import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';

let _clientApp: FirebaseApp | null = null;
let _clientAuth: Auth | null = null;

/**
 * EngVerse - Client-side Firebase SDK Singleton
 * Strictly uses public configuration from runtimeConfig.public
 * Reference: docs/ke_hoach.md - Sprint 1 (Task 4)
 */
export function useFirebase() {
  function getClientApp(): FirebaseApp | null {
    if (!import.meta.client) {
      return null;
    }

    if (getApps().length > 0) {
      return getApp();
    }

    if (_clientApp) {
      return _clientApp;
    }

    const config = useRuntimeConfig();
    const publicConfig = config.public;

    if (!publicConfig.firebaseApiKey) {
      console.warn('[FirebaseClient] Missing firebaseApiKey in runtimeConfig.public');
      return null;
    }

    _clientApp = initializeApp({
      apiKey: publicConfig.firebaseApiKey,
      authDomain: publicConfig.firebaseAuthDomain,
      projectId: publicConfig.firebaseProjectId,
      storageBucket: publicConfig.firebaseStorageBucket,
      messagingSenderId: publicConfig.firebaseMessagingSenderId,
      appId: publicConfig.firebaseAppId,
    });

    return _clientApp;
  }

  function getClientAuth(): Auth | null {
    if (!import.meta.client) {
      return null;
    }

    if (_clientAuth) {
      return _clientAuth;
    }

    const app = getClientApp();
    if (!app) {
      return null;
    }

    _clientAuth = getAuth(app);
    return _clientAuth;
  }

  /**
   * Prompts user with Google Sign-In popup and returns ID Token for backend validation
   */
  async function signInWithGoogle(): Promise<{ user: User; idToken: string }> {
    const auth = getClientAuth();
    if (!auth) {
      throw new Error('[FirebaseClient] Firebase Auth is unavailable on server or unconfigured');
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    const userCredential = await signInWithPopup(auth, provider);
    const idToken = await userCredential.user.getIdToken();

    return {
      user: userCredential.user,
      idToken,
    };
  }

  /**
   * Signs user out of Firebase Client SDK
   */
  async function signOutClient(): Promise<void> {
    const auth = getClientAuth();
    if (auth) {
      await firebaseSignOut(auth);
    }
  }

  /**
   * Subscribes to Firebase Auth state changes
   */
  function onClientAuthStateChanged(callback: (user: User | null) => void): () => void {
    const auth = getClientAuth();
    if (!auth) {
      return () => {};
    }
    return onAuthStateChanged(auth, callback);
  }

  return {
    getClientApp,
    getClientAuth,
    signInWithGoogle,
    signOutClient,
    onClientAuthStateChanged,
  };
}

