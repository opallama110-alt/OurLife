import { getToken, onMessage } from "firebase/messaging";
import { messaging, db, auth } from "../../firebase-config";
import { doc, updateDoc, setDoc } from "firebase/firestore";

const VAPID_KEY = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY || "YOUR_VAPID_KEY_HERE";

export const notificationService = {
    requestPermission: async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                console.log("Notification permission granted.");
                const token = await notificationService.getFCMToken();
                if (token) {
                    console.log("FCM Token:", token);
                    await notificationService.saveTokenToFirestore(token);
                }
            } else {
                console.log("Notification permission denied.");
            }
        } catch (error) {
            console.error("Error requesting notification permission:", error);
        }
    },

    getFCMToken: async () => {
        try {
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY !== "YOUR_VAPID_KEY_HERE" ? VAPID_KEY : undefined
            });
            return token;
        } catch (error) {
            console.error("Error retrieving FCM token:", error);
            return null;
        }
    },

    saveTokenToFirestore: async (token: string) => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, { fcmToken: token }, { merge: true });
            console.log("FCM Token saved to Firestore.");
        } catch (error) {
            console.error("Error saving FCM token to Firestore:", error);
        }
    },

    listenForMessages: () => {
        onMessage(messaging, (payload) => {
            console.log("Message received. ", payload);
            // Customize notification handling here
            new Notification(payload.notification?.title || "New Message", {
                body: payload.notification?.body,
                icon: "/ourlife-logo.png",
            });
        });
    }
};
