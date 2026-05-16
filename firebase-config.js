import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging } from "firebase/messaging";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,

    databaseURL: "https://ourlife-55802-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const messaging = getMessaging(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-southeast1");

// Local emulator wiring — only Functions is emulated. Auth + Firestore + RTDB
// keep talking to production so the rest of the app behaves normally during
// Tier 0.1 smoke testing. HMR can re-run this module; the try/catch absorbs
// the "already connected" error a second connect would throw.
if (import.meta.env.DEV) {
  try {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    console.info("[firebase-config] Connected to local Functions emulator (127.0.0.1:5001)");
  } catch (e) {
    console.debug("[firebase-config] Emulator connect skipped:", e?.message ?? e);
  }
}