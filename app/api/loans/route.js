import { requireUser } from '../../../lib/auth';
import { ok, handleError, readJson } from '../../../lib/api';
import { validateLoanInput } from '../../../lib/validation';
import { createLoan, listLoans } from '../../../lib/loan-service';

export async function GET(request) {
  try {
    await requireUser(request);
    return ok(await listLoans());
  } catch (err) { return handleError(err); }
}

export async function POST(request) {
  try {
    await requireUser(request);
    const input = validateLoanInput(await readJson(request));
    return ok(await createLoan(input), 201);
  } catch (err) { return handleError(err); }
}
