"""Сжатие существующих медиафайлов в S3 без потери качества."""
import json
import os
import io
import boto3
import psycopg2
from PIL import Image

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
BUCKET = 'files'
IMAGE_MAX_DIMENSION = 2560
IMAGE_TARGET_SIZE = 2 * 1024 * 1024
JPEG_QUALITY_START = 90
JPEG_QUALITY_MIN = 78
JPEG_QUALITY_STEP = 4
PNG_OPTIMIZE = False

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def get_db():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    return conn


def compress_image_bytes(data: bytes, mime_type: str, file_name: str) -> tuple:
    img = Image.open(io.BytesIO(data))
    original_size = len(data)
    w, h = img.size

    needs_resize = w > IMAGE_MAX_DIMENSION or h > IMAGE_MAX_DIMENSION
    needs_compress = original_size > IMAGE_TARGET_SIZE

    if not needs_resize and not needs_compress:
        return data, original_size, False, w, h

    if needs_resize:
        ratio = min(IMAGE_MAX_DIMENSION / w, IMAGE_MAX_DIMENSION / h)
        new_w = int(w * ratio)
        new_h = int(h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        w, h = new_w, new_h

    if img.mode == 'RGBA' and mime_type != 'image/png':
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    elif img.mode not in ('RGB', 'RGBA', 'L'):
        img = img.convert('RGB')

    is_png = mime_type == 'image/png'
    has_alpha = False
    if img.mode == 'RGBA':
        alpha = img.getchannel('A')
        if alpha.getextrema()[0] < 250:
            has_alpha = True

    if is_png and has_alpha:
        buf = io.BytesIO()
        img.save(buf, format='PNG', optimize=PNG_OPTIMIZE)
        result = buf.getvalue()
        if len(result) < original_size:
            return result, len(result), True, w, h
        if needs_resize:
            return result, len(result), True, w, h
        return data, original_size, False, w, h

    if is_png and not has_alpha:
        if img.mode != 'RGB':
            img = img.convert('RGB')

    quality = JPEG_QUALITY_START
    best_data = None

    while quality >= JPEG_QUALITY_MIN:
        buf = io.BytesIO()
        save_img = img.convert('RGB') if img.mode == 'RGBA' else img
        save_img.save(buf, format='JPEG', quality=quality, optimize=True, subsampling=0)
        result = buf.getvalue()

        if best_data is None or len(result) < len(best_data):
            best_data = result

        if len(result) <= IMAGE_TARGET_SIZE:
            break

        quality -= JPEG_QUALITY_STEP

    if best_data and (len(best_data) < original_size or needs_resize):
        return best_data, len(best_data), True, w, h

    return data, original_size, False, w, h


def handler(event, context):
    """Сжимает изображения в S3 хранилище, обновляет размеры в БД."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'compress')

    if method == 'GET' and action == 'status':
        return get_status()

    if method == 'POST' and action == 'compress':
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        min_size = body.get('min_size', IMAGE_TARGET_SIZE)
        limit = body.get('limit', 1)
        dry_run = body.get('dry_run', False)
        return run_compression(min_size, limit, dry_run)

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({'actions': ['GET ?action=status', 'POST ?action=compress']})
    }


def get_status():
    conn = get_db()
    cur = conn.cursor()
    cur.execute(f"""
        SELECT COUNT(*), COALESCE(SUM(file_size), 0)
        FROM {SCHEMA}.media_files
        WHERE file_type = 'image' AND file_size > %s
    """, (IMAGE_TARGET_SIZE,))
    count, total = cur.fetchone()
    cur.close()
    conn.close()
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'oversized_count': int(count),
            'oversized_total_mb': round(float(total) / 1024 / 1024, 2),
            'target_size_mb': round(IMAGE_TARGET_SIZE / 1024 / 1024, 2),
        })
    }


def run_compression(min_size, limit, dry_run):
    conn = get_db()
    cur = conn.cursor()

    if dry_run:
        cur.execute(f"""
            SELECT id, file_name, mime_type, file_size, s3_key
            FROM {SCHEMA}.media_files
            WHERE file_type = 'image' AND file_size > %s
              AND mime_type NOT IN ('image/gif', 'image/svg+xml')
            ORDER BY file_size DESC
            LIMIT %s
        """, (min_size, limit))
        rows = cur.fetchall()
        results = []
        for row in rows:
            fid, fname, mtype, fsize, skey = row
            results.append({
                'id': fid,
                'name': fname,
                'size_mb': round(int(fsize) / 1024 / 1024, 2),
                'mime': mtype,
            })
        cur.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'processed': len(results), 'dry_run': True, 'results': results}, ensure_ascii=False)
        }

    s3 = get_s3()

    cur.execute(f"""
        SELECT id, file_name, mime_type, file_size, s3_key
        FROM {SCHEMA}.media_files
        WHERE file_type = 'image' AND file_size > %s
          AND mime_type NOT IN ('image/gif', 'image/svg+xml')
        ORDER BY file_size DESC
        LIMIT %s
    """, (min_size, limit))

    rows = cur.fetchall()
    results = []
    total_saved = 0

    for row in rows:
        file_id, file_name, mime_type, file_size_raw, s3_key = row
        file_size = int(file_size_raw)

        try:
            obj = s3.get_object(Bucket=BUCKET, Key=s3_key)
            data = obj['Body'].read()

            compressed, new_size, was_compressed, new_w, new_h = compress_image_bytes(
                data, mime_type, file_name
            )

            if not was_compressed:
                results.append({
                    'id': file_id,
                    'name': file_name,
                    'skipped': True,
                    'reason': 'no improvement',
                    'size_mb': round(file_size / 1024 / 1024, 2),
                })
                continue

            saved = file_size - new_size

            content_type = mime_type
            if mime_type != 'image/png' and not s3_key.endswith('.png'):
                content_type = 'image/jpeg'

            s3.put_object(
                Bucket=BUCKET,
                Key=s3_key,
                Body=compressed,
                ContentType=content_type,
            )

            cur.execute(f"""
                UPDATE {SCHEMA}.media_files
                SET file_size = %s, width = %s, height = %s
                WHERE id = %s
            """, (new_size, new_w, new_h, file_id))

            total_saved += saved
            results.append({
                'id': file_id,
                'name': file_name,
                'original_mb': round(file_size / 1024 / 1024, 2),
                'compressed_mb': round(new_size / 1024 / 1024, 2),
                'saved_mb': round(saved / 1024 / 1024, 2),
                'dimensions': f'{new_w}x{new_h}',
            })

        except BaseException as e:
            results.append({
                'id': file_id,
                'name': file_name,
                'error': str(e),
            })

    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'processed': len(results),
            'total_saved_mb': round(total_saved / 1024 / 1024, 2),
            'results': results,
        }, ensure_ascii=False)
    }