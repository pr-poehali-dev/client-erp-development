-- Сброс статусов графика для займа 40 перед пересчётом
-- После этого необходимо вызвать recalc_statuses через интерфейс
UPDATE t_p25513958_client_erp_developme.loan_schedule
SET paid_amount = 0,
    paid_date = NULL,
    status = 'pending'
WHERE loan_id = 40;