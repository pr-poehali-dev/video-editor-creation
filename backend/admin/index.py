import json
import os
import psycopg2

def get_db():
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={schema}')

def get_admin_by_token(conn, token):
    if not token:
        return None
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.role FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.token = %s AND s.expires_at > NOW() AND u.is_active = TRUE AND u.role = 'admin'
    """, (token,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {'id': row[0], 'role': row[1]}

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

def handler(event, context):
    """Админ-панель: управление пользователями, статистика, транзакции"""
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
        admin = get_admin_by_token(conn, token)

        if not admin:
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Доступ запрещён'})}

        if path == '/stats' and method == 'GET':
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM users")
            total_users = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days'")
            new_users = cur.fetchone()[0]
            cur.execute("SELECT COALESCE(SUM(balance), 0) FROM wallets")
            total_balance = float(cur.fetchone()[0])
            cur.execute("SELECT COUNT(*) FROM projects")
            total_projects = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM purchases")
            total_purchases = cur.fetchone()[0]
            cur.execute("SELECT COALESCE(SUM(price), 0) FROM purchases")
            revenue = float(cur.fetchone()[0])
            cur.execute("SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours'")
            transactions_today = cur.fetchone()[0]
            cur.close()
            conn.close()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'total_users': total_users,
                'new_users_week': new_users,
                'total_balance': total_balance,
                'total_projects': total_projects,
                'total_purchases': total_purchases,
                'revenue': revenue,
                'transactions_today': transactions_today
            })}

        elif path == '/users' and method == 'GET':
            params = event.get('queryStringParameters') or {}
            limit = min(int(params.get('limit', 20)), 100)
            offset = int(params.get('offset', 0))
            search = params.get('search', '')

            cur = conn.cursor()
            if search:
                cur.execute("""
                    SELECT u.id, u.email, u.name, u.role, u.is_active, u.created_at, COALESCE(w.balance, 0),
                           (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id)
                    FROM users u LEFT JOIN wallets w ON w.user_id = u.id
                    WHERE u.email ILIKE %s OR u.name ILIKE %s
                    ORDER BY u.created_at DESC LIMIT %s OFFSET %s
                """, (f'%{search}%', f'%{search}%', limit, offset))
            else:
                cur.execute("""
                    SELECT u.id, u.email, u.name, u.role, u.is_active, u.created_at, COALESCE(w.balance, 0),
                           (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id)
                    FROM users u LEFT JOIN wallets w ON w.user_id = u.id
                    ORDER BY u.created_at DESC LIMIT %s OFFSET %s
                """, (limit, offset))
            rows = cur.fetchall()

            cur.execute("SELECT COUNT(*) FROM users")
            total = cur.fetchone()[0]
            cur.close()
            conn.close()

            users = [{
                'id': r[0], 'email': r[1], 'name': r[2], 'role': r[3],
                'is_active': r[4], 'created_at': str(r[5]),
                'balance': float(r[6]), 'projects_count': r[7]
            } for r in rows]

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'users': users, 'total': total})}

        elif path == '/users/update' and method == 'PUT':
            user_id = body.get('user_id')
            if not user_id:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'user_id обязателен'})}

            cur = conn.cursor()
            updates = []
            values = []

            if 'role' in body:
                updates.append("role = %s")
                values.append(body['role'])
            if 'is_active' in body:
                updates.append("is_active = %s")
                values.append(body['is_active'])
            if 'name' in body:
                updates.append("name = %s")
                values.append(body['name'])

            if updates:
                updates.append("updated_at = NOW()")
                values.append(user_id)
                cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", values)
                conn.commit()

            cur.close()
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        elif path == '/users/adjust-balance' and method == 'POST':
            user_id = body.get('user_id')
            amount = float(body.get('amount', 0))
            reason = body.get('reason', 'Корректировка админом')

            if not user_id or amount == 0:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'user_id и amount обязательны'})}

            cur = conn.cursor()
            cur.execute("UPDATE wallets SET balance = balance + %s, updated_at = NOW() WHERE user_id = %s RETURNING balance", (amount, user_id))
            row = cur.fetchone()
            if not row:
                cur.close()
                conn.close()
                return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Кошелёк не найден'})}

            new_balance = float(row[0])
            t_type = 'admin_credit' if amount > 0 else 'admin_debit'
            cur.execute("INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (%s, %s, %s, %s, %s)", (user_id, t_type, amount, new_balance, reason))
            conn.commit()
            cur.close()
            conn.close()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'balance': new_balance, 'message': 'Баланс обновлён'})}

        elif path == '/transactions' and method == 'GET':
            params = event.get('queryStringParameters') or {}
            limit = min(int(params.get('limit', 50)), 200)
            offset = int(params.get('offset', 0))

            cur = conn.cursor()
            cur.execute("""
                SELECT t.id, t.user_id, u.email, u.name, t.type, t.amount, t.balance_after, t.description, t.created_at
                FROM transactions t JOIN users u ON t.user_id = u.id
                ORDER BY t.created_at DESC LIMIT %s OFFSET %s
            """, (limit, offset))
            rows = cur.fetchall()
            cur.close()
            conn.close()

            items = [{
                'id': r[0], 'user_id': r[1], 'email': r[2], 'user_name': r[3],
                'type': r[4], 'amount': float(r[5]), 'balance_after': float(r[6]),
                'description': r[7], 'created_at': str(r[8])
            } for r in rows]

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'items': items})}

        else:
            conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Маршрут не найден'})}

    except Exception as e:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}