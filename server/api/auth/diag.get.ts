import { defineEventHandler } from 'h3';
import { getFirebaseAdminApp, getAdminAuth, getAdminDb } from '../../utils/firebaseAdmin';

/**
 * Diagnostic Endpoint for Firebase Admin & Vercel Environment Variables
 * Safe for inspection: Never leaks private keys or credentials.
 */
export default defineEventHandler(async () => {
  const config = useRuntimeConfig();

  const projectId =
    (config.public.firebaseProjectId as string) ||
    process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    '';

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

  const hasPrivateKey = !!rawPrivateKey && rawPrivateKey.length > 50;
  const privateKeyTrimmed = rawPrivateKey.trim();
  const startsWithQuote = privateKeyTrimmed.startsWith('"') || privateKeyTrimmed.startsWith("'");
  const endsWithQuote = privateKeyTrimmed.endsWith('"') || privateKeyTrimmed.endsWith("'");
  const hasBeginTag = rawPrivateKey.includes('-----BEGIN PRIVATE KEY-----');
  const hasEndTag = rawPrivateKey.includes('-----END PRIVATE KEY-----');

  let adminAppStatus = 'PENDING';
  let adminAuthStatus = 'PENDING';
  let firestoreStatus = 'PENDING';
  let initError: string | null = null;

  try {
    const app = getFirebaseAdminApp();
    adminAppStatus = app ? 'SUCCESS' : 'NULL_APP';

    const auth = getAdminAuth();
    adminAuthStatus = auth ? 'SUCCESS' : 'NULL_AUTH';

    const db = getAdminDb();
    const testDoc = await db.collection('users').limit(1).get();
    firestoreStatus = `SUCCESS (Read ${testDoc.size} docs)`;
  } catch (err: unknown) {
    initError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    diagnostics: {
      projectId: {
        value: projectId,
        isConfigured: !!projectId,
      },
      clientEmail: {
        value: clientEmail ? `${clientEmail.slice(0, 15)}...${clientEmail.slice(-15)}` : 'MISSING',
        isConfigured: !!clientEmail,
      },
      privateKey: {
        isConfigured: hasPrivateKey,
        length: rawPrivateKey.length,
        hasBeginTag,
        hasEndTag,
        startsWithQuote,
        endsWithQuote,
      },
      services: {
        adminApp: adminAppStatus,
        adminAuth: adminAuthStatus,
        firestore: firestoreStatus,
      },
      error: initError,
    },
  };
});

