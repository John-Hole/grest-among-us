/**
 * AuthService - Handles Firebase Authentication and User Session Management
 * 
 * Features:
 * - Anonymous authentication
 * - Player session management
 * - Room access control
 * - User validation
 */

import { auth } from './firebase-config.js';
import {
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  getIdToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

class AuthService {
  constructor() {
    this.currentUser = null;
    this.currentRoom = null;
    this.playerName = null;
    this.authStateCallbacks = [];
  }

  /**
   * Initialize authentication state listener
   */
  init() {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          this.currentUser = user;
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
          try {
            this.idToken = await getIdToken(user);
          } catch (e) {
            console.error('Failed to get ID token:', e);
          }
        } else {
          this.currentUser = null;
          this.idToken = null;
          try {
            localStorage.removeItem('realmong_user_cache');
          } catch (e) {}
        }
        
        this.notifyAuthStateChanged();
        resolve(user);
      });
    });
  }

  /**
   * Sign in anonymously
   * Called when user first joins the app
   */
  async signInAsGuest() {
    try {
      const credential = await signInAnonymously(auth);
      console.log('✅ Guest login successful:', credential.user.uid);
      return credential.user;
    } catch (error) {
      console.error('❌ Guest login failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Register with email and password
   */
  async registerWithEmail(email, password) {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Registration successful:', credential.user.uid);
      return credential.user;
    } catch (error) {
      console.error('❌ Registration failed:', error);
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Login with email and password
   */
  async loginWithEmail(email, password) {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Email login successful:', credential.user.uid);
      return credential.user;
    } catch (error) {
      console.error('❌ Email login failed:', error);
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Login with Google
   */
  async loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      console.log('✅ Google login successful:', credential.user.uid);
      return credential.user;
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('ℹ️ Google login cancelled by user');
        return null;
      }
      console.error('❌ Google login failed:', error);
      throw new Error(`Google login failed: ${error.message}`);
    }
  }

  /**
   * Store player session data
   * Called when player joins a specific room
   * 
   * @param {string} roomCode - Game room code
   * @param {string} playerName - Player's display name
   * @returns {Object} Session data
   */
  createPlayerSession(roomCode, playerName) {
    if (!this.currentUser) {
      throw new Error('User not authenticated. Call signInAsGuest() first.');
    }

    if (!roomCode || !playerName) {
      throw new Error('Room code and player name are required');
    }

    // Validate inputs
    if (playerName.length > 50 || playerName.length < 1) {
      throw new Error('Player name must be 1-50 characters');
    }

    this.currentRoom = roomCode;
    this.playerName = playerName;

    const session = {
      userId: this.currentUser.uid,
      roomCode,
      playerName,
      joinedAt: Date.now(),
      idToken: this.idToken,
      isAuthenticated: true,
    };

    // Store in sessionStorage (available only during browser session)
    sessionStorage.setItem('playerSession', JSON.stringify(session));

    return session;
  }

  /**
   * Retrieve current player session
   * @returns {Object|null} Session data or null if not in a session
   */
  getPlayerSession() {
    try {
      const stored = sessionStorage.getItem('playerSession');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error('Failed to retrieve player session:', e);
      return null;
    }
  }

  /**
   * Validate if user is in a valid session
   * @returns {boolean}
   */
  hasValidSession() {
    return this.currentUser && this.getPlayerSession() !== null;
  }

  /**
   * Get current user ID (Firebase UID)
   * @returns {string|null}
   */
  getUserId() {
    return this.currentUser?.uid || null;
  }

  /**
   * Get current user's ID token (for API requests)
   * @returns {string|null}
   */
  async getIdToken() {
    if (!this.currentUser) return null;
    try {
      return await getIdToken(this.currentUser);
    } catch (e) {
      console.error('Failed to get ID token:', e);
      return null;
    }
  }

  /**
   * Sign out and clear all session data
   */
  async logout() {
    try {
      await signOut(auth);
      this.currentUser = null;
      this.currentRoom = null;
      this.playerName = null;
      this.idToken = null;
      sessionStorage.removeItem('playerSession');
      try {
        localStorage.removeItem('realmong_user_cache');
      } catch (e) {}
      this.notifyAuthStateChanged();
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to auth state changes
   * @param {Function} callback - Called when auth state changes
   */
  onAuthStateChanged(callback) {
    this.authStateCallbacks.push(callback);
    // Call immediately with current state
    callback(this.currentUser);
  }

  /**
   * Notify all listeners of auth state change
   */
  notifyAuthStateChanged() {
    this.authStateCallbacks.forEach(callback => {
      try {
        callback(this.currentUser);
      } catch (e) {
        console.error('Auth state callback error:', e);
      }
    });
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * Get current authentication status as object
   * @returns {Object}
   */
  getAuthStatus() {
    const session = this.getPlayerSession();
    return {
      isAuthenticated: this.isAuthenticated(),
      userId: this.getUserId(),
      hasSession: session !== null,
      session,
      user: this.currentUser ? {
        uid: this.currentUser.uid,
        email: this.currentUser.email,
        isAnonymous: this.currentUser.isAnonymous,
        metadata: this.currentUser.metadata,
      } : null,
    };
  }

  /**
   * Validate room code format
   * @param {string} roomCode
   * @returns {boolean}
   */
  static validateRoomCode(roomCode) {
    return /^[A-Z0-9]{4,6}$/.test(roomCode);
  }

  /**
   * Validate player name format
   * @param {string} name
   * @returns {boolean}
   */
  static validatePlayerName(name) {
    return typeof name === 'string' && name.length > 0 && name.length <= 50;
  }
}

// Export singleton instance
export const authService = new AuthService();

export default AuthService;
