UPDATE loan_payments SET amount = 0, principal_part = 0, interest_part = 0, penalty_part = 0 WHERE id = 36;

UPDATE loan_schedule SET paid_amount = 0, paid_date = NULL, status = 'pending'
WHERE loan_id = 12 AND payment_no IN (1, 2);

UPDATE loans SET balance = 1500000.00, status = 'active', updated_at = NOW()
WHERE id = 12;