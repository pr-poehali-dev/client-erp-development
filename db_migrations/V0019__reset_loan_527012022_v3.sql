UPDATE loan_payments SET amount = 0, principal_part = 0, interest_part = 0 WHERE loan_id = 13;

UPDATE loan_schedule SET paid_amount = 0, paid_date = NULL, status = 'pending' WHERE loan_id = 13;

UPDATE loans SET balance = 1500000.00, monthly_payment = 34902.38, term_months = 60, status = 'active', updated_at = NOW() WHERE id = 13;