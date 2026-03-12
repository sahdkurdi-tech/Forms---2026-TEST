// js/aid-settings.js

firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
        const userDoc = await db.collection("users").doc(user.email).get();
        if (userDoc.exists && userDoc.data().role === 'owner') {
            loadCategories();
            initBuilder();
            loadExistingForm();
        } else {
            alert("تۆ دەسەڵاتی بینینی ئەم پەڕەیەت نییە!");
            window.location.href = "index.html";
        }
    }
});

// ==========================================
// ١. بەڕێوەبردنی بەشەکان لەگەڵ ڕەنگەکانیان
// ==========================================
async function addCategory() {
    const catInput = document.getElementById('catName');
    const catColorInput = document.getElementById('catColor'); // وەرگرتنی خانەی ڕەنگ
    
    const name = catInput.value.trim();
    const color = catColorInput ? catColorInput.value : '#03b6f7'; // ئەگەر ڕەنگی هەڵنەبژاردبوو، شینی کاڵ بەکاردێت
    
    if (!name) return alert("تکایە ناوی بەشەکە بنووسە!");
    
    try {
        await db.collection("aid_categories").add({ 
            name: name, 
            color: color, // پاشەکەوتکردنی ڕەنگەکە لە داتابەیس
            createdAt: firebase.firestore.FieldValue.serverTimestamp() 
        });
        
        catInput.value = '';
        if(catColorInput) catColorInput.value = '#03b6f7'; // گەڕاندنەوەی ڕەنگەکە بۆ باری ئاسایی
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'بەشەکە زیادکرا', showConfirmButton: false, timer: 1500 });
    } catch (error) { 
        alert("هەڵە ڕوویدا!"); 
    }
}

function loadCategories() {
    db.collection("aid_categories").orderBy("createdAt", "asc").onSnapshot((snapshot) => {
        const list = document.getElementById('categoriesList');
        list.innerHTML = '';
        if (snapshot.empty) return list.innerHTML = '<li class="list-group-item text-center text-muted">هیچ بەشێک نییە</li>';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const catColor = data.color || '#03b6f7'; // ئەگەر بەشە کۆنەکان ڕەنگیان نەبوو، شین دەبن
            
            // دروستکردنی لیستەکە بە دانانی بازنەیەکی ڕەنگاوڕەنگ لە تەنیشت ناوەکە
            list.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span>
                    <span style="display:inline-block; width:15px; height:15px; border-radius:50%; background-color:${catColor}; margin-left:10px; vertical-align:middle; border: 1px solid rgba(0,0,0,0.1);"></span>
                    ${data.name}
                </span>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${doc.id}')"><i class="fa-solid fa-trash"></i></button>
            </li>`;
        });
    });
}

async function deleteCategory(id) {
    if (confirm("دڵنیایت لە سڕینەوە؟")) await db.collection("aid_categories").doc(id).delete();
}


// ==========================================
// ٢. دروستکەری فۆڕم (Drag & Drop Builder)
// ==========================================
function initBuilder() {
    // ڕێکخستنی لیستی ئامرازەکان (Toolbox)
    new Sortable(document.getElementById('toolbox'), {
        group: { name: 'shared', pull: 'clone', put: false },
        sort: false,
        animation: 150
    });

    // ڕێکخستنی شاشەی سەرەکی (Canvas)
    initSortableCanvas(document.getElementById('form-canvas'));
}

function initSortableCanvas(element) {
    if (element.classList.contains('sortable-initialized')) return;

    new Sortable(element, {
        group: 'shared',
        animation: 150,
        handle: '.fa-grip-vertical',
        ghostClass: 'bg-light',
        onAdd: function (evt) {
            const item = evt.item;
            // ئەگەر لە Toolbox هاتبێت
            if (item.classList.contains('toolbox-item')) {
                const type = item.getAttribute('data-type');
                const newField = createFieldHtml(type);
                item.replaceWith(newField);

                document.getElementById('empty-msg').style.display = 'none';

                // ئەگەر خانەکە هەڵبژاردن بێت، ڕێگە بە دروستکردنی لق دەدەین لەناویدا
                if (type === 'select_one') {
                    const nested = newField.querySelector('.nested-container');
                    if (nested) initSortableCanvas(nested);
                }
            }
        }
    });
    element.classList.add('sortable-initialized');
}

// دروستکردنی کارتی خانەکە کاتێک فڕێدەدرێتە ناو Canvas
function createFieldHtml(type, existingData = null) {
    const div = document.createElement('div');
    div.className = 'form-element';
    div.setAttribute('data-type', type);

    // پێناسەکردنی ئایکۆن و ناوی سەرەتایی
    let typeName = '', icon = '';
    if (type === 'text') { typeName = 'دەقی کورت'; icon = 'fa-font'; }
    else if (type === 'number') { typeName = 'ژمارە'; icon = 'fa-hashtag'; }
    else if (type === 'textarea') { typeName = 'دەقی درێژ'; icon = 'fa-align-right'; }
    else if (type === 'date') { typeName = 'بەروار'; icon = 'fa-calendar'; }
    else if (type === 'select_one') { typeName = 'هەڵبژاردن (دروستکردنی لق)'; icon = 'fa-caret-square-down'; }

    // هێنانی زانیاری پێشوو ئەگەر هەبێت (بۆ کاتی Load کردنەوە)
    const labelValue = existingData ? existingData.label : '';
    const optionsValue = (existingData && existingData.options) ? existingData.options.join(',') : '';

    let extraHtml = '';
    if (type === 'select_one') {
        extraHtml = `
            <div class="mt-2">
                <label class="small text-muted fw-bold">هەڵبژاردنەکان (بە فاریزە , جیایان بکەرەوە):</label>
                <input type="text" class="form-control-custom field-options" placeholder="نموونە: بەڵێ, نەخێر" value="${optionsValue}">
            </div>
            <div class="nested-container mt-3" placeholder="خانەکانی پەیوەست بەم هەڵبژاردنە لێرە دابنێ..."></div>
        `;
    }

    div.innerHTML = `
        <div class="element-header">
            <div class="fw-bold text-muted"><i class="fa-solid fa-grip-vertical me-2"></i> <i class="fa-solid ${icon} me-1"></i> ${typeName}</div>
            <div class="element-actions">
                <button onclick="this.closest('.form-element').remove()"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
        <div>
            <label class="small text-muted fw-bold">ناوی پرسیار:</label>
            <input type="text" class="form-control-custom field-label" placeholder="پرسیارەکە لێرە بنووسە..." value="${labelValue}">
        </div>
        ${extraHtml}
    `;

    return div;
}


// ==========================================
// ٣. پاشەکەوتکردن و هێنانەوەی فۆڕمەکە
// ==========================================

// خوێندنەوەی درەختی فۆڕمەکە (Recursive)
function getFormStructure(container) {
    const elements = [];
    const children = container.children;

    for (let child of children) {
        if (child.classList.contains('form-element')) {
            const type = child.getAttribute('data-type');
            const labelInput = child.querySelector('.field-label');
            const label = labelInput ? labelInput.value.trim() : '';

            if (!label) continue; // ئەگەر ناوی نەبوو پاشەکەوتی مەکە

            let fieldData = {
                id: 'field_' + Math.random().toString(36).substr(2, 9),
                type: type,
                label: label
            };

            if (type === 'select_one') {
                const optionsInput = child.querySelector('.field-options');
                if (optionsInput) {
                    fieldData.options = optionsInput.value.split(',').map(s => s.trim()).filter(s => s !== '');
                }

                // خوێندنەوەی لقەکان (ئەگەر هەبن)
                const nestedContainer = child.querySelector('.nested-container');
                if (nestedContainer) {
                    fieldData.children = getFormStructure(nestedContainer);
                }
            }

            elements.push(fieldData);
        }
    }
    return elements;
}

// پاشەکەوتکردنی تەواوی فۆڕمەکە لە یەک دۆکیومێنتدا
async function saveAidForm() {
    const mainCanvas = document.getElementById('form-canvas');
    const structure = getFormStructure(mainCanvas);

    if (structure.length === 0) return alert("تکایە بەلایەنی کەمەوە خانەیەک دابنێ یان ناویان لێ بنێ!");

    const btn = document.querySelector('button[onclick="saveAidForm()"]');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i> چاوەڕوانبە...';
    btn.disabled = true;

    try {
        // ئێمە هەموو فۆڕمەکە دەخەینە ناو یەک دۆکیومێنت بە ناوی main_form
        await db.collection("aid_fields").doc("main_form").set({
            fields: structure,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        Swal.fire({ icon: 'success', title: 'سەرکەوتوو', text: 'فۆڕمەکە بە سەرکەوتوویی پاشەکەوت کرا', timer: 2000, showConfirmButton: false });
    } catch (error) {
        console.error(error);
        alert("هەڵە لە پاشەکەوتکردندا!");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk me-2"></i> پاشەکەوتکردنی فۆڕم';
        btn.disabled = false;
    }
}

// هێنانەوەی فۆڕمەکە کاتێک پەڕەکە دەکرێتەوە
async function loadExistingForm() {
    try {
        const doc = await db.collection("aid_fields").doc("main_form").get();
        if (doc.exists) {
            const data = doc.data();
            if (data.fields && data.fields.length > 0) {
                document.getElementById('empty-msg').style.display = 'none';
                const mainCanvas = document.getElementById('form-canvas');
                rebuildFormTree(data.fields, mainCanvas);
            }
        }
    } catch (error) {
        console.error("Error loading form:", error);
    }
}

// دروستکردنەوەی کارتەکان لە داتابەیسەوە (Recursive)
function rebuildFormTree(fields, container) {
    fields.forEach(fieldData => {
        const newField = createFieldHtml(fieldData.type, fieldData);
        container.appendChild(newField);

        if (fieldData.type === 'select_one') {
            const nestedContainer = newField.querySelector('.nested-container');
            if (nestedContainer) {
                initSortableCanvas(nestedContainer); // چالاککردنی ڕاکێشان بۆ ناو ئەم لقە
                if (fieldData.children && fieldData.children.length > 0) {
                    rebuildFormTree(fieldData.children, nestedContainer);
                }
            }
        }
    });
}