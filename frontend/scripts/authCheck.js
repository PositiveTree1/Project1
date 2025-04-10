// scripts/authCheck.js

// Shared functions
function parseJwt(token) {
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

function setupUserDropdown() {
    const userAvatar = document.getElementById('userAvatar');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const logoutButton = document.getElementById('logoutButton');

    if (userAvatar && dropdownMenu) {
        userAvatar.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        // Close dropdown when clicking outside
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
            updateSignInStatus();
            // Close the dropdown
            document.querySelector('.dropdown-menu')?.classList.remove('show');
        });
    }
}

function handleCredentialResponse(response) {
    console.log("Google Sign-In response received", response);
    try {
        const userInfo = parseJwt(response.credential);
        localStorage.setItem('googleAuthToken', response.credential);
        localStorage.setItem('user', JSON.stringify(userInfo));
        localStorage.setItem('isLoggedIn', 'true');
        
        // Redirect to index.html after successful sign-in
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error("Error handling credential response:", error);
    }
}

function updateSignInStatus() {
    const signInButtonContainer = document.getElementById('googleSignInButton');
    const userDropdown = document.querySelector('.user-dropdown');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    if (isLoggedIn) {
        const user = JSON.parse(localStorage.getItem('user'));
        const userAvatar = document.getElementById('userAvatar');
        
        if (signInButtonContainer) signInButtonContainer.style.display = 'none';
        if (userDropdown) userDropdown.style.display = 'flex';
        if (userAvatar && user?.picture) {
            userAvatar.src = user.picture;
        }
    } else {
        if (signInButtonContainer) signInButtonContainer.style.display = 'block';
        if (userDropdown) userDropdown.style.display = 'none';
    }
    
    // Dispatch event for toggle button visibility
    document.dispatchEvent(new Event('authChange'));
}

function checkAuthStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        // Only redirect if we're not already on the analyze page
        if (!window.location.pathname.includes('analyze.html')) {
            window.location.href = 'analyze.html';
        }
    }
}

function initializeAllGoogleSignins() {
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
            client_id: '969099711725-hldrjpjo3le920chng1ethgbbc71vald.apps.googleusercontent.com',
            callback: handleCredentialResponse,
            auto_select: false,
            ux_mode: 'popup'
        });

        // Render main button
        const mainButton = document.getElementById('googleSignInButton');
        if (mainButton) {
            google.accounts.id.renderButton(mainButton, {
                theme: "outline",        // valid values: "outline", "filled_blue", "filled_black"
                size: "medium",              // "small", "medium", "large"
                text: "signin",       // "signin_with", "signup_with", "continue_with", "signin"
                shape: "pill",               // "rectangular", "pill", "circle", "square"
                logo_alignment: "left",    // "left", "center"
                width: 100                   // set to a pixel value (integer only)
            });
        }

        // Render AI container buttons
        const aiButtons = [
            'aiSigninButton',
            'aiSigninButton1',
            'aiSigninButton2',
            'aiSigninButton3'
        ];

        aiButtons.forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                google.accounts.id.renderButton(button, {
                    theme: "filled_blue",
                    size: "medium",
                    width: "110"
                });
            }
        });
    }
}

// Initialize auth on all pages
document.addEventListener('DOMContentLoaded', () => {
    // Replace the existing initialization with:
    initializeAllGoogleSignins();
    
    // Keep the rest the same
    setupUserDropdown();
    updateSignInStatus();
    
    if (window.location.pathname.includes('dashboard.html')) {
        checkAuthStatus();
    }
});