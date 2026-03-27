"""Распознавание речи из аудиофайла с пословными таймкодами (OpenAI Whisper)"""
import json
import os
import base64
import urllib.request
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
}


def get_db():
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={schema}')


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


def transcribe_audio(audio_bytes, file_name='audio.mp3'):
    """Send audio to OpenAI Whisper API and get word-level timestamps"""
    api_key = os.environ.get('OPENAI_API_KEY', '')
    if not api_key:
        raise ValueError('OPENAI_API_KEY not configured')

    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    
    body_parts = []
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1'.encode())
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json'.encode())
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nword'.encode())
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode() + audio_bytes)
    body_parts.append(f'--{boundary}--\r\n'.encode())
    
    body = b'\r\n'.join(body_parts)
    
    req = urllib.request.Request(
        'https://api.openai.com/v1/audio/transcriptions',
        data=body,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': f'multipart/form-data; boundary={boundary}',
        },
        method='POST',
    )
    
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read().decode())
    
    return result


def handler(event, context):
    """Распознавание речи из аудиофайла с пословными таймкодами"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}

    headers = event.get('headers', {})
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token', '')

    conn = get_db()
    try:
        user = get_user_by_token(conn, token)
        if not user:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Unauthorized'})}
    finally:
        conn.close()

    body = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        body = base64.b64decode(body).decode()
    data = json.loads(body)

    audio_url = data.get('audio_url', '')
    audio_b64 = data.get('audio_data', '')
    file_name = data.get('file_name', 'audio.mp3')

    if not audio_url and not audio_b64:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'audio_url or audio_data required'})}

    if audio_b64:
        if ',' in audio_b64:
            audio_b64 = audio_b64.split(',', 1)[1]
        audio_bytes = base64.b64decode(audio_b64)
    else:
        req = urllib.request.Request(audio_url)
        with urllib.request.urlopen(req, timeout=60) as resp:
            audio_bytes = resp.read()

    max_size = 25 * 1024 * 1024
    if len(audio_bytes) > max_size:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Audio file too large. Max 25MB for transcription.'})}

    result = transcribe_audio(audio_bytes, file_name)

    words = []
    if 'words' in result:
        for w in result['words']:
            words.append({
                'word': w.get('word', ''),
                'start': round(w.get('start', 0), 3),
                'end': round(w.get('end', 0), 3),
            })

    segments = []
    if 'segments' in result:
        for seg in result['segments']:
            segments.append({
                'text': seg.get('text', ''),
                'start': round(seg.get('start', 0), 3),
                'end': round(seg.get('end', 0), 3),
            })

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({
            'text': result.get('text', ''),
            'language': result.get('language', ''),
            'duration': result.get('duration', 0),
            'words': words,
            'segments': segments,
        }),
    }