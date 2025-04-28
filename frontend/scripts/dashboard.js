import { getAnalyses, deleteAnalysis, getAnalysisHTML } from './api.js';

// DOM elements
const chatList = document.getElementById('chatList');
const emptyState = document.getElementById('emptyState');
const loadingIndicator = document.getElementById('loadingIndicator');
const totalChatsElement = document.getElementById('totalChats');

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        loadChatHistory();
        setupEventListeners();
    }
});

async function loadChatHistory() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        showEmptyState();
        return;
    }

    showLoading();
    
    try {
        const analyses = await getAnalyses(user.sub);
        if (analyses.length === 0) {
            showEmptyState();
        } else {
            renderAnalysisCards(analyses);
            totalChatsElement.textContent = analyses.length;
        }
    } catch (error) {
        console.error("Failed to load chat history:", error);
        showErrorState();
    } finally {
        hideLoading();
    }
}

function renderAnalysisCards(analyses) {
    chatList.innerHTML = '';
    emptyState.style.display = 'none';

    analyses.sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt));

    analyses.forEach(analysis => {
        const card = document.createElement('div');
        card.className = 'analysis-card';
        card.innerHTML = `
            <div class="analysis-header">
                <h3>${formatAnalysisTitle(analysis.metadata)}</h3>
                <span class="analysis-date">${formatDate(analysis.metadata.createdAt)}</span>
            </div>
            <div class="analysis-meta">
                <span class="meta-item">${analysis.metadata.messageCount} messages</span>
                <span class="meta-item">${analysis.metadata.participants.length} people</span>
                <span class="meta-item">${formatDateRange(analysis.metadata.dateRange)}</span>
            </div>
            <div class="analysis-actions">
                <button class="btn view-btn" data-id="${analysis.id}">View</button>
                <button class="btn delete-btn" data-id="${analysis.id}">Delete</button>
            </div>
        `;
        chatList.appendChild(card);
    });
}

function setupEventListeners() {
    // View button click
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('view-btn')) {
            const analysisId = e.target.dataset.id;
            window.location.href = `analysis.html?id=${analysisId}`;
        }
        
        // Delete button click
        if (e.target.classList.contains('delete-btn')) {
            const analysisId = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this analysis?')) {
                try {
                    await deleteAnalysis(analysisId);
                    loadChatHistory(); // Refresh the list
                } catch (error) {
                    console.error("Failed to delete analysis:", error);
                    alert("Failed to delete analysis. Please try again.");
                }
            }
        }
    });
}

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatDateRange(dateRange) {
    if (!dateRange || !dateRange.startDate || !dateRange.endDate) return 'N/A';
    return `${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`;
}

function formatAnalysisTitle(metadata) {
    if (metadata.chatName) return metadata.chatName;
    if (metadata.participants?.length > 0) {
        return `Chat with ${metadata.participants.join(' & ')}`;
    }
    return 'Chat Analysis';
}

function showLoading() {
    loadingIndicator.style.display = 'block';
    chatList.style.display = 'none';
    emptyState.style.display = 'none';
}

function hideLoading() {
    loadingIndicator.style.display = 'none';
    chatList.style.display = 'grid';
}

function showEmptyState() {
    emptyState.style.display = 'flex';
    chatList.style.display = 'none';
    loadingIndicator.style.display = 'none';
}

function showErrorState() {
    emptyState.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Failed to load analyses. Please try again later.</p>
            <button class="btn retry-btn">Retry</button>
        </div>
    `;
    emptyState.style.display = 'flex';
    chatList.style.display = 'none';
    loadingIndicator.style.display = 'none';
    
    // Add retry button listener
    document.querySelector('.retry-btn')?.addEventListener('click', loadChatHistory);
}