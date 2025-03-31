export function getChartColors() {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    
    return {
        primary: styles.getPropertyValue('--primary-color').trim(),
        secondary: styles.getPropertyValue('--secondary-color').trim(),
        accent: styles.getPropertyValue('--accent-color').trim(),
        text: styles.getPropertyValue('--text-color').trim(),
        lightText: styles.getPropertyValue('--light-text').trim()
    };
}

export function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}