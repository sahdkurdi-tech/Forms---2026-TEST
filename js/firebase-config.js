// js/firebase-config.js

// ١. زانیارییەکانی ImgBB
const imgbbAPIKey = "6af58315becc401b1652235b9dcbe9c9";

// ٢. زانیارییەکانی Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAC1cHMx4FXd8nAXECZo-puMN5RDdKc2yQ",
  authDomain: "forms---2026-test.firebaseapp.com",
  projectId: "forms---2026-test",
  storageBucket: "forms---2026-test.firebasestorage.app",
  messagingSenderId: "312984955524",
  appId: "1:312984955524:web:085a504080281f1a33b0d1"
};

// پەیوەستبوون (Initialize)
// تێبینی: ئێمە کتێبخانەی compat بەکاردێنین لە html بۆیە بەم شێوەیە دەینوسین
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
// چارەسەری کێشەی هێڵی کۆڕەک و بلۆکبوونی WebSockets
db.settings({
  experimentalForceLongPolling: true,
  useFetchStreams: false
});