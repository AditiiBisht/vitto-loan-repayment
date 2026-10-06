import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Called lazily in the browser so the build does not need Firebase env vars.
export function getFirebaseAuth() {
  const app = getApps().length ? getApps()[0] : initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
  return getAuth(app);
}
