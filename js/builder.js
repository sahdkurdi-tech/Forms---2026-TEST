// js/builder.js

const urlParams = new URLSearchParams(window.location.search);
const formId = urlParams.get('id');

// ==========================================
// 1. Initialization & Setup
// ==========================================
async function init() {
    if(!formId) return alert("هیچ پڕۆژەیەک دیاری نەکراوە");
    
    checkPasteButton();

    // Setup Toolbox
    new Sortable(document.getElementById('toolbox'), {
        group: { name: 'shared', pull: 'clone', put: false },
        sort: false, animation: 150
    });

    // Setup Main Canvas
    const mainCanvas = document.getElementById('form-canvas');
    initSortable(mainCanvas);

    // Fetch Existing Data
    try {
        const doc = await db.collection("forms").doc(formId).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('listNameDisplay').innerText = data.title;
            if(data.fields && data.fields.length > 0) {
                document.getElementById('empty-msg').style.display = 'none';
                rebuildFormTree(data.fields, mainCanvas);
            }
        }
    } catch (error) {
        console.error("Error loading form:", error);
    }
}

function initSortable(element) {
    if (element.classList.contains('sortable-initialized')) return;

    new Sortable(element, {
        group: 'shared',
        animation: 150,
        handle: '.fa-grip-vertical',
        ghostClass: 'sortable-ghost',
        onAdd: function (evt) {
            const item = evt.item;
            const type = item.getAttribute('data-type');
            const newField = createFieldElement(type);
            item.replaceWith(newField);
            document.getElementById('empty-msg').style.display = 'none';
        }
    });
    
    element.classList.add('sortable-initialized');
}

function makeOptionsSortable(fieldElement) {
    const container = fieldElement.querySelector('.options-tags-container');
    if (container && !container.classList.contains('sortable-options-init')) {
        new Sortable(container, {
            animation: 150,
            handle: '.option-drag-handle',
            ghostClass: 'bg-light', 
            direction: 'vertical',
            onEnd: function (evt) { }
        });
        container.classList.add('sortable-options-init');
    }
}

// ==========================================
// 2. Create Field Logic
// ==========================================
function createFieldElement(type, data = null) {
    const id = data ? data.id : 'field_' + Math.random().toString(36).substr(2, 9);
    const label = data ? data.label : (type === 'fingerprint' ? 'واژۆی ئەلیکترۆنی' : 'ناونیشانی پرسیار بنووسە');
    const isRequired = (data && data.required) ? 'checked' : ''; 
    
    const div = document.createElement('div');
    div.className = 'form-field';
    div.setAttribute('data-id', id);
    div.setAttribute('data-type', type);

    let extraControls = '';
    let preview = '';

    if (type === 'fingerprint') {
        preview = `
            <div class="border rounded p-3 mt-2 text-center bg-light text-muted">
                <i class="fa-solid fa-fingerprint fa-2x mb-2"></i>
                <br>شوێنی واژۆی ئەلیکترۆنی
            </div>`;
    }
    else if (type === 'select_one' || type === 'select_many') {
        const options = data && data.options ? data.options : [];
        const typeName = type === 'select_one' ? 'لیست (Dropdown)' : 'فرە هەڵبژاردن (Checkbox)';
        const icon = type === 'select_one' ? 'fa-caret-down' : 'fa-check-double';
        let tagsHTML = '';
        options.forEach(opt => { tagsHTML += createTagHTML(opt); });

        extraControls = `
            <div class="mt-3 p-3 bg-light border rounded">
                <label class="small text-muted mb-2 fw-bold">لیستی بژاردەکان:</label>
                <div class="input-group mb-3">
                    <input type="text" class="form-control option-adder-input" placeholder="بژاردەی نوێ...">
                    <button class="btn btn-primary" onclick="addOptionFromBtn(this)"><i class="fa-solid fa-plus"></i></button>
                </div>
                <div class="options-tags-container d-flex flex-column gap-2 mb-3">
                    ${tagsHTML}
                </div>
                <button class="btn btn-sm btn-outline-secondary w-100" onclick="generateBranches(this)">
                    <i class="fa-solid fa-code-branch"></i> نوێکردنەوەی لقەکان
                </button>
            </div>
            <div class="branches-wrapper"></div>`;
        preview = `<div class="text-muted small mt-2"><i class="fa-solid ${icon}"></i> ${typeName}</div>`;
    } 
    else {
        if(type === 'text') preview = '<input class="form-control form-control-sm mt-2" disabled placeholder="...">';
        else if(type === 'number') preview = '<input type="number" class="form-control form-control-sm mt-2" disabled placeholder="123">';
        else if(type === 'date') preview = '<input type="date" class="form-control form-control-sm mt-2" disabled>';
        else if(type === 'photo') preview = '<div class="border rounded p-2 mt-2 text-center text-muted"><i class="fa-solid fa-camera"></i></div>';
        else if(type === 'note') preview = '<textarea class="form-control form-control-sm mt-2" disabled></textarea>';
    }

    div.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
            <div class="d-flex gap-2 w-100 align-items-center">
                <i class="fa-solid fa-grip-vertical text-muted fs-5" style="cursor: move;"></i>
                <div class="flex-grow-1 ms-2">
                    <div class="editable-label" contenteditable="true">${label}</div>
                    <div class="form-check form-switch mt-2">
                        <input class="form-check-input required-toggle" type="checkbox" id="req_${id}" ${isRequired}>
                        <label class="form-check-label small text-muted" for="req_${id}">ئەمە ناچارییە</label>
                    </div>
                </div>
            </div>
            
            <div class="d-flex gap-1">
                <button class="btn btn-sm btn-light text-primary" onclick="copyField(this)" title="کۆپی">
                    <i class="fa-regular fa-copy"></i>
                </button>
                <button class="btn btn-sm btn-light text-danger" onclick="removeField(this)" title="سڕینەوە">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="ps-4 ms-2">
            ${preview}
            ${extraControls}
        </div>
        
        <div class="field-add-zone">
            <button class="btn-paste-here" onclick="pasteAfter(this)" title="پەیستکردن لە خوار ئەم خانەیە">
                <i class="fa-solid fa-plus"></i>
            </button>
        </div>
    `;

    if (type === 'select_one' || type === 'select_many') {
        const input = div.querySelector('.option-adder-input');
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); addOptionFromInput(this); }
        });
        
        setTimeout(() => makeOptionsSortable(div), 50);
    }

    return div;
}

// ==========================================
// 3. Option Tags Logic
// ==========================================
function createTagHTML(value) {
    const safeValue = value.replace(/"/g, "&quot;");
    return `
        <div class="option-tag d-flex align-items-center bg-white border rounded shadow-sm p-2" data-val="${safeValue}">
            <div class="option-drag-handle text-muted px-2 me-2" style="cursor: move;">
                <i class="fa-solid fa-bars"></i>
            </div>
            <span class="tag-text flex-grow-1 fw-bold text-dark">${value}</span>
            <button class="btn btn-sm text-danger hover-bg-light rounded-circle p-1" onclick="removeTag(this)">
                <i class="fa-solid fa-xmark fs-6"></i>
            </button>
        </div>
    `;
}

function addOptionFromInput(inputElement) {
    const value = inputElement.value.trim();
    if (!value) return;

    const container = inputElement.closest('.form-field').querySelector('.options-tags-container');
    const existingTags = Array.from(container.querySelectorAll('.tag-text')).map(el => el.innerText);
    if (existingTags.includes(value)) {
        alert("ئەم بژاردەیە پێشتر زیادکراوە!");
        return;
    }

    container.insertAdjacentHTML('beforeend', createTagHTML(value));
    inputElement.value = '';
    inputElement.focus();
}

function addOptionFromBtn(btn) {
    const input = btn.previousElementSibling;
    addOptionFromInput(input);
}

function removeTag(icon) {
    icon.closest('.option-tag').remove();
}

// ==========================================
// 4. Branch Generation (UPDATE: With Paste Button)
// ==========================================
function generateBranches(btn) {
    const fieldDiv = btn.closest('.form-field');
    const wrapper = fieldDiv.querySelector('.branches-wrapper');
    const tagsContainer = fieldDiv.querySelector('.options-tags-container');
    
    const newOptions = Array.from(tagsContainer.querySelectorAll('.option-tag'))
                            .map(tag => tag.getAttribute('data-val'));

    const existingMap = new Map();
    wrapper.querySelectorAll('.condition-zone').forEach(branch => {
        const val = branch.getAttribute('data-condition-value');
        existingMap.set(val, branch); 
    });

    const fragment = document.createDocumentFragment();

    newOptions.forEach(opt => {
        if (existingMap.has(opt)) {
            const branch = existingMap.get(opt);
            fragment.appendChild(branch);
            existingMap.delete(opt);
        } else {
            const branchId = 'branch_' + Math.random().toString(36).substr(2, 9);
            const branchDiv = document.createElement('div');
            branchDiv.className = 'condition-zone';
            branchDiv.setAttribute('data-condition-value', opt);
            
            // HTML-ی لقەکان بە دوگمەی پەیستەوە
            branchDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div class="condition-title">
                        <i class="fa-solid fa-arrow-turn-down"></i>
                        ئەگەر وەڵامەکە <b>"${opt}"</b> بوو:
                    </div>
                    <button onclick="pasteIntoBranch(this)" class="btn btn-sm btn-outline-primary py-0" title="پەیستکردن لەم لقە">
                        <i class="fa-regular fa-clipboard small"></i>
                    </button>
                </div>
                <div class="condition-container" id="${branchId}"></div>
            `;
            fragment.appendChild(branchDiv);
        }
    });

    wrapper.innerHTML = ''; 
    wrapper.appendChild(fragment); 

    wrapper.querySelectorAll('.condition-container').forEach(container => {
        initSortable(container);
    });
}

// ==========================================
// 5. Rebuild Logic (UPDATE: With Paste Button)
// ==========================================
function rebuildFormTree(fields, container) {
    fields.forEach(fieldData => {
        const fieldEl = createFieldElement(fieldData.type, fieldData);
        container.appendChild(fieldEl);

        if ((fieldData.type === 'select_one' || fieldData.type === 'select_many') && fieldData.branches) {
            const wrapper = fieldEl.querySelector('.branches-wrapper');
            
            for (const [optionName, children] of Object.entries(fieldData.branches)) {
                const branchId = 'branch_' + Math.random().toString(36).substr(2, 9);
                const branchHTML = `
                    <div class="condition-zone" data-condition-value="${optionName}">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div class="condition-title">
                                <i class="fa-solid fa-arrow-turn-down"></i>
                                ئەگەر وەڵامەکە <b>"${optionName}"</b> بوو:
                            </div>
                            <button onclick="pasteIntoBranch(this)" class="btn btn-sm btn-outline-primary py-0" title="پەیستکردن لەم لقە">
                                <i class="fa-regular fa-clipboard small"></i>
                            </button>
                        </div>
                        <div class="condition-container" id="${branchId}"></div>
                    </div>
                `;
                wrapper.insertAdjacentHTML('beforeend', branchHTML);
                const zoneContainer = document.getElementById(branchId);
                initSortable(zoneContainer);

                if(children && children.length > 0) {
                    rebuildFormTree(children, zoneContainer);
                }
            }
        }
    });
}

function removeField(btn) {
    if(confirm('دڵنیایت لە سڕینەوە؟')) btn.closest('.form-field').remove();
}

async function saveFormStructure() {
    const btn = document.getElementById('saveBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...';

    try {
        const structure = getStructure(document.getElementById('form-canvas'));
        await db.collection("forms").doc(formId).update({ 
            fields: structure,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('پێکهاتەکە بە سەرکەوتوویی پاشەکەوت کرا!');
    } catch (error) {
        console.error(error);
        alert('هەڵە: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function getStructure(container) {
    let fields = [];
    const children = Array.from(container.children).filter(el => el.classList.contains('form-field'));
    
    children.forEach(child => {
        const id = child.getAttribute('data-id');
        const type = child.getAttribute('data-type');
        const label = child.querySelector('.editable-label').innerText;
        const required = child.querySelector('.required-toggle').checked;
        
        let fieldData = { id, type, label, required };

        if(type === 'select_one' || type === 'select_many') {
            const tagsContainer = child.querySelector('.options-tags-container');
            const options = Array.from(tagsContainer.querySelectorAll('.option-tag'))
                                 .map(tag => tag.getAttribute('data-val'));
            
            fieldData.options = options;
            fieldData.branches = {}; 

            const zones = child.querySelectorAll('.condition-zone');
            zones.forEach(zone => {
                const conditionValue = zone.getAttribute('data-condition-value');
                const zoneContainer = zone.querySelector('.condition-container');
                const branchChildren = getStructure(zoneContainer);
                if(branchChildren.length > 0) {
                    fieldData.branches[conditionValue] = branchChildren;
                }
            });
        }
        fields.push(fieldData);
    });
    return fields;
}

// ==========================================
// 6. COPY & PASTE SYSTEM (UPDATED)
// ==========================================

function checkPasteButton() {
    const savedData = localStorage.getItem('copied_field_data');
    const pasteBtn = document.getElementById('floatingPasteBtn');
    
    if(pasteBtn) {
        if (savedData) {
            pasteBtn.style.display = 'flex';
            pasteBtn.classList.add('animate-up');
        } else {
            pasteBtn.style.display = 'none';
        }
    }
}

function copyField(btn) {
    const fieldDiv = btn.closest('.form-field');
    
    const type = fieldDiv.getAttribute('data-type');
    const label = fieldDiv.querySelector('.editable-label').innerText;
    const required = fieldDiv.querySelector('.required-toggle').checked;
    
    let fieldData = { type, label, required };

    if(type === 'select_one' || type === 'select_many') {
        const tagsContainer = fieldDiv.querySelector('.options-tags-container');
        if(tagsContainer) {
            const options = Array.from(tagsContainer.querySelectorAll('.option-tag'))
                                 .map(tag => tag.getAttribute('data-val'));
            fieldData.options = options;
        }
    }

    localStorage.setItem('copied_field_data', JSON.stringify(fieldData));
    
    checkPasteButton();

    const icon = btn.querySelector('i');
    const originalClass = icon.className;
    icon.className = 'fa-solid fa-check text-success';
    setTimeout(() => icon.className = originalClass, 1000);
    
    const Toast = Swal.mixin({
        toast: true, position: 'bottom-start', showConfirmButton: false, timer: 2000
    });
    Toast.fire({ icon: 'success', title: 'خانەکە کۆپی کرا' });
}

// 1. Paste Global (Bottom of form)
function pasteField() {
    insertCopiedField(null, null);
}

// 2. Paste After (Between fields)
function pasteAfter(btn) {
    const currentField = btn.closest('.form-field');
    insertCopiedField(currentField, null);
}

// 3. Paste Into Branch (NEW Function)
function pasteIntoBranch(btn) {
    const branchZone = btn.closest('.condition-zone');
    const container = branchZone.querySelector('.condition-container');
    insertCopiedField(null, container);
}

// Main Insertion Logic
function insertCopiedField(referenceNode, targetContainer) {
    const savedData = localStorage.getItem('copied_field_data');
    
    if (!savedData) {
        Swal.fire({
            icon: 'warning', title: 'ئاگاداری', text: 'هیچ خانەیەک کۆپی نەکراوە!', confirmButtonText: 'باشە', confirmButtonColor: '#6366f1'
        });
        return;
    }

    const data = JSON.parse(savedData);
    data.id = 'field_' + Math.random().toString(36).substr(2, 9);
    
    const newField = createFieldElement(data.type, data);
    
    // Logic for placement
    if (referenceNode) {
        // پەیست لە دوای خانەیەکی دیاریکراو (بۆ (+)ـەکەی نێوان خانەکان)
        referenceNode.after(newField);
    } else if (targetContainer) {
        // پەیست لە ناو لقێکی دیاریکراو (بۆ دوگمەی ناو لقەکان)
        targetContainer.appendChild(newField);
    } else {
        // پەیست لە خوارەوەی فۆرمەکە (بۆ دوگمە گەورەکە)
        document.getElementById('form-canvas').appendChild(newField);
    }
    
    const emptyMsg = document.getElementById('empty-msg');
    if(emptyMsg) emptyMsg.style.display = 'none';
    
    newField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    newField.style.transition = "border-color 0.3s, box-shadow 0.3s";
    newField.style.borderColor = '#6366f1';
    newField.style.boxShadow = '0 0 15px rgba(99, 102, 241, 0.2)';
    setTimeout(() => {
        newField.style.borderColor = '#e2e8f0';
        newField.style.boxShadow = '0 2px 5px rgba(0,0,0,0.02)';
    }, 2000);
}

init();