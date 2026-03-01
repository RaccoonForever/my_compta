import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env['NEXT_PUBLIC_FIREBASE_API_KEY'] ?? 'demo-key',
  authDomain: process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? 'localhost',
  projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'] ?? 'my-compta-dev',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
export const auth = getAuth(app);

// Connect to emulator in development
if (
  process.env['NODE_ENV'] === 'development' &&
  typeof window !== 'undefined' &&
  !(auth as unknown as { _isEmulated?: boolean })._isEmulated
) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    (auth as unknown as { _isEmulated: boolean })._isEmulated = true;
  } catch {
    // Already connected
  }
}
