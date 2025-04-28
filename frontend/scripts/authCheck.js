// frontend/scripts/authCheck.js
// Make setupGoogleButton available globally for initGoogleSignIn()


// Utility functions
export function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Error parsing JWT:", error);
        return null;
    }
}

export function updateCreditDisplay() {
    const creditCountElement = document.getElementById('creditCount');
    if (creditCountElement) {
        const credits = localStorage.getItem('userCredits') || '0';
        creditCountElement.textContent = credits;
    }
}

// Auth UI functions
export function renderAuthUI() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const googleSignInButton = document.getElementById('googleSignInButton');
    const userDropdown = document.querySelector('.user-dropdown');
    const creditsDisplay = document.querySelector('.credits-display');
    const creditCountElement = document.getElementById('creditCount');
  if (creditCountElement) {
    // If unset or invalid, default to 5
    let credits = parseInt(localStorage.getItem('userCredits'), 10);
    if (isNaN(credits)) credits = 5;
    creditCountElement.textContent = credits;
  }
    if (googleSignInButton) googleSignInButton.classList.toggle('hidden', isLoggedIn);
    if (userDropdown) userDropdown.classList.toggle('hidden', !isLoggedIn);
    if (creditsDisplay) creditsDisplay.classList.toggle('hidden', !isLoggedIn);

    if (isLoggedIn) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.picture) {
            const userAvatar = document.getElementById('userAvatar');
            if (userAvatar) userAvatar.src = user.picture;
        }
        updateCreditDisplay();
    }
}

export function setupUserDropdown() {
    const userAvatar = document.getElementById('userAvatar');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const logoutButton = document.getElementById('logoutButton');

    if (userAvatar && dropdownMenu) {
        userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-dropdown')) {
                dropdownMenu.classList.remove('show');
            }
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('user');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('googleAuthToken');
            renderAuthUI();
            document.querySelector('.dropdown-menu')?.classList.remove('show');
        });
    }
}

// Page protection
const RESTRICTED = ['/dashboard.html','/credits.html'];
export function protectPage() {
    if (localStorage.getItem('isLoggedIn') !== 'true' &&
        RESTRICTED.some(p => window.location.pathname.endsWith(p))) {
        window.location.href = 'index.html';
    }
}

// Google Sign-In setup
export function setupGoogleButton() {
    if (!window.google?.accounts?.id) {
        console.log('Google API not loaded yet');
        return;
    }

    // Initialize Google Auth
    google.accounts.id.initialize({
        client_id: '969099711725-hldrjpjo3le920chng1ethgbbc71vald.apps.googleusercontent.com',
        callback: handleCredentialResponse,
        ux_mode: 'popup'
    });

    // Render main sign-in button
    const mainBtn = document.getElementById('googleSignInButton');
    if (mainBtn) {
        google.accounts.id.renderButton(mainBtn, {
            theme: 'outline',
            size: 'large',
            text: 'signin',
            shape: 'pill',
        });
    }

    // Render any AI-trigger buttons
    const aiIds = [
        'aiSigninButton','aiSigninButton1','aiSigninButton2',
        'aiSigninButton3','aiSigninButton4','aiSigninButton5'
    ];
    aiIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            google.accounts.id.renderButton(btn, {
                theme: 'filled_blue',
                size: 'medium',
                width: 110
            });
        }
    });
}

function handleCredentialResponse(resp) {
    const user = parseJwt(resp.credential);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('googleAuthToken', resp.credential);
  
    // Set default credits to 5 if not already set
    if (!localStorage.getItem('userCredits')) {
      localStorage.setItem('userCredits', '5');
    }
  
    // Fetch initial (or updated) credits, then render + redirect
    fetch(`/api/user-credits/${user.sub}`)
      .then(r => r.json())
      .then(data => {
        // If user doesn't exist in DB yet, initialize with 5 credits
        if (data.credits === undefined || data.credits === null) {
          return fetch('/api/update-credits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userId: user.sub, 
              amount: 5 
            })
          });
        } else {
          // Update local storage with server value
          localStorage.setItem('userCredits', data.credits);
          return Promise.resolve();
        }
      })
      .then(() => {
        renderAuthUI();
        if (window.location.pathname.includes('index.html')) {
          window.location.href = 'dashboard.html';
        }
      })
      .catch(err => {
        console.error('Error fetching credits:', err);
        renderAuthUI();
      });
}
  

// Credit management
export async function checkUserCredits(userId) {
    const res = await fetch(`/api/user-credits/${userId}`);
    const { credits } = await res.json();
    localStorage.setItem('userCredits', credits);
    return credits;
}

export async function deductCredit(userId, amount = 1) {
    const res = await fetch('/api/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount: -amount })
    });
    if (res.ok) {
        const newCount = parseInt(localStorage.getItem('userCredits')||'0') - amount;
        localStorage.setItem('userCredits', newCount);
        updateCreditDisplay();
        return true;
    }
    console.error('Failed deduct', await res.text());
    return false;
}

window.setupGoogleButton = setupGoogleButton;

document.addEventListener('DOMContentLoaded', () => {
    renderAuthUI();
    protectPage();
    setupUserDropdown();
    // ← no more setupGoogleButton() here
});
