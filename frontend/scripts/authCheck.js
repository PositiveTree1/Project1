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

// Update the updateCreditDisplay function
// Update the updateCreditDisplay function
export async function updateCreditDisplay() {
    const creditCountElement = document.getElementById('creditCount');
    const currentBalanceElement = document.getElementById('currentBalance');
    
    if (creditCountElement || currentBalanceElement) {
        const userId = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).sub : null;
        let credits = localStorage.getItem('userCredits') || '0';
        
        if (userId) {
            try {
                const res = await fetch(`/api/user-credits/${userId}`);
                const { credits: serverCredits } = await res.json();
                credits = serverCredits;
                localStorage.setItem('userCredits', credits);
            } catch (err) {
                console.error('Failed to fetch credits:', err);
            }
        }
        
        if (creditCountElement) creditCountElement.textContent = credits;
        if (currentBalanceElement) currentBalanceElement.textContent = credits;
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

function clearUserSession() {
    ['user', 'userId', 'userCredits', 'isLoggedIn', 'googleAuthToken'].forEach(key => {
        localStorage.removeItem(key);
    });
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
            localStorage.removeItem('userCredits');
            // completely clear the session:
            ['user','userId','userCredits','isLoggedIn','googleAuthToken'].forEach(k => localStorage.removeItem(k));
            renderAuthUI();
            clearUserSession();
            document.querySelector('.dropdown-menu')?.classList.remove('show');
            window.location.href = 'index.html';
            document.dispatchEvent(new Event('authChange'));
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

    google.accounts.id.initialize({
        client_id: '969099711725-hldrjpjo3le920chng1ethgbbc71vald.apps.googleusercontent.com',
        callback: handleCredentialResponse,
        ux_mode: 'popup',
        prompt_parent_id: 'googleSignInButton'
    });

    const mainBtn = document.getElementById('googleSignInButton');
     if (mainBtn) {
        
        google.accounts.id.renderButton(mainBtn, {
            theme: 'outline',
            size: 'large',
            text:  'signin',
            shape: 'pill',
            width:'120px'
        });
    }

    const aiIds = [
        'aiSigninButton','aiSigninButton1','aiSigninButton2',
        'aiSigninButton3','aiSigninButton4','aiSigninButton5', 
        'aiSigninButton6','aiSigninButton7','aiSigninButton8',
        'aiSigninButton9','aiSigninButton10','aiSigninButton11',
        'aiSigninButton12','aiSigninButton13'
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

export async function handleCredentialResponse(resp) {
    const user = parseJwt(resp.credential);
    localStorage.setItem('userId', user.sub); // ✅ Add this!
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('googleAuthToken', resp.credential);

    // → Save the user record (including email) on the server:
    try {
      await fetch('/api/verify-google-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resp.credential })
      });
    } catch (e) {
      console.error('Failed to verify Google token:', e);
      // proceed anyway
    }
  
    try {
        const r1 = await fetch(`/api/user-credits/${user.sub}`);
        const { credits: serverCredits } = await r1.json();

        let credits;
        if (serverCredits == null) {
            const r2 = await fetch('/api/update-credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.sub, amount: 0 })
            });
            const json2 = await r2.json();
            credits = json2.credits;
        } else {
            credits = serverCredits;
        }
  
        localStorage.setItem('userCredits', credits);
        renderAuthUI();
  
        // Redirect to dashboard after successful sign-in
        window.location.href = 'dashboard.html';
        // let everyone know auth changed (so parallax.js can hide the AI toggle)
        document.dispatchEvent(new Event('authChange'));
    } catch (err) {
        console.error('Error in credential response:', err);
        renderAuthUI();
    }
}

// Credit management
export async function checkUserCredits(userId) {
    const res = await fetch(`/api/user-credits/${userId}`);
    const { credits } = await res.json();
    localStorage.setItem('userCredits', credits);
    return credits;
}

// Add this function
export function setupCreditPolling() {
  const userId = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).sub : null;
  if (!userId) return;

  async function pollCredits() {
    try {
      const res = await fetch(`/api/user-credits/${userId}`);
      const { credits } = await res.json();
      localStorage.setItem('userCredits', credits);
      updateCreditDisplay();
    } catch (err) {
      console.error('Polling error:', err);
    } finally {
      setTimeout(pollCredits, 10000); // Poll every 10 seconds
    }
  }

  pollCredits();
}




export async function deductCredit(userId, amount = 1) {
    const res = await fetch('/api/update-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount: -Math.abs(amount) })
    });
    if (!res.ok) {
        console.error('Failed to deduct credits:', await res.text());
        return false;
    }
    const { credits } = await res.json();
    localStorage.setItem('userCredits', credits);
    updateCreditDisplay();
    return true;
}

window.setupGoogleButton = setupGoogleButton;

document.addEventListener('DOMContentLoaded', () => {
    renderAuthUI();
    protectPage();
    setupUserDropdown();
    setupCreditPolling(); // 👈 the new polling version

    window.addEventListener('popstate', updateCreditDisplay);
});