// frontend/scripts/landing.js
import { setupGoogleButton, renderAuthUI, setupUserDropdown, updateCreditDisplay } from './authCheck.js';

function startTextRotation() {
    const textItems = document.querySelectorAll('.text-item');
    if (textItems.length === 0) return;
    
    let idx = 0;
    textItems[idx].classList.add('active');
    
    setInterval(() => {
        textItems[idx].classList.remove('active');
        idx = (idx + 1) % textItems.length;
        textItems[idx].classList.add('active');
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    startTextRotation();
    // Auth functions are already initialized in authCheck.js
});