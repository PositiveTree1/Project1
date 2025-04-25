
startTextRotation();

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

