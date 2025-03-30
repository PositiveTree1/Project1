(function() {
    // Use requestAnimationFrame for smoother animations.
    let lastScrollY = window.scrollY;

    function onScroll() {
        const currentScrollY = window.scrollY;

        // Smooth the top section: a gentle translation and fade-out.
        const topSection = document.querySelector(".top-section");
        if (topSection) {
            // Move top section at 40% of the scroll speed.
            topSection.style.transform = `translateY(${currentScrollY * 0.4}px)`;
            // Fade out gradually.
            const newOpacity = Math.max(1 - currentScrollY / 200, 0);
            topSection.style.opacity = newOpacity;
        }

        lastScrollY = currentScrollY;
        requestAnimationFrame(onScroll);
    }

    requestAnimationFrame(onScroll);
})();
