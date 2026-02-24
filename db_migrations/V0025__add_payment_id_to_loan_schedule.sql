-- Добавляем явную ссылку на платёж в строку графика
ALTER TABLE t_p25513958_client_erp_developme.loan_schedule
  ADD COLUMN IF NOT EXISTS payment_id INTEGER NULL;