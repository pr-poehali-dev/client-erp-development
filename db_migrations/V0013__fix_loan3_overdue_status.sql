UPDATE loans SET status='active', updated_at=NOW()
WHERE id=3
  AND status='overdue'
  AND NOT EXISTS (
    SELECT 1 FROM loan_schedule ls
    WHERE ls.loan_id = 3
      AND ls.status IN ('pending','partial','overdue')
      AND ls.payment_date < CURRENT_DATE
      AND COALESCE(ls.paid_amount,0) < (ls.principal_amount + ls.interest_amount + COALESCE(ls.penalty_amount,0))
  );

UPDATE loan_schedule SET status='pending', overdue_days=0
WHERE loan_id=3 AND status='overdue';