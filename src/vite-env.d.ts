/// <reference types="vite/client" />

// ─────────────────────────────────────────────────────────────────────────
// Vite ImportMeta env typing — added when aiService.ts became the first
// strict-TS consumer of import.meta.env.VITE_GROQ_API_KEY (other env
// consumers like firebase-config.js are JS files and bypass tsc).
// Each VITE_*-prefixed env var should be declared here so the rest of
// the app gets autocomplete + type-checking.
// ─────────────────────────────────────────────────────────────────────────

interface ImportMetaEnv {
  readonly VITE_GROQ_API_KEY: string;

  // Firebase config (defined in .env.local; consumed by firebase-config.js)
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
