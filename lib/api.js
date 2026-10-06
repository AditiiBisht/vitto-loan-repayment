const { AppError } = require('./errors');

// Every response is { success: true, data } or { success: false, error: { code, message } }
const ok = (data, status = 200) => Response.json({ success: true, data }, { status });
const fail = (status, code, message) => Response.json({ success: false, error: { code, message } }, { status });

function handleError(err) {
  if (err instanceof AppError) return fail(err.status, err.code, err.message);
  console.error(err);
  return fail(500, 'INTERNAL_ERROR', 'Something went wrong');
}
async function readJson(request) {
  try { return await request.json(); }
  catch { throw new AppError(400, 'MALFORMED_JSON', 'Request body must be valid JSON'); }
}
module.exports = { ok, fail, handleError, readJson };
