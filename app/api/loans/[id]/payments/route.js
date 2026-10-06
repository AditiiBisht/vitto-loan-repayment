import { requireUser } from '../../../../../lib/auth';
import { ok, handleError, readJson } from '../../../../../lib/api';
import { parseLoanId, validatePaymentInput } from '../../../../../lib/validation';
import { recordPayment } from '../../../../../lib/loan-service';

export async function POST(request, { params }) {
  try {
    await requireUser(request);
    const id = parseLoanId((await params).id);
    const input = validatePaymentInput(await readJson(request));
    const result = await recordPayment(id, input);
    return ok(result, result.duplicate ? 200 : 201); // 200 = already applied earlier
  } catch (err) { return handleError(err); }
}
