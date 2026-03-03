// js/view.js

// ******************************************************
// IMAGEKIT CONFIGURATION
const IMAGEKIT_PRIVATE_KEY = "private_1c11AFDWMP9vctTdwopQFDLCaBU=";
// ******************************************************

const urlParams = new URLSearchParams(window.location.search);
const formId = urlParams.get('id');

const formEl = document.getElementById('publicForm');
const container = document.getElementById('dynamicInputs');
const titleEl = document.getElementById('formTitleDisplay');
const STORAGE_KEY = `autosave_data_${formId}`;

// گوێگرتن لە هەر گۆڕانکارییەک (نووسین یان هەڵبژاردن)
if(formEl) {
    formEl.addEventListener('input', handleAutoSave);
    formEl.addEventListener('change', handleAutoSave);
}

// کۆگای وێنەکان
let photosStore = {};
// کۆگای خانە ناچارییەکان (بۆ پشکنین)
let requiredFieldsRegistry = [];
// کۆگای پەنجەمۆرەکان/واژۆکان
let fingerprintPads = {};

// گۆڕاو بۆ Cropper
let cropper = null;
let currentEditField = null;
let currentFileQueue = [];

// 1. بارکردنی فۆڕم و پشکنینی دۆخی چالاکبوون
async function initView() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    // هەوڵ دەدات کۆنتەینەرەکە بدۆزێتەوە (چ بە ئایدی یان بە کلاس)
    let mainContainer = document.getElementById('mainFormContainer');
    if (!mainContainer) mainContainer = document.querySelector('.container.py-5'); 

    let inactiveMsg = document.getElementById('inactiveMessage');

    // ئەگەر پەیامی داخستن لە HTML نەبوو، دروستی دەکەین
    if (!inactiveMsg) {
        inactiveMsg = document.createElement('div');
        inactiveMsg.id = 'inactiveMessage';
        inactiveMsg.className = 'd-none text-center mt-5 pt-5';
        inactiveMsg.innerHTML = `
            <div class="bg-white p-5 rounded-4 shadow mx-auto" style="max-width: 500px;">
                <i class="fa-solid fa-lock text-danger fa-4x mb-3"></i>
                <h3 class="fw-bold">فۆڕمەکە داخراوە</h3>
                <p class="text-muted">ببورە، ئەم فۆڕمە لە ئێستادا ناچاڵاکە.</p>
            </div>
        `;
        document.body.appendChild(inactiveMsg);
    }

    if(!formId) {
        if(typeof Swal !== 'undefined') Swal.fire({ icon: 'error', title: 'هەڵە', text: 'لینکەکە هەڵەیە' });
        else alert('لینکەکە هەڵەیە');
        return;
    }
    createEditorModal();

    try {
        const doc = await db.collection("forms").doc(formId).get();
        if (doc.exists) {
            const data = doc.data();

            // --- ١. ئەگەر ناچاڵاک بوو ---
            if (data.active === false) {
                if(loadingOverlay) loadingOverlay.style.display = 'none';
                if(mainContainer) mainContainer.classList.add('d-none'); // فۆڕم بشارەوە
                inactiveMsg.classList.remove('d-none'); // پەیام پیشان بدە
                return; 
            }

            // --- ٢. ئەگەر چالاک بوو ---
            if(mainContainer) mainContainer.classList.remove('d-none'); 
            inactiveMsg.classList.add('d-none');

            // بەردەوام بە لە بارکردنی داتا...
            titleEl.innerText = data.title;
            requiredFieldsRegistry = [];
            fingerprintPads = {}; 
            renderFields(data.fields || [], container);
            
            setTimeout(() => {
                restoreProgress();
            }, 300);
            
            const indicator = document.createElement('div');
            indicator.id = 'saveIndicator';
            indicator.className = 'text-muted small text-center mt-2 fw-bold text-primary';
            indicator.style.opacity = '0';
            indicator.style.transition = 'opacity 0.5s';
            indicator.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> خەزنکرا (کاتی)';
            if(titleEl && titleEl.parentNode) titleEl.parentNode.appendChild(indicator);

            if(loadingOverlay) loadingOverlay.style.display = 'none';
        } else {
            if(typeof Swal !== 'undefined') Swal.fire({ icon: 'error', title: 'نەدۆزرایەوە', text: 'فۆڕمەکە نەدۆزرایەوە!' });
            else alert('فۆرمەکە نەدۆزرایەوە!');
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

// 2. دروستکردنی HTMLـی مۆداڵی دەستکاری (Crop Modal)
function createEditorModal() {
    if(document.getElementById('imageEditorModal')) return;

    const modalHTML = `
    <div class="modal fade" id="imageEditorModal" data-bs-backdrop="static" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-dark text-white">
                    <h5 class="modal-title"><i class="fa-solid fa-crop-simple"></i> دەستکاری وێنە (سکانکردن)</h5>
                    <button type="button" class="btn-close btn-close-white" onclick="cancelCrop()"></button>
                </div>
                <div class="modal-body p-0 bg-dark text-center" style="height: 500px; overflow: hidden;">
                    <div style="height: 100%;">
                        <img id="imageToCrop" src="" style="max-width: 100%; max-height: 100%; display: block;">
                    </div>
                </div>
                <div class="modal-footer bg-dark justify-content-between">
                    <div>
                        <button type="button" class="btn btn-secondary" onclick="rotateImage(-90)" title="سووڕاندن"><i class="fa-solid fa-rotate-left"></i></button>
                        <button type="button" class="btn btn-secondary" onclick="rotateImage(90)" title="سووڕاندن"><i class="fa-solid fa-rotate-right"></i></button>
                    </div>
                    <div>
                        <button type="button" class="btn btn-light" onclick="cancelCrop()">لاچوون</button>
                        <button type="button" class="btn btn-primary px-4" onclick="saveCrop()">
                            <i class="fa-solid fa-check"></i> بڕین و پاشەکەوت
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// 3. دروستکردنی دیزاینی خانەکان
function renderFields(fields, parentElement) {
    fields.forEach(field => {
        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = 'field-wrapper mb-4 animate-up';
        
        const reqMark = field.required ? ' <span class="text-danger fw-bold">*</span>' : '';
        if(field.required) {
            requiredFieldsRegistry.push({ id: field.id, label: field.label, type: field.type });
        }

        const label = document.createElement('label');
        label.className = 'form-label fw-bold d-block mb-2 text-dark';
        label.innerHTML = field.label + reqMark;
        fieldWrapper.appendChild(label);

        let inputEl;
        let branchEls = {}; 

        // ----------------------------------------------------
        // 1. بەشی تایبەت بە ژمارە (NUMBER)
        // ----------------------------------------------------
        if (field.type === 'number') {
            inputEl = document.createElement('input');
            inputEl.type = "number"; 
            inputEl.className = 'form-control form-control-lg shadow-sm';
            inputEl.name = field.id; // گۆڕدرا بۆ ئایدی
            
            inputEl.setAttribute("inputmode", "decimal"); 
            inputEl.setAttribute("pattern", "[0-9]*");
            inputEl.setAttribute("step", "any"); 
            
            inputEl.addEventListener('wheel', function(e) { e.preventDefault(); });
            
            fieldWrapper.appendChild(inputEl);
        }

        // ----------------------------------------------------
        // 2. بەشی نووسینی ئاسایی (TEXT)
        // ----------------------------------------------------
        else if (field.type === 'text') {
            inputEl = createInput('text', field.id); // گۆڕدرا بۆ ئایدی
            
            if (field.label.includes("مۆبایل") || field.label.includes("Mobile")) {
                inputEl.dir = "ltr";  
                inputEl.setAttribute("inputmode", "tel");                 
                inputEl.addEventListener('input', function(e) {
                    let val = this.value;
                    const kurdishMap = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
                    this.value = val.replace(/[٠-٩]/g, match => kurdishMap[match]);
                });

                if(typeof Inputmask !== 'undefined') {
                    Inputmask({}).mask(inputEl);
                }
            }
            fieldWrapper.appendChild(inputEl);
        }

        // ----------------------------------------------------
        // 3. بەشی واژۆ (Fingerprint)
        // ----------------------------------------------------
        else if (field.type === 'fingerprint') {
            const padContainer = document.createElement('div');
            padContainer.className = 'border rounded shadow-sm bg-white';
            
            padContainer.innerHTML = `
                <div class="card-header bg-light d-flex justify-content-between align-items-center p-2 border-bottom">
                    <span class="fw-bold text-dark small"><i class="fa-solid fa-signature"></i> واژۆی ئەلیکترۆنی</span>
                </div>
                <div class="position-relative bg-white" style="height: 200px; touch-action: none;">
                    <canvas id="canvas_${field.id}" style="width: 100%; height: 100%; display: block; touch-action: none;"></canvas>
                    <div class="text-muted small position-absolute bottom-0 start-0 w-100 text-center py-2 pe-none opacity-50" style="pointer-events: none;">
                        لێرە واژۆ بکە
                    </div>
                </div>
                <div class="bg-light p-2 text-end border-top">
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="clearFingerprint('${field.id}')">
                        <i class="fa-solid fa-eraser"></i> سڕینەوە
                    </button>
                </div>
            `;
            fieldWrapper.appendChild(padContainer);

            setTimeout(() => {
                const canvas = document.getElementById(`canvas_${field.id}`);
                if(canvas) {
                    if (typeof SignaturePad === 'undefined') return;

                    const resizeCanvas = () => {
                        const ratio = Math.max(window.devicePixelRatio || 1, 1);
                        canvas.width = canvas.offsetWidth * ratio;
                        canvas.height = canvas.offsetHeight * ratio;
                        canvas.getContext("2d").scale(ratio, ratio);
                    };
                    resizeCanvas();
                    window.addEventListener("resize", resizeCanvas);

                    fingerprintPads[field.id] = new SignaturePad(canvas, {
                        backgroundColor: 'rgba(255, 255, 255, 0)',
                        penColor: 'rgb(0, 0, 139)',
                        minWidth: 1.5,
                        maxWidth: 3.5,
                    });
                }
            }, 500);
        }

        // ----------------------------------------------------
        // 4. وێنە (Photo)
        // ----------------------------------------------------
        else if (field.type === 'photo') {
            photosStore[field.id] = []; // گۆڕدرا بۆ ئایدی
            const photoContainer = document.createElement('div');
            photoContainer.className = 'photo-uploader p-3 bg-light border rounded';

            const buttonsDiv = document.createElement('div');
            buttonsDiv.className = 'd-flex gap-2 mb-3';
            
            const cameraBtn = document.createElement('button');
            cameraBtn.type = 'button';
            cameraBtn.className = 'btn btn-outline-primary flex-grow-1';
            cameraBtn.innerHTML = '<i class="fa-solid fa-camera fa-lg mb-1 d-block"></i> گرتنی وێنە';
            
            const galleryBtn = document.createElement('button');
            galleryBtn.type = 'button';
            galleryBtn.className = 'btn btn-outline-secondary flex-grow-1';
            galleryBtn.innerHTML = '<i class="fa-regular fa-images fa-lg mb-1 d-block"></i> گەلەری';

            buttonsDiv.appendChild(cameraBtn);
            buttonsDiv.appendChild(galleryBtn);

            const hiddenInput = document.createElement('input');
            hiddenInput.type = 'file';
            hiddenInput.accept = 'image/*';
            hiddenInput.style.display = 'none';

            const previewContainer = document.createElement('div');
            previewContainer.className = 'd-flex flex-wrap gap-2';
            previewContainer.id = `preview_${field.id}`;

            cameraBtn.onclick = () => {
                hiddenInput.removeAttribute('multiple'); 
                hiddenInput.setAttribute('capture', 'environment');
                hiddenInput.click();
            };
            galleryBtn.onclick = () => {
                hiddenInput.removeAttribute('capture');
                hiddenInput.setAttribute('multiple', 'multiple');
                hiddenInput.click();
            };

            hiddenInput.onchange = (e) => {
                if(e.target.files && e.target.files.length > 0) {
                    currentFileQueue = Array.from(e.target.files);
                    currentEditField = { id: field.id, label: field.label, previewContainer: previewContainer }; // ئایدی زیاد کرا
                    processNextInQueue(); 
                }
                hiddenInput.value = ''; 
            };

            photoContainer.appendChild(buttonsDiv);
            photoContainer.appendChild(previewContainer);
            photoContainer.appendChild(hiddenInput);
            fieldWrapper.appendChild(photoContainer);
        }

        // ----------------------------------------------------
        // 5. Select One
        // ----------------------------------------------------
        else if (field.type === 'select_one') {
            inputEl = document.createElement('select');
            inputEl.className = 'form-select form-select-lg shadow-sm';
            inputEl.name = field.id; // گۆڕدرا بۆ ئایدی
            
            const defOpt = document.createElement('option');
            defOpt.innerText = 'هەڵبژێرە...';
            defOpt.value = '';
            inputEl.appendChild(defOpt);

            if(field.options) {
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.innerText = opt;
                    inputEl.appendChild(option);
                });
            }
            fieldWrapper.appendChild(inputEl);

            if(field.branches) {
                const branchesContainer = createBranchContainer(field.branches, branchEls);
                fieldWrapper.appendChild(branchesContainer);
                inputEl.addEventListener('change', (e) => {
                    const selectedVal = e.target.value;
                    Object.values(branchEls).forEach(el => el.style.display = 'none');
                    if (branchEls[selectedVal]) branchEls[selectedVal].style.display = 'block';
                });
            }
        }

        // ----------------------------------------------------
        // 6. Select Many
        // ----------------------------------------------------
        else if (field.type === 'select_many') {
            const checkboxGroup = document.createElement('div');
            checkboxGroup.style.display = 'grid';
            checkboxGroup.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
            checkboxGroup.style.gap = '10px';
            checkboxGroup.className = 'p-3 border rounded bg-light';

            if(field.options) {
                let branchesContainer;
                if(field.branches) branchesContainer = createBranchContainer(field.branches, branchEls);

                field.options.forEach(opt => {
                    const checkWrapper = document.createElement('div');
                    checkWrapper.className = 'form-check d-flex align-items-center p-2 border rounded bg-white shadow-sm h-100';
                    checkWrapper.style.cursor = 'pointer';
                    
                    const checkbox = document.createElement('input');
                    checkbox.className = 'form-check-input ms-2';
                    checkbox.type = 'checkbox';
                    checkbox.value = opt;
                    checkbox.name = field.id + '[]'; // گۆڕدرا بۆ ئایدی
                    checkbox.id = `${field.id}_${opt.replace(/\s/g, '_')}`;

                    const checkLabel = document.createElement('label');
                    checkLabel.className = 'form-check-label w-100 cursor-pointer mb-0';
                    checkLabel.htmlFor = checkbox.id;
                    checkLabel.innerText = opt;

                    checkWrapper.appendChild(checkbox);
                    checkWrapper.appendChild(checkLabel);
                    checkboxGroup.appendChild(checkWrapper);

                    if(field.branches) {
                        checkbox.addEventListener('change', (e) => {
                            const val = e.target.value;
                            if (branchEls[val]) {
                                branchEls[val].style.display = e.target.checked ? 'block' : 'none';
                            }
                        });
                    }
                });

                fieldWrapper.appendChild(checkboxGroup);
                if(branchesContainer) fieldWrapper.appendChild(branchesContainer);
            }
        }

        // ----------------------------------------------------
        // 7. Date & Note
        // ----------------------------------------------------
        else if (field.type === 'date') {
            inputEl = createInput('date', field.id); // گۆڕدرا بۆ ئایدی
            fieldWrapper.appendChild(inputEl);
        } 
        else if (field.type === 'note') {
            inputEl = document.createElement('textarea');
            inputEl.className = 'form-control shadow-sm';
            inputEl.name = field.id; // گۆڕدرا بۆ ئایدی
            inputEl.rows = 3;
            fieldWrapper.appendChild(inputEl);
        }

        // پشکنینی ناچاری (Required Check) بۆ هەموو ئینپوتەکان
        if(inputEl && field.required && field.type !== 'select_many' && field.type !== 'photo') {
            inputEl.required = true;
            inputEl.oninvalid = function(e) { e.target.setCustomValidity('تکایە ئەم خانەیە پڕ بکەرەوە'); };
            inputEl.oninput = function(e) { e.target.setCustomValidity(''); };
        }

        parentElement.appendChild(fieldWrapper);
    });
}
// --- LOGIC FOR CROPPING AND EDITING ---

function processNextInQueue() {
    if (currentFileQueue.length === 0) return;

    const file = currentFileQueue[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const modalEl = document.getElementById('imageEditorModal');
        const imgEl = document.getElementById('imageToCrop');
        
        imgEl.src = e.target.result;
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        modalEl.addEventListener('shown.bs.modal', () => {
            if (cropper) cropper.destroy(); 
            cropper = new Cropper(imgEl, {
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.8, 
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        }, { once: true });
    };
    reader.readAsDataURL(file);
}

window.rotateImage = function(degree) {
    if(cropper) cropper.rotate(degree);
}

window.saveCrop = function() {
    if (!cropper) return;

    cropper.getCroppedCanvas().toBlob((blob) => {
        const newFile = new File([blob], "cropped_image.jpg", { type: "image/jpeg" });
        photosStore[currentEditField.id].push(newFile); // گۆڕدرا بۆ ئایدی

        const reader = new FileReader();
        reader.onload = (e) => {
            const imgDiv = document.createElement('div');
            imgDiv.className = 'position-relative shadow-sm rounded overflow-hidden animate-up';
            imgDiv.style.width = '100px';
            imgDiv.style.height = '100px';
            
            imgDiv.innerHTML = `
                <img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">
                <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0 p-0 d-flex justify-content-center align-items-center" 
                        style="width: 24px; height: 24px; border-radius: 0 0 0 5px;" 
                        onclick="removePhoto('${currentEditField.id}', ${photosStore[currentEditField.id].length - 1}, this)">
                    <i class="fa-solid fa-times"></i>
                </button>
            `; // گۆڕدرا بۆ ئایدی لە removePhoto
            currentEditField.previewContainer.appendChild(imgDiv);
        };
        reader.readAsDataURL(newFile);
        closeEditor();
    }, 'image/jpeg', 0.8);
}

window.cancelCrop = function() {
    closeEditor();
}

function closeEditor() {
    const modalEl = document.getElementById('imageEditorModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if(modal) modal.hide();
    
    if(cropper) {
        cropper.destroy();
        cropper = null;
    }

    currentFileQueue.shift();
    if (currentFileQueue.length > 0) {
        setTimeout(() => processNextInQueue(), 500); 
    }
}

window.removePhoto = function(fieldId, index, btn) { // Parameter گۆڕدرا
    photosStore[fieldId][index] = null;
    btn.parentElement.remove();
}

// --- STANDARD FUNCTIONS ---

function createBranchContainer(branchesData, branchElsRef) {
    const container = document.createElement('div');
    container.className = 'branches-container mt-3';

    for (const [optionName, childFields] of Object.entries(branchesData)) {
        const branchDiv = document.createElement('div');
        branchDiv.className = 'branch-group p-3 border-start border-4 border-primary bg-light rounded-end mt-2';
        branchDiv.style.display = 'none';
        
        const header = document.createElement('div');
        header.className = 'branch-header text-primary fw-bold small mb-2';
        header.innerHTML = `<i class="fa-solid fa-arrow-turn-down"></i> پەیوەست بە: ${optionName}`;
        branchDiv.appendChild(header);

        renderFields(childFields, branchDiv); 
        container.appendChild(branchDiv);
        branchElsRef[optionName] = branchDiv;
    }
    return container;
}

function createInput(type, name) {
    const input = document.createElement('input');
    input.type = type;
    input.name = name;
    input.className = 'form-control form-control-lg shadow-sm';
    return input;
}

// --- SUBMIT ---
formEl.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const originalBtnText = submitBtn.innerHTML;

    // --- Validation Logic START ---
    let isValid = true;
    for (const reqField of requiredFieldsRegistry) {
        if (reqField.type === 'photo') {
            const hasPhotos = photosStore[reqField.id] && photosStore[reqField.id].some(p => p !== null); // گۆڕدرا بۆ ئایدی
            if (!hasPhotos) {
                isValid = false;
                if(typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'تکایە وێنە دابنێ',
                        text: `خانەی "${reqField.label}" پێویستی بە وێنەیە.`,
                        confirmButtonText: 'باشە',
                        confirmButtonColor: '#6366f1'
                    });
                } else alert(`وێنە بۆ "${reqField.label}" پێویستە`);
                return; 
            }
        } else if (reqField.type === 'select_many') {
            const checked = document.querySelectorAll(`input[name="${reqField.id}[]"]:checked`); // گۆڕدرا بۆ ئایدی
            if (checked.length === 0) {
                isValid = false;
                if(typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'هەڵبژاردن',
                        text: `تکایە لانیکەم یەک دانە بۆ "${reqField.label}" هەڵبژێرە.`,
                        confirmButtonText: 'باشە',
                        confirmButtonColor: '#6366f1'
                    });
                } else alert(`هەڵبژاردن بۆ "${reqField.label}" پێویستە`);
                return;
            }
        } 
        else if (reqField.type === 'fingerprint') { 
            const pad = fingerprintPads[reqField.id];
            if (!pad || pad.isEmpty()) {
                isValid = false;
                if(typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'واژۆ',
                        text: `تکایە واژۆ لە خانەی "${reqField.label}" بکە.`,
                        confirmButtonText: 'باشە',
                        confirmButtonColor: '#6366f1'
                    });
                } else alert(`واژۆ بۆ "${reqField.label}" پێویستە`);
                return;
            }
        }
    }
    // --- Validation Logic END ---

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner-border spinner-border-sm text-light"></div> خەریکی ناردن...';

    try {
        let formData = {};
        const elements = formEl.elements;

        for (let i = 0; i < elements.length; i++) {
            const item = elements[i];
            if (!item.name || item.type === 'submit' || item.type === 'file') continue;

            if (item.type === 'checkbox') {
                const cleanName = item.name.replace('[]', '');
                if (item.checked) {
                    if (!formData[cleanName]) formData[cleanName] = [];
                    formData[cleanName].push(item.value);
                }
                continue;
            }
            if (item.type === 'radio') {
                if (item.checked) formData[item.name] = item.value;
                continue;
            }
            if (item.value) formData[item.name] = item.value;
        }

        // Upload Edited Photos (ImageKit)
        for (const [fieldId, files] of Object.entries(photosStore)) { // fieldName بوو بە fieldId
            const validFiles = files.filter(f => f !== null);
            if (validFiles.length > 0) {
                submitBtn.innerHTML = `<div class="spinner-border spinner-border-sm text-light"></div> بارکردنی وێنەکان...`;
                let uploadedUrls = [];
                for (const file of validFiles) {
                    const url = await uploadImageToImageKit(file);
                    if(url) uploadedUrls.push(url);
                }
                if (uploadedUrls.length > 0) formData[fieldId] = uploadedUrls; // گۆڕدرا بۆ ئایدی
            }
        }

        // +++ ئەپلۆدکردنی واژۆکان (ImageKit) +++
        for (const [fieldId, pad] of Object.entries(fingerprintPads)) {
            if (!pad.isEmpty()) {
                submitBtn.innerHTML = `<div class="spinner-border spinner-border-sm text-light"></div> واژۆ...`;
                const dataURL = pad.toDataURL("image/png");
                const res = await fetch(dataURL);
                const blob = await res.blob();
                const file = new File([blob], "signature.png", { type: "image/png" });
                
                const url = await uploadImageToImageKit(file);
                if(url) formData[fieldId] = url; // ڕاستەوخۆ دەچێتە سەر ئایدییەکە
            }
        }
        // +++++++++++++++++++++++++++

        submitBtn.innerHTML = '<div class="spinner-border spinner-border-sm text-light"></div> خەزن دەکرێت...';
        await db.collection("forms").doc(formId).collection("submissions").add({
            data: formData,
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        localStorage.removeItem(STORAGE_KEY);

        if(typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'سەرکەوتوو بوو',
                text: 'زانیارییەکان بە سەرکەوتوویی نێردران!',
                showConfirmButton: false,
                timer: 2000
            }).then(() => {
                window.location.reload();
            });
        } else {
            alert('سەرکەوتوو بوو!');
            window.location.reload();
        }

    } catch (error) {
        console.error("Error:", error);
        if(typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'هەڵە ڕوویدا',
                text: error.message,
                confirmButtonText: 'باشە'
            });
        } else alert(error.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
});

// ==========================================
// IMAGEKIT UPLOAD FUNCTION
// ==========================================
async function uploadImageToImageKit(file) {
    if (!file) return null;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", file.name);
    formData.append("useUniqueFileName", "true"); 
    formData.append("folder", "/form_photos"); 

    try {
        const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
            method: "POST",
            headers: {
                "Authorization": "Basic " + btoa(IMAGEKIT_PRIVATE_KEY + ":")
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || "Upload Failed");
        }

        const data = await response.json();
        return data.url; 

    } catch (error) {
        console.error("Upload Error:", error);
        alert("کێشە لە بارکردنی وێنە: " + error.message);
        return null;
    }
}

initView();

// --- فەنکشنەکانی Auto-Save ---
function handleAutoSave(e) {
    if(e.target.type === 'file') return;
    saveProgress();
    const badge = document.getElementById('saveIndicator');
    if(badge) {
        badge.style.opacity = '1';
        clearTimeout(window.saveTimer);
        window.saveTimer = setTimeout(() => badge.style.opacity = '0', 1500);
    }
}

function saveProgress() {
    const formData = new FormData(formEl);
    let dataToSave = {};
    for (const [key, value] of formData.entries()) {
        if (value instanceof File) continue; 
        if (dataToSave[key]) {
            if (!Array.isArray(dataToSave[key])) {
                dataToSave[key] = [dataToSave[key]];
            }
            dataToSave[key].push(value);
        } else {
            dataToSave[key] = value;
        }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
}

function restoreProgress() {
    const savedJSON = localStorage.getItem(STORAGE_KEY);
    if (!savedJSON) return;
    try {
        const savedData = JSON.parse(savedJSON);
        Object.keys(savedData).forEach(key => {
            const val = savedData[key];
            const inputs = document.querySelectorAll(`[name="${key}"]`);
            inputs.forEach(input => {
                if(input.type === 'checkbox' || input.type === 'radio') {
                    const valuesToCheck = Array.isArray(val) ? val : [val];
                    if(valuesToCheck.includes(input.value)) {
                        input.checked = true;
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else {
                    input.value = val;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        });
    } catch (e) {
        console.error("Auto-save restore failed", e);
    }
}