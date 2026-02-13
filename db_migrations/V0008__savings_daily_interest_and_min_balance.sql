
ALTER TABLE savings ADD COLUMN IF NOT EXISTS min_balance_pct NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS savings_daily_accruals (
    id SERIAL PRIMARY KEY,
    saving_id INTEGER NOT NULL,
    accrual_date DATE NOT NULL,
    balance NUMERIC NOT NULL,
    rate NUMERIC NOT NULL,
    daily_amount NUMERIC NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(saving_id, accrual_date)
);

CREATE INDEX IF NOT EXISTS idx_savings_daily_accruals_saving ON savings_daily_accruals(saving_id);
CREATE INDEX IF NOT EXISTS idx_savings_daily_accruals_date ON savings_daily_accruals(accrual_date);
