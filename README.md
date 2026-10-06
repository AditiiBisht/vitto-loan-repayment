# Loan Repayment Service (MSME Lending)

A full-stack loan repayment service for MSME lending built with **Next.js, React, JavaScript, PostgreSQL, and Firebase Authentication**.

The application creates loans, generates EMI schedules, records repayments, handles underpayments, overpayments, late payments and duplicate requests, and displays the current loan position.

## Live Application

**Deployed URL:** https://vitto-loan-repayment-chi.vercel.app

**Test account:** `ltgudiya@gmail.com`

> The test account password is intentionally not included in this public README. It can be shared separately with the reviewer.

---

## Tech Stack

- **Frontend:** React / Next.js
- **Backend:** Next.js Route Handlers
- **Language:** JavaScript
- **Database:** PostgreSQL
- **Production Database:** Neon
- **Authentication:** Firebase Authentication
- **Server-side Auth Verification:** Firebase Admin SDK
- **Testing:** Jest
- **Integration Tests:** Real PostgreSQL database
- **CI:** GitHub Actions
- **Deployment:** Vercel

---

## Features

- Create loans with principal, interest rate, tenure and disbursement date
- Automatically generate the complete EMI schedule
- View loan details and repayment schedule
- Record repayments
- Handle partial/underpayments
- Handle overpayments across outstanding instalments
- Handle late payments
- Reject payments exceeding total outstanding balance
- Prevent duplicate payments using idempotency keys
- Protect all API routes with Firebase Authentication
- Store money as integer paise instead of floating-point values
- Use PostgreSQL transactions and row locking for concurrent payments
- Display outstanding principal, next due amount and overdue amount
- Seed demo loans for overdue and partial-payment scenarios

---

## Seeded Loans

Run `npm run db:seed` to reset and recreate the demo data.

| ID | Loan | Demonstrates |
|---|---|---|
| 1 | ₹2,00,000 · 18% · 24 months · disbursed 2026-10-05 | Fresh loan |
| 2 | ₹5,00,000 · 15% · 36 months · disbursed 2026-03-05 | Overdue instalments |
| 3 | ₹1,00,000 · 12% · 12 months · disbursed 2026-08-05 · ₹5,000 paid | Partial payment |

Overdue status is calculated against the current date.

> **Warning:** `npm run db:seed` wipes and recreates the loan data. Do not run it against the production database unless resetting the demo data is intentional.

---

## Local Setup

### Requirements

- Node.js 20.6+
- PostgreSQL / Neon database
- Firebase project with Email/Password authentication enabled

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy the example environment file:

```bash
cp .env.example .env.local
```

Fill in the required values:
```text
DATABASE_URL=your_production_neon_connection_string
TEST_DATABASE_URL=your_test_database_connection_string
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_service_account_email
FIREBASE_PRIVATE_KEY=your_firebase_service_account_private_key
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
```

For FIREBASE_PRIVATE_KEY, preserve the newline escape sequences (\n) when storing the value in the environment variable.
### 3. Create the database schema
npm run db:setup

This operation is idempotent and creates the required PostgreSQL tables.
### 4. Seed demo data
npm run db:seed

This resets and seeds the demo loans described above.
### 5. Start the development server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

## Firebase Authentication

The application uses Firebase Email/Password authentication.

Create a test user from:

**Firebase Console → Authentication → Users**

The client obtains a Firebase ID token after login.

The token is then sent to the API as:

```http
Authorization: Bearer <Firebase ID token>
```

The server verifies the token using the Firebase Admin SDK.

Requests without a valid token return:

```http
401 Unauthorized
```

## API

All API endpoints require:

```http
Authorization: Bearer <Firebase ID token>
```

### Response Format

Successful responses:

```json
{
  "success": true,
  "data": {}
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

### Money Convention

API inputs are expressed in **rupees**.

API/database monetary values are represented as integer **paise** where applicable.

### GET `/api/loans`

Returns the available loans.

Used by the frontend to populate the loan selector.

Requires authentication.

### POST `/api/loans`

Creates a loan and its repayment schedule.

Example request:

```json
{
  "principal": 200000,
  "annualInterestRate": 18,
  "tenureMonths": 24,
  "disbursementDate": "2026-10-05"
}
```

Successful response:

```http
201 Created
```

The response contains the created loan, generated schedule and current position.

### GET `/api/loans/:id`

Returns:

- Loan details
- Complete repayment schedule
- Outstanding principal
- Next due date
- Next due amount
- Overdue amount

Example:

```http
GET /api/loans/3
```

### POST `/api/loans/:id/payments`

Records a repayment.

Example:

```json
{
  "amount": 5000,
  "date": "2026-11-05",
  "idempotencyKey": "ref-123"
}
```

Successful first request:

```http
201 Created
```

A repeated request with the same loan and idempotency key returns:

```http
200 OK
```

with:

```json
{
  "duplicate": true
}
```

The payment is not applied twice.

## Validation and Error Handling

The API validates:

- Principal must be positive
- Interest rate must be valid
- Tenure must be positive
- Payment amount must be positive
- Payment date must be valid
- Idempotency key must be supplied
- Loan must exist
- Payment cannot exceed the total outstanding balance

### Typical Status Codes

| Status | Meaning |
|---|---|
| `200` | Successful request / duplicate payment |
| `201` | Loan or payment created |
| `400` | Invalid request or validation error |
| `401` | Missing or invalid Firebase authentication |
| `404` | Loan not found |
| `422` | Payment exceeds total outstanding balance |
| `500` | Unexpected server error |

## Money Handling

Money is stored as integer **paise** in PostgreSQL `BIGINT`.

For example:

```text
₹9,986.50 = 998650 paise
```

Floating-point values are avoided for persisted monetary amounts because values such as `0.1` cannot always be represented exactly in binary floating-point arithmetic.

Using `BIGINT` also provides a much larger range than PostgreSQL `INTEGER`.

Rupee input is parsed from text using:

```text
lib/money.js
```

The application does not calculate monetary values by simply multiplying user input by `100` using floating-point arithmetic.

## EMI Calculation and Rounding

Monthly interest is calculated as:

```text
round(balance × annualInterestRate / 1200)
```

The principal component is:

```text
EMI - interest
```

The final instalment uses the exact remaining principal balance so that:

```text
Total principal repaid = Original loan principal
```

As a result, the final EMI may differ from the regular EMI by a few paise.

## Payment Allocation Policy

The payment allocation policy is:

1. Apply payment to the **oldest unpaid instalment first**.
2. Within an instalment, apply payment to **interest first**.
3. Apply the remaining amount to principal.
4. If money remains after fully paying an instalment, continue to the next outstanding instalment.
5. Never apply more than the outstanding amount of an instalment.
6. If the payment exceeds the total outstanding balance, reject the entire payment with `422`.
7. No prepayment closure is performed; excess payment is allocated to subsequent scheduled instalments.

Only the total `amount_paid` is stored for each instalment. Interest and principal portions paid are derived from that value.

### Underpayment

If a payment is less than the amount due:

- The payment is applied to the oldest outstanding instalment.
- Interest is satisfied first.
- The remaining amount reduces principal.
- The instalment remains partially outstanding.
- The schedule displays it as `PARTIAL` or `OVERDUE_PARTIAL`, depending on the due date.

### Overpayment

If a payment is greater than one instalment:

- The first instalment is fully settled.
- Any remaining amount moves to the next outstanding instalment.
- The process continues until the payment is fully allocated.

A payment exceeding the entire outstanding loan balance is rejected.

### Late Payment

Late payments do not create additional penalty interest.

An instalment is considered overdue when:

```text
due_date < today
```

and it still has an outstanding amount.

A late payment is allocated using the same normal allocation policy and reduces the overdue amount accordingly.

## Duplicate Payments and Idempotency

Payment requests use an idempotency key.

The database enforces:

```sql
UNIQUE (loan_id, idempotency_key)
```

The payment insert uses conflict handling so that a repeated request with the same key does not create another payment.

A duplicate request returns the original payment information with:

```json
{
  "duplicate": true
}
```

and does not modify the loan balance a second time.

The frontend generates a UUID idempotency key for each payment submission.

## Concurrent Payments

Payment processing runs inside a PostgreSQL transaction.

Before modifying the repayment state, the service locks the loan row using:

```sql
SELECT ... FOR UPDATE
```

This ensures concurrent payments for the same loan are processed sequentially and prevents two simultaneous requests from overwriting each other's repayment state.

## Database Integrity

The database uses a foreign-key relationship:

```text
payments.loan_id → loans.id
```

This prevents a payment from being stored for a non-existent loan.

The repayment schedule is stored separately from the loan and contains one row per scheduled instalment.

## Testing

Run the complete test suite with:

```bash
npm test
```

The test suite contains **11 tests** across unit and integration test suites.

The tests cover:

- EMI calculation
- Payment allocation
- Underpayment
- Overpayment allocation
- Duplicate/idempotent payments
- Invalid input
- Unknown loans
- Authentication failure
- Real PostgreSQL persistence
- Repayment schedule creation

### Integration Tests

Integration tests use a separate PostgreSQL database through:

```text
TEST_DATABASE_URL
```

They call the actual Next.js route handlers and interact with a real PostgreSQL database.

The Firebase token verification is mocked only at the authentication boundary so the integration tests do not require a real Firebase user.

The integration tests do not use the production database.

Run the test suite with:

```bash
npm test
```

## Continuous Integration

GitHub Actions runs the test suite on:

- Every push
- Every pull request

The workflow:

1. Starts a PostgreSQL 16 service.
2. Creates the test database schema.
3. Installs dependencies.
4. Runs the complete Jest test suite.

Workflow:

```text
.github/workflows/test.yml
```

## Deployment

The application is deployed using **Vercel**.

### Production Services

- **Frontend/API:** Vercel
- **Database:** Neon PostgreSQL
- **Authentication:** Firebase Authentication
- **Server-side Firebase verification:** Firebase Admin SDK

### Deployment Steps

1. Create the PostgreSQL database in Neon.
2. Run the database schema setup.
3. Seed the required demo data.
4. Create the Firebase project.
5. Enable Email/Password authentication.
6. Create a Firebase test user.
7. Generate the Firebase Admin service-account credentials.
8. Import the GitHub repository into Vercel.
9. Add the required environment variables.
10. Deploy the application.
11. Add the Vercel production domain to Firebase Authentication's authorized domains.

### Production URL

```text
https://vitto-loan-repayment-chi.vercel.app
```

## Environment Variables

Required variables:

```text
DATABASE_URL
TEST_DATABASE_URL

FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY

NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
```

Production secrets such as the database connection string and Firebase Admin private key must never be committed to Git.

The repository uses `.env.local` for local secrets and keeps it excluded through `.gitignore`.

## Project Structure

```text
.
├── app/
│   ├── api/
│   │   └── loans/
│   │       ├── route.js
│   │       └── [id]/
│   │           ├── route.js
│   │           └── payments/
│   │               └── route.js
│   └── page.js
│
├── db/
│   ├── migrate.js
│   └── seed.js
│
├── lib/
│   ├── api.js
│   ├── auth.js
│   ├── db.js
│   ├── errors.js
│   ├── firebase-admin.js
│   ├── loan-service.js
│   ├── money.js
│   └── validation.js
│
├── tests/
│   ├── api.integration.test.js
│   ├── calculator.test.js
│   ├── payment-allocation.test.js
│   └── setup-env.js
│
├── .github/
│   └── workflows/
│       └── test.yml
│
├── .env.example
├── jest.config.js
├── package.json
└── README.md
```

## Security Notes

- Firebase ID tokens are verified server-side.
- Firebase Admin credentials are stored only in environment variables.
- Database credentials are stored only in environment variables.
- `.env.local` is excluded from Git.
- Payment idempotency is enforced at the database level.
- Payment processing uses database transactions and row locking.
- The public Firebase Web API key is used only for client-side Firebase configuration; server-side Firebase Admin credentials remain private.

## License

This project was created as a technical assessment for the Vitto MSME Lending assessment.