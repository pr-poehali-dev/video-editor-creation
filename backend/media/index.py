"""Загрузка и получение медиафайлов пользователя (обычная + chunked до 150 МБ)"""
import json
import os
import base64
import uuid
from datetime import datetime
import psycopg2
import boto3

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
}
MAX_FILE_SIZE = 150 * 1024 * 1024
CHUNK_SIZE = 2 * 1024 * 1024

ALLOWED_TYPES = {
    'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image',
    'image/bmp': 'image', 'image/x-ms-bmp': 'image', 'image/svg+xml': 'image', 'image/tiff': 'image',
    'audio/mpeg': 'audio', 'audio/wav': 'audio', 'audio/ogg': 'audio', 'audio/mp4': 'audio', 'audio/webm': 'audio',
    'audio/flac': 'audio', 'audio/aac': 'audio', 'audio/x-m4a': 'audio', 'audio/x-wav': 'audio',
    'audio/mp3': 'audio', 'audio/x-mp3': 'audio', 'audio/x-mpeg': 'audio', 'audio/wave': 'audio',
    'audio/x-aac': 'audio', 'audio/x-flac': 'audio', 'audio/vnd.wave': 'audio', 'audio/basic': 'audio',
    'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video', 'video/x-msvideo': 'video',
    'video/mpeg': 'video', 'video/3gpp': 'video', 'video/x-matroska': 'video', 'video/x-ms-wmv': 'video',
    'application/octet-stream': 'video',
}

def get_db():
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={schema}')

def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )

def get_user_by_token(conn, token):
    if not token:
        return None
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.email, u.name FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = %s AND s.expires_at > NOW() AND u.is_active = TRUE
    """, (token,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {'id': row[0], 'email': row[1], 'name': row[2]}

def ok(body, status=200):
    return {'statusCode': status, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps(body, default=str)}

def err(msg, status=400):
    return {'statusCode': status, 'headers': {**CORS, 'Content-Type': 'application/json'}, 'body': json.dumps({'error': msg})}

def handler(event, context):
    """Загрузка, получение и удаление медиафайлов пользователя"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    route = qs.get('route', '/')
    token = (event.get('headers') or {}).get('X-Auth-Token', '')

    conn = get_db()

    if route == '/proxy' and method == 'GET':
        proxy_token = qs.get('token', '') or token
        user = get_user_by_token(conn, proxy_token)
        if not user:
            conn.close()
            return err('Необходима авторизация', 401)
        result = handle_proxy(conn, user, qs)
        conn.close()
        return result

    user = get_user_by_token(conn, token)
    if not user:
        conn.close()
        return err('Необходима авторизация', 401)

    if route == '/presign' and method == 'GET':
        result = handle_presign(conn, user, qs)
        conn.close()
        return result

    if route == '/upload' and method == 'POST':
        result = handle_upload(conn, user, event)
        conn.close()
        return result

    if route == '/list' and method == 'GET':
        result = handle_list(conn, user, qs)
        conn.close()
        return result

    if route == '/delete' and method == 'POST':
        result = handle_delete(conn, user, event)
        conn.close()
        return result

    if route == '/chunked/init' and method == 'POST':
        result = handle_chunked_init(conn, user, event)
        conn.close()
        return result

    if route == '/chunked/part' and method == 'POST':
        result = handle_chunked_part(user, event)
        conn.close()
        return result

    if route == '/chunked/complete' and method == 'POST':
        result = handle_chunked_complete(conn, user, event)
        conn.close()
        return result

    conn.close()
    return err('Маршрут не найден', 404)


def handle_upload(conn, user, event):
    body_str = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        body_str = base64.b64decode(body_str).decode('utf-8')
    body = json.loads(body_str)

    file_data_b64 = body.get('file_data')
    file_name = body.get('file_name', 'file')
    mime_type = body.get('mime_type', 'application/octet-stream')
    duration = body.get('duration', 0)
    width = body.get('width')
    height = body.get('height')
    project_id = body.get('project_id')

    if not file_data_b64:
        return err('file_data обязателен')

    if mime_type not in ALLOWED_TYPES:
        return err(f'Тип файла {mime_type} не поддерживается')

    file_bytes = base64.b64decode(file_data_b64)
    if len(file_bytes) > MAX_FILE_SIZE:
        return err('Файл слишком большой (макс 150 МБ)')

    file_type = ALLOWED_TYPES[mime_type]
    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else 'bin'
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    s3_key = f"media/{user['id']}/{unique_name}"

    s3 = get_s3()
    s3.put_object(
        Bucket='files',
        Key=s3_key,
        Body=file_bytes,
        ContentType=mime_type,
    )

    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{s3_key}"

    cur = conn.cursor()
    cur.execute("""
        INSERT INTO media_files (user_id, project_id, file_name, file_type, mime_type, file_size, duration, width, height, s3_key, cdn_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, created_at
    """, (user['id'], project_id, file_name, file_type, mime_type, len(file_bytes), duration, width, height, s3_key, cdn_url))
    row = cur.fetchone()
    conn.commit()
    cur.close()

    return ok({
        'file': {
            'id': row[0],
            'file_name': file_name,
            'file_type': file_type,
            'mime_type': mime_type,
            'file_size': len(file_bytes),
            'duration': duration,
            'width': width,
            'height': height,
            'cdn_url': cdn_url,
            'created_at': str(row[1]),
        }
    })


def handle_chunked_init(conn, user, event):
    body_str = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        body_str = base64.b64decode(body_str).decode('utf-8')
    body = json.loads(body_str)

    file_name = body.get('file_name', 'file')
    mime_type = body.get('mime_type', 'application/octet-stream')
    file_size = body.get('file_size', 0)
    total_chunks = body.get('total_chunks', 1)

    if mime_type not in ALLOWED_TYPES:
        return err(f'Тип файла {mime_type} не поддерживается')
    if file_size > MAX_FILE_SIZE:
        return err(f'Файл слишком большой (макс {MAX_FILE_SIZE // (1024*1024)} МБ)')

    upload_id = uuid.uuid4().hex
    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else 'bin'
    s3_key = f"media/{user['id']}/{upload_id}.{ext}"

    cur = conn.cursor()
    cur.execute("""
        INSERT INTO chunked_uploads (upload_id, user_id, file_name, mime_type, file_size, total_chunks, s3_key)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (upload_id, user['id'], file_name, mime_type, file_size, total_chunks, s3_key))
    conn.commit()
    cur.close()

    return ok({'upload_id': upload_id, 'total_chunks': total_chunks})


def handle_chunked_part(user, event):
    body_str = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        body_str = base64.b64decode(body_str).decode('utf-8')
    body = json.loads(body_str)

    upload_id = body.get('upload_id')
    chunk_index = body.get('chunk_index', 0)
    chunk_data = body.get('chunk_data')

    if not upload_id or chunk_data is None:
        return err('upload_id и chunk_data обязательны')

    chunk_bytes = base64.b64decode(chunk_data)
    s3 = get_s3()
    chunk_key = f"chunks/{user['id']}/{upload_id}/part_{chunk_index:05d}"
    s3.put_object(Bucket='files', Key=chunk_key, Body=chunk_bytes)

    return ok({'chunk_index': chunk_index, 'size': len(chunk_bytes)})


def handle_chunked_complete(conn, user, event):
    body_str = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        body_str = base64.b64decode(body_str).decode('utf-8')
    body = json.loads(body_str)

    upload_id = body.get('upload_id')
    duration = body.get('duration', 0)
    width = body.get('width')
    height = body.get('height')
    project_id = body.get('project_id')

    if not upload_id:
        return err('upload_id обязателен')

    cur = conn.cursor()
    cur.execute("""
        SELECT file_name, mime_type, file_size, total_chunks, s3_key
        FROM chunked_uploads WHERE upload_id = %s AND user_id = %s
    """, (upload_id, user['id']))
    row = cur.fetchone()
    if not row:
        cur.close()
        return err('Загрузка не найдена', 404)

    file_name, mime_type, file_size, total_chunks, s3_key = row
    file_type = ALLOWED_TYPES.get(mime_type, 'video')

    s3 = get_s3()
    parts = []
    for i in range(total_chunks):
        chunk_key = f"chunks/{user['id']}/{upload_id}/part_{i:05d}"
        obj = s3.get_object(Bucket='files', Key=chunk_key)
        parts.append(obj['Body'].read())

    full_data = b''.join(parts)
    s3.put_object(Bucket='files', Key=s3_key, Body=full_data, ContentType=mime_type)

    for i in range(total_chunks):
        chunk_key = f"chunks/{user['id']}/{upload_id}/part_{i:05d}"
        s3.delete_object(Bucket='files', Key=chunk_key)

    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{s3_key}"

    cur.execute("""
        INSERT INTO media_files (user_id, project_id, file_name, file_type, mime_type, file_size, duration, width, height, s3_key, cdn_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, created_at
    """, (user['id'], project_id, file_name, file_type, mime_type, len(full_data), duration, width, height, s3_key, cdn_url))
    media_row = cur.fetchone()

    cur.execute("DELETE FROM chunked_uploads WHERE upload_id = %s", (upload_id,))
    conn.commit()
    cur.close()

    return ok({
        'file': {
            'id': media_row[0],
            'file_name': file_name,
            'file_type': file_type,
            'mime_type': mime_type,
            'file_size': len(full_data),
            'duration': duration,
            'width': width,
            'height': height,
            'cdn_url': cdn_url,
            'created_at': str(media_row[1]),
        }
    })


def handle_list(conn, user, qs):
    project_id = qs.get('project_id')
    cur = conn.cursor()
    if project_id:
        cur.execute("""
            SELECT id, file_name, file_type, mime_type, file_size, duration, width, height, cdn_url, created_at
            FROM media_files WHERE user_id = %s AND project_id = %s ORDER BY created_at DESC
        """, (user['id'], int(project_id)))
    else:
        cur.execute("""
            SELECT id, file_name, file_type, mime_type, file_size, duration, width, height, cdn_url, created_at
            FROM media_files WHERE user_id = %s ORDER BY created_at DESC
        """, (user['id'],))
    rows = cur.fetchall()
    cur.close()
    files = []
    for r in rows:
        files.append({
            'id': r[0], 'file_name': r[1], 'file_type': r[2], 'mime_type': r[3],
            'file_size': r[4], 'duration': r[5], 'width': r[6], 'height': r[7],
            'cdn_url': r[8], 'created_at': str(r[9]),
        })
    return ok({'files': files})


def handle_delete(conn, user, event):
    body = json.loads(event.get('body', '{}'))
    file_id = body.get('id')
    if not file_id:
        return err('id обязателен')

    cur = conn.cursor()
    cur.execute("SELECT s3_key FROM media_files WHERE id = %s AND user_id = %s", (file_id, user['id']))
    row = cur.fetchone()
    if not row:
        cur.close()
        return err('Файл не найден', 404)

    s3_key = row[0]
    s3 = get_s3()
    s3.delete_object(Bucket='files', Key=s3_key)

    cur.execute("UPDATE media_files SET s3_key = 'deleted', cdn_url = '' WHERE id = %s", (file_id,))
    conn.commit()
    cur.close()
    return ok({'deleted': True})


def handle_presign(conn, user, qs):
    file_id = qs.get('id')
    if not file_id:
        return err('id обязателен')

    cur = conn.cursor()
    cur.execute("SELECT s3_key, mime_type, file_size FROM media_files WHERE id = %s AND user_id = %s AND s3_key != 'deleted'", (int(file_id), user['id']))
    row = cur.fetchone()
    cur.close()
    if not row:
        return err('Файл не найден', 404)

    s3_key, mime_type, file_size = row
    s3 = get_s3()

    presigned_url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': 'files', 'Key': s3_key},
        ExpiresIn=3600,
    )

    return ok({'url': presigned_url, 'mime_type': mime_type, 'size': file_size})


def handle_proxy(conn, user, qs):
    file_id = qs.get('id')
    if not file_id:
        return err('id обязателен')

    try:
        fid = int(file_id)
    except (ValueError, TypeError):
        return err('Неверный id')

    cur = conn.cursor()
    cur.execute("SELECT s3_key, mime_type, file_size FROM media_files WHERE id = %s AND user_id = %s AND s3_key != 'deleted'", (fid, user['id']))
    row = cur.fetchone()
    cur.close()
    if not row:
        return err('Файл не найден', 404)

    s3_key, mime_type, file_size = row

    try:
        s3 = get_s3()

        if qs.get('info') == '1':
            return ok({'size': file_size or 0, 'mime_type': mime_type})

        range_start = qs.get('start')
        range_end = qs.get('end')

        MAX_PROXY_SIZE = 100 * 1024

        if range_start is not None and range_end is not None:
            start = int(range_start)
            end = int(range_end)
            chunk_size = end - start + 1
            if chunk_size > MAX_PROXY_SIZE:
                end = start + MAX_PROXY_SIZE - 1
            s3_params = {'Bucket': 'files', 'Key': s3_key, 'Range': f'bytes={start}-{end}'}
        else:
            if file_size and file_size > MAX_PROXY_SIZE:
                return err(f'Файл слишком большой для прямого прокси ({file_size} bytes). Используйте chunked загрузку с параметрами start/end', 413)
            s3_params = {'Bucket': 'files', 'Key': s3_key}

        obj = s3.get_object(**s3_params)
        data = obj['Body'].read()
        b64_data = base64.b64encode(data).decode('utf-8')

        return ok({'data': b64_data, 'mime_type': mime_type, 'size': len(data)})
    except Exception as e:
        return err(f'Ошибка при загрузке файла: {str(e)}', 500)