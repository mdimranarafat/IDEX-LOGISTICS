// ============================================================
// FIREBASE CONFIG — EDIT THIS FILE ONLY
// Paste your real Firebase project config below.
// Get it from: Firebase Console → Project Settings → General → Your apps → SDK setup and config
// ============================================================
import { initializeApp } from "https://www.gstatic.com./firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com./firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com./firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgQQKA3HIRW1DYxTR8S6BfUn3T84InNzo",
  authDomain: "idex-logistics.firebaseapp.com",
  projectId: "idex-logistics",
  storageBucket: "idex-logistics.firebasestorage.app",
  messagingSenderId: "1035854772632",
  appId: "1:1035854772632:web:f4880c9aabc279db7d53ed",
  measurementId: "G-ZPSCX2NZF4"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Fail-fast check: if this file still contains placeholder values,
// Authentication can never work (every sign-in attempt fails with
// auth/invalid-api-key). admin-app.js uses this flag to show a clear
// message on the login screen instead of a generic failure.
export const configIsPlaceholder = Object.values(firebaseConfig)
  .some(v => typeof v === 'string' && v.startsWith('YOUR_'));

if (configIsPlaceholder) {
  console.error(
    '[IDEX] firebase-config.js is NOT configured yet. Replace the YOUR_* ' +
    'placeholders with your real Firebase web app config ' +
    '(Firebase Console → Project Settings → General → Your apps).'
  );
}
