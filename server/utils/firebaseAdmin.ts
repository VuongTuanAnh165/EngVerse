import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Singleton storage for Firebase Admin instances
 * Prevents multiple initializations during Serverless Function warm-up
 */
let _adminApp: App | null = null;
let _adminAuth: Auth | null = null;
let _adminDb: Firestore | null = null;

/**
 * Initializes or retrieves the Firebase Admin App Singleton
 */
export function getFirebaseAdminApp(): App {
  // If already initialized by Firebase runtime
  if (getApps().length > 0) {
    return getApp();
  }

  // If cached locally
  if (_adminApp) {
    return _adminApp;
  }

  const config = useRuntimeConfig();

  const projectId =
    (config.public.firebaseProjectId as string) ||
    process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    'ai-hub-1f53a';

  const clientEmail =
    (config.firebaseClientEmail as string) ||
    process.env.FIREBASE_CLIENT_EMAIL ||
    process.env.NUXT_FIREBASE_CLIENT_EMAIL ||
    '';

  const rawPrivateKey =
    (config.firebasePrivateKey as string) ||
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.NUXT_FIREBASE_PRIVATE_KEY ||
    '';

  // Handle all PEM formats: trim, remove surrounding quotes from Vercel env, replace \n
  let privateKey = rawPrivateKey.trim();
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1).trim();
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error(
      `[FirebaseAdmin] Thiếu thông tin cấu hình (clientEmail: ${clientEmail ? 'OK' : 'MISSING'}, privateKey: ${privateKey ? 'OK' : 'MISSING'})`
    );
  }

  _adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });

  return _adminApp;
}

/**
 * Returns singleton Auth instance
 */
export function getAdminAuth(): Auth {
  if (!_adminAuth) {
    _adminAuth = getAuth(getFirebaseAdminApp());
  }
  return _adminAuth;
}

/**
 * Returns singleton Firestore instance
 */
export function getAdminDb(): Firestore {
  if (!_adminDb) {
    const db = getFirestore(getFirebaseAdminApp());
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Ignore if Firestore settings were already applied
    }
    _adminDb = db;
  }
  return _adminDb;
}

/**
 * Lazy-initialized adminAuth Proxy
 * Safely defers initialization to first call without throwing during build
 */
export const adminAuth: Auth = new Proxy({} as Auth, {
  get<K extends keyof Auth>(_target: Auth, prop: K): Auth[K] {
    const authInstance = getAdminAuth();
    const value = authInstance[prop];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(authInstance) as unknown as Auth[K]
      : value;
  },
});

/**
 * Lazy-initialized adminDb Proxy
 * Safely defers initialization to first call without throwing during build
 */
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get<K extends keyof Firestore>(_target: Firestore, prop: K): Firestore[K] {
    const dbInstance = getAdminDb();
    const value = dbInstance[prop];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(dbInstance) as unknown as Firestore[K]
      : value;
  },
});

