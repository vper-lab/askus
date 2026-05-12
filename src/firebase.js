import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  ...(import.meta.env.VITE_FIREBASE_DATABASE_URL ? { databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL } : {}),
};

const hasRequiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
].every(Boolean);

let dbInstance = null;
let analyticsInstance = null;

if (hasRequiredConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    if (firebaseConfig.databaseURL) {
      dbInstance = getDatabase(app);
    } else {
      console.warn('⚠️ Firebase inicializado, pero falta VITE_FIREBASE_DATABASE_URL. Realtime Database no estará disponible.');
    }
    if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
      analyticsInstance = getAnalytics(app);
    }
  } catch (error) {
    console.error('Error inicializando Firebase:', error.message);
  }
} else {
  if (typeof window !== 'undefined') {
    console.warn('⚠️ Firebase no está bien configurado. Revisa src/firebase.js y tu archivo .env.');
  }
}

export const db = dbInstance;
export const analytics = analyticsInstance;
