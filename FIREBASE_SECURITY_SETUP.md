# 🔐 Firebase Security Setup

## Step 1: Apply Realtime Database Rules

### Via Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project **"grest-among-us"**
3. Navigate to **Realtime Database** → **Rules** tab
4. Copy the content of `firebase-rules.json` from this repository
5. Paste into the Rules editor
6. Click **Publish** (⚠️ This will lock down the database!)

### Via Firebase CLI (Recommended):

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only database:rules
```

Or use the included deploy script:
```bash
npm run firebase:rules:deploy
```

---

## Step 2: Enable Firebase Authentication

### Authentication Methods to Enable:

1. **Anonymous Authentication**
   - Go to Firebase Console → Authentication → Sign-in method
   - Enable "Anonymous"
   - This allows temporary users to join games without email/password

2. **Email/Password (Optional)**
   - Enable if you want account creation for frequent players

---

## Step 3: Update Vercel Environment Variables

Add these to your Vercel project settings (Settings → Environment Variables):

```
VITE_FIREBASE_API_KEY=AIzaSyDP523x9SZZ6MVkvl3tVbuv5SBpbzVsxr4
VITE_FIREBASE_AUTH_DOMAIN=grest-among-us.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://grest-among-us-default-rtdb.europe-west1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=grest-among-us
VITE_FIREBASE_STORAGE_BUCKET=grest-among-us.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=113254807143
VITE_FIREBASE_APP_ID=1:113254807143:web:f9491251c65d4d717b46c2
```

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
