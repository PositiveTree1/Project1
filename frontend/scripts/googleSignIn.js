document.addEventListener('DOMContentLoaded', () => {
    // Check if Google Identity Services are available
    if (window.google && google.accounts && google.accounts.id) {
        // Initialize the Google Sign-In client
        google.accounts.id.initialize({
            client_id: '969099711725-hldrjpjo3le920chng1ethgbbc71vald.apps.googleusercontent.com',
            callback: handleCredentialResponse,
            auto_select: false,
            ux_mode: 'popup'
        });

        // Render the Google Sign-In button into the specified container
        const signInButtonContainer = document.getElementById('googleSignInButton');
        if (signInButtonContainer) {
            google.accounts.id.renderButton(signInButtonContainer, {
                theme: "outline",
                size: "medium",
                width: "220"
            });
        } else {
            console.error("Google Sign-In button container not found.");
        }
    } else {
        console.error("Google Identity Services not available.");
    }

    // Setup dropdown toggle functionality
    setupUserDropdown();
    updateSignInStatus();
});

function handleCredentialResponse(response) {
    console.log("Google Sign-In response received", response);
    try {
        const userInfo = parseJwt(response.credential);
        // Store the token and user info in localStorage for persistence
        localStorage.setItem('googleAuthToken', response.credential);
        localStorage.setItem('user', JSON.stringify(userInfo));
        localStorage.setItem('isLoggedIn', 'true');

        updateSignInStatus();
    } catch (error) {
        console.error("Error handling credential response:", error);
    }
}

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
}