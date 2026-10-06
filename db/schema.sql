-- All money columns are BIGINT integer paise (1 rupee = 100 paise). Never FLOAT.
CREATE TABLE IF NOT EXISTS loans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  principal BIGINT NOT NULL CHECK (principal > 0),
  annual_interest_rate NUMERIC(6,3) NOT NULL CHECK (annual_interest_rate >= 0 AND annual_interest_rate <= 100),
  tenure_months INTEGER NOT NULL CHECK (tenure_months > 0),
  disbursement_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loan_schedule (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  due_date DATE NOT NULL,
  principal_amount BIGINT NOT NULL CHECK (principal_amount >= 0),
  interest_amount BIGINT NOT NULL CHECK (interest_amount >= 0),
  total_due BIGINT NOT NULL CHECK (total_due >= 0),
  amount_paid BIGINT NOT NULL DEFAULT 0 CHECK (amount_paid >= 0 AND amount_paid <= total_due),
  UNIQUE (loan_id, installment_number)
);

-- FK: a payment can never exist without a loan.
-- UNIQUE (loan_id, idempotency_key): the same payment cannot be stored twice.
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES loans(id),
  amount BIGINT NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (loan_id, idempotency_key)
);
