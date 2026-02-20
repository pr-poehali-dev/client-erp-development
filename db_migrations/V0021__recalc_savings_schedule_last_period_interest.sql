-- Пересчёт interest_amount для последних периодов по фактическим дням

-- id=14, период 3: 2026-03-31 → 2026-05-05 = 35 дней, 600000 × 16% × 35 / 365
UPDATE t_p25513958_client_erp_developme.savings_schedule
SET interest_amount = ROUND(600000.00 * 16.0 / 100 * 35 / 365, 2),
    cumulative_interest = ROUND(
        (SELECT SUM(interest_amount) FROM t_p25513958_client_erp_developme.savings_schedule WHERE saving_id=14 AND period_no < 3)
        + ROUND(600000.00 * 16.0 / 100 * 35 / 365, 2), 2
    ),
    balance_after = 600000.00
WHERE saving_id = 14 AND period_no = 3;

-- id=11, период 14: 2026-07-31 → 2026-08-09 = 9 дней, 409933.99 × 23% × 9 / 365
UPDATE t_p25513958_client_erp_developme.savings_schedule
SET interest_amount = ROUND(409933.99 * 23.0 / 100 * 9 / 365, 2),
    cumulative_interest = ROUND(
        (SELECT SUM(interest_amount) FROM t_p25513958_client_erp_developme.savings_schedule WHERE saving_id=11 AND period_no < 14)
        + ROUND(409933.99 * 23.0 / 100 * 9 / 365, 2), 2
    ),
    balance_after = 409933.99
WHERE saving_id = 11 AND period_no = 14;

-- id=13, период 13: 2026-11-30 → 2027-01-10 = 41 день, 1457000.00 × 24% × 41 / 365
UPDATE t_p25513958_client_erp_developme.savings_schedule
SET interest_amount = ROUND(1457000.00 * 24.0 / 100 * 41 / 365, 2),
    cumulative_interest = ROUND(
        (SELECT SUM(interest_amount) FROM t_p25513958_client_erp_developme.savings_schedule WHERE saving_id=13 AND period_no < 13)
        + ROUND(1457000.00 * 24.0 / 100 * 41 / 365, 2), 2
    ),
    balance_after = 1457000.00
WHERE saving_id = 13 AND period_no = 13;
