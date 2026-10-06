# Loan Repayment Service (MSME lending)

Next.js (React + Route Handlers), JavaScript only, PostgreSQL (Neon-ready), Firebase Auth (email/password).
Creates loans, stores the full EMI schedule, records payments (under/over/late/duplicate) and shows the loan position.

**Deployed URL:** _<add Vercel URL>_ · **Test account:** _<add email/password>_

## Seeded loans (`npm run db:seed`, ids are fixed because the seed resets the tables)
| ID | Loan | Demonstrates |
|----|------|--------------|
| 1 | ₹2,00,000 · 18% · 24m · disbursed 2026-10-05 | Fresh loan, nothing due yet |
| 2 | ₹5,00,000 · 15% · 36m · disbursed 2026-03-05, no payments | **Overdue instalments** (highlighted red) |
| 3 | ₹1,00,000 · 12% · 12m · disbursed 2026-08-05, ₹5,000 paid | **Partial payment**; instalment 1 still overdue |

Overdue is judged against today's date, so re-seed with newer dates if the demo data gets old.

## Setup
```
npm install
cp .env.example .env.local     # fill in values (Neon URL, Firebase)
npm run db:setup               # creates tables (idempotent)
npm run db:seed                # WARNING: wipes and re-seeds loan data
npm run dev
```
Requires Node 20.6+. Create the Firebase user (Console → Authentication → Email/Password) for the reviewer.

## Testing
`TEST_DATABASE_URL=postgres://user:pass@localhost:5432/loans_test npm test`
Runs 12 tests: unit tests (calculator, allocation) plus integration tests that call the real route handlers against real
PostgreSQL. Only the Firebase token check is mocked (so no real Firebase user is needed in CI). The integration tests
create their own loans and never wipe data. CI: `.github/workflows/test.yml` (Postgres service, schema setup, tests on every push).

## API
All endpoints need `Authorization: Bearer <Firebase ID token>`, otherwise **401**. Success: `{ "success": true, "data": ... }`.
Error: `{ "success": false, "error": { "code", "message" } }` (400 validation, 401, 404, 422 overpayment beyond loan).
Inputs are in **rupees** (max 2 decimals); outputs are integer **paise** (fields end in `Paise`).
- `GET /api/loans` – list loans (used by the UI)
- `POST /api/loans` – `{"principal":200000,"annualInterestRate":18,"tenureMonths":24,"disbursementDate":"2026-10-05"}` → 201, loan + schedule + position
- `GET /api/loans/:id` – loan, full schedule, `position` (`outstandingPrincipalPaise`, `nextDueDate`, `nextDueAmountPaise`, `overdueAmountPaise`)
- `POST /api/loans/:id/payments` – `{"amount":5000,"date":"2026-11-05","idempotencyKey":"ref-123"}` → 201 with `payment`, `allocations`, updated `schedule` and `position`; 200 with `duplicate:true` if the key was already used

## Money
Money is stored as integer **paise** in `BIGINT` (₹9,986.50 = 998650). Floats can't represent values like 0.1 exactly and errors
accumulate; integers are exact. BIGINT avoids the 2.1 billion paise (₹2.1 crore) limit of INTEGER. Rupee input is parsed from text
(`lib/money.js`), never multiplied as floats. The only float maths is the EMI power term, rounded to whole paise immediately.

## Rounding
Interest = `round(balance × rate / 1200)` per month; principal part = EMI − interest. The **last instalment's principal is the
remaining balance**, so total principal equals the loan exactly and the balance ends at 0 (last EMI differs by a few paise).

## Payment allocation
1. Oldest unpaid instalment first. 2. Interest before principal. 3. If money remains, move to the next instalment.
4. Never apply more than is owed on an instalment. 5. If the payment exceeds the total outstanding, it is **rejected (422)** and nothing is saved.
Only `amount_paid` is stored per instalment; interest/principal paid are derived (`interestPaid = min(amount_paid, interest)`).
- **Underpayment:** instalment stays `PARTIAL`; remainder stays outstanding.
- **Overpayment:** surplus flows into the next instalment(s) (no prepayment closure).
- **Late payment:** no penalty interest. Allocated normally; an instalment is overdue while `due_date < today` and unpaid, so a late payment that settles it clears the overdue amount.

## Duplicate & concurrent payments
`UNIQUE (loan_id, idempotency_key)` plus `INSERT ... ON CONFLICT DO NOTHING`. A repeat returns the original payment (200, `duplicate:true`)
and changes nothing. Each payment runs in a transaction that first locks the loan row (`SELECT ... FOR UPDATE`), so simultaneous
payments are processed one at a time and can't overwrite each other. The UI keeps the same key when retrying a failed submit.

## Auth
`lib/auth.js` reads the Bearer token and `lib/firebase-admin.js` verifies it with Firebase Admin on the server. Missing/invalid → 401.
The foreign key `payments.loan_id → loans.id` makes it impossible for the database to hold a payment without a loan.

## Deployment (Vercel + Neon + Firebase)
1. Create a Neon DB; run `db:setup` and `db:seed` locally with its `DATABASE_URL`. 2. Create a Firebase project, enable Email/Password, add a test user,
generate a service-account key. 3. Import the repo in Vercel and set every variable from `.env.example`
(keep `\n` in `FIREBASE_PRIVATE_KEY`). 4. Add the Vercel domain to Firebase → Authentication → Authorized domains.
