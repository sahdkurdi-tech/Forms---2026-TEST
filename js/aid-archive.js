// js/aid-archive.js

let formFieldsCache = [];
let allArchivedCases = [];

firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        // بەکارهێنانی toLowerCase() بۆ دڵنیایی زیاتر لە خوێندنەوەی ئیمەیڵەکە
        const userDoc = await db.collection("users").doc(user.email.toLowerCase()).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();

            // پشکنینی دەسەڵاتی ئەرشیف: ئەگەر خاوەن نەبوو وە دەسەڵاتی ئەرشیفیشی نەبوو
            if (userData.role !== 'owner' && !userData.canViewArchive) {
                alert("تۆ دەسەڵاتی چوونەژوورەوەت نییە بۆ بەشی ئەرشیف!");
                window.location.href = "index.html"; // گەڕانەوە بۆ پەڕەی سەرەکی
                return; // وەستاندنی خوێندنەوەی کۆدەکانی خوارەوە
            }

            // شاردنەوەی دوگمەی سێتینگ ئەگەر خاوەن نەبوو
            if (userData.role !== 'owner') {
                const settingsLink = document.querySelector('a[href="settings.html"]');
                if (settingsLink) settingsLink.style.display = 'none';
            }

            // ئەگەر دەسەڵاتی هەبوو، با ئەرشیفەکە کار بکات
            initArchive();
        } else {
            alert("تۆ ڕێگەپێدراو نیت!");
            window.location.href = "login.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

function initArchive() {
    // خوێندنەوەی درەختی فۆڕمەکە
    db.collection("aid_fields").doc("main_form").onSnapshot(doc => {
        formFieldsCache = [];
        if (doc.exists && doc.data().fields) {
            flattenFieldsCache(doc.data().fields);
        }
        loadArchivedCases();
    });
}

// دروستکردنی لیستێکی سادە لە خانەکان بۆ دیزاینی کارتەکان
function flattenFieldsCache(fields) {
    fields.forEach(f => {
        formFieldsCache.push({ id: f.id, label: f.label, type: f.type });
        if (f.children && f.children.length > 0) {
            flattenFieldsCache(f.children);
        }
    });
}

function loadArchivedCases() {
    db.collection("aid_cases").where("stage", "==", "archived").onSnapshot(snapshot => {
        allArchivedCases = [];

        snapshot.forEach(doc => {
            allArchivedCases.push({ id: doc.id, ...doc.data() });
        });

        allArchivedCases.sort((a, b) => {
            const timeA = a.completedAt ? a.completedAt.toMillis() : 0;
            const timeB = b.completedAt ? b.completedAt.toMillis() : 0;
            return timeB - timeA;
        });

        renderArchive();
    });
}

function renderArchive() {
    const list = document.getElementById('archiveList');
    const filter = document.getElementById('statusFilter').value;
    const countDisplay = document.getElementById('totalCount');

    list.innerHTML = '';

    const filteredCases = allArchivedCases.filter(c => filter === 'all' || c.status === filter);

    countDisplay.innerText = `کۆی گشتی: ${filteredCases.length}`;

    if (filteredCases.length === 0) {
        list.innerHTML = '<div class="col-12 text-center text-muted mt-5"><i class="fa-solid fa-folder-open fa-3x mb-3 opacity-25"></i><p>هیچ کەیسێک لەم بەشەدا نییە</p></div>';
        return;
    }

    filteredCases.forEach(data => {
        const primaryText = getPrimaryText(data);
        const detailsHtml = generateDetailsHtml(data);
        const badgeClass = getBadgeClass(data.status);
        const dateStr = formatDate(data.completedAt);

        list.innerHTML += `
            <div class="col-md-6 col-lg-4">
                <div class="archive-card">
                    <div class="status-badge ${badgeClass}">${data.status}</div>
                    <h6 class="fw-bold mb-0 text-primary mt-4"><i class="fa-solid fa-user-check me-1"></i> ${primaryText}</h6>
                    
                    ${detailsHtml}
                    
                    <div class="d-flex justify-content-between align-items-center pt-2 mt-2 border-top">
                        <small class="text-muted" style="font-size: 0.75rem;"><i class="fa-regular fa-clock"></i> کاتی بڕیار: ${dateStr}</small>
                        <button class="btn btn-sm btn-outline-warning" onclick="restoreCase('${data.id}')" title="گەڕاندنەوە بۆ بەشی دابەشکردن">
                            <i class="fa-solid fa-rotate-left"></i> گەڕاندنەوە
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

function generateDetailsHtml(data) {
    let html = '<div class="mt-3 mb-3 p-2 border rounded shadow-sm bg-light" style="font-size: 0.85rem; max-height: 150px; overflow-y: auto;">';

    const isDarkMode = document.body.classList.contains('dark-mode');
    if (isDarkMode) html = html.replace('bg-light', '');

    formFieldsCache.forEach(field => {
        const key = field.label;
        if (data[key] !== undefined && data[key] !== '') {
            html += `
                <div class="d-flex justify-content-between mb-1 border-bottom pb-1">
                    <span class="text-muted">${key}:</span>
                    <strong class="ms-2 text-start" style="max-width: 65%; word-wrap: break-word;">${data[key]}</strong>
                </div>
            `;
        }
    });
    html += '</div>';
    return html;
}

function getPrimaryText(data) {
    const firstFieldLabel = formFieldsCache.length > 0 ? formFieldsCache[0].label : null;
    return firstFieldLabel && data[firstFieldLabel] ? data[firstFieldLabel] : 'بێ ناو';
}

function getBadgeClass(status) {
    switch (status) {
        case 'سەردانی کراوان': return 'badge-success';
        case 'سەردانی نەکراوان': return 'badge-danger';
        case 'پێویستی بە سەردان نەبوو': return 'badge-secondary';
        case 'پێشتر سەردانی کراوە': return 'badge-info';
        default: return 'badge-secondary';
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'نەزانراو';
    const date = timestamp.toDate();
    return date.toLocaleDateString('ku-IQ') + ' - ' + date.toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' });
}

async function restoreCase(id) {
    if (confirm("دڵنیایت کە دەتەوێت ئەم کەیسە بگەڕێنیتەوە بۆ ناو بەشەکان؟ (بۆ ئەوەی دووبارە بڕیاری لەسەر بدرێتەوە)")) {
        await db.collection("aid_cases").doc(id).update({
            stage: 'category',
            status: 'pending'
        });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'کەیسەکە گەڕێندرایەوە', showConfirmButton: false, timer: 1500 });
    }
}