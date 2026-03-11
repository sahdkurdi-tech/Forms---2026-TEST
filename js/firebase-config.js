// js/firebase-config.js

// ١. زانیارییەکانی ImgBB
const imgbbAPIKey = "6af58315becc401b1652235b9dcbe9c9";

// ٢. زانیارییەکانی Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBS7-fWFagKFtMHGyshAA5edj-BefFMcO8",
  authDomain: "forms---2026-test-ed964.firebaseapp.com",
  projectId: "forms---2026-test-ed964",
  storageBucket: "forms---2026-test-ed964.firebasestorage.app",
  messagingSenderId: "287228770317",
  appId: "1:287228770317:web:5dd90b1718c47abb6ebd44"
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