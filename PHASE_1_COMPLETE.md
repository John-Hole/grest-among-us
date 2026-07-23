# 🔒 PHASE 1: SECURITY - IMPLEMENTATION GUIDE

## ✅ Completed Tasks

### 1.1 ✅ API Key in Environment Variables
- **File:** `.env.example` (template with all required variables)
- **File:** `.env.local` (actual config - do NOT commit)
- **File:** `.gitignore` (prevents accidental commits)
- **File:** `js/env-loader.js` (loads config from multiple sources)
- **File:** `js/firebase-config.js` (updated to use env-loader)

**What it does:**
- Removes hardcoded API keys from source code
- Supports Vite, Vercel, and manual environment variable loading
- Falls back gracefully if env vars not available

---

### 1.2 ✅ Firebase Realtime Database Rules
- **File:** `firebase-rules.json` (security rules template)
- **File:** `FIREBASE_SECURITY_SETUP.md` (deployment instructions)

**What it does:**
- Prevents unauthorized access to game data
- Ensures only room creator can control game state
- Allows players to manage only their own data
- Blocks cross-room interference
- Validates data structure

---

### 1.3 ✅ Firebase Authentication
- **File:** `js/AuthService.js` (authentication service singleton)
- **File:** `AUTH_IMPLEMENTATION.md` (integration guide)

**What it does:**
- Anonymous login for guests (no email required)
- Session management with ID tokens
- User validation on all operations
- Integration with Firebase Rules

---

## 🚀 Quick Start - Local Development

### Step 1: Setup Environment Variables

```bash
# 1. Copy template
cp .env.example .env.local

# 2. .env.local already has the credentials for this project
# (populated during setup)

# 3. If you need to change them, edit .env.local manually
# (this file is in .gitignore, won't be committed)
```

### Step 2: Test AuthService in Browser

1. Open any page (e.g., index.html)
2. Open Browser DevTools (F12)
3. In Console, run:

```javascript
import { authService } from './js/AuthService.js';

// Initialize
await authService.init();

// Check status
console.log(authService.getAuthStatus());

// Sign in as guest
await authService.signInAsGuest();

// Create game session
authService.createPlayerSession('ABCD', 'TestPlayer');

// Check again
console.log(authService.getAuthStatus());
```

### Step 3: Test Firebase Rules with Emulator (Optional)

```bash
# Install Firebase CLI (if not already)
npm install -g firebase-tools

# Start emulator
firebase emulators:start --only database

# Visit: http://localhost:4000 (Emulator UI)

# Update firebase-config.js to use emulator:
// const db = connectDatabaseEmulator(db, 'localhost', 9000);
```

---

## 🔧 Deployment to Vercel

### Step 1: Add Environment Variables to Vercel

Go to [Vercel Dashboard](https://vercel.com/dashboard)

1. Select project **"realmong-us"**
2. Go to **Settings** → **Environment Variables**
3. Add all variables from `.env.local`:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=realmong-us.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://realmong-us-default-rtdb.region.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=realmong-us
VITE_FIREBASE_STORAGE_BUCKET=realmong-us.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

4. Set availability: **Production** (for main branch)

### Step 2: Deploy Firebase Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy rules to production
firebase deploy --only database:rules

# Or use this for target project:
firebase deploy --only database:rules -P realmong-us
```

### Step 3: Enable Anonymous Auth in Firebase Console

1. [Firebase Console](https://console.firebase.google.com)
2. Select **realmong-us** project
3. **Authentication** → **Sign-in method**
4. Enable **Anonymous**
5. Save

### Step 4: Deploy to Vercel

```bash
git add .
git commit -m "Security: Phase 1 - Env vars, Firebase Rules, Auth"
git push origin main
```

Vercel will automatically deploy when you push.

---

## 🧪 Validation Checklist

### Local Testing

- [ ] Can load `.env.local` variables
- [ ] Can sign in anonymously with AuthService
- [ ] Can create player session
- [ ] sessionStorage persists session
- [ ] Can logout and clear session
- [ ] Firebase config loads from env-loader

### Firebase Console

- [ ] Anonymous authentication enabled
- [ ] Database Rules deployed (check Firebase Console → Realtime Database → Rules)
- [ ] Rules are active (green checkmark)

### Vercel Production

- [ ] Environment variables set in Vercel project settings
- [ ] Deployment successful (no build errors)
- [ ] App loads without console errors
- [ ] AuthService works in production

### Security

- [ ] No API keys visible in GitHub repo
- [ ] No hardcoded secrets in source files
- [ ] `.env.local` is in `.gitignore`
- [ ] Firebase Rules prevent unauthorized access
- [ ] Player can only modify their own data

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `.env.example` | Template for environment variables |
| `.env.local` | Actual config (local only, in .gitignore) |
| `.gitignore` | Prevents committing sensitive files |
| `js/env-loader.js` | Loads config from multiple sources |
| `js/firebase-config.js` | Firebase app initialization |
| `js/AuthService.js` | Authentication service |
| `firebase-rules.json` | Realtime Database security rules |
| `FIREBASE_SECURITY_SETUP.md` | Firebase console setup guide |
| `AUTH_IMPLEMENTATION.md` | AuthService integration guide |

---

## 🔍 Troubleshooting

### Issue: "Can't connect to Firebase after deployment"

**Solution:**
1. Check Vercel Environment Variables are set correctly
2. Check Firebase project is accessible
3. Check internet connection
4. Clear browser cache

### Issue: "Rules rejecting my writes"

**Solution:**
1. Verify user is authenticated: `authService.isAuthenticated() === true`
2. Check Firebase Console for error messages
3. Test with Firebase Emulator first
4. Review rules in `firebase-rules.json`

### Issue: ".env.local not being loaded"

**Solution:**
1. Verify file exists: `ls .env.local`
2. Check syntax is valid (YAML-like format)
3. Restart your dev server
4. Try manually via console:

```javascript
import { setupFirebaseConfigDev } from './js/env-loader.js';
setupFirebaseConfigDev({
  apiKey: "...",
  // ... other fields
});
```

### Issue: "sessionStorage is empty after refresh"

**Cause:** This is expected - sessionStorage clears when browser tab closes

**Solution:** 
- Call `authService.init()` on every page load
- Auto-sign-in user on app initialization
- If persistence needed across sessions, use `localStorage` (less secure)

---

## 📊 Impact Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Security** | ⚠️ Exposed API keys | ✅ Protected in .env |
| **Authorization** | ❌ No access control | ✅ Firebase Rules |
| **Authentication** | ❌ Query string spoofing | ✅ Firebase Auth + UID |
| **Data Integrity** | ⚠️ Anyone can modify | ✅ Only owner can modify |
| **Audit Trail** | ❌ No logging | ⚠️ Firebase logs available |

---

## 🎯 Next Steps: Phase 2

After Phase 1 is complete and stable, proceed to:

1. **Service Layer** - GameService, RoomService, PlayerService
2. **State Management** - GameStore with EventEmitter
3. **UI Feedback** - Toast notifications

See `MIGLIORAMENTI_PROPOSTI.md` for full roadmap.

---

## Questions?

- Firebase Docs: https://firebase.google.com/docs
- Authentication: https://firebase.google.com/docs/auth
- Realtime Database: https://firebase.google.com/docs/database
- Security Rules: https://firebase.google.com/docs/database/security

