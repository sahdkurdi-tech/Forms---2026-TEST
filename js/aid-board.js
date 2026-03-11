// js/aid-board.js

let formFieldsCache = [];
let categoriesCache = [];
let isBoardInitialized = false;
let currentUserPerms = {};

firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        const userDoc = await db.collection("users").doc(user.email).get();
        if (userDoc.exists) {
            currentUserPerms = userDoc.data();

            // پیشاندانی دوگمەی سێتینگ تەنها ئەگەر کەسەکە خاوەن (owner) بوو
            if (currentUserPerms.role === 'owner') {
                const settingSidebar = document.getElementById('navSettingsSidebar');
                const settingMobile = document.getElementById('navSettingsMobile');
                if (settingSidebar) settingSidebar.classList.remove('d-none');
                if (settingMobile) settingMobile.classList.remove('d-none');
            }

            // شاردنەوەی تابی "دابەشکردن" ئەگەر کەسەکە دەسەڵاتی نەبوو
            if (currentUserPerms.role !== 'owner' && !currentUserPerms.canDistribute) {
                const distributeTabLi = document.getElementById('distribute-tab');
                if (distributeTabLi) {
                    distributeTabLi.parentElement.style.display = 'none';
                }
            }

            // شاردنەوەی هەموو لینک و دوگمەکانی ئەرشیف ئەگەر کەسەکە دەسەڵاتی نەبوو
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
    let html = '<div class="mt-3 mb-3 p-2 border rounded shadow-sm" style="font-size: 0.9rem; max-height: 180px; overflow-y: auto;">';

    formFieldsCache.forEach(field => {
        const key = field.label;
        if (data[key] !== undefined && data[key] !== '') {
            html += `
                <div class="d-flex justify-content-between mb-2 border-bottom pb-1">
                    <span class="text-muted"><i class="fa-solid fa-angle-left me-1" style="font-size: 0.7rem;"></i> ${key}:</span>
                    <strong class="ms-2 text-start" style="max-width: 60%; word-wrap: break-word;">${data[key]}</strong>
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

        snapshot.forEach(doc => {
            const data = doc.data();
            const primaryText = getPrimaryText(data);
            const detailsHtml = generateDetailsHtml(data);

            list.innerHTML += `
                <div class="col-md-6 col-lg-4">
                    <div class="case-card border-top border-4 border-primary">
                        <h6 class="fw-bold mb-0 text-primary"><i class="fa-solid fa-user-clock me-1"></i> ${primaryText}</h6>
                        ${detailsHtml}
                        <div class="d-flex justify-content-between pt-2">
                            <button class="btn btn-sm btn-outline-danger action-btn" onclick="deleteCase('${doc.id}')">
                                <i class="fa-solid fa-trash"></i> سڕینەوە
                            </button>
                            <button class="btn btn-sm btn-primary action-btn" onclick="sendToCategory('${doc.id}')">
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
            status: 'pending'
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

            snapshot.forEach(doc => {
                const data = doc.data();
                const primaryText = getPrimaryText(data);
                const detailsHtml = generateDetailsHtml(data);

                list.innerHTML += `
                <div class="col-md-6 col-lg-6">
                    <div class="case-card border-top border-4 border-warning">
                        <h6 class="fw-bold mb-0"><i class="fa-solid fa-folder-open text-warning me-2"></i> ${primaryText}</h6>
                        ${detailsHtml}
                        <div class="d-flex flex-wrap gap-2 pt-2 justify-content-center">
                            <button class="btn btn-sm btn-success action-btn flex-grow-1" onclick="updateStatus('${doc.id}', 'سەردانی کراوان')">
                                <i class="fa-solid fa-check-double"></i> سەردانی کراوە
                            </button>
                            <button class="btn btn-sm btn-danger action-btn flex-grow-1" onclick="updateStatus('${doc.id}', 'سەردانی نەکراوان')">
                                <i class="fa-solid fa-xmark"></i> بەردەست نەبوو
                            </button>
                            <button class="btn btn-sm btn-secondary action-btn flex-grow-1" onclick="updateStatus('${doc.id}', 'پێویستی بە سەردان نەبوو')">
                                <i class="fa-solid fa-ban"></i> پێویست نەبوو
                            </button>
                            <button class="btn btn-sm btn-info action-btn flex-grow-1 text-white" onclick="updateStatus('${doc.id}', 'پێشتر سەردانی کراوە')">
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