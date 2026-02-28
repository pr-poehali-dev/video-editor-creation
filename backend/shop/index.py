import json
import os
import psycopg2
from datetime import datetime

def get_db():
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={schema}')

def get_user_by_token(conn, token):
    if not token:
        return None
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.role FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.token = %s AND s.expires_at > NOW() AND u.is_active = TRUE
    """, (token,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {'id': row[0], 'role': row[1]}

def validate_promo(conn, code, user_id, item_category=None, item_price=0):
    cur = conn.cursor()
    cur.execute("""
        SELECT id, discount_type, discount_value, min_purchase, max_uses, used_count, applies_to, item_ids, is_active, expires_at
        FROM promo_codes WHERE code = %s
    """, (code.upper().strip(),))
    row = cur.fetchone()
    cur.close()
    if not row:
        return None, 'Промокод не найден'
    promo = {
        'id': row[0], 'discount_type': row[1], 'discount_value': float(row[2]),
        'min_purchase': float(row[3]), 'max_uses': row[4], 'used_count': row[5],
        'applies_to': row[6], 'item_ids': row[7] or '', 'is_active': row[8], 'expires_at': row[9]
    }
    if not promo['is_active']:
        return None, 'Промокод неактивен'
    if promo['expires_at'] and promo['expires_at'].replace(tzinfo=None) < datetime.now():
        return None, 'Срок действия промокода истёк'
    if promo['max_uses'] and promo['used_count'] >= promo['max_uses']:
        return None, 'Промокод исчерпан'
    if item_price < promo['min_purchase']:
        return None, f"Минимальная сумма покупки: {promo['min_purchase']:.0f} ₽"
    if promo['applies_to'] != 'all' and item_category and promo['applies_to'] != item_category:
        return None, f"Промокод действует только для категории: {promo['applies_to']}"

    cur2 = conn.cursor()
    cur2.execute("SELECT id FROM promo_usages WHERE promo_id = %s AND user_id = %s", (promo['id'], user_id))
    if cur2.fetchone():
        cur2.close()
        return None, 'Вы уже использовали этот промокод'
    cur2.close()

    if promo['discount_type'] == 'percent':
        discount = round(item_price * promo['discount_value'] / 100, 2)
    else:
        discount = min(promo['discount_value'], item_price)

    return {**promo, 'discount': discount}, None

def apply_promo(conn, promo_id, user_id):
    cur = conn.cursor()
    cur.execute("INSERT INTO promo_usages (promo_id, user_id) VALUES (%s, %s)", (promo_id, user_id))
    cur.execute("UPDATE promo_codes SET used_count = used_count + 1 WHERE id = %s", (promo_id,))
    cur.close()

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

def handler(event, context):
    """Магазин эффектов, расширений и дополнений VideoForge с поддержкой промокодов"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    path = params.get('route', event.get('path', '/'))
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except:
            pass

    headers = event.get('headers', {})
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token') or ''

    try:
        conn = get_db()

        if path == '/catalog' and method == 'GET':
            params = event.get('queryStringParameters') or {}
            category = params.get('category', '')

            cur = conn.cursor()
            if category:
                cur.execute("""
                    SELECT id, slug, name, description, category, price, icon, preview_url, features, is_active
                    FROM shop_items WHERE is_active = TRUE AND category = %s
                    ORDER BY sort_order, id
                """, (category,))
            else:
                cur.execute("""
                    SELECT id, slug, name, description, category, price, icon, preview_url, features, is_active
                    FROM shop_items WHERE is_active = TRUE
                    ORDER BY sort_order, id
                """)
            rows = cur.fetchall()
            cur.close()

            user_purchases = []
            user = get_user_by_token(conn, token)
            if user:
                cur2 = conn.cursor()
                cur2.execute("SELECT item_id FROM purchases WHERE user_id = %s AND item_type = 'shop'", (user['id'],))
                user_purchases = [r[0] for r in cur2.fetchall()]
                cur2.close()

            conn.close()

            items = [{
                'id': r[0], 'slug': r[1], 'name': r[2], 'description': r[3],
                'category': r[4], 'price': float(r[5]), 'icon': r[6],
                'preview_url': r[7], 'features': r[8] if r[8] else [],
                'owned': r[1] in user_purchases
            } for r in rows]

            categories = list(set(i['category'] for i in items))

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'items': items, 'categories': categories})}

        elif path == '/check-promo' and method == 'POST':
            user = get_user_by_token(conn, token)
            if not user:
                conn.close()
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

            code = body.get('code', '')
            item_slug = body.get('slug', '')
            if not code:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Введите промокод'})}

            item_price = 0
            item_category = None
            if item_slug:
                cur = conn.cursor()
                cur.execute("SELECT price, category FROM shop_items WHERE slug = %s AND is_active = TRUE", (item_slug,))
                irow = cur.fetchone()
                cur.close()
                if irow:
                    item_price = float(irow[0])
                    item_category = irow[1]

            promo, err = validate_promo(conn, code, user['id'], item_category, item_price)
            conn.close()

            if err:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': err})}

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'valid': True,
                'code': code.upper().strip(),
                'discount_type': promo['discount_type'],
                'discount_value': promo['discount_value'],
                'discount': promo['discount'],
                'final_price': max(0, item_price - promo['discount']),
                'original_price': item_price
            })}

        elif path == '/buy' and method == 'POST':
            user = get_user_by_token(conn, token)
            if not user:
                conn.close()
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

            item_slug = body.get('slug', '')
            promo_code = body.get('promo_code', '')
            if not item_slug:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'slug обязателен'})}

            cur = conn.cursor()

            cur.execute("SELECT id, slug, name, price, category FROM shop_items WHERE slug = %s AND is_active = TRUE", (item_slug,))
            item = cur.fetchone()
            if not item:
                cur.close()
                conn.close()
                return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Товар не найден'})}

            cur.execute("SELECT id FROM purchases WHERE user_id = %s AND item_id = %s AND item_type = 'shop'", (user['id'], item_slug))
            if cur.fetchone():
                cur.close()
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Вы уже приобрели этот товар'})}

            price = float(item[3])
            discount = 0
            promo = None

            if promo_code:
                promo, err = validate_promo(conn, promo_code, user['id'], item[4], price)
                if err:
                    cur.close()
                    conn.close()
                    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': f'Промокод: {err}'})}
                discount = promo['discount']

            final_price = max(0, price - discount)

            cur.execute("SELECT balance FROM wallets WHERE user_id = %s", (user['id'],))
            wallet_row = cur.fetchone()
            balance = float(wallet_row[0]) if wallet_row else 0

            if balance < final_price:
                cur.close()
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({
                    'error': 'Недостаточно средств',
                    'balance': balance,
                    'price': final_price,
                    'need': final_price - balance
                })}

            cur.execute("UPDATE wallets SET balance = balance - %s, updated_at = NOW() WHERE user_id = %s RETURNING balance", (final_price, user['id']))
            new_balance = float(cur.fetchone()[0])

            desc = 'Покупка: ' + item[2]
            if discount > 0:
                desc += f' (скидка {discount:.0f} ₽ по промокоду {promo_code.upper()})'

            cur.execute("INSERT INTO purchases (user_id, item_type, item_id, item_name, price) VALUES (%s, 'shop', %s, %s, %s)",
                       (user['id'], item_slug, item[2], final_price))

            cur.execute("INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (%s, 'purchase', %s, %s, %s)",
                       (user['id'], -final_price, new_balance, desc))

            if promo:
                apply_promo(conn, promo['id'], user['id'])

            conn.commit()
            cur.close()
            conn.close()

            result = {
                'ok': True,
                'message': 'Покупка совершена!',
                'item_name': item[2],
                'balance': new_balance,
                'original_price': price,
                'final_price': final_price,
            }
            if discount > 0:
                result['discount'] = discount
                result['promo_code'] = promo_code.upper()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(result)}

        elif path == '/my-items' and method == 'GET':
            user = get_user_by_token(conn, token)
            if not user:
                conn.close()
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

            cur = conn.cursor()
            cur.execute("""
                SELECT s.id, s.slug, s.name, s.description, s.category, s.price, s.icon, s.features, p.created_at
                FROM purchases p 
                JOIN shop_items s ON p.item_id = s.slug
                WHERE p.user_id = %s AND p.item_type = 'shop'
                ORDER BY p.created_at DESC
            """, (user['id'],))
            rows = cur.fetchall()
            cur.close()
            conn.close()

            items = [{
                'id': r[0], 'slug': r[1], 'name': r[2], 'description': r[3],
                'category': r[4], 'price': float(r[5]), 'icon': r[6],
                'features': r[7] if r[7] else [],
                'purchased_at': str(r[8])
            } for r in rows]

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'items': items})}

        elif path == '/promos' and method == 'GET':
            user = get_user_by_token(conn, token)
            if not user or user['role'] != 'admin':
                conn.close()
                return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}

            cur = conn.cursor()
            cur.execute("""
                SELECT id, code, discount_type, discount_value, min_purchase, max_uses, used_count, applies_to, is_active, expires_at, created_at
                FROM promo_codes ORDER BY id DESC
            """)
            rows = cur.fetchall()
            cur.close()
            conn.close()

            promos = [{
                'id': r[0], 'code': r[1], 'discount_type': r[2], 'discount_value': float(r[3]),
                'min_purchase': float(r[4]), 'max_uses': r[5], 'used_count': r[6],
                'applies_to': r[7], 'is_active': r[8], 'expires_at': str(r[9]) if r[9] else None,
                'created_at': str(r[10])
            } for r in rows]

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'promos': promos})}

        elif path == '/promos' and method == 'POST':
            user = get_user_by_token(conn, token)
            if not user or user['role'] != 'admin':
                conn.close()
                return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}

            code = body.get('code', '').upper().strip()
            discount_type = body.get('discount_type', 'fixed')
            discount_value = float(body.get('discount_value', 0))
            max_uses = body.get('max_uses')
            applies_to = body.get('applies_to', 'all')
            expires_at = body.get('expires_at')

            if not code or discount_value <= 0:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Код и скидка обязательны'})}

            cur = conn.cursor()
            cur.execute("""
                INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, applies_to, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (code, discount_type, discount_value, max_uses, applies_to, expires_at))
            promo_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            conn.close()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'id': promo_id, 'code': code})}

        elif path == '/promos/toggle' and method == 'POST':
            user = get_user_by_token(conn, token)
            if not user or user['role'] != 'admin':
                conn.close()
                return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}

            promo_id = body.get('id')
            cur = conn.cursor()
            cur.execute("UPDATE promo_codes SET is_active = NOT is_active WHERE id = %s RETURNING is_active", (promo_id,))
            row = cur.fetchone()
            conn.commit()
            cur.close()
            conn.close()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'is_active': row[0] if row else False})}

        elif path == '/promos/delete' and method == 'POST':
            user = get_user_by_token(conn, token)
            if not user or user['role'] != 'admin':
                conn.close()
                return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}

            promo_id = body.get('id')
            if not promo_id:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'id обязателен'})}

            cur = conn.cursor()
            cur.execute("DELETE FROM promo_usages WHERE promo_id = %s", (promo_id,))
            cur.execute("DELETE FROM promo_codes WHERE id = %s", (promo_id,))
            conn.commit()
            cur.close()
            conn.close()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        elif path == '/promos/update' and method == 'POST':
            user = get_user_by_token(conn, token)
            if not user or user['role'] != 'admin':
                conn.close()
                return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}

            promo_id = body.get('id')
            if not promo_id:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'id обязателен'})}

            fields = []
            values = []
            for key in ['code', 'discount_type', 'discount_value', 'max_uses', 'applies_to', 'expires_at', 'min_purchase']:
                if key in body:
                    val = body[key]
                    if key == 'code':
                        val = val.upper().strip()
                    fields.append(f"{key} = %s")
                    values.append(val)

            if not fields:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нет полей для обновления'})}

            values.append(promo_id)
            cur = conn.cursor()
            cur.execute(f"UPDATE promo_codes SET {', '.join(fields)} WHERE id = %s", tuple(values))
            conn.commit()
            cur.close()
            conn.close()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        else:
            conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Маршрут не найден'})}

    except Exception as e:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}