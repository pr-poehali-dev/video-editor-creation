import json
import os
import psycopg2

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

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

def handler(event, context):
    """Кошелёк, транзакции и покупки пользователя"""
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
        user = get_user_by_token(conn, token)

        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        if path == '/balance' and method == 'GET':
            cur = conn.cursor()
            cur.execute("SELECT balance, currency FROM wallets WHERE user_id = %s", (user['id'],))
            row = cur.fetchone()
            cur.close()
            conn.close()
            if not row:
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'balance': 0, 'currency': 'RUB'})}
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'balance': float(row[0]), 'currency': row[1]})}

        elif path == '/topup' and method == 'POST':
            amount = float(body.get('amount', 0))
            if amount <= 0 or amount > 100000:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Сумма от 1 до 100000'})}

            cur = conn.cursor()
            cur.execute("UPDATE wallets SET balance = balance + %s, updated_at = NOW() WHERE user_id = %s RETURNING balance", (amount, user['id']))
            new_balance = float(cur.fetchone()[0])
            cur.execute("INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (%s, 'topup', %s, %s, 'Пополнение кошелька')", (user['id'], amount, new_balance))
            conn.commit()
            cur.close()
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'balance': new_balance, 'message': 'Баланс пополнен'})}

        elif path == '/purchase' and method == 'POST':
            item_type = body.get('item_type', '')
            item_id = body.get('item_id', '')
            item_name = body.get('item_name', '')
            price = float(body.get('price', 0))

            if not item_type or not item_id or price <= 0:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверные данные покупки'})}

            cur = conn.cursor()
            cur.execute("SELECT balance FROM wallets WHERE user_id = %s", (user['id'],))
            balance = float(cur.fetchone()[0])

            if balance < price:
                cur.close()
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Недостаточно средств', 'balance': balance, 'price': price})}

            cur.execute("UPDATE wallets SET balance = balance - %s, updated_at = NOW() WHERE user_id = %s RETURNING balance", (price, user['id']))
            new_balance = float(cur.fetchone()[0])
            cur.execute("INSERT INTO purchases (user_id, item_type, item_id, item_name, price) VALUES (%s, %s, %s, %s, %s)", (user['id'], item_type, item_id, item_name, price))
            cur.execute("INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (%s, 'purchase', %s, %s, %s)", (user['id'], -price, new_balance, 'Покупка: ' + item_name))
            conn.commit()
            cur.close()
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'balance': new_balance, 'message': 'Покупка совершена'})}

        elif path == '/transactions' and method == 'GET':
            params = event.get('queryStringParameters') or {}
            limit = min(int(params.get('limit', 20)), 100)
            offset = int(params.get('offset', 0))

            cur = conn.cursor()
            cur.execute("SELECT id, type, amount, balance_after, description, status, created_at FROM transactions WHERE user_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s", (user['id'], limit, offset))
            rows = cur.fetchall()
            cur.execute("SELECT COUNT(*) FROM transactions WHERE user_id = %s", (user['id'],))
            total = cur.fetchone()[0]
            cur.close()
            conn.close()

            items = [{'id': r[0], 'type': r[1], 'amount': float(r[2]), 'balance_after': float(r[3]), 'description': r[4], 'status': r[5], 'created_at': str(r[6])} for r in rows]
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'items': items, 'total': total})}

        elif path == '/purchases' and method == 'GET':
            cur = conn.cursor()
            cur.execute("SELECT id, item_type, item_id, item_name, price, status, created_at FROM purchases WHERE user_id = %s ORDER BY created_at DESC", (user['id'],))
            rows = cur.fetchall()
            cur.close()
            conn.close()

            items = [{'id': r[0], 'item_type': r[1], 'item_id': r[2], 'item_name': r[3], 'price': float(r[4]), 'status': r[5], 'created_at': str(r[6])} for r in rows]
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'items': items})}

        else:
            conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Маршрут не найден'})}

    except Exception as e:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}