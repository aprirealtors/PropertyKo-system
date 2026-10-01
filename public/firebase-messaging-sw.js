importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

// Hardcoded keys because Service Workers cannot read .env files
const firebaseConfig = {
  apiKey: "AIzaSyDRkj1NI4bO23xqCpSNfJElZQ4wNjiZ9m0",
  authDomain: "propertyko-notif.firebaseapp.com",
  projectId: "propertyko-notif",
  storageBucket: "propertyko-notif.firebasestorage.app",
  messagingSenderId: "681344275697",
  appId: "1:681344275697:web:a17d0f3cf9d214e6104550",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icon-192.png", // Ensure you have this icon in your public folder
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});