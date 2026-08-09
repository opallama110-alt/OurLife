import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasProfile, setHasProfile] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // Single Source of Truth: Fetch from Realtime Database exclusively
                const userData = await storageService.getUserDetails(currentUser.uid);

                // Set explicitly based on RTDB presence.
                setHasProfile(!!userData);
                // Google sign-ins are auto-verified; email/password requires the link click.
                setEmailVerified(currentUser.emailVerified || currentUser.providerData.some(p => p.providerId === 'google.com'));
            } else {
                setHasProfile(false);
                setEmailVerified(false);
            }

            setUser(currentUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Google", error);
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
