// js/firebase-config.js

// ١. زانیارییەکانی ImgBB
const imgbbAPIKey = "6af58315becc401b1652235b9dcbe9c9";

// ٢. زانیارییەکانی Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA4lbQFKrYLnLT4uwnYbLR2b66cSTEzKY4",
  authDomain: "forms---2026-test-93616.firebaseapp.com",
  projectId: "forms---2026-test-93616",
  storageBucket: "forms---2026-test-93616.firebasestorage.app",
  messagingSenderId: "934643278",
  appId: "1:934643278:web:234b18d44e2fd971ed651f",
  measurementId: "G-ZCLHLQ5KD0"
};

// پەیوەستبوون (Initialize)
// تێبینی: ئێمە کتێبخانەی compat بەکاردێنین لە html بۆیە بەم شێوەیە دەینوسین
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
// چارەسەری کێشەی هێڵی کۆڕەک و بلۆکبوونی WebSockets
// چارەسەری کێشەی هێڵی کۆڕەک و بلۆکبوونی WebSockets
db.settings({
  experimentalForceLongPolling: true,
  useFetchStreams: false,
  merge: true // ئەم دێڕە زیادکرا بۆ لابردنی ئێرۆرەکەی کۆنسۆڵ
});