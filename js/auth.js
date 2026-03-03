// js/auth.js

firebase.auth().onAuthStateChanged(async (user) => {
    const path = window.location.pathname;
    const isPublicPage = path.includes("login.html") || path.includes("view.html");

    if (!user) {
        if (!isPublicPage) window.location.href = "login.html";
        return;
    }

    // لێرەدا دەچین زانیاری بەکارهێنەر لە داتابەیس دەهێنین
    // چیتر پشت بە نوسینی ئیمەیڵەکە نابەستین لە کۆدەکەدا
    const userDoc = await db.collection("users").doc(user.email).get();

    if (!userDoc.exists) {
        // ئەگەر ئەم کەسە لە داتابەیس نەبوو، واتە هیچ دەسەڵاتێکی نییە
        alert("تۆ تۆمار نەکراویت!");
        firebase.auth().signOut();
        window.location.href = "login.html";
        return;
    }

    const userData = userDoc.data();

    // پاراستنی پەڕە هەستیارەکان (Settings & Builder)
    // تەنها ئەوانە دەتوانن بچن کە ڕۆڵیان 'owner'ـە
    if (path.includes("settings.html") || path.includes("builder.html")) {
        if (userData.role !== 'owner') {
            alert("تۆ دەسەڵاتی چوونە ناو سێتینگت نییە!");
            window.location.href = "index.html";
        }
    }
});

function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = "login.html";
    });
}