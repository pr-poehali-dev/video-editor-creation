import json
import os
import psycopg2

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

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

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

def handler(event, context):
    """Магазин эффектов, расширений и дополнений VideoForge"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
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

        elif path == '/buy' and method == 'POST':
            user = get_user_by_token(conn, token)
            if not user:
                conn.close()
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

            item_slug = body.get('slug', '')
            if not item_slug:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'slug обязателен'})}

            cur = conn.cursor()

            cur.execute("SELECT id, slug, name, price FROM shop_items WHERE slug = %s AND is_active = TRUE", (item_slug,))
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
            cur.execute("SELECT balance FROM wallets WHERE user_id = %s", (user['id'],))
            wallet_row = cur.fetchone()
            balance = float(wallet_row[0]) if wallet_row else 0

            if balance < price:
                cur.close()
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({
                    'error': 'Недостаточно средств',
                    'balance': balance,
                    'price': price,
                    'need': price - balance
                })}

            cur.execute("UPDATE wallets SET balance = balance - %s, updated_at = NOW() WHERE user_id = %s RETURNING balance", (price, user['id']))
            new_balance = float(cur.fetchone()[0])

            cur.execute("INSERT INTO purchases (user_id, item_type, item_id, item_name, price) VALUES (%s, 'shop', %s, %s, %s)",
                       (user['id'], item_slug, item[2], price))

            cur.execute("INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (%s, 'purchase', %s, %s, %s)",
                       (user['id'], -price, new_balance, 'Покупка: ' + item[2]))

            conn.commit()
            cur.close()
            conn.close()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'ok': True,
                'message': 'Покупка совершена!',
                'item_name': item[2],
                'balance': new_balance
            })}

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

        else:
            conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Маршрут не найден'})}

    except Exception as e:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}
