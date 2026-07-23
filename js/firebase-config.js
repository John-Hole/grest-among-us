import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

// Firebase Configuration for realmong-us-g20b
const firebaseConfig = {
  apiKey: "AIzaSyBSbg2-cLl3SYG4odF2NYWWDtshoEv6lVo",
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

export { db, auth, app, firebaseConfig };
