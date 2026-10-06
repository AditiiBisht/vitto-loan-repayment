const { AppError } = require('./errors');
const { verifyToken } = require('./firebase-admin');

// Call at the top of every route. Throws 401 if the Bearer token is missing or not valid.
async function requireUser(request) {
  const match = (request.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!match) throw new AppError(401, 'UNAUTHENTICATED', 'Missing bearer token');
  try {
    return await verifyToken(match[1]);
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired token');
  }
}
module.exports = { requireUser };
