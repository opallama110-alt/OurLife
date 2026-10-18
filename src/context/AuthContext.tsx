import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
    User,
    onAuthStateChanged,
    onIdTokenChanged,
    signInWithPopup,
    browserLocalPersistence,
    setPersistence,
    GoogleAuthProvider,
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    deleteUser,
    updateProfile,
    reload,
} from 'firebase/auth';
import { ref, remove } from 'firebase/database';
import { deleteDoc, doc } from 'firebase/firestore';
import { auth, rtdb, db } from '../../firebase-config';
import { storageService } from '../services/storageService';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    hasProfile: boolean;
    emailVerified: boolean;
    isAdmin: boolean;
    refreshAdminClaim: () => Promise<boolean>;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
    sendVerificationEmail: () => Promise<void>;
    refreshEmailVerification: () => Promise<boolean>;
    sendPasswordReset: (email: string) => Promise<void>;
    logout: () => Promise<void>;
    deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Admin is the `admin` custom claim on the current ID token — the exact check
// firestore.rules and database.rules.json enforce on every request.
const readAdminClaim = async (u: User, forceRefresh = false): Promise<boolean> => {
    try {
        const { claims } = await u.getIdTokenResult(forceRefresh);
        return claims.admin === true;
    } catch (error) {
        console.warn('[AuthContext] Could not read admin claim:', error);
        return false;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasProfile, setHasProfile] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        let active = true;

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // Single Source of Truth: Fetch from Realtime Database exclusively
                const userData = await storageService.getUserDetails(currentUser.uid);

                if (!active) return;

                // Set explicitly based on presence.
                setHasProfile(!!userData);
                // Google sign-ins are auto-verified; email/password requires the link click.
                setEmailVerified(currentUser.emailVerified || currentUser.providerData.some(p => p.providerId === 'google.com'));
            } else {
                setHasProfile(false);
                setEmailVerified(false);
            }

            if (!active) return;
            setUser(currentUser);
            setLoading(false);
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    // onAuthStateChanged doesn't fire on token refresh, so re-read the claim on
    // every new ID token (hourly SDK refresh, forced refresh, sign-in/out) —
    // otherwise a revoked or granted claim would only reach the UI after a reload.
    useEffect(() => {
        let latest = 0;
        const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
            const seq = ++latest;
            const admin = currentUser ? await readAdminClaim(currentUser) : false;
            // Ignore results superseded by a newer token event.
            if (seq === latest) setIsAdmin(admin);
        });
        return unsubscribe;
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
            // Make the Firebase session durable before opening Google. This avoids
            // returning to /login after a successful popup when the route reloads.
            await setPersistence(auth, browserLocalPersistence);
            await signInWithPopup(auth, provider);
        } catch (error: unknown) {
            console.error('[AuthContext] Google sign in error:', error);
            throw error;
        }
    };

    const signInWithEmail = async (email: string, password: string) => {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        setEmailVerified(cred.user.emailVerified);
    };

    const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName && displayName.trim()) {
            try { await updateProfile(cred.user, { displayName: displayName.trim() }); } catch { /* non-fatal */ }
        }
        await sendEmailVerification(cred.user);
        setEmailVerified(false);
    };

    const sendVerificationEmail = async () => {
        const current = auth.currentUser;
        if (!current) throw new Error('No authenticated user.');
        await sendEmailVerification(current);
    };

    // Forces a metadata refresh from Firebase so a freshly-clicked verification
    // link is reflected without making the user sign out and back in.
    const refreshEmailVerification = async (): Promise<boolean> => {
        const current = auth.currentUser;
        if (!current) return false;
        await reload(current);
        setEmailVerified(current.emailVerified);
        return current.emailVerified;
    };

    // A session token minted before the claim was granted won't carry it for up
    // to an hour; forcing a refresh picks it up without signing out and back in.
    const refreshAdminClaim = useCallback(async (): Promise<boolean> => {
        const current = auth.currentUser;
        if (!current) {
            setIsAdmin(false);
            return false;
        }
        const admin = await readAdminClaim(current, true);
        // Drop the result if the user signed out or switched accounts mid-refresh.
        if (auth.currentUser?.uid !== current.uid) return false;
        setIsAdmin(admin);
        return admin;
    }, []);

    const sendPasswordReset = async (email: string) => {
        await sendPasswordResetEmail(auth, email.trim());
    };

    const logout = async () => {
        try {
            await signOut(auth);
            localStorage.clear(); // Safety wipe cache on logout
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    const deleteAccount = async () => {
        const current = auth.currentUser;
        if (!current) throw new Error('No authenticated user.');
        const uid = current.uid;

        await Promise.allSettled([
            remove(ref(rtdb, `users/${uid}`)),
            deleteDoc(doc(db, 'users', uid)),
            deleteDoc(doc(db, 'leaderboard', uid)),
        ]);

        await deleteUser(current);
        localStorage.clear();
    };

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            hasProfile,
            emailVerified,
            isAdmin,
            refreshAdminClaim,
            signInWithGoogle,
            signInWithEmail,
            signUpWithEmail,
            sendVerificationEmail,
            refreshEmailVerification,
            sendPasswordReset,
            logout,
            deleteAccount,
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
