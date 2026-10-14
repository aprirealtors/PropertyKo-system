"use client";

import { useEffect, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "./firebase";

export const usePushNotifications = () => {
  const [token, setToken] = useState<string | null>(null);

  const requestPermission = async () => {
    try {
      if (typeof window === "undefined" || !("Notification" in window)) return;

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const msg = await messaging();
        if (!msg) return;

        // Register service worker
        const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

        // ✨ THE FIX: Wait for the Service Worker to be completely active and ready
        await navigator.serviceWorker.ready;

        try {
          // ✨ NEW: Wrapped in try-catch to prevent crashes on HTTP subdomains
          // Get FCM Device Token
          const currentToken = await getToken(msg, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: registration,
          });

          if (currentToken) {
            setToken(currentToken);
            console.log("FCM Device Token Generated:", currentToken);
          }
        } catch (tokenError) {
          // Fails silently in the console instead of throwing a red error screen
          console.warn("FCM Token Generation Blocked. This is expected if testing on an HTTP subdomain like bsa.localhost:3000.", tokenError);
        }
      }
    } catch (error) {
      console.error("Push notification registration failed:", error);
    }
  };

  // Listen for notifications while the tab is active/open (Foreground)
  useEffect(() => {
    const listenForMessages = async () => {
      try {
        const msg = await messaging();
        if (!msg) return;

        onMessage(msg, (payload) => {
          console.log("Foreground message received:", payload);
          // Note: GlobalPushListener handles the actual popup, this just logs it
        });
      } catch (err) {
        console.warn("Foreground message listener failed.", err);
      }
    };

    listenForMessages();
  }, []);

  return { token, requestPermission };
};