import { defineEventHandler } from 'h3';

/**
 * Diagnostic Endpoint with Zero-Crash Architecture
 * Uses dynamic import inside the handler so the module NEVER crashes at boot time.
 */
export default defineEventHandler(async () => {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    envKeysAvailable: Object.keys(process.env).filter(
      (k) => k.includes('FIREBASE') || k.includes('NUXT')
    ),
  };

  try {
    const fbAdmin = await import('../../utils/firebaseAdmin');
    diagnostics.moduleImport = 'SUCCESS';

    try {
      const app = fbAdmin.getFirebaseAdminApp();
      diagnostics.adminApp = app ? 'SUCCESS' : 'NULL';

      const auth = fbAdmin.getAdminAuth();
      diagnostics.adminAuth = auth ? 'SUCCESS' : 'NULL';

      const db = fbAdmin.getAdminDb();
      const test = await db.collection('users').limit(1).get();
      diagnostics.firestore = `SUCCESS (Found ${test.size} docs)`;
    } catch (fbErr: unknown) {
      diagnostics.firebaseExecutionError =
        fbErr instanceof Error ? `${fbErr.name}: ${fbErr.message}` : String(fbErr);
      if (fbErr instanceof Error && fbErr.stack) {
        diagnostics.firebaseExecutionStack = fbErr.stack.split('\n').slice(0, 5);
      }
    }
  } catch (importErr: unknown) {
    diagnostics.moduleImport = 'FAILED';
    diagnostics.moduleImportError =
      importErr instanceof Error ? `${importErr.name}: ${importErr.message}` : String(importErr);
    if (importErr instanceof Error && importErr.stack) {
      diagnostics.moduleImportStack = importErr.stack.split('\n').slice(0, 5);
    }
  }

  return { diagnostics };
});
