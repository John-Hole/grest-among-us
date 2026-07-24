import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

// Firebase Configuration for realmong-us-g20b
const firebaseConfig = {
  apiKey: "AIzaSyDJvLk7jYzBn5YoNIUlhTgwl0TAFMcpxVc",
  authDomain: "realmong-us-g20b.firebaseapp.com",
  databaseURL: "https://realmong-us-g20b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "realmong-us-g20b",
  storageBucket: "realmong-us-g20b.firebasestorage.app",
  messagingSenderId: "200595572263",
  appId: "1:200595572263:web:62f7eeb3cca84df5b7f002",
  measurementId: "G-EB9910R23E"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let authPromise = null;

export function ensureAuth() {
  if (authPromise) return authPromise;
  authPromise = new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        try {
          const displayName = user.isAnonymous ? 'Ospite' : (user.displayName || user.email || 'Utente');
          const displayEmail = user.isAnonymous ? 'Account Ospite' : (user.email || user.displayName || 'Utente');
          localStorage.setItem('realmong_user_cache', JSON.stringify({
            uid: user.uid,
            displayName,
            email: displayEmail,
            isAnonymous: user.isAnonymous
          }));
        } catch (e) {}
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          const u = cred.user;
          try {
            localStorage.setItem('realmong_user_cache', JSON.stringify({
              uid: u.uid,
              displayName: 'Ospite',
              email: 'Account Ospite',
              isAnonymous: true
            }));
          } catch (e) {}
          resolve(u);
        } catch (e) {
          console.error("Auto sign-in failed:", e);
          resolve(null);
        }
      }
    });
  });
  return authPromise;
}

export { db, auth, app, firebaseConfig };
