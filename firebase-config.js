// ============================================================
// FIREBASE CONFIG — EDIT THIS FILE ONLY
// Paste your real Firebase project config below.
// Get it from: Firebase Console → Project Settings → General → Your apps → SDK setup and config
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

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
export const storage = getStorage(app);
