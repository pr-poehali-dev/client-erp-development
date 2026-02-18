CREATE TABLE savings_rate_changes (
    id SERIAL PRIMARY KEY,
    saving_id INTEGER NOT NULL REFERENCES savings(id),
    effective_date DATE NOT NULL,
    old_rate NUMERIC(6,3) NOT NULL,
    new_rate NUMERIC(6,3) NOT NULL,
    reason TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER NULL
);

CREATE INDEX idx_src_saving ON savings_rate_changes(saving_id);
CREATE INDEX idx_src_date ON savings_rate_changes(saving_id, effective_date);