// Google Sign-In
function handleCredentialResponse(response) {
    console.log("Google sign-in response:", response);
    // Here you would typically send the credential to your backend for verification
    // For now, we'll just store it in localStorage
    localStorage.setItem('googleAuthToken', response.credential);
    document.getElementById('signin-button').innerHTML = `
      <div class="signed-in">
        <img src="${response.clientId}" alt="User" class="user-avatar">
        <span>Welcome!</span>
      </div>
    `;
  }
  
  // Initialize Google Sign-In
  window.onload = function() {
    google.accounts.id.initialize({
      client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
      callback: handleCredentialResponse,
      context: 'signin'
    });
    
    google.accounts.id.renderButton(
      document.getElementById('signin-button'),
      { theme: 'outline', size: 'large', text: 'continue_with' }
    );
    
    // Start rotating text animation
    startTextRotation();
  };
  
  // Rotating text animation
  function startTextRotation() {
    const textItems = document.querySelectorAll('.text-item');
    let currentIndex = 0;
    
    setInterval(() => {
      // Fade out current item
      textItems[currentIndex].classList.remove('active');
      
      // Move to next item
      currentIndex = (currentIndex + 1) % textItems.length;
      
      // Fade in next item
      textItems[currentIndex].classList.add('active');
    }, 3000); // Change every 3 seconds
  }

  