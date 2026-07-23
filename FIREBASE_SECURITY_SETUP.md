# 🔐 Firebase Security Setup - Realmong Us

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a new project"**
3. Project name: **"Realmong Us"**
4. Project ID: **"realmong-us"**
5. Create project and wait for completion

## Step 2: Get Firebase Credentials

1. Project Settings (⚙️ icon) → Project Settings
2. Under "Your apps", select the **Web** app
3. Copy credentials to `.env.local` file:
   ```
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=realmong-us.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=realmong-us
   VITE_FIREBASE_STORAGE_BUCKET=realmong-us.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```
4. For Database URL, go to **Realtime Database** → Copy URL and add to `.env.local`

## Step 3: Enable Realtime Database

1. Go to **Realtime Database** tab
2. Click **"Create Database"**
3. Start in **production mode**
4. Choose region (closest to your location)

## Step 4: Apply Database Security Rules

1. Navigate to **Realtime Database** → **Rules** tab
2. Copy content from `firebase-rules.json`
3. Paste into Rules editor
4. Click **Publish** (⚠️ This locks down the database!)

**Alternative: Via Firebase CLI:**

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only database:rules
```

## Step 5: Enable Anonymous Authentication

1. Go to **Authentication** → **Sign-in method** tab
2. Click **Anonymous**
3. Toggle **Enable**
4. Click **Save**

## Step 6: Update Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select project **"realmong-us"**
3. Settings → **Environment Variables**
4. Add all values from `.env.local`:
   ```
   VITE_FIREBASE_API_KEY=your-actual-value
   VITE_FIREBASE_AUTH_DOMAIN=realmong-us.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://realmong-us-default-rtdb.region.firebasedatabase.app
   VITE_FIREBASE_PROJECT_ID=realmong-us
   VITE_FIREBASE_STORAGE_BUCKET=realmong-us.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-actual-value
   VITE_FIREBASE_APP_ID=your-actual-value
   ```
5. Set availability: **Production**

---

## ⚠️ IMPORTANT: Testing the Rules

Before deploying to production, **test the rules thoroughly**:

### Invalid Operations (Should be Blocked):
- ❌ Non-authenticated user reading any room data
- ❌ Player trying to modify another player's data
- ❌ Player trying to change game state (only creator can)
- ❌ Reading data from non-existent room

### Valid Operations (Should Succeed):
- ✅ Authenticated user creating a new room
- ✅ Player reading their own data
- ✅ Player submitting their vote
- ✅ Creator updating game state
- ✅ Creator managing room configuration

### Firebase Emulator for Testing (Recommended):

```bash
firebase emulators:start --only database
```

This runs a local Firebase emulator to test rules without affecting production.

---

## 🚀 Rollout Strategy

### For Current Live Game:
1. **Before applying rules:**
   - Migrate existing game data structure to comply with new rules
   - Backup database: `firebase database:export`
   - Test rules with emulator first

2. **Apply rules during off-hours** (when no games are running)

3. **Monitor:** Watch Firebase Console → Realtime Database → Rules violations

---

## Database Structure (After Auth Implementation)

```
/rooms/{roomId}
  /creatorId: "user-id-of-master"
  /status: "waiting|playing|finished"
  /gameState/
    /round: 1
    /status: "waiting"
    /timeRemaining: 600000
  /players/{playerId}
    /name: "Giovanni"
    /role: "crewmate|impostor|scientist"
    /status: "alive|dead|ghost"
    /tasks/
      /{taskId}: { completed: true, completedAt: 1234567890 }
  /votes/{voterId}: "targetPlayerId|null"
  /config/
    /roundTimes: [600000, 420000, 300000]
    /discussionTime: 15000
    /votingTime: 30000
```

---

## Migration Checklist

- [ ] Backup production database
- [ ] Test rules with Firebase Emulator
- [ ] Verify all auth flows work
- [ ] Deploy to staging first (if available)
- [ ] Apply rules to production
- [ ] Monitor for errors (first 24h)
- [ ] Document any issues

---

## Rollback Plan

If something breaks:

```bash
# Restore backup
firebase database:import backup.json

# Reset rules to open (TEMPORARY - only for debugging)
firebase database:set:rules firebase-rules-open.json
```

Always keep a copy of `firebase-rules-open.json` (backup open rules) for emergencies:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

---

## Questions?

For Firebase Rules documentation: https://firebase.google.com/docs/database/security

For auth implementation: See `js/auth/AuthService.js` (coming in Phase 1.3)
