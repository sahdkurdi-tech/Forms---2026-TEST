// js/dark-mode.js

const toggleBtn = document.getElementById('darkModeToggle');
const icon = document.getElementById('darkModeIcon');
const body = document.body;

// ١. پشکنین: ئایا پێشتر دۆخی تاریکی هەڵبژاردووە؟
if (localStorage.getItem('theme') === 'dark') {
    enableDarkMode();
}

// ٢. فەنکشنی چالاککردن
function enableDarkMode() {
    body.classList.add('dark-mode');
    localStorage.setItem('theme', 'dark');
    if(icon) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun'); // گۆڕین بۆ خۆر
    }
}

// ٣. فەنکشنی لابردن
function disableDarkMode() {
    body.classList.remove('dark-mode');
    localStorage.setItem('theme', 'light');
    if(icon) {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon'); // گۆڕین بۆ مانگ
    }
}

// ٤. گوێگرتن لە کلیک
if(toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        if (body.classList.contains('dark-mode')) {
            disableDarkMode();
        } else {
            enableDarkMode();
        }
    });
}