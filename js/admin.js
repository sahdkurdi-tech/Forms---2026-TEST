// js/admin.js

let currentFields = [];

// گۆڕینی ئایکۆن بەپێی جۆری پرسیار
const typeIcons = {
    'text': '<i class="fa-solid fa-font"></i>',
    'number': '<i class="fa-solid fa-hashtag"></i>',
    'date': '<i class="fa-regular fa-calendar"></i>',
    'select_one': '<i class="fa-regular fa-caret-square-down"></i>',
    'photo': '<i class="fa-solid fa-camera"></i>',
    'note': '<i class="fa-solid fa-quote-right"></i>'
};

document.getElementById('fieldType').addEventListener('change', function() {
    const type = this.value;
    const optionsDiv = document.getElementById('optionsDiv');
    optionsDiv.style.display = (type === 'select_one') ? 'block' : 'none';
});

function addField() {
    const label = document.getElementById('fieldLabel').value;
    const type = document.getElementById('fieldType').value;
    const optionsInput = document.getElementById('fieldOptions').value;

    if(!label) return alert("تکایە ناوی پرسیارەکە بنووسە");

    // لابردنی نوسینی "هیچ پرسیارێک نییە"
    const emptyState = document.querySelector('.empty-state');
    if(emptyState) emptyState.style.display = 'none';

    let optionsArray = [];
    if(optionsInput) {
        optionsArray = optionsInput.split(',').map(s => s.trim());
    }

    const newField = { label, type, options: optionsArray };
    currentFields.push(newField);
    renderPreview();
    
    document.getElementById('fieldLabel').value = '';
    document.getElementById('fieldOptions').value = '';
    document.getElementById('fieldLabel').focus();
}

function renderPreview() {
    const container = document.getElementById('fieldsList');
    const titleInput = document.getElementById('formTitle').value;
    
    document.getElementById('previewTitle').innerText = titleInput || "سەردێڕی فۆرم";
    container.innerHTML = '';

    currentFields.forEach((field, index) => {
        const icon = typeIcons[field.type] || '<i class="fa-solid fa-circle"></i>';
        
        container.innerHTML += `
            <div class="field-item">
                <div class="d-flex align-items-center">
                    <div class="field-icon">${icon}</div>
                    <div class="ms-3">
                        <div class="fw-bold text-dark">${field.label}</div>
                        <span class="badge bg-light text-secondary border mt-1">${field.type}</span>
                    </div>
                </div>
                <button onclick="removeField(${index})" class="btn btn-outline-danger btn-sm rounded-circle" style="width: 35px; height: 35px;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    });
}

function removeField(index) {
    currentFields.splice(index, 1);
    renderPreview();
    if(currentFields.length === 0) {
        document.getElementById('fieldsList').innerHTML = `
            <div class="text-center text-muted py-5 empty-state">
                <i class="fa-regular fa-clipboard fa-3x mb-3 opacity-25"></i>
                <p>هێشتا هیچ پرسیارێک زیاد نەکراوە</p>
            </div>
        `;
    }
}

async function saveForm() {
    const title = document.getElementById('formTitle').value;
    const saveBtn = document.querySelector('button[onclick="saveForm()"]');
    
    if(!title || currentFields.length === 0) return alert("تکایە ناوێک و چەند پرسیارێک دابنێ");

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> چاوەڕێبە...';

    try {
        const docRef = await db.collection("forms").add({
            title: title,
            fields: currentFields,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        const link = `${window.location.origin}/view.html?id=${docRef.id}`;
        
        // نیشاندانی مۆداڵ یان ئالێرتێکی جوان
        const container = document.querySelector('.col-lg-8 .modern-card');
        container.innerHTML = `
            <div class="text-center p-5">
                <div class="mb-4 text-success"><i class="fa-regular fa-circle-check fa-5x"></i></div>
                <h3>پیرۆزە! فۆرمەکەت ئامادەیە</h3>
                <p class="text-muted">ئەم لینکە بنێرە بۆ بەکارهێنەران</p>
                
                <div class="input-group mb-3 mt-4">
                    <input type="text" class="form-control text-center" value="${link}" id="shareLink" readonly>
                    <button class="btn btn-primary" onclick="navigator.clipboard.writeText(document.getElementById('shareLink').value)">
                        <i class="fa-regular fa-copy"></i> کۆپی
                    </button>
                </div>
                <a href="${link}" target="_blank" class="btn btn-outline-primary mt-3">کردنەوەی فۆرم</a>
                <button onclick="window.location.reload()" class="btn btn-link mt-3 text-muted">دروستکردنی یەکێکی تر</button>
            </div>
        `;
        
    } catch (error) {
        console.error("Error", error);
        alert("هەڵەیەک ڕوویدا");
        saveBtn.disabled = false;
        saveBtn.innerText = 'پاشەکەوتکردن';
    }
}