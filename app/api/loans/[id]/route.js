import { requireUser } from '../../../../lib/auth';
import { ok, fail, handleError } from '../../../../lib/api';
import { parseLoanId } from '../../../../lib/validation';
import { getLoanDetail } from '../../../../lib/loan-service';

export async function GET(request, { params }) {
  try {
    await requireUser(request);
    const id = parseLoanId((await params).id);
    const detail = await getLoanDetail(id);
    if (!detail) return fail(404, 'NOT_FOUND', 'Loan not found');
    return ok(detail);
  } catch (err) { return handleError(err); }
}
