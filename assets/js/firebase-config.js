// ============================================================
// firebase-config.js
// นำค่าจาก Firebase Console > Project settings > Your apps (Web)
// มาวางแทนค่าด้านล่างนี้
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDCeaJgF-_RTJMftiOGBng9hqNW1IMVj6s",
  authDomain: "cert-system-static.firebaseapp.com",
  projectId: "cert-system-static",
  storageBucket: "cert-system-static.firebasestorage.app",
  messagingSenderId: "458464459159",
  appId: "1:458464459159:web:e6cdc2076cd6b57939acd2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
