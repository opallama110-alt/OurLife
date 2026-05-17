import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging } from "firebase/messaging";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// NOTE: Cloud Functions binding intentionally removed (was the
// chatWithSystem callable for the Tier 0.1 AI proxy). aiService now
// talks to Groq directly from the browser — see services/aiService.ts
// + CLAUDE.md §6.5 for the policy rationale. Do not re-add
// `getFunctions` / `connectFunctionsEmulator` here without first
// reintroducing a real client callable.

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