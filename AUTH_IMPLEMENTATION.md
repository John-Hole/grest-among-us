# 🔐 Authentication Setup - Phase 1.3

## Overview

This document explains how to enable **Firebase Anonymous Authentication** for the Realmong_Us application.

Anonymous authentication allows players to join games without creating an account, which is perfect for event-based applications like GREST.

---

## Step 1: Enable Anonymous Authentication in Firebase Console

### Via Firebase Console Web UI:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project **"realmong-us"**
3. Navigate to **Authentication** → **Sign-in method** tab
4. Click **Anonymous**
5. Toggle the **Enable** switch
6. Click **Save**

### Verification:
- After enabling, you should see **"Anonymous"** listed under "Sign-in providers"

---

## Step 2: Architecture Overview

### Current Flow (UNSAFE - Before):
```
Player enters name in URL
  ↓
Query string: ?room=ABCD&player=Giovanni
  ↓
No validation or auth
  ↓
Player can spoof any identity!
```

### New Flow (SECURE - After):
```
Player visits app → AuthService.init()
  ↓
signInAnonymously() → Get Firebase UID
  ↓
Player enters room code + name
  ↓
authService.createPlayerSession(roomCode, playerName)
  ↓
Session stored in sessionStorage with UID + ID Token
  ↓
All DB operations verified by Firebase UID
  ↓
Cannot spoof - each user has unique cryptographic identity!
```

---

## Step 3: Implementation Details

### AuthService Methods (in `js/AuthService.js`):

```javascript
// 1. Initialize auth listener
await authService.init();

// 2. Sign in as anonymous user
const user = await authService.signInAsGuest();
// Returns: { uid: "xyz...", isAnonymous: true }

// 3. Create player session for a game room
const session = authService.createPlayerSession('ABCD', 'Giovanni');
// Returns: { userId: "xyz...", roomCode: "ABCD", playerName: "Giovanni", idToken: "..." }

// 4. Check if player has valid session
if (authService.hasValidSession()) {
  // Player is authenticated and in a room
}

// 5. Logout
await authService.logout();
```

### Usage in index.html (Hub Page):

```html
<!-- Before showing game options -->
<script type="module">
  import { authService } from './js/AuthService.js';
  
  // Initialize on page load
  await authService.init();
  
  if (!authService.isAuthenticated()) {
    // Sign in as guest
    await authService.signInAsGuest();
  }
  
  // Now user is authenticated!
  console.log('User ID:', authService.getUserId());
</script>
```

### Usage in giocatore.html (Player App):

```javascript
import { authService } from './js/AuthService.js';

// On app load
await authService.init();

// When joining room
const roomCode = new URLSearchParams(window.location.search).get('room');
const playerName = prompt('Enter your name:');

try {
  authService.createPlayerSession(roomCode, playerName);
} catch (error) {
  showError(error.message);
}

// All Firebase operations now use authenticated user
// Firebase Rules will verify userId matches auth.uid
```

---

## Step 4: Firebase Rules Integration

### How AuthService works with Firebase Rules:

In `firebase-rules.json`, rules check:
```json
".write": "auth.uid === userId"  // Only owner can write
".read": "auth != null"           // Only authenticated users can read
```

When you call `authService.createPlayerSession(roomCode, name)`:
1. Generate a unique userId from Firebase auth
2. Store session with that userId
3. Firebase Rules verify all operations are from that auth.uid
4. **Result:** Cannot spoof or manipulate other players' data!

---

## Step 5: Testing Authentication

### Test in Browser Console:

```javascript
// 1. Initialize
import { authService } from './js/AuthService.js';
await authService.init();

// 2. Check auth status
console.log(authService.getAuthStatus());
// Output:
// {
//   isAuthenticated: true,
//   userId: "xyz123...",
//   hasSession: false,  // Not in a game yet
//   user: { uid: "xyz123...", isAnonymous: true, ... }
// }

// 3. Create session
authService.createPlayerSession('TEST1', 'TestPlayer');
console.log(authService.getAuthStatus());
// Now hasSession: true

// 4. Verify session persists (sessionStorage)
console.log(authService.getPlayerSession());

// 5. Test logout
await authService.logout();
console.log(authService.isAuthenticated()); // false
```

### Test Firebase Rules:

After enabling Anonymous Auth and deploying rules:

```javascript
// ❌ This should FAIL (no auth):
const db = getDatabase(app);
const ref = ref(db, 'rooms/TEST1/gameState');
get(ref);  // Firebase will reject: "Permission denied"

// ✅ This should SUCCEED (with auth):
await authService.init();
const user = await authService.signInAsGuest();
get(ref);  // Firebase will allow (if user is in room)
```

---

## Step 6: Migration Checklist

- [ ] Enable Anonymous Authentication in Firebase Console
- [ ] Deploy Firebase Rules from `firebase-rules.json`
- [ ] Import AuthService in index.html
- [ ] Test `authService.init()` and `signInAsGuest()`
- [ ] Update giocatore.html to use authService
- [ ] Update master.html to use authService
- [ ] Test session creation with `createPlayerSession()`
- [ ] Verify sessionStorage persistence
- [ ] Test logout functionality
- [ ] Monitor Firebase Console for auth-related errors

---

## Step 7: Security Best Practices

### ✅ DO:
- Always call `await authService.init()` on page load
- Validate userId matches between client and Firebase
- Use sessionStorage (not localStorage) for sensitive data
- Log out when player leaves game
- Monitor Firebase Console for suspicious activity

### ❌ DON'T:
- Hardcode player names in URLs
- Store auth tokens in localStorage permanently
- Trust client-side validation alone
- Expose ID tokens in browser console logs
- Skip Firebase Rules validation

---

## Step 8: Troubleshooting

### Issue: "signInAnonymously is not working"

**Cause:** Anonymous authentication not enabled in Firebase Console

**Solution:**
1. Go to Firebase Console → Authentication → Sign-in method
2. Verify **Anonymous** is enabled
3. Refresh browser

### Issue: "Firebase Rules rejecting writes"

**Cause:** User not authenticated or Rule structure doesn't match

**Solution:**
1. Verify `authService.isAuthenticated()` returns true
2. Check Firebase Console → Realtime Database → Rules
3. Check browser console for Firebase error messages
4. Test with Firebase Emulator first

### Issue: "Session lost after page refresh"

**Cause:** sessionStorage is cleared or browser session ended

**Solution:**
- This is expected behavior
- Redesign: auto-sign-in on page load with `authService.init()`
- If need persistence: use `localStorage` instead (less secure)

---

## Step 9: Production Checklist

Before deploying to production:

- [ ] Anonymous auth enabled in Firebase Console
- [ ] Firebase Rules deployed and tested
- [ ] AuthService integrated into all pages
- [ ] ID tokens validated on backend (if using)
- [ ] Rate limiting configured (optional)
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Backups created before auth changes

---

## References

- [Firebase Anonymous Auth Docs](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Firebase Realtime Database Rules](https://firebase.google.com/docs/database/security)
- [Firebase Security Best Practices](https://firebase.google.com/docs/database/usage/best-practices)

---

## Next Steps

After Phase 1.3 is complete:

- **Phase 2:** Implement Service Layer (GameService, RoomService)
- **Phase 2:** Implement State Management (GameStore)
- **Phase 2:** Add Toast Notifications for user feedback
