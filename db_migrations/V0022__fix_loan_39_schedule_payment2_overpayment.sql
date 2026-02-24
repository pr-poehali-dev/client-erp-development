-- Исправление данных по договору 300-000008308112024 (loan_id=39)
-- Платёж №2 в графике (id=29201) содержит данные об удалённом платеже (переплата 0.35 руб.)
-- Сбрасываем paid_amount, paid_date и статус обратно на pending
UPDATE t_p25513958_client_erp_developme.loan_schedule
SET paid_amount = 0.00,
    paid_date = NULL,
    status = 'pending'
WHERE id = 29201
  AND loan_id = 39
  AND payment_no = 2;