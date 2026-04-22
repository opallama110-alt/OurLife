import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    deleteUser,
} from 'firebase/auth';
import { ref, remove } from 'firebase/database';
import { deleteDoc, doc } from 'firebase/firestore';
import { auth, rtdb, db } from '../firebase-config';
import { storageService } from '../services/storageService';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    hasProfile: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasProfile, setHasProfile] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // Single Source of Truth: Fetch from Realtime Database exclusively
                const userData = await storageService.getUserDetails(currentUser.uid);

                // Set explicitly based on RTDB presence.
                // We completely removed the legacy Firestore `setDoc` initialization here,
                // passing the responsibility to explicitly trigger `<Onboarding>` through Routes via false.
                setHasProfile(!!userData);
            } else {
                setHasProfile(false);
            }

            // Set user AFTER remote data has been evaluated to avoid premature layout mounting
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

    const logout = async () => {
        try {
            await signOut(auth);
            localStorage.clear(); // Safety wipe cache on logout
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    // Hard delete: wipes RTDB node + Firestore user doc, then deletes the Firebase Auth account.
    // Firebase may reject with `auth/requires-recent-login` — caller should handle re-auth.
    const deleteAccount = async () => {
        const current = auth.currentUser;
        if (!current) throw new Error('No authenticated user.');
        const uid = current.uid;

        // Remove backend data first so an auth-delete failure doesn't leave orphaned docs.
        await Promise.allSettled([
            remove(ref(rtdb, `users/${uid}`)),
            deleteDoc(doc(db, 'users', uid)),
        ]);

        await deleteUser(current);
        localStorage.clear();
    };

    return (
        <AuthContext.Provider value={{ user, loading, hasProfile, signInWithGoogle, logout, deleteAccount }}>
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
