
export async function loadAnalysis(analysisId) {
    try {
        const response = await fetch(`/api/get-analysis/${analysisId}`);
        return await response.json();
    } catch (error) {
        console.error("Load failed:", error);
        throw error;
    }
}


export async function getUserAnalyses() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user?.sub) return [];
    
    try {
        const response = await fetch(`/api/get-analyses/${user.sub}`);
        return await response.json();
    } catch (error) {
        console.error("Fetch failed:", error);
        return [];
    }
}

