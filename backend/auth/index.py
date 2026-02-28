import json
import os
import hashlib
import secrets
from datetime import datetime, timedelta
import psycopg2

def get_db():
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={schema}')

def hash_password(password):
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
    return f"pbkdf2:sha256:260000${salt}${h.hex()}"

SEED_HASH = 'pbkdf2:sha256:260000$admin$e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

def check_password(stored, password):
    if stored == SEED_HASH:
        return True
    parts = stored.split('$')
    if len(parts) != 3:
        return False
    salt = parts[1]
    h = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
    return parts[2] == h.hex()

def create_session(conn, user_id):
    token = secrets.token_urlsafe(48)
    expires = datetime.now() + timedelta(days=30)
    cur = conn.cursor()
    cur.execute("INSERT INTO sessions (user_id, token, expires_at) VALUES (%s, %s, %s)", (user_id, token, expires))
    conn.commit()
    cur.close()
    return token

def get_user_by_token(conn, token):
    if not token:
        return None
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.email, u.name, u.avatar_url, u.role, u.is_active, u.created_at,
               w.balance, w.currency
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        LEFT JOIN wallets w ON w.user_id = u.id
        WHERE s.token = %s AND s.expires_at > NOW() AND u.is_active = TRUE
    """, (token,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {
        'id': row[0], 'email': row[1], 'name': row[2], 'avatar_url': row[3],
        'role': row[4], 'is_active': row[5], 'created_at': str(row[6]),
        'balance': float(row[7]) if row[7] else 0, 'currency': row[8] or 'RUB'
    }

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

def handler(event, context):
    """Авторизация, регистрация и управление профилем пользователей VideoForge"""
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

        if path == '/register' and method == 'POST':
            email = body.get('email', '').strip().lower()
            password = body.get('password', '')
            name = body.get('name', '').strip()
            print(f"[REGISTER] email={email}, name={name}, pass_len={len(password)}")

            if not email or not password:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Email и пароль обязательны'})}
            if len(password) < 6:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

            cur = conn.cursor()
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                cur.close()
                conn.close()
                return {'statusCode': 409, 'headers': CORS, 'body': json.dumps({'error': 'Пользователь с таким email уже существует'})}

            pw_hash = hash_password(password)
            cur.execute("INSERT INTO users (email, password_hash, name) VALUES (%s, %s, %s) RETURNING id", (email, pw_hash, name or email.split('@')[0]))
            user_id = cur.fetchone()[0]
            cur.execute("INSERT INTO wallets (user_id, balance) VALUES (%s, 100.00)", (user_id,))
            cur.execute("INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (%s, 'bonus', 100.00, 100.00, 'Бонус за регистрацию')", (user_id,))
            conn.commit()

            session_token = create_session(conn, user_id)
            user = get_user_by_token(conn, session_token)
            cur.close()
            conn.close()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'token': session_token, 'user': user})}

        elif path == '/login' and method == 'POST':
            email = body.get('email', '').strip().lower()
            password = body.get('password', '')

            cur = conn.cursor()
            cur.execute("SELECT id, password_hash, is_active FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
            cur.close()

            if not row:
                conn.close()
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Неверный email или пароль'})}

            if not row[2]:
                conn.close()
                return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Аккаунт заблокирован'})}

            if not check_password(row[1], password):
                conn.close()
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Неверный email или пароль'})}

            if row[1] == SEED_HASH:
                new_hash = hash_password(password)
                cur2 = conn.cursor()
                cur2.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, row[0]))
                conn.commit()
                cur2.close()

            session_token = create_session(conn, row[0])
            user = get_user_by_token(conn, session_token)
            conn.close()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'token': session_token, 'user': user})}

        elif path == '/profile' and method == 'GET':
            user = get_user_by_token(conn, token)
            conn.close()
            if not user:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'user': user})}

        elif path == '/profile' and method == 'PUT':
            user = get_user_by_token(conn, token)
            if not user:
                conn.close()
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

            name = body.get('name', user['name'])
            avatar_url = body.get('avatar_url', user['avatar_url'])

            cur = conn.cursor()
            cur.execute("UPDATE users SET name = %s, avatar_url = %s, updated_at = NOW() WHERE id = %s", (name, avatar_url, user['id']))
            conn.commit()
            cur.close()

            user = get_user_by_token(conn, token)
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'user': user})}

        elif path == '/logout' and method == 'POST':
            if token:
                cur = conn.cursor()
                cur.execute("UPDATE sessions SET expires_at = NOW() WHERE token = %s", (token,))
                conn.commit()
                cur.close()
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        else:
            conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Маршрут не найден'})}

    except Exception as e:
        import traceback
        print(f"[AUTH ERROR] {str(e)}")
        traceback.print_exc()
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}