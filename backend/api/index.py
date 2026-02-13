import json
import os
import psycopg2
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import calendar
import base64
import hashlib
import secrets
from io import BytesIO

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def last_day_of_month(d):
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])

def add_months(d, months):
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)

def serialize(val):
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    return val

def query_rows(cur, sql):
    cur.execute(sql)
    cols = [d[0] for d in cur.description]
    return [{cols[i]: serialize(r[i]) for i in range(len(cols))} for r in cur.fetchall()]

def query_one(cur, sql):
    cur.execute(sql)
    if cur.rowcount == 0:
        return None
    cols = [d[0] for d in cur.description]
    row = cur.fetchone()
    return {cols[i]: serialize(row[i]) for i in range(len(cols))}

def calc_annuity_schedule(amount, rate, term, start_date):
    monthly_rate = Decimal(str(rate)) / Decimal('100') / Decimal('12')
    amt = Decimal(str(amount))
    if monthly_rate > 0:
        annuity = amt * monthly_rate * (1 + monthly_rate) ** term / ((1 + monthly_rate) ** term - 1)
    else:
        annuity = amt / term
    annuity = annuity.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    schedule = []
    balance = amt
    for i in range(1, term + 1):
        payment_date = last_day_of_month(add_months(start_date, i))
        days_in_month = calendar.monthrange(payment_date.year, payment_date.month)[1]
        interest = (balance * Decimal(str(rate)) / Decimal('100') * Decimal(str(days_in_month)) / Decimal('360')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if i == term:
            principal = balance
            payment = principal + interest
        else:
            principal = annuity - interest
            if principal < 0:
                principal = Decimal('0')
            payment = annuity
        balance = balance - principal
        if balance < 0:
            balance = Decimal('0')
        schedule.append({
            'payment_no': i, 'payment_date': payment_date.isoformat(),
            'payment_amount': float(payment), 'principal_amount': float(principal),
            'interest_amount': float(interest), 'balance_after': float(balance),
        })
    return schedule, float(annuity)

def calc_end_of_term_schedule(amount, rate, term, start_date):
    amt = Decimal(str(amount))
    schedule = []
    balance = amt
    for i in range(1, term + 1):
        payment_date = last_day_of_month(add_months(start_date, i))
        days_in_month = calendar.monthrange(payment_date.year, payment_date.month)[1]
        interest = (balance * Decimal(str(rate)) / Decimal('100') * Decimal(str(days_in_month)) / Decimal('360')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if i == term:
            principal = balance
            payment = principal + interest
            balance = Decimal('0')
        else:
            principal = Decimal('0')
            payment = interest
        schedule.append({
            'payment_no': i, 'payment_date': payment_date.isoformat(),
            'payment_amount': float(payment), 'principal_amount': float(principal),
            'interest_amount': float(interest), 'balance_after': float(balance),
        })
    return schedule, float(schedule[0]['payment_amount']) if schedule else 0

def calc_savings_schedule(amount, rate, term, start_date, payout_type):
    amt = Decimal(str(amount))
    schedule = []
    cumulative = Decimal('0')
    for i in range(1, term + 1):
        period_start = last_day_of_month(add_months(start_date, i - 1)) if i > 1 else start_date
        period_end = last_day_of_month(add_months(start_date, i))
        days_in_month = calendar.monthrange(period_end.year, period_end.month)[1]
        interest = (amt * Decimal(str(rate)) / Decimal('100') * Decimal(str(days_in_month)) / Decimal('360')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        cumulative += interest
        balance_after = float(amt + cumulative) if payout_type == 'end_of_term' else float(amt)
        schedule.append({
            'period_no': i, 'period_start': period_start.isoformat(),
            'period_end': period_end.isoformat(), 'interest_amount': float(interest),
            'cumulative_interest': float(cumulative), 'balance_after': balance_after,
        })
    return schedule

def esc(val):
    return str(val).replace("'", "''") if val else ''

def audit_log(cur, staff, action, entity, entity_id=None, entity_label='', details='', ip=''):
    uid = staff.get('user_id') if staff else None
    uname = esc(staff.get('name', '')) if staff else ''
    urole = staff.get('role', '') if staff else ''
    cur.execute("INSERT INTO audit_log (user_id, user_name, user_role, action, entity, entity_id, entity_label, details, ip) VALUES (%s, '%s', '%s', '%s', '%s', %s, '%s', '%s', '%s')" % (
        uid or 'NULL', uname, urole, esc(action), esc(entity),
        entity_id or 'NULL', esc(entity_label), esc(details), esc(ip)
    ))

def handle_members(method, params, body, cur, conn, staff=None, ip=''):
    if method == 'GET':
        member_id = params.get('id')
        if member_id:
            return query_one(cur, "SELECT * FROM members WHERE id = %s" % member_id)
        return query_rows(cur, """
            SELECT m.id, m.member_no, m.member_type,
                   CASE WHEN m.member_type = 'FL' THEN CONCAT(m.last_name, ' ', m.first_name, ' ', m.middle_name)
                        ELSE m.company_name END as name,
                   m.inn, m.phone, m.email, m.status, m.created_at,
                   (SELECT COUNT(*) FROM loans l WHERE l.member_id = m.id AND l.status != 'closed') as active_loans,
                   (SELECT COUNT(*) FROM savings s WHERE s.member_id = m.id AND s.status = 'active') as active_savings
            FROM members m WHERE m.status != 'deleted' ORDER BY m.created_at DESC
        """)

    elif method == 'POST':
        mt = body.get('member_type', 'FL')
        cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM members")
        next_id = cur.fetchone()[0]
        member_no = 'П-%06d' % next_id

        if mt == 'FL':
            cur.execute("""
                INSERT INTO members (member_no, member_type, last_name, first_name, middle_name,
                    birth_date, birth_place, inn, passport_series, passport_number,
                    passport_dept_code, passport_issue_date, passport_issued_by,
                    registration_address, phone, email, telegram, bank_bik, bank_account,
                    marital_status, spouse_fio, spouse_phone, extra_phone, extra_contact_fio)
                VALUES ('%s', 'FL', '%s', '%s', '%s', %s, '%s', '%s', '%s', '%s', '%s', %s, '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
                RETURNING id, member_no
            """ % (
                member_no, esc(body.get('last_name')), esc(body.get('first_name')), esc(body.get('middle_name')),
                ("'%s'" % body['birth_date']) if body.get('birth_date') else 'NULL',
                esc(body.get('birth_place')), esc(body.get('inn')),
                esc(body.get('passport_series')), esc(body.get('passport_number')),
                esc(body.get('passport_dept_code')),
                ("'%s'" % body['passport_issue_date']) if body.get('passport_issue_date') else 'NULL',
                esc(body.get('passport_issued_by')), esc(body.get('registration_address')),
                esc(body.get('phone')), esc(body.get('email')), esc(body.get('telegram')),
                esc(body.get('bank_bik')), esc(body.get('bank_account')),
                esc(body.get('marital_status')), esc(body.get('spouse_fio')),
                esc(body.get('spouse_phone')), esc(body.get('extra_phone')), esc(body.get('extra_contact_fio')),
            ))
        else:
            cur.execute("""
                INSERT INTO members (member_no, member_type, inn, company_name, director_fio,
                    director_phone, contact_person_fio, contact_person_phone, bank_bik, bank_account)
                VALUES ('%s', 'UL', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
                RETURNING id, member_no
            """ % (
                member_no, esc(body.get('inn')), esc(body.get('company_name')),
                esc(body.get('director_fio')), esc(body.get('director_phone')),
                esc(body.get('contact_person_fio')), esc(body.get('contact_person_phone')),
                esc(body.get('bank_bik')), esc(body.get('bank_account')),
            ))
        result = cur.fetchone()
        label = body.get('last_name', body.get('company_name', ''))
        audit_log(cur, staff, 'create', 'member', result[0], '%s %s' % (result[1], label), '', ip)
        conn.commit()
        return {'id': result[0], 'member_no': result[1]}

    elif method == 'PUT':
        member_id = body.get('id')
        updates = []
        for f in ['last_name','first_name','middle_name','birth_place','inn','passport_series','passport_number',
                   'passport_dept_code','passport_issued_by','registration_address','phone','email','telegram',
                   'bank_bik','bank_account','marital_status','spouse_fio','spouse_phone','extra_phone',
                   'extra_contact_fio','company_name','director_fio','director_phone','contact_person_fio',
                   'contact_person_phone','status']:
            if f in body:
                updates.append("%s = '%s'" % (f, esc(body[f])))
        for f in ['birth_date','passport_issue_date']:
            if f in body and body[f]:
                updates.append("%s = '%s'" % (f, body[f]))
        if updates:
            updates.append("updated_at = NOW()")
            cur.execute("UPDATE members SET %s WHERE id = %s" % (', '.join(updates), member_id))
            changed = [f for f in body if f not in ('id', 'entity')]
            audit_log(cur, staff, 'update', 'member', member_id, '', ', '.join(changed), ip)
            conn.commit()
        return {'success': True}

def handle_loans(method, params, body, cur, conn, staff=None, ip=''):
    if method == 'GET':
        action = params.get('action', 'list')
        if action == 'detail':
            loan = query_one(cur, "SELECT * FROM loans WHERE id = %s" % params['id'])
            if not loan:
                return None
            cur.execute("SELECT CASE WHEN m.member_type='FL' THEN CONCAT(m.last_name,' ',m.first_name,' ',m.middle_name) ELSE m.company_name END FROM members m WHERE m.id=%s" % loan['member_id'])
            nr = cur.fetchone()
            loan['member_name'] = nr[0] if nr else ''
            loan['schedule'] = query_rows(cur, "SELECT * FROM loan_schedule WHERE loan_id=%s ORDER BY payment_no" % params['id'])
            loan['payments'] = query_rows(cur, "SELECT * FROM loan_payments WHERE loan_id=%s ORDER BY payment_date" % params['id'])
            return loan
        elif action == 'schedule':
            a, r, t = float(params['amount']), float(params['rate']), int(params['term'])
            st = params.get('schedule_type', 'annuity')
            sd = date.fromisoformat(params.get('start_date', date.today().isoformat()))
            fn = calc_annuity_schedule if st == 'annuity' else calc_end_of_term_schedule
            schedule, monthly = fn(a, r, t, sd)
            return {'schedule': schedule, 'monthly_payment': monthly}
        else:
            return query_rows(cur, """
                SELECT l.id, l.contract_no, l.amount, l.rate, l.term_months, l.schedule_type,
                       l.start_date, l.end_date, l.monthly_payment, l.balance, l.status,
                       CASE WHEN m.member_type='FL' THEN CONCAT(m.last_name,' ',m.first_name,' ',m.middle_name)
                            ELSE m.company_name END as member_name, m.id as member_id
                FROM loans l JOIN members m ON m.id=l.member_id ORDER BY l.created_at DESC
            """)

    elif method == 'POST':
        action = body.get('action', 'create')
        if action == 'create':
            cn = body['contract_no']
            mid = int(body['member_id'])
            a, r, t = float(body['amount']), float(body['rate']), int(body['term_months'])
            st = body.get('schedule_type', 'annuity')
            sd = date.fromisoformat(body.get('start_date', date.today().isoformat()))
            ed = last_day_of_month(add_months(sd, t))
            fn = calc_annuity_schedule if st == 'annuity' else calc_end_of_term_schedule
            schedule, monthly = fn(a, r, t, sd)

            cur.execute("""
                INSERT INTO loans (contract_no, member_id, amount, rate, term_months, schedule_type,
                    start_date, end_date, monthly_payment, balance, status)
                VALUES ('%s', %s, %s, %s, %s, '%s', '%s', '%s', %s, %s, 'active') RETURNING id
            """ % (esc(cn), mid, a, r, t, st, sd.isoformat(), ed.isoformat(), monthly, a))
            lid = cur.fetchone()[0]
            for item in schedule:
                cur.execute("""
                    INSERT INTO loan_schedule (loan_id, payment_no, payment_date, payment_amount,
                        principal_amount, interest_amount, balance_after)
                    VALUES (%s, %s, '%s', %s, %s, %s, %s)
                """ % (lid, item['payment_no'], item['payment_date'], item['payment_amount'],
                       item['principal_amount'], item['interest_amount'], item['balance_after']))
            audit_log(cur, staff, 'create', 'loan', lid, cn, 'Сумма: %s, ставка: %s%%, срок: %s мес.' % (a, r, t), ip)
            conn.commit()
            return {'id': lid, 'schedule': schedule, 'monthly_payment': monthly}

        elif action == 'payment':
            lid = int(body['loan_id'])
            pd = body['payment_date']
            amt = Decimal(str(body['amount']))

            cur.execute("SELECT balance FROM loans WHERE id = %s" % lid)
            loan_bal = Decimal(str(cur.fetchone()[0]))

            cur.execute("""
                SELECT id, principal_amount, interest_amount, penalty_amount, paid_amount
                FROM loan_schedule WHERE loan_id=%s AND status IN ('pending','partial','overdue')
                ORDER BY payment_no
            """ % lid)
            schedule_rows = cur.fetchall()
            remaining = amt
            pp = ip = pnp = Decimal('0')

            for sr in schedule_rows:
                if remaining <= 0:
                    break
                sid, sp, si, spn, spa = sr[0], Decimal(str(sr[1])), Decimal(str(sr[2])), Decimal(str(sr[3])), Decimal(str(sr[4]))
                owed_p = sp - Decimal(str(spa)) if spa < sp else Decimal('0')
                owed_total = sp + si + spn - Decimal(str(spa))
                if owed_total <= 0:
                    continue

                row_pp = row_ip = row_pnp = Decimal('0')
                if remaining >= si:
                    row_ip = si; remaining -= si
                else:
                    row_ip = remaining; remaining = Decimal('0')
                if remaining >= spn:
                    row_pnp = spn; remaining -= spn
                else:
                    row_pnp = remaining; remaining = Decimal('0')
                if remaining >= owed_p:
                    row_pp = owed_p; remaining -= owed_p
                else:
                    row_pp = remaining; remaining = Decimal('0')

                pp += row_pp
                ip += row_ip
                pnp += row_pnp

                new_paid = Decimal(str(spa)) + row_pp + row_ip + row_pnp
                ns = 'paid' if new_paid >= sp + si + spn else 'partial'
                cur.execute("UPDATE loan_schedule SET paid_amount=%s, paid_date='%s', status='%s' WHERE id=%s" % (float(new_paid), pd, ns, sid))

            if remaining > 0:
                extra_principal = min(remaining, loan_bal - pp)
                if extra_principal > 0:
                    pp += extra_principal
                    remaining -= extra_principal

            cur.execute("""
                INSERT INTO loan_payments (loan_id, payment_date, amount, principal_part, interest_part, penalty_part, payment_type)
                VALUES (%s, '%s', %s, %s, %s, %s, 'regular')
            """ % (lid, pd, float(amt), float(pp), float(ip), float(pnp)))

            nb = loan_bal - pp
            if nb < 0: nb = Decimal('0')
            cur.execute("UPDATE loans SET balance=%s, updated_at=NOW() WHERE id=%s" % (float(nb), lid))
            if nb == 0:
                cur.execute("UPDATE loans SET status='closed', updated_at=NOW() WHERE id=%s" % lid)

            recalc_schedule = None
            if nb > 0 and pp > ip + pnp:
                scheduled_principal = sum(
                    float(sr[1]) - float(sr[4]) for sr in schedule_rows
                    if Decimal(str(sr[1])) + Decimal(str(sr[2])) + Decimal(str(sr[3])) - Decimal(str(sr[4])) > 0
                )
                if pp > Decimal(str(scheduled_principal)) * Decimal('0.01'):
                    cur.execute("SELECT rate, schedule_type FROM loans WHERE id=%s" % lid)
                    lr = cur.fetchone()
                    l_rate, l_stype = float(lr[0]), lr[1]

                    cur.execute("SELECT COUNT(*) FROM loan_schedule WHERE loan_id=%s AND status='pending'" % lid)
                    remaining_periods = cur.fetchone()[0]

                    if remaining_periods > 0:
                        cur.execute("DELETE FROM loan_schedule WHERE loan_id=%s AND status='pending'" % lid)
                        fn = calc_annuity_schedule if l_stype == 'annuity' else calc_end_of_term_schedule
                        new_sched, new_monthly = fn(float(nb), l_rate, remaining_periods, date.fromisoformat(pd))
                        for item in new_sched:
                            cur.execute("INSERT INTO loan_schedule (loan_id,payment_no,payment_date,payment_amount,principal_amount,interest_amount,balance_after) VALUES (%s,%s,'%s',%s,%s,%s,%s)" % (lid, item['payment_no'], item['payment_date'], item['payment_amount'], item['principal_amount'], item['interest_amount'], item['balance_after']))
                        ne = date.fromisoformat(new_sched[-1]['payment_date'])
                        cur.execute("UPDATE loans SET monthly_payment=%s, end_date='%s', updated_at=NOW() WHERE id=%s" % (new_monthly, ne.isoformat(), lid))
                        recalc_schedule = new_sched

            detail = 'Сумма: %s, ОД: %s, %%: %s' % (float(amt), float(pp), float(ip))
            if recalc_schedule:
                detail += ', график пересчитан'
            audit_log(cur, staff, 'payment', 'loan', lid, '', detail, ip)
            conn.commit()
            result = {'success': True, 'new_balance': float(nb), 'principal_part': float(pp), 'interest_part': float(ip), 'penalty_part': float(pnp)}
            if recalc_schedule:
                result['schedule_recalculated'] = True
                result['new_monthly'] = new_monthly
            return result

        elif action == 'early_repayment':
            lid = int(body['loan_id'])
            amt = float(body['amount'])
            rt = body.get('repayment_type', 'reduce_term')
            pd = body.get('payment_date', date.today().isoformat())

            cur.execute("SELECT amount, rate, balance, term_months, start_date, schedule_type FROM loans WHERE id=%s" % lid)
            lr = cur.fetchone()
            cb, r, st = float(lr[2]), float(lr[1]), lr[5]
            nb = cb - amt

            if nb <= 0:
                cur.execute("UPDATE loans SET balance=0, status='closed', updated_at=NOW() WHERE id=%s" % lid)
                cur.execute("UPDATE loan_schedule SET status='paid' WHERE loan_id=%s AND status='pending'" % lid)
                cur.execute("INSERT INTO loan_payments (loan_id, payment_date, amount, principal_part, payment_type) VALUES (%s,'%s',%s,%s,'early_full')" % (lid, pd, amt, cb))
                audit_log(cur, staff, 'early_repayment', 'loan', lid, '', 'Полное досрочное погашение: %s' % amt, ip)
                conn.commit()
                return {'success': True, 'new_balance': 0, 'status': 'closed'}

            cur.execute("UPDATE loan_schedule SET status='paid' WHERE loan_id=%s AND status='pending'" % lid)
            cur.execute("SELECT COUNT(*) FROM loan_schedule WHERE loan_id=%s AND status='paid'" % lid)
            paid_count = cur.fetchone()[0]

            if rt == 'reduce_payment':
                nt = int(lr[3]) - paid_count
            else:
                mp = float(lr[2]) if lr[2] else 0
                nt = max(int(nb / max(mp / 2, 1)), 1)

            fn = calc_annuity_schedule if st == 'annuity' else calc_end_of_term_schedule
            ns, nm = fn(nb, r, max(nt, 1), date.fromisoformat(pd))
            for item in ns:
                cur.execute("INSERT INTO loan_schedule (loan_id,payment_no,payment_date,payment_amount,principal_amount,interest_amount,balance_after) VALUES (%s,%s,'%s',%s,%s,%s,%s)" % (lid, item['payment_no'], item['payment_date'], item['payment_amount'], item['principal_amount'], item['interest_amount'], item['balance_after']))

            ne = date.fromisoformat(ns[-1]['payment_date'])
            cur.execute("UPDATE loans SET balance=%s, monthly_payment=%s, end_date='%s', term_months=%s, updated_at=NOW() WHERE id=%s" % (nb, nm, ne.isoformat(), nt, lid))
            cur.execute("INSERT INTO loan_payments (loan_id,payment_date,amount,principal_part,payment_type) VALUES (%s,'%s',%s,%s,'early_partial')" % (lid, pd, amt, amt))
            audit_log(cur, staff, 'early_repayment', 'loan', lid, '', 'Частичное: %s, тип: %s' % (amt, rt), ip)
            conn.commit()
            return {'success': True, 'new_balance': nb, 'new_schedule': ns, 'new_monthly': nm}

        elif action == 'update_payment':
            pid = int(body['payment_id'])
            cur.execute("SELECT loan_id, amount, principal_part, interest_part, penalty_part, payment_date FROM loan_payments WHERE id=%s" % pid)
            old = cur.fetchone()
            if not old:
                return {'error': 'Платёж не найден'}
            lid = old[0]
            old_principal = Decimal(str(old[2]))
            new_date = body.get('payment_date', str(old[5]))
            new_amount = Decimal(str(body.get('amount', float(old[1]))))
            new_pp = Decimal(str(body.get('principal_part', float(old[2]))))
            new_ip = Decimal(str(body.get('interest_part', float(old[3]))))
            new_pnp = Decimal(str(body.get('penalty_part', float(old[4]))))
            cur.execute("UPDATE loan_payments SET payment_date='%s', amount=%s, principal_part=%s, interest_part=%s, penalty_part=%s WHERE id=%s" % (
                new_date, float(new_amount), float(new_pp), float(new_ip), float(new_pnp), pid))
            delta_principal = new_pp - old_principal
            if delta_principal != 0:
                cur.execute("UPDATE loans SET balance=balance-%s, updated_at=NOW() WHERE id=%s" % (float(delta_principal), lid))
                cur.execute("SELECT balance FROM loans WHERE id=%s" % lid)
                nb = Decimal(str(cur.fetchone()[0]))
                if nb <= 0:
                    cur.execute("UPDATE loans SET balance=0, status='closed', updated_at=NOW() WHERE id=%s" % lid)
                elif nb > 0:
                    cur.execute("UPDATE loans SET status='active', updated_at=NOW() WHERE id=%s" % lid)
            audit_log(cur, staff, 'update_payment', 'loan', lid, '', 'Платёж #%s: сумма %s, ОД %s, %%: %s' % (pid, float(new_amount), float(new_pp), float(new_ip)), ip)
            conn.commit()
            return {'success': True}

        elif action == 'delete_payment':
            pid = int(body['payment_id'])
            cur.execute("SELECT loan_id, principal_part FROM loan_payments WHERE id=%s" % pid)
            old = cur.fetchone()
            if not old:
                return {'error': 'Платёж не найден'}
            lid, old_pp = old[0], Decimal(str(old[1]))
            cur.execute("DELETE FROM loan_payments WHERE id=%s" % pid)
            if old_pp > 0:
                cur.execute("UPDATE loans SET balance=balance+%s, status='active', updated_at=NOW() WHERE id=%s" % (float(old_pp), lid))
            audit_log(cur, staff, 'delete_payment', 'loan', lid, '', 'Удалён платёж #%s (ОД: %s)' % (pid, float(old_pp)), ip)
            conn.commit()
            return {'success': True}

        elif action == 'modify':
            lid = int(body['loan_id'])
            cur.execute("SELECT balance, rate, term_months, start_date, schedule_type FROM loans WHERE id=%s" % lid)
            lr = cur.fetchone()
            bal = float(lr[0])
            r = float(body['new_rate']) if body.get('new_rate') else float(lr[1])
            t = int(body['new_term']) if body.get('new_term') else int(lr[2])
            st = lr[4]

            cur.execute("UPDATE loan_schedule SET status='paid' WHERE loan_id=%s AND status='pending'" % lid)
            fn = calc_annuity_schedule if st == 'annuity' else calc_end_of_term_schedule
            ns, m = fn(bal, r, t, date.today())
            for item in ns:
                cur.execute("INSERT INTO loan_schedule (loan_id,payment_no,payment_date,payment_amount,principal_amount,interest_amount,balance_after) VALUES (%s,%s,'%s',%s,%s,%s,%s)" % (lid, item['payment_no'], item['payment_date'], item['payment_amount'], item['principal_amount'], item['interest_amount'], item['balance_after']))
            ne = date.fromisoformat(ns[-1]['payment_date'])
            cur.execute("UPDATE loans SET rate=%s, term_months=%s, monthly_payment=%s, end_date='%s', updated_at=NOW() WHERE id=%s" % (r, t, m, ne.isoformat(), lid))
            audit_log(cur, staff, 'modify', 'loan', lid, '', 'Ставка: %s%%, срок: %s мес.' % (r, t), ip)
            conn.commit()
            return {'success': True, 'new_schedule': ns, 'monthly_payment': m}

def handle_savings(method, params, body, cur, conn, staff=None, ip=''):
    if method == 'GET':
        action = params.get('action', 'list')
        if action == 'detail':
            s = query_one(cur, "SELECT * FROM savings WHERE id=%s" % params['id'])
            if not s: return None
            cur.execute("SELECT CASE WHEN m.member_type='FL' THEN CONCAT(m.last_name,' ',m.first_name,' ',m.middle_name) ELSE m.company_name END FROM members m WHERE m.id=%s" % s['member_id'])
            nr = cur.fetchone()
            s['member_name'] = nr[0] if nr else ''
            s['schedule'] = query_rows(cur, "SELECT * FROM savings_schedule WHERE saving_id=%s ORDER BY period_no" % params['id'])
            s['transactions'] = query_rows(cur, "SELECT * FROM savings_transactions WHERE saving_id=%s ORDER BY transaction_date" % params['id'])
            return s
        elif action == 'schedule':
            a, r, t = float(params['amount']), float(params['rate']), int(params['term'])
            pt = params.get('payout_type', 'monthly')
            sd = date.fromisoformat(params.get('start_date', date.today().isoformat()))
            return {'schedule': calc_savings_schedule(a, r, t, sd, pt)}
        else:
            return query_rows(cur, """
                SELECT s.id, s.contract_no, s.amount, s.rate, s.term_months, s.payout_type,
                       s.start_date, s.end_date, s.accrued_interest, s.paid_interest, s.current_balance, s.status,
                       CASE WHEN m.member_type='FL' THEN CONCAT(m.last_name,' ',m.first_name,' ',m.middle_name)
                            ELSE m.company_name END as member_name, m.id as member_id
                FROM savings s JOIN members m ON m.id=s.member_id ORDER BY s.created_at DESC
            """)

    elif method == 'POST':
        action = body.get('action', 'create')
        if action == 'create':
            cn, mid = body['contract_no'], int(body['member_id'])
            a, r, t = float(body['amount']), float(body['rate']), int(body['term_months'])
            pt = body.get('payout_type', 'monthly')
            sd = date.fromisoformat(body.get('start_date', date.today().isoformat()))
            ed = last_day_of_month(add_months(sd, t))
            schedule = calc_savings_schedule(a, r, t, sd, pt)
            cur.execute("INSERT INTO savings (contract_no,member_id,amount,rate,term_months,payout_type,start_date,end_date,current_balance,status) VALUES ('%s',%s,%s,%s,%s,'%s','%s','%s',%s,'active') RETURNING id" % (esc(cn), mid, a, r, t, pt, sd.isoformat(), ed.isoformat(), a))
            sid = cur.fetchone()[0]
            for item in schedule:
                cur.execute("INSERT INTO savings_schedule (saving_id,period_no,period_start,period_end,interest_amount,cumulative_interest,balance_after) VALUES (%s,%s,'%s','%s',%s,%s,%s)" % (sid, item['period_no'], item['period_start'], item['period_end'], item['interest_amount'], item['cumulative_interest'], item['balance_after']))
            audit_log(cur, staff, 'create', 'saving', sid, cn, 'Сумма: %s, ставка: %s%%, срок: %s мес.' % (a, r, t), ip)
            conn.commit()
            return {'id': sid, 'schedule': schedule}

        elif action == 'transaction':
            sid = int(body['saving_id'])
            a = float(body['amount'])
            tt = body['transaction_type']
            td = body.get('transaction_date', date.today().isoformat())
            ic = body.get('is_cash', False)
            d = body.get('description', '')
            cur.execute("INSERT INTO savings_transactions (saving_id,transaction_date,amount,transaction_type,is_cash,description) VALUES (%s,'%s',%s,'%s',%s,'%s')" % (sid, td, a, tt, ic, esc(d)))
            if tt == 'deposit':
                cur.execute("UPDATE savings SET current_balance=current_balance+%s, amount=amount+%s, updated_at=NOW() WHERE id=%s" % (a, a, sid))
            elif tt == 'withdrawal':
                cur.execute("UPDATE savings SET current_balance=current_balance-%s, updated_at=NOW() WHERE id=%s" % (a, sid))
            elif tt == 'interest_payout':
                cur.execute("UPDATE savings SET paid_interest=paid_interest+%s, updated_at=NOW() WHERE id=%s" % (a, sid))
            tt_labels = {'deposit': 'Пополнение', 'withdrawal': 'Снятие', 'interest_payout': 'Выплата %'}
            audit_log(cur, staff, 'transaction', 'saving', sid, '', '%s: %s' % (tt_labels.get(tt, tt), a), ip)
            conn.commit()
            return {'success': True}

        elif action == 'early_close':
            sid = int(body['saving_id'])
            cur.execute("SELECT amount, accrued_interest, paid_interest, current_balance FROM savings WHERE id=%s" % sid)
            sv = cur.fetchone()
            oa, paid, bal = Decimal(str(sv[0])), Decimal(str(sv[2])), Decimal(str(sv[3]))
            ei = (oa * Decimal('0.001')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            overpaid = paid - ei
            fa = bal - overpaid if overpaid > 0 else bal
            cur.execute("UPDATE savings SET status='early_closed', current_balance=%s, accrued_interest=%s, updated_at=NOW() WHERE id=%s" % (float(fa), float(ei), sid))
            cur.execute("INSERT INTO savings_transactions (saving_id,transaction_date,amount,transaction_type,description) VALUES (%s,'%s',%s,'early_close','Досрочное закрытие')" % (sid, date.today().isoformat(), float(fa)))
            audit_log(cur, staff, 'early_close', 'saving', sid, '', 'Возврат: %s' % float(fa), ip)
            conn.commit()
            return {'success': True, 'final_amount': float(fa), 'early_interest': float(ei)}

def handle_shares(method, params, body, cur, conn, staff=None, ip=''):
    if method == 'GET':
        action = params.get('action', 'list')
        if action == 'detail':
            acc = query_one(cur, "SELECT * FROM share_accounts WHERE id=%s" % params['id'])
            if not acc: return None
            cur.execute("SELECT CASE WHEN m.member_type='FL' THEN CONCAT(m.last_name,' ',m.first_name,' ',m.middle_name) ELSE m.company_name END FROM members m WHERE m.id=%s" % acc['member_id'])
            nr = cur.fetchone()
            acc['member_name'] = nr[0] if nr else ''
            acc['transactions'] = query_rows(cur, "SELECT * FROM share_transactions WHERE account_id=%s ORDER BY transaction_date DESC" % params['id'])
            return acc
        else:
            return query_rows(cur, """
                SELECT sa.id, sa.account_no, sa.balance, sa.total_in, sa.total_out, sa.status, sa.created_at, sa.updated_at,
                       CASE WHEN m.member_type='FL' THEN CONCAT(m.last_name,' ',m.first_name,' ',m.middle_name)
                            ELSE m.company_name END as member_name, m.id as member_id
                FROM share_accounts sa JOIN members m ON m.id=sa.member_id ORDER BY sa.created_at DESC
            """)

    elif method == 'POST':
        action = body.get('action', 'create')
        if action == 'create':
            mid = int(body['member_id'])
            a = float(body.get('amount', 0))
            cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM share_accounts")
            ni = cur.fetchone()[0]
            ano = 'ПС-%06d' % ni
            cur.execute("INSERT INTO share_accounts (account_no,member_id,balance,total_in) VALUES ('%s',%s,%s,%s) RETURNING id, account_no" % (ano, mid, a, a))
            result = cur.fetchone()
            if a > 0:
                cur.execute("INSERT INTO share_transactions (account_id,transaction_date,amount,transaction_type,description) VALUES (%s,'%s',%s,'in','Первоначальный паевой взнос')" % (result[0], date.today().isoformat(), a))
            audit_log(cur, staff, 'create', 'share', result[0], ano, 'Сумма: %s' % a, ip)
            conn.commit()
            return {'id': result[0], 'account_no': result[1]}
        elif action == 'transaction':
            aid = int(body['account_id'])
            a = float(body['amount'])
            tt = body['transaction_type']
            td = body.get('transaction_date', date.today().isoformat())
            d = body.get('description', '')
            if tt == 'in':
                cur.execute("UPDATE share_accounts SET balance=balance+%s, total_in=total_in+%s, updated_at=NOW() WHERE id=%s" % (a, a, aid))
            else:
                cur.execute("SELECT balance FROM share_accounts WHERE id=%s" % aid)
                if float(cur.fetchone()[0]) < a:
                    return {'error': 'Недостаточно средств'}
                cur.execute("UPDATE share_accounts SET balance=balance-%s, total_out=total_out+%s, updated_at=NOW() WHERE id=%s" % (a, a, aid))
            cur.execute("INSERT INTO share_transactions (account_id,transaction_date,amount,transaction_type,description) VALUES (%s,'%s',%s,'%s','%s')" % (aid, td, a, tt, esc(d)))
            tt_label = 'Внесение' if tt == 'in' else 'Выплата'
            audit_log(cur, staff, 'transaction', 'share', aid, '', '%s: %s' % (tt_label, a), ip)
            conn.commit()
            return {'success': True}

def fmt_date(d):
    if not d:
        return ''
    if isinstance(d, str):
        parts = d.split('-')
        if len(parts) == 3:
            return '%s.%s.%s' % (parts[2], parts[1], parts[0])
        return d
    return d.strftime('%d.%m.%Y')

def fmt_money(n):
    if n is None:
        return '0.00'
    return '{:,.2f}'.format(float(n)).replace(',', ' ')

def generate_loan_xlsx(loan, schedule, payments, member_name):
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, Border, Side, PatternFill

    wb = Workbook()
    ws = wb.active
    ws.title = 'Выписка по займу'

    thin = Side(style='thin')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    header_font = Font(bold=True, size=11)
    title_font = Font(bold=True, size=14)
    header_fill = PatternFill(start_color='E2EFDA', end_color='E2EFDA', fill_type='solid')

    ws.merge_cells('A1:F1')
    ws['A1'] = 'Выписка по договору займа %s' % loan.get('contract_no', '')
    ws['A1'].font = title_font

    ws['A3'] = 'Пайщик:'
    ws['B3'] = member_name
    ws['A3'].font = Font(bold=True)
    ws['A4'] = 'Сумма займа:'
    ws['B4'] = '%s руб.' % fmt_money(loan.get('amount'))
    ws['A4'].font = Font(bold=True)
    ws['A5'] = 'Ставка:'
    ws['B5'] = '%s%% годовых' % loan.get('rate', '')
    ws['A5'].font = Font(bold=True)
    ws['A6'] = 'Срок:'
    ws['B6'] = '%s мес.' % loan.get('term_months', '')
    ws['A6'].font = Font(bold=True)
    ws['A7'] = 'Период:'
    ws['B7'] = '%s — %s' % (fmt_date(loan.get('start_date')), fmt_date(loan.get('end_date')))
    ws['A7'].font = Font(bold=True)
    ws['A8'] = 'Остаток:'
    ws['B8'] = '%s руб.' % fmt_money(loan.get('balance'))
    ws['A8'].font = Font(bold=True)
    ws['A9'] = 'Статус:'
    status_map = {'active': 'Активен', 'closed': 'Закрыт', 'overdue': 'Просрочен'}
    ws['B9'] = status_map.get(loan.get('status', ''), loan.get('status', ''))
    ws['A9'].font = Font(bold=True)

    ws.column_dimensions['A'].width = 18
    ws.column_dimensions['B'].width = 20
    ws.column_dimensions['C'].width = 18
    ws.column_dimensions['D'].width = 18
    ws.column_dimensions['E'].width = 18
    ws.column_dimensions['F'].width = 18
    ws.column_dimensions['G'].width = 14

    row = 11
    ws.merge_cells('A%d:G%d' % (row, row))
    ws['A%d' % row] = 'ГРАФИК ПЛАТЕЖЕЙ'
    ws['A%d' % row].font = Font(bold=True, size=12)
    row += 1

    sched_headers = ['№', 'Дата', 'Платёж', 'Осн. долг', 'Проценты', 'Остаток', 'Статус']
    for ci, h in enumerate(sched_headers, 1):
        c = ws.cell(row=row, column=ci, value=h)
        c.font = header_font
        c.fill = header_fill
        c.border = border
        c.alignment = Alignment(horizontal='center')
    row += 1

    status_labels = {'pending': 'Ожидается', 'paid': 'Оплачен', 'partial': 'Частично', 'overdue': 'Просрочен'}
    for item in schedule:
        ws.cell(row=row, column=1, value=item.get('payment_no')).border = border
        ws.cell(row=row, column=2, value=fmt_date(item.get('payment_date'))).border = border
        ws.cell(row=row, column=3, value=float(item.get('payment_amount', 0))).border = border
        ws.cell(row=row, column=3).number_format = '#,##0.00'
        ws.cell(row=row, column=4, value=float(item.get('principal_amount', 0))).border = border
        ws.cell(row=row, column=4).number_format = '#,##0.00'
        ws.cell(row=row, column=5, value=float(item.get('interest_amount', 0))).border = border
        ws.cell(row=row, column=5).number_format = '#,##0.00'
        ws.cell(row=row, column=6, value=float(item.get('balance_after', 0))).border = border
        ws.cell(row=row, column=6).number_format = '#,##0.00'
        ws.cell(row=row, column=7, value=status_labels.get(item.get('status', 'pending'), item.get('status', ''))).border = border
        row += 1

    total_payment = sum(float(i.get('payment_amount', 0)) for i in schedule)
    total_principal = sum(float(i.get('principal_amount', 0)) for i in schedule)
    total_interest = sum(float(i.get('interest_amount', 0)) for i in schedule)
    ws.cell(row=row, column=1, value='ИТОГО').font = Font(bold=True)
    ws.cell(row=row, column=1).border = border
    ws.cell(row=row, column=2).border = border
    ws.cell(row=row, column=3, value=total_payment).border = border
    ws.cell(row=row, column=3).number_format = '#,##0.00'
    ws.cell(row=row, column=3).font = Font(bold=True)
    ws.cell(row=row, column=4, value=total_principal).border = border
    ws.cell(row=row, column=4).number_format = '#,##0.00'
    ws.cell(row=row, column=5, value=total_interest).border = border
    ws.cell(row=row, column=5).number_format = '#,##0.00'
    ws.cell(row=row, column=6).border = border
    ws.cell(row=row, column=7).border = border
    row += 2

    if payments:
        ws.merge_cells('A%d:F%d' % (row, row))
        ws['A%d' % row] = 'ИСТОРИЯ ПЛАТЕЖЕЙ'
        ws['A%d' % row].font = Font(bold=True, size=12)
        row += 1

        pay_headers = ['Дата', 'Сумма', 'Осн. долг', 'Проценты', 'Штрафы', 'Тип']
        for ci, h in enumerate(pay_headers, 1):
            c = ws.cell(row=row, column=ci, value=h)
            c.font = header_font
            c.fill = header_fill
            c.border = border
            c.alignment = Alignment(horizontal='center')
        row += 1

        for p in payments:
            ws.cell(row=row, column=1, value=fmt_date(p.get('payment_date'))).border = border
            ws.cell(row=row, column=2, value=float(p.get('amount', 0))).border = border
            ws.cell(row=row, column=2).number_format = '#,##0.00'
            ws.cell(row=row, column=3, value=float(p.get('principal_part', 0))).border = border
            ws.cell(row=row, column=3).number_format = '#,##0.00'
            ws.cell(row=row, column=4, value=float(p.get('interest_part', 0))).border = border
            ws.cell(row=row, column=4).number_format = '#,##0.00'
            ws.cell(row=row, column=5, value=float(p.get('penalty_part', 0))).border = border
            ws.cell(row=row, column=5).number_format = '#,##0.00'
            type_labels = {'regular': 'Обычный', 'early_full': 'Досрочное полное', 'early_partial': 'Досрочное частичное'}
            ws.cell(row=row, column=6, value=type_labels.get(p.get('payment_type', ''), p.get('payment_type', ''))).border = border
            row += 1

    row += 1
    ws['A%d' % row] = 'Дата формирования: %s' % datetime.now().strftime('%d.%m.%Y %H:%M')
    ws['A%d' % row].font = Font(italic=True, color='666666')

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()

def generate_loan_pdf(loan, schedule, payments, member_name):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=14, spaceAfter=6)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, spaceAfter=2)

    story.append(Paragraph('Vyipiska po dogovoru zayma %s' % loan.get('contract_no', ''), title_style))

    status_map = {'active': 'Aktiven', 'closed': 'Zakryt', 'overdue': 'Prosrochen'}
    info_data = [
        ['Payschik:', member_name, 'Summa:', '%s rub.' % fmt_money(loan.get('amount'))],
        ['Stavka:', '%s%%' % loan.get('rate', ''), 'Srok:', '%s mes.' % loan.get('term_months', '')],
        ['Period:', '%s - %s' % (fmt_date(loan.get('start_date')), fmt_date(loan.get('end_date'))), 'Ostatok:', '%s rub.' % fmt_money(loan.get('balance'))],
        ['Status:', status_map.get(loan.get('status', ''), loan.get('status', '')), '', ''],
    ]
    info_table = Table(info_data, colWidths=[70, 180, 70, 180])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 10))

    story.append(Paragraph('Grafik platezhey', ParagraphStyle('SH', parent=styles['Heading2'], fontSize=11, spaceAfter=4)))

    sched_data = [['N', 'Data', 'Platezh', 'Osn. dolg', 'Protsenty', 'Ostatok', 'Status']]
    status_labels = {'pending': 'Ozhidaetsya', 'paid': 'Oplatchen', 'partial': 'Chastichno', 'overdue': 'Prosrochen'}
    for item in schedule:
        sched_data.append([
            str(item.get('payment_no', '')),
            fmt_date(item.get('payment_date')),
            fmt_money(item.get('payment_amount', 0)),
            fmt_money(item.get('principal_amount', 0)),
            fmt_money(item.get('interest_amount', 0)),
            fmt_money(item.get('balance_after', 0)),
            status_labels.get(item.get('status', 'pending'), item.get('status', '')),
        ])
    total_payment = sum(float(i.get('payment_amount', 0)) for i in schedule)
    total_principal = sum(float(i.get('principal_amount', 0)) for i in schedule)
    total_interest = sum(float(i.get('interest_amount', 0)) for i in schedule)
    sched_data.append(['ITOGO', '', fmt_money(total_payment), fmt_money(total_principal), fmt_money(total_interest), '', ''])

    st = Table(sched_data, colWidths=[30, 70, 85, 85, 85, 85, 75])
    st.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2EFDA')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (2, 0), (5, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F2F2F2')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(st)
    story.append(Spacer(1, 10))

    if payments:
        story.append(Paragraph('Istoriya platezhey', ParagraphStyle('PH', parent=styles['Heading2'], fontSize=11, spaceAfter=4)))
        pay_data = [['Data', 'Summa', 'Osn. dolg', 'Protsenty', 'Shtrafy', 'Tip']]
        type_labels = {'regular': 'Obychnyy', 'early_full': 'Dosrochnoe polnoe', 'early_partial': 'Dosrochnoe chastichnoe'}
        for p in payments:
            pay_data.append([
                fmt_date(p.get('payment_date')),
                fmt_money(p.get('amount', 0)),
                fmt_money(p.get('principal_part', 0)),
                fmt_money(p.get('interest_part', 0)),
                fmt_money(p.get('penalty_part', 0)),
                type_labels.get(p.get('payment_type', ''), p.get('payment_type', '')),
            ])
        pt = Table(pay_data, colWidths=[70, 85, 85, 85, 85, 120])
        pt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E2EFDA')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (1, 0), (4, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(pt)

    story.append(Spacer(1, 15))
    story.append(Paragraph('Data formirovaniya: %s' % datetime.now().strftime('%d.%m.%Y %H:%M'), ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey)))

    doc.build(story)
    return buf.getvalue()

def generate_savings_xlsx(saving, schedule, transactions, member_name):
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, Border, Side, PatternFill

    wb = Workbook()
    ws = wb.active
    ws.title = 'Выписка по сбережению'

    thin = Side(style='thin')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    header_font = Font(bold=True, size=11)
    header_fill = PatternFill(start_color='D6EAF8', end_color='D6EAF8', fill_type='solid')

    ws.merge_cells('A1:F1')
    ws['A1'] = 'Выписка по договору сбережений %s' % saving.get('contract_no', '')
    ws['A1'].font = Font(bold=True, size=14)

    ws['A3'] = 'Пайщик:'
    ws['B3'] = member_name
    ws['A3'].font = Font(bold=True)
    ws['A4'] = 'Сумма вклада:'
    ws['B4'] = '%s руб.' % fmt_money(saving.get('amount'))
    ws['A4'].font = Font(bold=True)
    ws['A5'] = 'Ставка:'
    ws['B5'] = '%s%% годовых' % saving.get('rate', '')
    ws['A5'].font = Font(bold=True)
    ws['A6'] = 'Срок:'
    ws['B6'] = '%s мес.' % saving.get('term_months', '')
    ws['A6'].font = Font(bold=True)
    ws['A7'] = 'Период:'
    ws['B7'] = '%s — %s' % (fmt_date(saving.get('start_date')), fmt_date(saving.get('end_date')))
    ws['A7'].font = Font(bold=True)
    ws['A8'] = 'Начислено %:'
    ws['B8'] = '%s руб.' % fmt_money(saving.get('accrued_interest'))
    ws['A8'].font = Font(bold=True)

    ws.column_dimensions['A'].width = 18
    ws.column_dimensions['B'].width = 20
    ws.column_dimensions['C'].width = 18
    ws.column_dimensions['D'].width = 18
    ws.column_dimensions['E'].width = 18

    row = 10
    ws['A%d' % row] = 'ГРАФИК ДОХОДНОСТИ'
    ws['A%d' % row].font = Font(bold=True, size=12)
    row += 1

    headers = ['№', 'Начало', 'Окончание', 'Проценты', 'Накоплено', 'Баланс']
    for ci, h in enumerate(headers, 1):
        c = ws.cell(row=row, column=ci, value=h)
        c.font = header_font
        c.fill = header_fill
        c.border = border
        c.alignment = Alignment(horizontal='center')
    row += 1

    for item in schedule:
        ws.cell(row=row, column=1, value=item.get('period_no')).border = border
        ws.cell(row=row, column=2, value=fmt_date(item.get('period_start'))).border = border
        ws.cell(row=row, column=3, value=fmt_date(item.get('period_end'))).border = border
        ws.cell(row=row, column=4, value=float(item.get('interest_amount', 0))).border = border
        ws.cell(row=row, column=4).number_format = '#,##0.00'
        ws.cell(row=row, column=5, value=float(item.get('cumulative_interest', 0))).border = border
        ws.cell(row=row, column=5).number_format = '#,##0.00'
        ws.cell(row=row, column=6, value=float(item.get('balance_after', 0))).border = border
        ws.cell(row=row, column=6).number_format = '#,##0.00'
        row += 1

    if transactions:
        row += 1
        ws['A%d' % row] = 'ОПЕРАЦИИ'
        ws['A%d' % row].font = Font(bold=True, size=12)
        row += 1
        t_headers = ['Дата', 'Сумма', 'Тип', 'Описание']
        for ci, h in enumerate(t_headers, 1):
            c = ws.cell(row=row, column=ci, value=h)
            c.font = header_font
            c.fill = header_fill
            c.border = border
        row += 1
        type_labels = {'deposit': 'Пополнение', 'withdrawal': 'Снятие', 'interest_payout': 'Выплата %', 'early_close': 'Досрочное закрытие'}
        for t in transactions:
            ws.cell(row=row, column=1, value=fmt_date(t.get('transaction_date'))).border = border
            ws.cell(row=row, column=2, value=float(t.get('amount', 0))).border = border
            ws.cell(row=row, column=2).number_format = '#,##0.00'
            ws.cell(row=row, column=3, value=type_labels.get(t.get('transaction_type', ''), t.get('transaction_type', ''))).border = border
            ws.cell(row=row, column=4, value=t.get('description', '')).border = border
            row += 1

    row += 1
    ws['A%d' % row] = 'Дата формирования: %s' % datetime.now().strftime('%d.%m.%Y %H:%M')
    ws['A%d' % row].font = Font(italic=True, color='666666')

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()

def generate_savings_pdf(saving, schedule, transactions, member_name):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph('Vyipiska po dogovoru sberezheniy %s' % saving.get('contract_no', ''), ParagraphStyle('T', parent=styles['Heading1'], fontSize=14, spaceAfter=6)))

    info = [
        ['Payschik:', member_name, 'Summa:', '%s rub.' % fmt_money(saving.get('amount'))],
        ['Stavka:', '%s%%' % saving.get('rate', ''), 'Srok:', '%s mes.' % saving.get('term_months', '')],
        ['Period:', '%s - %s' % (fmt_date(saving.get('start_date')), fmt_date(saving.get('end_date'))), 'Nachisleno:', '%s rub.' % fmt_money(saving.get('accrued_interest'))],
    ]
    it = Table(info, colWidths=[70, 180, 70, 180])
    it.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 9), ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'), ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    story.append(it)
    story.append(Spacer(1, 10))

    story.append(Paragraph('Grafik dokhodnosti', ParagraphStyle('SH', parent=styles['Heading2'], fontSize=11, spaceAfter=4)))
    sdata = [['N', 'Nachalo', 'Okonchanie', 'Protsenty', 'Nakopleno', 'Balans']]
    for item in schedule:
        sdata.append([str(item.get('period_no', '')), fmt_date(item.get('period_start')), fmt_date(item.get('period_end')), fmt_money(item.get('interest_amount', 0)), fmt_money(item.get('cumulative_interest', 0)), fmt_money(item.get('balance_after', 0))])
    st = Table(sdata, colWidths=[30, 80, 80, 85, 85, 85])
    st.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#D6EAF8')), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 8), ('GRID', (0, 0), (-1, -1), 0.5, colors.grey), ('ALIGN', (3, 0), (-1, -1), 'RIGHT'), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    story.append(st)

    if transactions:
        story.append(Spacer(1, 10))
        story.append(Paragraph('Operatsii', ParagraphStyle('TH', parent=styles['Heading2'], fontSize=11, spaceAfter=4)))
        tdata = [['Data', 'Summa', 'Tip', 'Opisanie']]
        type_labels = {'deposit': 'Popolnenie', 'withdrawal': 'Snyatie', 'interest_payout': 'Vyplata %', 'early_close': 'Dosrochnoe zakrytie'}
        for t in transactions:
            tdata.append([fmt_date(t.get('transaction_date')), fmt_money(t.get('amount', 0)), type_labels.get(t.get('transaction_type', ''), t.get('transaction_type', '')), t.get('description', '')])
        tt = Table(tdata, colWidths=[70, 85, 120, 200])
        tt.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#D6EAF8')), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 8), ('GRID', (0, 0), (-1, -1), 0.5, colors.grey), ('ALIGN', (1, 0), (1, -1), 'RIGHT'), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
        story.append(tt)

    story.append(Spacer(1, 15))
    story.append(Paragraph('Data formirovaniya: %s' % datetime.now().strftime('%d.%m.%Y %H:%M'), ParagraphStyle('F', parent=styles['Normal'], fontSize=8, textColor=colors.grey)))
    doc.build(story)
    return buf.getvalue()

def generate_shares_xlsx(account, transactions, member_name):
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, Border, Side, PatternFill

    wb = Workbook()
    ws = wb.active
    ws.title = 'Выписка по паевому счёту'

    thin = Side(style='thin')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    header_font = Font(bold=True, size=11)
    header_fill = PatternFill(start_color='FCE4D6', end_color='FCE4D6', fill_type='solid')

    ws.merge_cells('A1:D1')
    ws['A1'] = 'Выписка по паевому счёту %s' % account.get('account_no', '')
    ws['A1'].font = Font(bold=True, size=14)

    ws['A3'] = 'Пайщик:'
    ws['B3'] = member_name
    ws['A3'].font = Font(bold=True)
    ws['A4'] = 'Баланс:'
    ws['B4'] = '%s руб.' % fmt_money(account.get('balance'))
    ws['A4'].font = Font(bold=True)
    ws['A5'] = 'Внесено:'
    ws['B5'] = '%s руб.' % fmt_money(account.get('total_in'))
    ws['A5'].font = Font(bold=True)
    ws['A6'] = 'Выплачено:'
    ws['B6'] = '%s руб.' % fmt_money(account.get('total_out'))
    ws['A6'].font = Font(bold=True)

    ws.column_dimensions['A'].width = 18
    ws.column_dimensions['B'].width = 20
    ws.column_dimensions['C'].width = 18
    ws.column_dimensions['D'].width = 30

    row = 8
    ws['A%d' % row] = 'ОПЕРАЦИИ'
    ws['A%d' % row].font = Font(bold=True, size=12)
    row += 1

    headers = ['Дата', 'Сумма', 'Тип', 'Описание']
    for ci, h in enumerate(headers, 1):
        c = ws.cell(row=row, column=ci, value=h)
        c.font = header_font
        c.fill = header_fill
        c.border = border
    row += 1

    type_labels = {'in': 'Внесение', 'out': 'Выплата'}
    for t in transactions:
        ws.cell(row=row, column=1, value=fmt_date(t.get('transaction_date'))).border = border
        ws.cell(row=row, column=2, value=float(t.get('amount', 0))).border = border
        ws.cell(row=row, column=2).number_format = '#,##0.00'
        ws.cell(row=row, column=3, value=type_labels.get(t.get('transaction_type', ''), t.get('transaction_type', ''))).border = border
        ws.cell(row=row, column=4, value=t.get('description', '')).border = border
        row += 1

    row += 1
    ws['A%d' % row] = 'Дата формирования: %s' % datetime.now().strftime('%d.%m.%Y %H:%M')
    ws['A%d' % row].font = Font(italic=True, color='666666')

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()

def generate_shares_pdf(account, transactions, member_name):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph('Vyipiska po paevomu schyotu %s' % account.get('account_no', ''), ParagraphStyle('T', parent=styles['Heading1'], fontSize=14, spaceAfter=6)))
    info = [['Payschik:', member_name], ['Balans:', '%s rub.' % fmt_money(account.get('balance'))], ['Vneseno:', '%s rub.' % fmt_money(account.get('total_in'))], ['Vyplacheno:', '%s rub.' % fmt_money(account.get('total_out'))]]
    it = Table(info, colWidths=[80, 200])
    it.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 9), ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    story.append(it)
    story.append(Spacer(1, 10))

    story.append(Paragraph('Operatsii', ParagraphStyle('OH', parent=styles['Heading2'], fontSize=11, spaceAfter=4)))
    tdata = [['Data', 'Summa', 'Tip', 'Opisanie']]
    type_labels = {'in': 'Vnesenie', 'out': 'Vyplata'}
    for t in transactions:
        tdata.append([fmt_date(t.get('transaction_date')), fmt_money(t.get('amount', 0)), type_labels.get(t.get('transaction_type', ''), t.get('transaction_type', '')), t.get('description', '')])
    tt = Table(tdata, colWidths=[70, 85, 100, 200])
    tt.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FCE4D6')), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 8), ('GRID', (0, 0), (-1, -1), 0.5, colors.grey), ('ALIGN', (1, 0), (1, -1), 'RIGHT'), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    story.append(tt)

    story.append(Spacer(1, 15))
    story.append(Paragraph('Data formirovaniya: %s' % datetime.now().strftime('%d.%m.%Y %H:%M'), ParagraphStyle('F', parent=styles['Normal'], fontSize=8, textColor=colors.grey)))
    doc.build(story)
    return buf.getvalue()

def handle_export(params, cur):
    export_type = params.get('type', 'loan')
    format_ = params.get('format', 'xlsx')
    item_id = params.get('id')
    if not item_id:
        return None

    if export_type == 'loan':
        loan = query_one(cur, "SELECT * FROM loans WHERE id = %s" % item_id)
        if not loan:
            return None
        cur.execute("SELECT CASE WHEN m.member_type='FL' THEN CONCAT(m.last_name,' ',m.first_name,' ',m.middle_name) ELSE m.company_name END FROM members m WHERE m.id=%s" % loan['member_id'])
        nr = cur.fetchone()
        member_name = nr[0] if nr else ''
        schedule = query_rows(cur, "SELECT * FROM loan_schedule WHERE loan_id=%s ORDER BY payment_no" % item_id)
        payments = query_rows(cur, "SELECT * FROM loan_payments WHERE loan_id=%s ORDER BY payment_date" % item_id)
        if format_ == 'pdf':
            data = generate_loan_pdf(loan, schedule, payments, member_name)
            ct = 'application/pdf'
            fn = 'loan_%s.pdf' % loan.get('contract_no', item_id)
        else:
            data = generate_loan_xlsx(loan, schedule, payments, member_name)
            ct = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            fn = 'loan_%s.xlsx' % loan.get('contract_no', item_id)

    elif export_type == 'saving':
        saving = query_one(cur, "SELECT * FROM savings WHERE id = %s" % item_id)
        if not saving:
            return None
        cur.execute("SELECT CASE WHEN m.member_type='FL' THEN CONCAT(m.last_name,' ',m.first_name,' ',m.middle_name) ELSE m.company_name END FROM members m WHERE m.id=%s" % saving['member_id'])
        nr = cur.fetchone()
        member_name = nr[0] if nr else ''
        schedule = query_rows(cur, "SELECT * FROM savings_schedule WHERE saving_id=%s ORDER BY period_no" % item_id)
        transactions = query_rows(cur, "SELECT * FROM savings_transactions WHERE saving_id=%s ORDER BY transaction_date" % item_id)
        if format_ == 'pdf':
            data = generate_savings_pdf(saving, schedule, transactions, member_name)
            ct = 'application/pdf'
            fn = 'saving_%s.pdf' % saving.get('contract_no', item_id)
        else:
            data = generate_savings_xlsx(saving, schedule, transactions, member_name)
            ct = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            fn = 'saving_%s.xlsx' % saving.get('contract_no', item_id)

    elif export_type == 'share':
        account = query_one(cur, "SELECT * FROM share_accounts WHERE id = %s" % item_id)
        if not account:
            return None
        cur.execute("SELECT CASE WHEN m.member_type='FL' THEN CONCAT(m.last_name,' ',m.first_name,' ',m.middle_name) ELSE m.company_name END FROM members m WHERE m.id=%s" % account['member_id'])
        nr = cur.fetchone()
        member_name = nr[0] if nr else ''
        transactions = query_rows(cur, "SELECT * FROM share_transactions WHERE account_id=%s ORDER BY transaction_date DESC" % item_id)
        if format_ == 'pdf':
            data = generate_shares_pdf(account, transactions, member_name)
            ct = 'application/pdf'
            fn = 'share_%s.pdf' % account.get('account_no', item_id)
        else:
            data = generate_shares_xlsx(account, transactions, member_name)
            ct = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            fn = 'share_%s.xlsx' % account.get('account_no', item_id)
    else:
        return None

    return {'file': base64.b64encode(data).decode('utf-8'), 'content_type': ct, 'filename': fn}

def handle_dashboard(cur):
    stats = {}
    cur.execute("SELECT COUNT(*) FROM members WHERE status='active'")
    stats['total_members'] = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*), COALESCE(SUM(balance),0) FROM loans WHERE status='active'")
    r = cur.fetchone()
    stats['active_loans'] = r[0]
    stats['loan_portfolio'] = float(r[1])
    cur.execute("SELECT COUNT(*) FROM loans WHERE status='overdue'")
    stats['overdue_loans'] = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(current_balance),0) FROM savings WHERE status='active'")
    stats['total_savings'] = float(cur.fetchone()[0])
    cur.execute("SELECT COALESCE(SUM(balance),0) FROM share_accounts WHERE status='active'")
    stats['total_shares'] = float(cur.fetchone()[0])
    return stats

def hash_password(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def generate_sms_code():
    return '%06d' % (secrets.randbelow(900000) + 100000)

def generate_token():
    return secrets.token_hex(32)

def get_session_user(headers, cur):
    token = (headers or {}).get('X-Auth-Token') or (headers or {}).get('x-auth-token', '')
    if not token:
        return None
    cur.execute("SELECT cs.user_id, u.member_id, u.name, u.phone, u.role FROM client_sessions cs JOIN users u ON u.id=cs.user_id WHERE cs.token='%s' AND cs.expires_at > NOW()" % esc(token))
    row = cur.fetchone()
    if not row:
        return None
    return {'user_id': row[0], 'member_id': row[1], 'name': row[2], 'phone': row[3], 'role': row[4]}

def get_staff_session(params, headers, cur):
    token = (headers or {}).get('X-Auth-Token') or (headers or {}).get('x-auth-token', '')
    if not token:
        token = params.get('staff_token', '')
    if not token:
        return None
    cur.execute("SELECT cs.user_id, u.name, u.role, u.login FROM client_sessions cs JOIN users u ON u.id=cs.user_id WHERE cs.token='%s' AND cs.expires_at > NOW() AND u.role IN ('admin','manager')" % esc(token))
    row = cur.fetchone()
    if not row:
        return None
    return {'user_id': row[0], 'name': row[1], 'role': row[2], 'login': row[3]}

def handle_staff_auth(body, cur, conn, ip=''):
    action = body.get('action', '')

    if action == 'login':
        login = body.get('login', '').strip()
        password = body.get('password', '')
        if not login or not password:
            return {'error': 'Введите логин и пароль'}
        pw_hash = hash_password(password)
        cur.execute("SELECT id, name, role, login FROM users WHERE login='%s' AND password_hash='%s' AND role IN ('admin','manager') AND status='active'" % (esc(login), pw_hash))
        row = cur.fetchone()
        if not row:
            audit_log(cur, None, 'login_failed', 'auth', None, login, '', ip)
            conn.commit()
            return {'error': 'Неверный логин или пароль'}
        user_id, name, role, ulogin = row
        token = generate_token()
        expires = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
        cur.execute("INSERT INTO client_sessions (user_id, token, expires_at) VALUES (%s,'%s','%s')" % (user_id, token, expires))
        cur.execute("UPDATE users SET last_login=NOW() WHERE id=%s" % user_id)
        staff_info = {'user_id': user_id, 'name': name, 'role': role}
        audit_log(cur, staff_info, 'login', 'auth', user_id, ulogin, '', ip)
        conn.commit()
        return {'success': True, 'token': token, 'user': {'name': name, 'role': role, 'login': ulogin}}

    if action == 'check':
        token = body.get('token', '')
        cur.execute("SELECT u.id, u.name, u.role, u.login FROM users u JOIN client_sessions cs ON cs.user_id=u.id WHERE cs.token='%s' AND cs.expires_at > NOW() AND u.role IN ('admin','manager')" % esc(token))
        row = cur.fetchone()
        if not row:
            return {'_status': 401, 'error': 'Не авторизован'}
        return {'success': True, 'user': {'name': row[1], 'role': row[2], 'login': row[3]}}

    if action == 'logout':
        token = body.get('token', '')
        cur.execute("UPDATE client_sessions SET expires_at=NOW() WHERE token='%s'" % esc(token))
        conn.commit()
        return {'success': True}

    if action == 'change_password':
        token = body.get('token', '')
        old_pw = body.get('old_password', '')
        new_pw = body.get('new_password', '')
        if not new_pw or len(new_pw) < 6:
            return {'error': 'Новый пароль не менее 6 символов'}
        cur.execute("SELECT cs.user_id FROM client_sessions cs WHERE cs.token='%s' AND cs.expires_at > NOW()" % esc(token))
        row = cur.fetchone()
        if not row:
            return {'_status': 401, 'error': 'Сессия истекла'}
        user_id = row[0]
        cur.execute("SELECT password_hash FROM users WHERE id=%s" % user_id)
        cur_hash = cur.fetchone()[0]
        if cur_hash and cur_hash != hash_password(old_pw):
            return {'error': 'Неверный текущий пароль'}
        cur.execute("UPDATE users SET password_hash='%s' WHERE id=%s" % (hash_password(new_pw), user_id))
        conn.commit()
        return {'success': True}

    return {'error': 'Неизвестное действие'}

def handle_users(method, params, body, staff, cur, conn):
    if staff['role'] != 'admin':
        return {'_status': 403, 'error': 'Только администратор может управлять пользователями'}

    if method == 'GET':
        user_id = params.get('id')
        if user_id:
            return query_one(cur, "SELECT id, login, name, email, phone, role, status, member_id, last_login, created_at FROM users WHERE id=%s" % user_id)
        return query_rows(cur, "SELECT id, login, name, email, phone, role, status, member_id, last_login, created_at FROM users ORDER BY created_at DESC")

    elif method == 'POST':
        action = body.get('action', 'create')
        if action == 'create':
            login = body.get('login', '').strip()
            name = body.get('name', '').strip()
            role = body.get('role', 'manager')
            password = body.get('password', '')
            email = body.get('email', '')
            phone = body.get('phone', '')
            if not login or not name:
                return {'error': 'Логин и имя обязательны'}
            if role not in ('admin', 'manager'):
                return {'error': 'Роль должна быть admin или manager'}
            if not password or len(password) < 6:
                return {'error': 'Пароль не менее 6 символов'}
            cur.execute("SELECT id FROM users WHERE login='%s'" % esc(login))
            if cur.fetchone():
                return {'error': 'Логин уже занят'}
            pw_hash = hash_password(password)
            cur.execute("INSERT INTO users (login, name, email, phone, role, password_hash) VALUES ('%s','%s','%s','%s','%s','%s') RETURNING id" % (esc(login), esc(name), esc(email), esc(phone), role, pw_hash))
            uid = cur.fetchone()[0]
            audit_log(cur, staff, 'create', 'user', uid, '%s (%s)' % (login, role), '', '')
            conn.commit()
            return {'id': uid, 'login': login}
        elif action == 'update':
            uid = body.get('id')
            if not uid:
                return {'error': 'Укажите id'}
            updates = []
            for f in ['name', 'email', 'phone', 'role', 'status', 'login']:
                if f in body and body[f] is not None:
                    if f == 'role' and body[f] not in ('admin', 'manager', 'client'):
                        return {'error': 'Недопустимая роль'}
                    updates.append("%s='%s'" % (f, esc(body[f])))
            if body.get('password'):
                if len(body['password']) < 6:
                    return {'error': 'Пароль не менее 6 символов'}
                updates.append("password_hash='%s'" % hash_password(body['password']))
            if updates:
                cur.execute("UPDATE users SET %s WHERE id=%s" % (', '.join(updates), uid))
                changed = [f for f in body if f not in ('id', 'entity', 'action', 'password')]
                if body.get('password'):
                    changed.append('password')
                audit_log(cur, staff, 'update', 'user', uid, '', ', '.join(changed), '')
                conn.commit()
            return {'success': True}
        elif action == 'delete':
            uid = body.get('id')
            if not uid:
                return {'error': 'Укажите id'}
            if int(uid) == staff['user_id']:
                return {'error': 'Нельзя удалить самого себя'}
            cur.execute("UPDATE users SET status='blocked' WHERE id=%s" % uid)
            cur.execute("UPDATE client_sessions SET expires_at=NOW() WHERE user_id=%s" % uid)
            audit_log(cur, staff, 'block', 'user', uid, '', '', '')
            conn.commit()
            return {'success': True}
    return {'error': 'Неизвестное действие'}

def handle_auth(method, body, cur, conn):
    action = body.get('action', '')

    if action == 'send_sms':
        phone = body.get('phone', '').strip()
        if not phone:
            return {'error': 'Укажите номер телефона'}
        clean_phone = ''.join(c for c in phone if c.isdigit())
        if len(clean_phone) == 11 and clean_phone[0] == '8':
            clean_phone = '7' + clean_phone[1:]

        cur.execute("SELECT m.id, m.phone FROM members m WHERE REPLACE(REPLACE(REPLACE(REPLACE(m.phone,' ',''),'-',''),'(',''),')','') LIKE '%%%s%%' AND m.status='active'" % clean_phone[-10:])
        member = cur.fetchone()
        if not member:
            return {'error': 'Пайщик с таким номером не найден. Обратитесь в КПК.'}

        member_id = member[0]
        cur.execute("SELECT id, password_hash FROM users WHERE member_id=%s AND role='client'" % member_id)
        user_row = cur.fetchone()

        code = generate_sms_code()
        expires = (datetime.now() + timedelta(minutes=5)).strftime('%Y-%m-%d %H:%M:%S')

        if user_row:
            user_id = user_row[0]
            has_password = bool(user_row[1])
            cur.execute("UPDATE users SET sms_code='%s', sms_code_expires='%s' WHERE id=%s" % (code, expires, user_id))
        else:
            cur.execute("SELECT CASE WHEN member_type='FL' THEN CONCAT(last_name,' ',first_name) ELSE company_name END FROM members WHERE id=%s" % member_id)
            name_row = cur.fetchone()
            uname = name_row[0] if name_row else 'Клиент'
            cur.execute("INSERT INTO users (member_id, name, email, phone, role, sms_code, sms_code_expires) VALUES (%s,'%s','','%s','client','%s','%s') RETURNING id" % (member_id, esc(uname), esc(phone), code, expires))
            user_id = cur.fetchone()[0]
            has_password = False

        conn.commit()
        return {'success': True, 'has_password': has_password, 'sms_sent': True, 'debug_code': code}

    elif action == 'verify_sms':
        phone = body.get('phone', '').strip()
        code = body.get('code', '').strip()
        clean_phone = ''.join(c for c in phone if c.isdigit())

        cur.execute("SELECT u.id, u.password_hash, u.name, u.member_id FROM users u JOIN members m ON m.id=u.member_id WHERE REPLACE(REPLACE(REPLACE(REPLACE(m.phone,' ',''),'-',''),'(',''),')','') LIKE '%%%s%%' AND u.role='client' AND u.sms_code='%s' AND u.sms_code_expires > NOW()" % (clean_phone[-10:], esc(code)))
        row = cur.fetchone()
        if not row:
            return {'error': 'Неверный код или код истёк'}

        user_id, pw_hash, name, member_id = row[0], row[1], row[2], row[3]
        has_password = bool(pw_hash)

        cur.execute("UPDATE users SET sms_code=NULL, sms_code_expires=NULL WHERE id=%s" % user_id)

        if has_password:
            token = generate_token()
            expires = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')
            cur.execute("INSERT INTO client_sessions (user_id, token, expires_at) VALUES (%s,'%s','%s')" % (user_id, token, expires))
            cur.execute("UPDATE users SET last_login=NOW() WHERE id=%s" % user_id)
            conn.commit()
            return {'success': True, 'has_password': True, 'authenticated': True, 'token': token, 'user': {'name': name, 'member_id': member_id}}
        else:
            temp_token = generate_token()
            expires = (datetime.now() + timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S')
            cur.execute("INSERT INTO client_sessions (user_id, token, expires_at) VALUES (%s,'%s','%s')" % (user_id, temp_token, expires))
            conn.commit()
            return {'success': True, 'has_password': False, 'setup_token': temp_token}

    elif action == 'set_password':
        token = body.get('setup_token') or body.get('token', '')
        password = body.get('password', '')
        if not password or len(password) < 6:
            return {'error': 'Пароль должен быть не менее 6 символов'}

        cur.execute("SELECT cs.user_id FROM client_sessions cs WHERE cs.token='%s' AND cs.expires_at > NOW()" % esc(token))
        row = cur.fetchone()
        if not row:
            return {'error': 'Сессия истекла, повторите авторизацию'}

        user_id = row[0]
        pw_hash = hash_password(password)
        cur.execute("UPDATE users SET password_hash='%s' WHERE id=%s" % (pw_hash, user_id))

        cur.execute("UPDATE client_sessions SET expires_at=NOW() WHERE token='%s'" % esc(token))

        new_token = generate_token()
        expires = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')
        cur.execute("INSERT INTO client_sessions (user_id, token, expires_at) VALUES (%s,'%s','%s')" % (user_id, new_token, expires))
        cur.execute("UPDATE users SET last_login=NOW() WHERE id=%s" % user_id)

        cur.execute("SELECT name, member_id FROM users WHERE id=%s" % user_id)
        ur = cur.fetchone()
        conn.commit()
        return {'success': True, 'token': new_token, 'user': {'name': ur[0], 'member_id': ur[1]}}

    elif action == 'login_password':
        phone = body.get('phone', '').strip()
        password = body.get('password', '')
        clean_phone = ''.join(c for c in phone if c.isdigit())
        pw_hash = hash_password(password)

        cur.execute("SELECT u.id, u.name, u.member_id FROM users u JOIN members m ON m.id=u.member_id WHERE REPLACE(REPLACE(REPLACE(REPLACE(m.phone,' ',''),'-',''),'(',''),')','') LIKE '%%%s%%' AND u.role='client' AND u.password_hash='%s'" % (clean_phone[-10:], pw_hash))
        row = cur.fetchone()
        if not row:
            return {'error': 'Неверный телефон или пароль'}

        user_id, name, member_id = row
        token = generate_token()
        expires = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')
        cur.execute("INSERT INTO client_sessions (user_id, token, expires_at) VALUES (%s,'%s','%s')" % (user_id, token, expires))
        cur.execute("UPDATE users SET last_login=NOW() WHERE id=%s" % user_id)
        conn.commit()
        return {'success': True, 'token': token, 'user': {'name': name, 'member_id': member_id}}

    elif action == 'change_password':
        token = body.get('token', '')
        old_pw = body.get('old_password', '')
        new_pw = body.get('new_password', '')
        if not new_pw or len(new_pw) < 6:
            return {'error': 'Новый пароль должен быть не менее 6 символов'}

        cur.execute("SELECT cs.user_id FROM client_sessions cs WHERE cs.token='%s' AND cs.expires_at > NOW()" % esc(token))
        row = cur.fetchone()
        if not row:
            return {'error': 'Сессия истекла'}
        user_id = row[0]

        cur.execute("SELECT password_hash FROM users WHERE id=%s" % user_id)
        cur_hash = cur.fetchone()[0]
        if cur_hash and cur_hash != hash_password(old_pw):
            return {'error': 'Неверный текущий пароль'}

        cur.execute("UPDATE users SET password_hash='%s' WHERE id=%s" % (hash_password(new_pw), user_id))
        conn.commit()
        return {'success': True}

    elif action == 'logout':
        token = body.get('token', '')
        cur.execute("UPDATE client_sessions SET expires_at=NOW() WHERE token='%s'" % esc(token))
        conn.commit()
        return {'success': True}

    elif action == 'check':
        token = body.get('token', '')
        cur.execute("SELECT u.id, u.name, u.member_id FROM users u JOIN client_sessions cs ON cs.user_id=u.id WHERE cs.token='%s' AND cs.expires_at > NOW()" % esc(token))
        row = cur.fetchone()
        if not row:
            return {'error': 'Не авторизован'}
        return {'success': True, 'user': {'name': row[1], 'member_id': row[2]}}

    return {'error': 'Неизвестное действие'}

def handle_cabinet(method, params, body, headers, cur):
    token = (headers or {}).get('X-Auth-Token') or (headers or {}).get('x-auth-token', '')
    if not token:
        token = params.get('token') or body.get('token', '')

    cur.execute("SELECT u.id, u.member_id FROM users u JOIN client_sessions cs ON cs.user_id=u.id WHERE cs.token='%s' AND cs.expires_at > NOW()" % esc(token))
    row = cur.fetchone()
    if not row:
        return {'_status': 401, 'error': 'Не авторизован'}
    member_id = row[1]

    action = params.get('action') or body.get('action', 'overview')

    if action == 'overview':
        cur.execute("SELECT CASE WHEN member_type='FL' THEN CONCAT(last_name,' ',first_name,' ',middle_name) ELSE company_name END as name, member_no, phone, email FROM members WHERE id=%s" % member_id)
        mr = cur.fetchone()
        info = {'name': mr[0], 'member_no': mr[1], 'phone': mr[2], 'email': mr[3]} if mr else {}

        loans = query_rows(cur, """
            SELECT id, contract_no, amount, rate, term_months, schedule_type, start_date, end_date,
                   monthly_payment, balance, status
            FROM loans WHERE member_id=%s ORDER BY created_at DESC
        """ % member_id)

        savings = query_rows(cur, """
            SELECT id, contract_no, amount, rate, term_months, payout_type, start_date, end_date,
                   accrued_interest, paid_interest, current_balance, status
            FROM savings WHERE member_id=%s ORDER BY created_at DESC
        """ % member_id)

        shares = query_rows(cur, """
            SELECT id, account_no, balance, total_in, total_out, status
            FROM share_accounts WHERE member_id=%s ORDER BY created_at DESC
        """ % member_id)

        return {'info': info, 'loans': loans, 'savings': savings, 'shares': shares}

    elif action == 'loan_detail':
        loan_id = params.get('id') or body.get('id')
        loan = query_one(cur, "SELECT * FROM loans WHERE id=%s AND member_id=%s" % (loan_id, member_id))
        if not loan:
            return {'error': 'Договор не найден'}
        loan['schedule'] = query_rows(cur, "SELECT * FROM loan_schedule WHERE loan_id=%s ORDER BY payment_no" % loan_id)
        loan['payments'] = query_rows(cur, "SELECT * FROM loan_payments WHERE loan_id=%s ORDER BY payment_date" % loan_id)
        return loan

    elif action == 'saving_detail':
        saving_id = params.get('id') or body.get('id')
        saving = query_one(cur, "SELECT * FROM savings WHERE id=%s AND member_id=%s" % (saving_id, member_id))
        if not saving:
            return {'error': 'Договор не найден'}
        saving['schedule'] = query_rows(cur, "SELECT * FROM savings_schedule WHERE saving_id=%s ORDER BY period_no" % saving_id)
        return saving

    return {'error': 'Неизвестное действие'}

def handle_audit(params, staff, cur):
    if staff.get('role') != 'admin':
        return {'_status': 403, 'error': 'Только администратор может просматривать журнал'}
    limit = min(int(params.get('limit', 100)), 500)
    offset = int(params.get('offset', 0))
    entity_filter = params.get('filter_entity', '')
    action_filter = params.get('filter_action', '')
    where = []
    if entity_filter:
        where.append("entity='%s'" % esc(entity_filter))
    if action_filter:
        where.append("action='%s'" % esc(action_filter))
    where_sql = (' WHERE ' + ' AND '.join(where)) if where else ''
    cur.execute("SELECT COUNT(*) FROM audit_log%s" % where_sql)
    total = cur.fetchone()[0]
    rows = query_rows(cur, "SELECT * FROM audit_log%s ORDER BY created_at DESC LIMIT %s OFFSET %s" % (where_sql, limit, offset))
    return {'items': rows, 'total': total}

PROTECTED_ENTITIES = {'dashboard', 'members', 'loans', 'savings', 'shares', 'export', 'users', 'audit'}

def handler(event, context):
    """Единый API для ERP кредитного кооператива: пайщики, займы, сбережения, паевые счета, личный кабинет, авторизация"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}
    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body', '{}')) if event.get('body') else {}
    ev_headers = event.get('headers') or {}

    entity = params.get('entity') or body.get('entity', 'dashboard')

    src_ip = (event.get('requestContext') or {}).get('identity', {}).get('sourceIp', '')

    conn = get_conn()
    cur = conn.cursor()

    try:
        staff = None
        if entity in PROTECTED_ENTITIES:
            staff = get_staff_session(params, ev_headers, cur)
            if not staff:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Требуется авторизация'})}

            if staff['role'] == 'manager':
                if method == 'DELETE':
                    return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Менеджер не может удалять записи'})}
                if entity in ('users', 'audit'):
                    return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Недостаточно прав'})}
                action = params.get('action') or body.get('action', '')
                if action == 'delete':
                    return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Менеджер не может удалять записи'})}

        if entity == 'dashboard':
            result = handle_dashboard(cur)
        elif entity == 'members':
            result = handle_members(method, params, body, cur, conn, staff, src_ip)
        elif entity == 'loans':
            result = handle_loans(method, params, body, cur, conn, staff, src_ip)
        elif entity == 'savings':
            result = handle_savings(method, params, body, cur, conn, staff, src_ip)
        elif entity == 'shares':
            result = handle_shares(method, params, body, cur, conn, staff, src_ip)
        elif entity == 'export':
            result = handle_export(params, cur)
        elif entity == 'users':
            result = handle_users(method, params, body, staff, cur, conn)
        elif entity == 'audit':
            result = handle_audit(params, staff, cur)
        elif entity == 'staff_auth':
            result = handle_staff_auth(body, cur, conn, src_ip)
        elif entity == 'auth':
            result = handle_auth(method, body, cur, conn)
        elif entity == 'cabinet':
            result = handle_cabinet(method, params, body, ev_headers, cur)
        else:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Unknown entity: %s' % entity})}

        if isinstance(result, dict) and '_status' in result:
            st = result.pop('_status')
            return {'statusCode': st, 'headers': headers, 'body': json.dumps(result)}

        if result is None:
            return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Не найдено'})}

        if isinstance(result, dict) and 'error' in result:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps(result)}

        code = 201 if method == 'POST' else 200
        return {'statusCode': code, 'headers': headers, 'body': json.dumps(result)}
    except Exception as e:
        conn.rollback()
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}
    finally:
        cur.close()
        conn.close()