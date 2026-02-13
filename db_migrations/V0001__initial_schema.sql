
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    member_no VARCHAR(20) UNIQUE NOT NULL,
    member_type VARCHAR(2) NOT NULL CHECK (member_type IN ('FL', 'UL')),
    last_name VARCHAR(100),
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    birth_date DATE,
    birth_place VARCHAR(300),
    passport_series VARCHAR(4),
    passport_number VARCHAR(6),
    passport_dept_code VARCHAR(10),
    passport_issue_date DATE,
    passport_issued_by VARCHAR(500),
    registration_address VARCHAR(500),
    marital_status VARCHAR(50),
    spouse_fio VARCHAR(200),
    spouse_phone VARCHAR(20),
    extra_phone VARCHAR(20),
    extra_contact_fio VARCHAR(200),
    company_name VARCHAR(300),
    director_fio VARCHAR(200),
    director_phone VARCHAR(20),
    contact_person_fio VARCHAR(200),
    contact_person_phone VARCHAR(20),
    inn VARCHAR(12) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(200),
    telegram VARCHAR(100),
    bank_bik VARCHAR(9),
    bank_account VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id),
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'client')),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE loans (
    id SERIAL PRIMARY KEY,
    contract_no VARCHAR(30) UNIQUE NOT NULL,
    member_id INTEGER NOT NULL REFERENCES members(id),
    amount NUMERIC(15,2) NOT NULL,
    rate NUMERIC(5,2) NOT NULL,
    term_months INTEGER NOT NULL,
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('annuity', 'end_of_term')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    monthly_payment NUMERIC(15,2),
    balance NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'overdue', 'closed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE loan_schedule (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(id),
    payment_no INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    payment_amount NUMERIC(15,2) NOT NULL,
    principal_amount NUMERIC(15,2) NOT NULL,
    interest_amount NUMERIC(15,2) NOT NULL,
    balance_after NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue')),
    paid_amount NUMERIC(15,2) DEFAULT 0,
    paid_date DATE,
    overdue_days INTEGER DEFAULT 0,
    penalty_amount NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE loan_payments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(id),
    payment_date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    principal_part NUMERIC(15,2) DEFAULT 0,
    interest_part NUMERIC(15,2) DEFAULT 0,
    penalty_part NUMERIC(15,2) DEFAULT 0,
    payment_type VARCHAR(30) NOT NULL DEFAULT 'regular' CHECK (payment_type IN ('regular', 'early_partial', 'early_full', 'penalty')),
    description VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE savings (
    id SERIAL PRIMARY KEY,
    contract_no VARCHAR(30) UNIQUE NOT NULL,
    member_id INTEGER NOT NULL REFERENCES members(id),
    amount NUMERIC(15,2) NOT NULL,
    rate NUMERIC(5,2) NOT NULL,
    term_months INTEGER NOT NULL,
    payout_type VARCHAR(20) NOT NULL CHECK (payout_type IN ('monthly', 'end_of_term')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    accrued_interest NUMERIC(15,2) DEFAULT 0,
    paid_interest NUMERIC(15,2) DEFAULT 0,
    current_balance NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'early_closed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE savings_schedule (
    id SERIAL PRIMARY KEY,
    saving_id INTEGER NOT NULL REFERENCES savings(id),
    period_no INTEGER NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    interest_amount NUMERIC(15,2) NOT NULL,
    cumulative_interest NUMERIC(15,2) NOT NULL,
    balance_after NUMERIC(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'accrued')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE savings_transactions (
    id SERIAL PRIMARY KEY,
    saving_id INTEGER NOT NULL REFERENCES savings(id),
    transaction_date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('interest_payout', 'deposit', 'withdrawal', 'early_close')),
    is_cash BOOLEAN DEFAULT FALSE,
    description VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE share_accounts (
    id SERIAL PRIMARY KEY,
    account_no VARCHAR(20) UNIQUE NOT NULL,
    member_id INTEGER NOT NULL REFERENCES members(id),
    balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_in NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_out NUMERIC(15,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE share_transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES share_accounts(id),
    transaction_date DATE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('in', 'out')),
    description VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_members_inn ON members(inn);
CREATE INDEX idx_members_type ON members(member_type);
CREATE INDEX idx_loans_member ON loans(member_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loan_schedule_loan ON loan_schedule(loan_id);
CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id);
CREATE INDEX idx_savings_member ON savings(member_id);
CREATE INDEX idx_savings_status ON savings(status);
CREATE INDEX idx_share_accounts_member ON share_accounts(member_id);

INSERT INTO users (name, email, role, status) VALUES ('Администратор', 'admin@kpk.ru', 'admin', 'active');
