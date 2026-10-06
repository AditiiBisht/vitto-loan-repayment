const admin = require('firebase-admin');

// Verifies a Firebase ID token with Google's public keys. Throws if invalid/expired.
async function verifyToken(idToken) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
  }
  return admin.auth().verifyIdToken(idToken);
}
module.exports = { verifyToken };
