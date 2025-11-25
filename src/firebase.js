// src/firebase.js

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

const firebaseConfig = {
  apiKey:
    process.env.REACT_APP_FIREBASE_API_KEY ||
    "AIzaSyC6xbu-keOE2GLWFFZ4hBAFmZr5TXjvSX4",
  authDomain:
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "pqchat-app.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "pqchat-app",
  storageBucket:
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "pqchat-app.appspot.com",
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "970955153659",
  appId:
    process.env.REACT_APP_FIREBASE_APP_ID ||
    "1:970955153659:web:df7af3a7e67357f067d05e",
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

console.log("[Firebase] Bootstrapping with config:", {
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  hasApiKey: Boolean(firebaseConfig.apiKey),
  missingKeys,
});

export const firebaseDiagnostics = {
  missingKeys,
  config: firebaseConfig,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
