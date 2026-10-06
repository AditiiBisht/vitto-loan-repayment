const { AppError } = require('./errors');
const { rupeesToPaise } = require('./money');

const MAX_PAISE = 1e13; // Rs 100 billion, keeps all maths well inside safe integers
const bad = (msg) => { throw new AppError(400, 'VALIDATION_ERROR', msg); };
const isNumeric = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v));

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) bad('Body must be a JSON object');
}

function validateLoanInput(body) {
  requireObject(body);
  const principalPaise = rupeesToPaise(body.principal);
  if (principalPaise === null || principalPaise <= 0 || principalPaise > MAX_PAISE) bad('principal must be a positive number of rupees (max 2 decimals)');
  if (!isNumeric(body.annualInterestRate) || Number(body.annualInterestRate) < 0 || Number(body.annualInterestRate) > 100) bad('annualInterestRate must be a number between 0 and 100');
  if (!isNumeric(body.tenureMonths) || !Number.isInteger(Number(body.tenureMonths)) || Number(body.tenureMonths) < 1 || Number(body.tenureMonths) > 600) bad('tenureMonths must be a whole number between 1 and 600');
  if (!isValidDate(body.disbursementDate)) bad('disbursementDate must be a valid date (YYYY-MM-DD)');
  return {
    principalPaise,
    annualInterestRate: Number(body.annualInterestRate),
    tenureMonths: Number(body.tenureMonths),
    disbursementDate: body.disbursementDate,
  };
}

function validatePaymentInput(body) {
  requireObject(body);
  const amountPaise = rupeesToPaise(body.amount);
  if (amountPaise === null || amountPaise <= 0 || amountPaise > MAX_PAISE) bad('amount must be a positive number of rupees (max 2 decimals)');
  if (!isValidDate(body.date)) bad('date must be a valid date (YYYY-MM-DD)');
  const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  if (key.length < 1 || key.length > 100) bad('idempotencyKey must be a non-empty string (max 100 chars)');
  return { amountPaise, date: body.date, idempotencyKey: key };
}

function parseLoanId(id) {
  if (!/^\d{1,15}$/.test(String(id)) || Number(id) < 1) bad('Loan id must be a positive integer');
  return Number(id);
}
module.exports = { validateLoanInput, validatePaymentInput, parseLoanId, isValidDate };
