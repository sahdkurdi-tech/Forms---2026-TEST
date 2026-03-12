// js/aid-board.js

let formFieldsCache = [];
let categoriesCache = [];
let isBoardInitialized = false;
let currentUserPerms = {};

// --- فەنکشنە نوێیەکان بۆ کات و ڕێکەوت ---
function formatDateTime(timestamp) {
    if (!timestamp) return '<span class="text-danger opacity-50">نەزانراو</span>';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '<span class="text-danger opacity-50">نەزانراو</span>';
    
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const dateString = date.toLocaleDateString('ku-IQ', options);
    const timeString = date.toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dateString} <span class="mx-1 text-muted">|</span> ${timeString}`;
}

function calculateDaysPassed(timestamp) {
    if (!timestamp) return 0;
    const pastDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(pastDate.getTime())) return 0;
    
    const today = new Date();
    const pastDay = new Date(pastDate.getFullYear(), pastDate.getMonth(), pastDate.getDate());
    const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const diffTime = currentDay - pastDay;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
}

// فەنکشنی نوێ بۆ دروستکردنی ئەو ٧ هێڵەی کە داوات کرد
function generateDaysTrackerHtml(daysPassed) {
    let remainingDays = Math.max(0, 7 - daysPassed);
    let linesHtml = '';
    
    // ئەگەر کاتەکەی کەم مابوو (٢ ڕۆژ یان کەمتر) با ڕەنگەکەی پرتەقاڵی بێت، ئەگەرنا سەوزە
    let colorClass = remainingDays <= 2 ? 'warning' : 'active';
    
    for (let i = 0; i < 7; i++) {
        if (i < remainingDays) {
            // هێڵی پڕکراوە (ڕۆژی ماوە)
            linesHtml += `<div class="tracker-line ${colorClass}"></div>`;
        } else {
            // هێڵی بەتاڵ (ڕۆژی ڕۆیشتوو)
            linesHtml += `<div class="tracker-line"></div>`;
        }
    }
    
    return `
        <div class="mt-2 pt-2 border-top">
            <div class="d-flex justify-content-between align-items-center">
                <span class="text-muted" style="font-size: 0.75rem;"><i class="fa-solid fa-hourglass-half me-1"></i> مـاوە:</span>
                <div class="d-flex gap-1" dir="ltr">
                    ${linesHtml}
                </div>
            </div>
        </div>
    `;
}
// ----------------------------------------

firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        const userDoc = await db.collection("users").doc(user.email).get();
        if (userDoc.exists) {
            currentUserPerms = userDoc.data();

            if (currentUserPerms.role === 'owner') {
                const settingSidebar = document.getElementById('navSettingsSidebar');
                const settingMobile = document.getElementById('navSettingsMobileLi');
                if (settingSidebar) settingSidebar.classList.remove('d-none');
                if (settingMobile) settingMobile.classList.remove('d-none');
            }

            if (currentUserPerms.role !== 'owner' && !currentUserPerms.canDistribute) {
                const distributeTabLi = document.getElementById('distribute-tab');
                if (distributeTabLi) {
                    distributeTabLi.parentElement.style.display = 'none';
                }
            }

            if (currentUserPerms.role !== 'owner' && !currentUserPerms.canViewArchive) {
                const archiveLinks = document.querySelectorAll('a[href="aid-archive.html"]');
                archiveLinks.forEach(link => {
                    link.style.display = 'none';
                });
            }

            initBoard();
        } else {
            alert("تۆ ڕێگەپێدراو نیت!");
            window.location.href = "login.html";
        }
    } else {
        window.location.href = "login.html";
    }
});

function initBoard() {
    db.collection("aid_fields").doc("main_form").onSnapshot(doc => {
        const container = document.getElementById('dynamicFormFields');
        formFieldsCache = [];
        container.innerHTML = '';

        if (!doc.exists || !doc.data().fields || doc.data().fields.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">هیچ خانەیەک دروست نەکراوە. لە سێتینگ دروستی بکە.</div>';
        } else {
            const fieldsTree = doc.data().fields;
            flattenFieldsCache(fieldsTree);
            renderFieldsTree(fieldsTree, container);
        }

        if (!isBoardInitialized) {
            loadCategories();
            if (currentUserPerms.role === 'owner' || currentUserPerms.canDistribute) {
                loadDistributionCases();
            }
            isBoardInitialized = true;
        } else {
            if (currentUserPerms.role === 'owner' || currentUserPerms.canDistribute) {
                loadDistributionCases();
            }
            if (document.getElementById('categoryFilter').value) loadCategoryCases();
        }
    });
}

function flattenFieldsCache(fields) {
    fields.forEach(f => {
        formFieldsCache.push({ id: f.id, label: f.label, type: f.type });
        if (f.children && f.children.length > 0) {
            flattenFieldsCache(f.children);
        }
    });
}

function renderFieldsTree(fields, container, isHidden = false) {
    const wrapper = document.createElement('div');
    if (isHidden) wrapper.style.display = 'none';

    fields.forEach(field => {
        const div = document.createElement('div');
        div.className = isHidden ? 'mb-3 p-3 bg-light rounded border border-info' : 'mb-3';
        if (isHidden && document.body.classList.contains('dark-mode')) div.classList.remove('bg-light');

        let inputHtml = '';
        if (field.type === 'textarea') {
            inputHtml = `<textarea class="form-control" name="${field.id}" data-label="${field.label}" rows="3" ${!isHidden ? 'required' : ''}></textarea>`;
        } else if (field.type === 'select_one') {
            let optionsHtml = '<option value="">هەڵبژێرە...</option>';
            if (field.options) {
                field.options.forEach(opt => {
                    optionsHtml += `<option value="${opt}">${opt}</option>`;
                });
            }
            inputHtml = `<select class="form-select" name="${field.id}" data-label="${field.label}" ${!isHidden ? 'required' : ''}>${optionsHtml}</select>`;
        } else {
            let inputType = field.type === 'date' ? 'date' : (field.type === 'number' ? 'number' : 'text');
            inputHtml = `<input type="${inputType}" class="form-control" name="${field.id}" data-label="${field.label}" ${!isHidden ? 'required' : ''}>`;
        }

        div.innerHTML = `<label class="form-label fw-bold ${isHidden ? 'text-info' : ''}">${field.label}</label>${inputHtml}`;
        wrapper.appendChild(div);

        if (field.type === 'select_one' && field.children && field.children.length > 0) {
            const childContainer = renderFieldsTree(field.children, div, true);

            setTimeout(() => {
                const selectEl = div.querySelector(`select[name="${field.id}"]`);
                if (selectEl) {
                    selectEl.addEventListener('change', (e) => {
                        if (e.target.value !== "") {
                            childContainer.style.display = 'block';
                            childContainer.querySelectorAll('input, select, textarea').forEach(el => el.required = true);
                        } else {
                            childContainer.style.display = 'none';
                            childContainer.querySelectorAll('input, select, textarea').forEach(el => {
                                el.required = false;
                                el.value = '';
                            });
                        }
                    });
                }
            }, 50);
        }
    });

    container.appendChild(wrapper);
    return wrapper;
}

document.getElementById('newCaseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    let caseData = {};

    const inputs = e.target.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.offsetParent !== null && input.name) {
            caseData[input.getAttribute('data-label')] = input.value;
        }
    });

    caseData.stage = 'distribution';
    caseData.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    try {
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> چاوەڕوانبە...';

        await db.collection("aid_cases").add(caseData);
        e.target.reset();

        e.target.querySelectorAll('.branch-container, .bg-light').forEach(el => {
            if (el.style.display !== '') el.style.display = 'none';
        });

        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i> ناردن بۆ دابەشکردن';

        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'کەیسەکە تۆمارکرا', showConfirmButton: false, timer: 2000 });

        if (currentUserPerms.role === 'owner' || currentUserPerms.canDistribute) {
            const distributeTab = new bootstrap.Tab(document.getElementById('distribute-tab'));
            distributeTab.show();
        }
    } catch (error) {
        console.error(error);
        alert("هەڵە لە ناردندا!");
    }
});

function loadCategories() {
    db.collection("aid_categories").orderBy("createdAt", "asc").onSnapshot(snapshot => {
        categoriesCache = [];
        const filterSelect = document.getElementById('categoryFilter');
        filterSelect.innerHTML = '<option value="">هەڵبژاردنی بەش...</option>';

        snapshot.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            categoriesCache.push(data);
            filterSelect.innerHTML += `<option value="${data.id}">${data.name}</option>`;
        });
    });
}

function generateDetailsHtml(data) {
    let html = '<div class="mt-3 mb-3 p-2 border rounded shadow-sm bg-white" style="font-size: 0.9rem; max-height: 180px; overflow-y: auto;">';

    formFieldsCache.forEach(field => {
        const key = field.label;
        if (data[key] !== undefined && data[key] !== '') {
            html += `
                <div class="d-flex justify-content-between mb-2 border-bottom pb-1">
                    <span class="text-muted"><i class="fa-solid fa-angle-left me-1" style="font-size: 0.7rem;"></i> ${key}:</span>
                    <strong class="ms-2 text-start" style="max-width: 60%; word-wrap: break-word; color: var(--text-main);">${data[key]}</strong>
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

function loadDistributionCases() {
    db.collection("aid_cases").where("stage", "==", "distribution").onSnapshot(snapshot => {
        const list = document.getElementById('distributionList');
        if (!list) return;

        list.innerHTML = '';

        if (snapshot.empty) {
            list.innerHTML = '<div class="col-12 text-center text-muted mt-4">هیچ کەیسێک نییە بۆ دابەشکردن</div>';
            return;
        }

        let casesData = [];
        snapshot.forEach(doc => {
            casesData.push({ id: doc.id, data: doc.data() });
        });
        
        casesData.sort((a, b) => {
            const timeA = a.data.createdAt ? (a.data.createdAt.seconds || 0) : 0;
            const timeB = b.data.createdAt ? (b.data.createdAt.seconds || 0) : 0;
            return timeA - timeB; 
        });

        casesData.forEach(item => {
            const docId = item.id;
            const data = item.data;
            const primaryText = getPrimaryText(data);
            const detailsHtml = generateDetailsHtml(data);
            
            const submittedDays = calculateDaysPassed(data.createdAt);
            const isDelayed = submittedDays >= 7;
            
            const cardClass = isDelayed ? "case-card border-top border-4 case-delayed-border" : "case-card border-top border-4 border-primary";
            const warningBadge = isDelayed ? `<div class="case-delayed-badge fw-bold"><i class="fa-solid fa-triangle-exclamation ms-1"></i> ئەم کەیسە ${submittedDays} ڕۆژە نەنێردراوە!</div>` : '';

            list.innerHTML += `
                <div class="col-md-6 col-lg-4">
                    <div class="${cardClass}">
                        ${warningBadge}
                        <h6 class="fw-bold mb-3 text-primary"><i class="fa-solid fa-user-clock me-2"></i> ${primaryText}</h6>
                        
                        <div class="time-tracking-box">
                            <div class="d-flex justify-content-between mb-2 pb-2">
                                <span class="text-muted"><i class="fa-solid fa-pen-to-square me-1"></i> پڕکرایەوە:</span>
                                <span class="text-dark" dir="ltr" style="font-size: 0.8rem; font-weight:500;">${formatDateTime(data.createdAt)}</span>
                            </div>
                            ${generateDaysTrackerHtml(submittedDays)}
                        </div>
                        
                        ${detailsHtml}
                        
                        <div class="d-flex justify-content-between pt-2">
                            <button class="btn btn-sm btn-outline-danger action-btn" onclick="deleteCase('${docId}')">
                                <i class="fa-solid fa-trash"></i> سڕینەوە
                            </button>
                            <button class="btn btn-sm btn-primary action-btn" onclick="sendToCategory('${docId}')">
                                ناردن بۆ بەش <i class="fa-solid fa-share ms-1"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    });
}

async function deleteCase(id) {
    if (confirm("دڵنیایت لە سڕینەوەی ئەم کەیسە؟")) {
        await db.collection("aid_cases").doc(id).delete();
    }
}

async function sendToCategory(id) {
    if (categoriesCache.length === 0) return alert("هیچ بەشێک بوونی نییە، با ئەدمین دروستی بکات!");

    let optionsHtml = '';
    categoriesCache.forEach(cat => {
        optionsHtml += `<option value="${cat.id}">${cat.name}</option>`;
    });

    const { value: categoryId } = await Swal.fire({
        title: 'ناردن بۆ بەش',
        html: `<select id="swal-category" class="form-select mt-3">${optionsHtml}</select>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'ناردن',
        cancelButtonText: 'پاشگەزبوونەوە',
        preConfirm: () => {
            return document.getElementById('swal-category').value;
        }
    });

    if (categoryId) {
        await db.collection("aid_cases").doc(id).update({
            stage: 'category',
            categoryId: categoryId,
            status: 'pending',
            assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'نێردرا بۆ بەشەکە', showConfirmButton: false, timer: 1500 });
    }
}

function loadCategoryCases() {
    const selectedCatId = document.getElementById('categoryFilter').value;
    const list = document.getElementById('categoryCasesList');

    if (!selectedCatId) {
        list.innerHTML = '<div class="text-center text-muted mt-4"><i class="fa-solid fa-arrow-up"></i> تکایە سەرەتا بەشێک هەڵبژێرە</div>';
        return;
    }

    db.collection("aid_cases")
        .where("stage", "==", "category")
        .where("categoryId", "==", selectedCatId)
        .where("status", "==", "pending")
        .onSnapshot(snapshot => {
            list.innerHTML = '';

            if (snapshot.empty) {
                list.innerHTML = '<div class="col-12 text-center text-muted mt-4">هیچ کەیسێکی نوێ لەم بەشەدا نییە</div>';
                return;
            }

            let casesData = [];
            snapshot.forEach(doc => {
                casesData.push({ id: doc.id, data: doc.data() });
            });
            
            casesData.sort((a, b) => {
                const timeA = a.data.assignedAt ? (a.data.assignedAt.seconds || 0) : 0;
                const timeB = b.data.assignedAt ? (b.data.assignedAt.seconds || 0) : 0;
                return timeA - timeB; 
            });

            casesData.forEach(item => {
                const docId = item.id;
                const data = item.data;
                const primaryText = getPrimaryText(data);
                const detailsHtml = generateDetailsHtml(data);
                
                const timeToCalculate = data.assignedAt || data.createdAt; 
                const assignedDays = calculateDaysPassed(timeToCalculate);
                const isDelayed = assignedDays >= 7;
                
                const cardClass = isDelayed ? "case-card border-top border-4 case-delayed-border" : "case-card border-top border-4 border-warning";
                const warningBadge = isDelayed ? `<div class="case-delayed-badge fw-bold"><i class="fa-solid fa-triangle-exclamation ms-1"></i> ئەم کەیسە ${assignedDays} ڕۆژە سەردانی نەکراوە!</div>` : '';

                list.innerHTML += `
                <div class="col-md-6 col-lg-6">
                    <div class="${cardClass}">
                        ${warningBadge}
                        <h6 class="fw-bold mb-3"><i class="fa-solid fa-folder-open text-warning me-2"></i> ${primaryText}</h6>
                        
                        <div class="time-tracking-box">
                            <div class="d-flex justify-content-between mb-2 pb-2">
                                <span class="text-muted"><i class="fa-solid fa-share-nodes me-1"></i> نێردراوە بۆ بەش:</span>
                                <span class="text-dark" dir="ltr" style="font-size: 0.8rem; font-weight:500;">${formatDateTime(data.assignedAt || data.createdAt)}</span>
                            </div>
                            ${generateDaysTrackerHtml(assignedDays)}
                        </div>
                        
                        ${detailsHtml}
                        
                        <div class="d-flex flex-wrap gap-2 pt-2 justify-content-center">
                            <button class="btn btn-sm btn-success action-btn flex-grow-1" onclick="updateStatus('${docId}', 'سەردانی کراوان')">
                                <i class="fa-solid fa-check-double"></i> سەردانی کراوە
                            </button>
                            <button class="btn btn-sm btn-danger action-btn flex-grow-1" onclick="updateStatus('${docId}', 'بەردەست نەبوو')">
                                <i class="fa-solid fa-xmark"></i> بەردەست نەبوو
                            </button>
                            <button class="btn btn-sm btn-secondary action-btn flex-grow-1" onclick="updateStatus('${docId}', 'پێویستی بە سەردان نەبوو')">
                                <i class="fa-solid fa-ban"></i> پێویست نەبوو
                            </button>
                            <button class="btn btn-sm btn-info action-btn flex-grow-1 text-white" onclick="updateStatus('${docId}', 'پێشتر سەردانی کراوە')">
                                <i class="fa-solid fa-clock-rotate-left"></i> پێشتر کراوە
                            </button>
                        </div>
                    </div>
                </div>
            `;
            });
        });
}

async function updateStatus(id, newStatus) {
    if (confirm(`دڵنیایت کە دەتەوێت بیخەیتە باری: (${newStatus}) ؟`)) {
        await db.collection("aid_cases").doc(id).update({
            stage: 'archived',
            status: newStatus,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'کەیسەکە ئەرشیف کرا', showConfirmButton: false, timer: 1500 });
    }
}