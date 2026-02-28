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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

def handler(event, context):
    """CRUD операции для видео-проектов пользователя"""
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

        if path == '/list' and method == 'GET':
            cur = conn.cursor()
            cur.execute("""
                SELECT id, name, description, thumbnail_url, is_public, created_at, updated_at
                FROM projects WHERE user_id = %s ORDER BY updated_at DESC
            """, (user['id'],))
            rows = cur.fetchall()
            cur.close()
            conn.close()

            items = [{
                'id': r[0], 'name': r[1], 'description': r[2],
                'thumbnail_url': r[3], 'is_public': r[4],
                'created_at': str(r[5]), 'updated_at': str(r[6])
            } for r in rows]

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'projects': items})}

        elif path == '/create' and method == 'POST':
            name = body.get('name', 'Новый проект')
            description = body.get('description', '')
            project_data = body.get('project_data', {})

            cur = conn.cursor()
            cur.execute("""
                INSERT INTO projects (user_id, name, description, project_data)
                VALUES (%s, %s, %s, %s) RETURNING id, created_at
            """, (user['id'], name, description, json.dumps(project_data)))
            row = cur.fetchone()
            conn.commit()
            cur.close()
            conn.close()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'id': row[0], 'name': name, 'created_at': str(row[1]), 'message': 'Проект создан'
            })}

        elif path == '/get' and method == 'GET':
            params = event.get('queryStringParameters') or {}
            project_id = params.get('id')
            if not project_id:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'id обязателен'})}

            cur = conn.cursor()
            cur.execute("""
                SELECT id, name, description, thumbnail_url, project_data, is_public, created_at, updated_at
                FROM projects WHERE id = %s AND user_id = %s
            """, (project_id, user['id']))
            row = cur.fetchone()
            cur.close()
            conn.close()

            if not row:
                return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Проект не найден'})}

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'id': row[0], 'name': row[1], 'description': row[2],
                'thumbnail_url': row[3], 'project_data': row[4],
                'is_public': row[5], 'created_at': str(row[6]), 'updated_at': str(row[7])
            })}

        elif path == '/save' and method == 'PUT':
            project_id = body.get('id')
            if not project_id:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'id обязателен'})}

            cur = conn.cursor()
            updates = []
            values = []

            if 'name' in body:
                updates.append("name = %s")
                values.append(body['name'])
            if 'description' in body:
                updates.append("description = %s")
                values.append(body['description'])
            if 'project_data' in body:
                updates.append("project_data = %s")
                values.append(json.dumps(body['project_data']))
            if 'thumbnail_url' in body:
                updates.append("thumbnail_url = %s")
                values.append(body['thumbnail_url'])
            if 'is_public' in body:
                updates.append("is_public = %s")
                values.append(body['is_public'])

            if updates:
                updates.append("updated_at = NOW()")
                values.extend([project_id, user['id']])
                cur.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = %s AND user_id = %s", values)
                conn.commit()

            cur.close()
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'message': 'Проект сохранён'})}

        elif path == '/delete' and method == 'POST':
            project_id = body.get('id')
            if not project_id:
                conn.close()
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'id обязателен'})}

            cur = conn.cursor()
            cur.execute("UPDATE projects SET is_public = FALSE, name = name || ' [удалён]' WHERE id = %s AND user_id = %s", (project_id, user['id']))
            conn.commit()
            cur.close()
            conn.close()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'message': 'Проект удалён'})}

        else:
            conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Маршрут не найден'})}

    except Exception as e:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': str(e)})}