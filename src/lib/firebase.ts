import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** When Firebase keys are missing the app runs in Demo Mode (localStorage). */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;

export function firebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured");
  if (!app) app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}

let db: Firestore | null = null;

export function firestore(): Firestore {
  if (!db) {
    try {
      db = initializeFirestore(firebaseApp(), { ignoreUndefinedProperties: true });
    } catch {
      db = getFirestore(firebaseApp());
    }
  }
  return db;
}
