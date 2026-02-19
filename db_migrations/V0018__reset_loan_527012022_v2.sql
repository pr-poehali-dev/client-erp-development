UPDATE loan_payments SET amount = 0, principal_part = 0, interest_part = 0 WHERE loan_id = 12;

UPDATE loan_schedule SET paid_amount = 0, paid_date = NULL, status = 'pending'
WHERE loan_id = 12;

UPDATE loan_schedule SET payment_amount = 34902.38, principal_amount = 16235.71, interest_amount = 18666.67, balance_after = 1483764.29
WHERE loan_id = 12 AND payment_no = 1;

UPDATE loan_schedule SET payment_amount = 34902.38, principal_amount = 17014.78, interest_amount = 17887.60, balance_after = 1466749.51
WHERE loan_id = 12 AND payment_no = 2;

UPDATE loans SET balance = 1500000.00, monthly_payment = 34902.38, term_months = 60, status = 'active', updated_at = NOW()
WHERE id = 12;