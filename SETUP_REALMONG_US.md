# 📋 Setup Instructions - Realmong Us

## 🎯 Obiettivo
Rinominare il progetto Firebase da "grest-among-us" a "realmong-us" con credenziali nuove.

---

## ⚙️ TODO CHECKLIST

### 1️⃣ Create New Firebase Project

#### Via Firebase Console:

1. Vai a https://console.firebase.google.com
2. Clicca **"Add project"** o **"Create project"**
3. Inserisci:
   - **Project name:** `Realmong Us`
   - **Project ID:** `realmong-us` (importante: esattamente questo)
4. Clicca **"Continue"**
5. Disabilita Google Analytics (opzionale)
6. Clicca **"Create project"** e attendi

### 2️⃣ Ottenere le Credenziali Firebase

1. Vai a **Project Settings** (⚙️ icon in basso a sinistra)
2. Tab **"General"**
3. Sezione **"Your apps"**
4. Clicca su App **"Web"** (o aggiungi se non esiste)
5. Copia i dati mostrati:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...", // Copia questo
     authDomain: "realmong-us.firebaseapp.com",
     databaseURL: "https://realmong-us-default-rtdb.XXX.firebasedatabase.app",
     projectId: "realmong-us",
     storageBucket: "realmong-us.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123def456"
   };
   ```

### 3️⃣ Aggiornare `.env.local`

Apri il file `.env.local` e sostituisci i valori con quelli dal Firebase Console:

```bash
VITE_FIREBASE_API_KEY=AIzaSy...           # Dalla sezione config
VITE_FIREBASE_AUTH_DOMAIN=realmong-us.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://realmong-us-default-rtdb.XXX.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=realmong-us
VITE_FIREBASE_STORAGE_BUCKET=realmong-us.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
VITE_APP_URL=https://realmong-us.vercel.app
VITE_APP_NAME=Realmong Us
```

**⚠️ IMPORTANTE:** `.env.local` è in `.gitignore` e NON sarà committato.

### 4️⃣ Creare Realtime Database

1. Nel Firebase Console, vai a **Realtime Database**
2. Clicca **"Create Database"**
3. Location: Scegli la region più vicina
4. Security Rules: **"Start in production mode"**
5. Clicca **"Enable"**
6. Copia l'URL del database (nelle Rules, in alto a destra)
7. Incolla in `.env.local` come `VITE_FIREBASE_DATABASE_URL`

### 5️⃣ Abilitare Anonymous Authentication

1. Nel Firebase Console, vai a **Authentication**
2. Tab **"Sign-in method"**
3. Clicca su **"Anonymous"**
4. Toggle **"Enable"**
5. Clicca **"Save"**

### 6️⃣ Deployare le Firebase Rules

#### Opzione A: Via Firebase CLI (Consigliato)

```bash
# Installa Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Deploy rules
firebase deploy --only database:rules -P realmong-us
```

#### Opzione B: Via Firebase Console

1. Firebase Console → **Realtime Database** → **Rules**
2. Copia il contenuto di `firebase-rules.json`
3. Incolla nel Rules editor
4. Clicca **"Publish"**

### 7️⃣ Aggiungere Variabili di Ambiente a Vercel

1. Vai a https://vercel.com/dashboard
2. Seleziona il progetto **"realmong-us"**
3. **Settings** → **Environment Variables**
4. Aggiungi le seguenti variabili (dai valori di `.env.local`):
   ```
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=realmong-us.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://realmong-us-default-rtdb.XXX.firebasedatabase.app
   VITE_FIREBASE_PROJECT_ID=realmong-us
   VITE_FIREBASE_STORAGE_BUCKET=realmong-us.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
   ```
5. Availability: **Production**

### 8️⃣ Testare Localmente

```javascript
// Console browser, su http://localhost:5173 (o simile)

import { authService } from './js/AuthService.js';

// 1. Inizializza
await authService.init();
console.log('Auth status:', authService.getAuthStatus());

// 2. Login anonimo
await authService.signInAsGuest();
console.log('Logged in:', authService.isAuthenticated());

// 3. Crea sessione
authService.createPlayerSession('TEST1', 'TestPlayer');
console.log('Session:', authService.getPlayerSession());

// 4. Verifica sessionStorage
console.log('SessionStorage:', sessionStorage.getItem('playerSession'));
```

Tutti i log dovrebbero essere ✅ con successo!

### 9️⃣ Deployare su Vercel

```bash
cd /path/to/repo
git add .
git commit -m "Rename Firebase project from grest-among-us to realmong-us"
git push origin main
```

Vercel auto-deploya quando hai pushato. ✨

---

## 🔍 Validazione

Dopo il deploy a Vercel:

- [ ] Vercel deployment completato (check: https://vercel.com/dashboard)
- [ ] App carica senza errori di Firebase
- [ ] AuthService funziona (`console.log` in browser non mostra errori)
- [ ] Database rules sono applicate in Firebase Console

---

## 🚨 Troubleshooting

### "Firebase config not loaded"
→ Verifica che `.env.local` abbia i valori corretti
→ Verifica che `.env.local` sia nella root del progetto
→ Riavvia il browser

### "Permission denied" errors
→ Assicurati che Firebase Rules siano deployate
→ Verifica che Anonymous Auth sia abilitata
→ Testa con Firebase Emulator per verificare le rules

### "Realtime Database URL not found"
→ Vai a Firebase Console → Realtime Database
→ Copia l'URL completo (dovrebbe iniziare con `https://`)
→ Incolla in `.env.local` esattamente come mostrato

---

## 📚 Riferimenti

- [Firebase Console](https://console.firebase.google.com)
- [Firebase Project Setup](https://firebase.google.com/docs/projects/learn-more)
- [Realtime Database Rules](https://firebase.google.com/docs/database/security)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## ✅ Dopo il Setup

Una volta completato:

1. **Non commitare `.env.local`** (è in `.gitignore`)
2. **Aggiungi le variabili a Vercel** per il deploy live
3. **Testa su produzione** (https://realmong-us.vercel.app)
4. **Documenta le credenziali** in un posto sicuro

---

**Domande?** Leggi i file:
- `PHASE_1_COMPLETE.md` - Setup completo
- `FIREBASE_SECURITY_SETUP.md` - Firebase Console guide
- `AUTH_IMPLEMENTATION.md` - Integrazione AuthService
