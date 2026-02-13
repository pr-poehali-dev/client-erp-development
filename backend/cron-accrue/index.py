import json
import os
import psycopg2
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event, context):
    """Ежедневное начисление процентов на остаток по всем активным вкладам. Вызывается по расписанию в 00:05."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}

    body = {}
    if event.get('body'):
        body = json.loads(event['body'])

    conn = get_conn()
    cur = conn.cursor()

    try:
        accrual_date = body.get('date', date.today().isoformat())

        cur.execute("SELECT id, current_balance, rate, start_date FROM savings WHERE status='active'")
        savings_rows = cur.fetchall()
        count = 0
        total = Decimal('0')
        skipped = 0

        for row in savings_rows:
            s_id, s_bal, s_rate, s_start = row[0], Decimal(str(row[1])), Decimal(str(row[2])), str(row[3])
            if s_bal <= 0:
                skipped += 1
                continue
            if accrual_date <= s_start:
                skipped += 1
                continue
            daily_amount = (s_bal * s_rate / Decimal('100') / Decimal('365')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if daily_amount <= 0:
                skipped += 1
                continue
            cur.execute("SELECT id FROM savings_daily_accruals WHERE saving_id=%s AND accrual_date='%s'" % (s_id, accrual_date))
            if cur.fetchone():
                skipped += 1
                continue
            cur.execute("INSERT INTO savings_daily_accruals (saving_id, accrual_date, balance, rate, daily_amount) VALUES (%s, '%s', %s, %s, %s)" % (s_id, accrual_date, float(s_bal), float(s_rate), float(daily_amount)))
            cur.execute("UPDATE savings SET accrued_interest=accrued_interest+%s, updated_at=NOW() WHERE id=%s" % (float(daily_amount), s_id))
            count += 1
            total += daily_amount

        if count > 0:
            conn.commit()

        result = {
            'success': True,
            'date': accrual_date,
            'processed': count,
            'skipped': skipped,
            'total_accrued': float(total)
        }
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps(result)}

    except Exception as e:
        conn.rollback()
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}
    finally:
        cur.close()
        conn.close()