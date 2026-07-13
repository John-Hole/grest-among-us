import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDP523x9SZZ6MVkvl3tVbuv5S8pbzVsxr4",
  authDomain: "grest-among-us.firebaseapp.com",
  databaseURL: "https://grest-among-us-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "grest-among-us",
  storageBucket: "grest-among-us.firebasestorage.app",
  messagingSenderId: "113254807143",
  appId: "1:113254807143:web:f9491251c65d4d717b46c2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export { db, auth, app };
