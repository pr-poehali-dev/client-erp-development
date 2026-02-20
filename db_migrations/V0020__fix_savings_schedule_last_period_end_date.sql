-- Пересчёт графиков сбережений: последний период до даты закрытия = start_date + term_months
-- Договор 300-000000605022026 (id=14): 3 мес, старт 2026-02-05, закрытие 2026-05-05
UPDATE t_p25513958_client_erp_developme.savings_schedule
SET period_end = '2026-05-05'
WHERE saving_id = 14 AND period_no = 3;

-- Договор 300-000000911122023 (id=11): 14 мес, старт 2025-06-09, закрытие 2026-08-09
UPDATE t_p25513958_client_erp_developme.savings_schedule
SET period_end = '2026-08-09'
WHERE saving_id = 11 AND period_no = 14;

-- Договор 100-000003619122023 (id=13): 13 мес, старт 2025-12-10, закрытие 2027-01-10
UPDATE t_p25513958_client_erp_developme.savings_schedule
SET period_end = '2027-01-10'
WHERE saving_id = 13 AND period_no = 13;

-- Обновить end_date в savings
UPDATE t_p25513958_client_erp_developme.savings SET end_date = '2026-05-05' WHERE id = 14;
UPDATE t_p25513958_client_erp_developme.savings SET end_date = '2026-08-09' WHERE id = 11;
UPDATE t_p25513958_client_erp_developme.savings SET end_date = '2027-01-10' WHERE id = 13;
