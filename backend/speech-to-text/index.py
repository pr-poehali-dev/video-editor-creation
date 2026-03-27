"""Распознавание речи из аудиофайла с пословными таймкодами (AssemblyAI)"""
import json
import os
import base64
import time
import urllib.request
import urllib.error
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
}

AAI_BASE = 'https://api.assemblyai.com/v2'


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


def aai_request(path, method='GET', body=None, api_key=''):
    url = f'{AAI_BASE}{path}'
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        'Authorization': api_key,
        'Content-Type': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else ''
        print(f'[AAI ERROR] {e.code} {path}: {error_body}')
        raise


def aai_upload(audio_bytes, api_key):
    req = urllib.request.Request(
        f'{AAI_BASE}/upload',
        data=audio_bytes,
        method='POST',
        headers={
            'Authorization': api_key,
            'Content-Type': 'application/octet-stream',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode())
        return result['upload_url']
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else ''
        print(f'[AAI UPLOAD ERROR] {e.code}: {error_body}')
        raise


def download_audio(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def transcribe_audio(audio_bytes=None, audio_url=None, api_key=''):
    if not audio_bytes and audio_url:
        print(f'[INFO] Downloading audio from URL: {audio_url[:100]}')
        audio_bytes = download_audio(audio_url)
        print(f'[INFO] Downloaded {len(audio_bytes)} bytes')

    if not audio_bytes:
        raise ValueError('No audio data provided')

    print(f'[INFO] Uploading {len(audio_bytes)} bytes to AssemblyAI')
    upload_url = aai_upload(audio_bytes, api_key)
    print(f'[INFO] Upload done, URL: {upload_url[:80]}')

    transcript = aai_request('/transcript', method='POST', body={
        'audio_url': upload_url,
        'language_detection': True,
        'speech_model': 'universal-2',
    }, api_key=api_key)

    transcript_id = transcript['id']
    print(f'[INFO] Transcript created: {transcript_id}')

    for _ in range(120):
        result = aai_request(f'/transcript/{transcript_id}', api_key=api_key)
        status = result.get('status')
        if status == 'completed':
            print(f'[INFO] Transcription completed')
            return result
        if status == 'error':
            raise ValueError(result.get('error', 'Transcription failed'))
        time.sleep(2)

    raise ValueError('Transcription timed out')


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

    api_key = os.environ.get('ASSEMBLYAI_API_KEY', '')
    if not api_key:
        return {'statusCode': 500, 'headers': CORS, 'body': json.dumps({'error': 'ASSEMBLYAI_API_KEY not configured'})}

    body = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        body = base64.b64decode(body).decode()
    data = json.loads(body)

    audio_url = data.get('audio_url', '')
    audio_b64 = data.get('audio_data', '')

    if not audio_url and not audio_b64:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'audio_url or audio_data required'})}

    audio_bytes = None
    if audio_b64:
        if ',' in audio_b64:
            audio_b64 = audio_b64.split(',', 1)[1]
        audio_bytes = base64.b64decode(audio_b64)
        max_size = 100 * 1024 * 1024
        if len(audio_bytes) > max_size:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Audio file too large. Max 100MB.'})}

    result = transcribe_audio(
        audio_bytes=audio_bytes,
        audio_url=audio_url if not audio_bytes else None,
        api_key=api_key,
    )

    words = []
    for w in (result.get('words') or []):
        words.append({
            'word': w.get('text', ''),
            'start': round(w.get('start', 0) / 1000, 3),
            'end': round(w.get('end', 0) / 1000, 3),
        })

    segments = []
    current_seg_words = []
    for w in words:
        current_seg_words.append(w)
        word_text = w['word']
        if (len(current_seg_words) >= 8 or
                word_text.endswith('.') or word_text.endswith('?') or
                word_text.endswith('!') or word_text.endswith(',')):
            segments.append({
                'text': ' '.join(sw['word'] for sw in current_seg_words),
                'start': current_seg_words[0]['start'],
                'end': current_seg_words[-1]['end'],
            })
            current_seg_words = []
    if current_seg_words:
        segments.append({
            'text': ' '.join(sw['word'] for sw in current_seg_words),
            'start': current_seg_words[0]['start'],
            'end': current_seg_words[-1]['end'],
        })

    full_text = result.get('text', '')
    language = result.get('language_code', '')
    duration = round(result.get('audio_duration', 0), 3)

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({
            'text': full_text,
            'language': language,
            'duration': duration,
            'words': words,
            'segments': segments,
        }),
    }