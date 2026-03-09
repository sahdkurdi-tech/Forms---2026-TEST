// js/dashboard.js

// بەکارهێنانی orderBy بۆ هێنان بەپێی ڕیزبەندی دیاریکراو
db.collection("forms").orderBy("order", "asc").onSnapshot(async (snapshot) => {
    const container = document.getElementById('formsContainer');
    const loadingSpinner = document.getElementById('loadingSpinner'); 
    
    if(loadingSpinner) loadingSpinner.style.display = 'none';
    container.innerHTML = "";

    // --- بەشی گرنگ: چارەسەرکردنی کێشەی دیارنەمان ---
    if (snapshot.empty) {
        // پشکنین دەکەین بزانین ئایا بەڕاستی هیچ فۆڕمێک نییە، یان تەنها Orderیان نییە؟
        // تێبینی: ئەمە یەکجار ڕوودەدات بۆ چاککردنی داتاکانی کۆن
        const checkSnapshot = await db.collection("forms").get();
        
        if (!checkSnapshot.empty) {
            // واتە: فۆڕم هەیە، بەڵام چونکە orderـیان نییە دەرناکەون
            console.log("Detecting old forms without order. Fixing...");
            
            const batch = db.batch();
            checkSnapshot.docs.forEach((doc, index) => {
                // ئەگەر orderی نەبوو، بۆی دادەنێین
                if (doc.data().order === undefined) {
                    batch.update(doc.ref, { order: index });
                }
            });
            await batch.commit();
            // لێرەدا کۆدەکە خۆی Refresh دەبێتەوە چونکە onSnapshot گوێی گرتووە
            return;
        }

        // ئەگەر بەڕاستی هیچ فۆڕمێک نەبوو:
        container.innerHTML = `
            <div class="col-12 text-center mt-5">
                <div class="opacity-50 mb-3"><i class="fa-solid fa-folder-open fa-4x"></i></div>
                <h4>هیچ فۆڕمێک نەدۆزرایەوە</h4>
                <p class="text-muted">لەرێگەی دوگمەی "فۆڕمی نوێ" یەکەم فۆڕمت دروست بکە</p>
            </div>`;
        return;
    }
    // --------------------------------------------------

    snapshot.forEach((doc) => {
        const data = doc.data();
        const id = doc.id;
        const viewLink = `${window.location.origin}/view.html?id=${id}`;
        
        container.innerHTML += `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="project-card">
                    
                    <div class="card-body-custom">
                        
                        <div class="card-header-row">
                            <div class="card-title-text text-truncate" style="max-width: 70%;" title="${data.title}">${data.title}</div>
                            <span class="badge ${data.active !== false ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} rounded-pill">
                                ${data.active !== false ? 'چالاکە' : 'ڕاگیراوە'}
                            </span>
                        </div>

                        <div class="main-actions-row">
                            <a href="${viewLink}" target="_blank" class="btn-fill-form">
                                <i class="fa-solid fa-pen-to-square"></i> پڕکردنەوەی فۆڕم
                            </a>
                            <a href="builder.html?id=${id}" class="btn-design-outline" title="دەستکاری دیزاین">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </a>
                        </div>

                        <div class="utility-row">
                            <button onclick="copyLink('${viewLink}')" class="util-btn" title="کۆپی لینک">
                                <i class="fa-regular fa-copy"></i>
                            </button>
                            <button onclick="toggleProjectStatus('${id}', ${data.active !== false})" class="util-btn" title="${data.active !== false ? 'ڕاگرتن' : 'چالاککردن'}">
                                <i class="fa-solid ${data.active !== false ? 'fa-pause' : 'fa-play'}"></i>
                            </button>
                            <button onclick="deleteForm('${id}')" class="util-btn delete" title="سڕینەوە">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    <a href="data.html?id=${id}" class="btn-view-data-footer">
                        بینینی داتاکان <i class="fa-solid fa-arrow-left me-2"></i>
                    </a>

                </div>
            </div>
        `;
    });
});