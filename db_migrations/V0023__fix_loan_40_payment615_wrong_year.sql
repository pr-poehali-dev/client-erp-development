-- Исправление опечатки в дате платежа id=615 по договору 100-000005226022024 (loan_id=40)
-- Дата была введена как 0025-10-29 (год 25) вместо 2025-10-29
UPDATE t_p25513958_client_erp_developme.loan_payments
SET payment_date = '2025-10-29'
WHERE id = 615
  AND loan_id = 40
  AND payment_date = '0025-10-29';