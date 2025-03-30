// chatFocusWords.js
export const chatFocusWords = {
    // Dynamic words that depend on the context (e.g., "you", "you're")
    dynamic: ["you", "you're", "ur", "u", "y'all"],

    // Static words that are always associated with Person A or Person B
    static: {
        personA: ["im", "i'm", "I", "i", "il", "i'll", "ill", "imma", "ima"], // Words related to Person A
        personB: ["im", "i'm", "I", "i", "il", "i'll", "ill", "imma", "ima"],  // Words related to Person B
    },
};