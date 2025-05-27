import { getAnalyses, deleteAnalysis } from './api.js';

const chatList         = document.getElementById('chatList');
const emptyState       = document.getElementById('emptyState');
const loadingIndicator = document.getElementById('loadingIndicator');
const totalChatsElem   = document.getElementById('totalChats');

function showLoading() {
  loadingIndicator.style.display = 'block';
  chatList.style.display       = 'none';
  emptyState.style.display     = 'none';
}
function hideLoading() {
  loadingIndicator.style.display = 'none';
  chatList.style.display       = 'grid';
}
function showEmptyState() {
  emptyState.style.display       = 'flex';
  chatList.style.display         = 'none';
  loadingIndicator.style.display = 'none';
  chatList.innerHTML             = '';  // ← add this line
}

function showErrorState() {
  emptyState.innerHTML = `
    <div class="error-state">
      <i class="fas fa-exclamation-triangle"></i>
      <p>Failed to load analyses. Please try again later.</p>
      <button class="btn retry-btn">Retry</button>
    </div>`;
  emptyState.style.display     = 'flex';
  chatList.style.display       = 'none';
  loadingIndicator.style.display = 'none';

  document.querySelector('.retry-btn')?.addEventListener('click', loadChatHistory);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function renderAnalysisList(list) {
  console.log('Analyses:', list);
  totalChatsElem.textContent = list.length;
  chatList.innerHTML = list.map(a => {
    const participants = a.analysisData.metadata.participants || [];
    let title;
    if (participants.length > 3) {
      title = participants.slice(0, 3).join(' & ') + ' & ...';
    } else {
      title = participants.join(' & ');
    }
    if (!title) title = 'Chat Analysis';
    const date = formatDate(a.createdAt);
    
    // Check for AI analysis
    const hasAI = a.analysisData.html.includes('ai-analysis-complete');
    const aiPill = hasAI ? '<div class="ai-pill"><span class="ai-logo"></span>AI</div>' : '';
    
    // Check for expiration time
    let expirationPill = '';
    if (a.expiresAt) {
      const expiresAt = new Date(a.expiresAt);
      const now = new Date();
      const timeLeft = expiresAt - now;
      
      if (timeLeft > 0) {
        const minutesLeft = Math.ceil(timeLeft / (1000 * 60));
        expirationPill = `
          <div class="expiration-pill">
            <i class="fas fa-clock"></i>
            <span class="expiration-time">${minutesLeft}m</span>
          </div>
        `;
      }
    }
    
    return `
      <div class="chat-card" data-expires-at="${a.expiresAt || ''}">
        <div class="card-header">
          ${aiPill}
          ${expirationPill}
        </div>
        <h3 class="chat-title">${title}</h3>
        <p class="chat-date">${date}</p>
        <div class="chat-actions">
          <button class="view-button" data-id="${a.id}">Open</button>
          <button class="delete-button" data-id="${a.id}">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}
// Add this function to dashboard.js
function startExpirationTimers() {
  const updateTimers = () => {
    document.querySelectorAll('.chat-card').forEach(card => {
      const expiresAt = card.dataset.expiresAt;
      const pillEl = card.querySelector('.expiration-pill .expiration-time');
      if (!expiresAt || !pillEl) return;

      const timeLeft = new Date(expiresAt) - new Date();
      if (timeLeft > 0) {
        const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
        pillEl.textContent = `Expires in ${daysLeft}d`;
      } else {
        pillEl.textContent = 'Expired';
        pillEl.style.color = '#f44336'; 
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
      }
    });
  };

  // Update immediately
  updateTimers();
}

async function loadChatHistory() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!user.sub) {
    showEmptyState();
    return;
  }

  showLoading();
  try {
    const list = await getAnalyses(user.sub);
    if (list.length === 0) {
      showEmptyState();
    } else {
      renderAnalysisList(list);
      startExpirationTimers(); // Add this line
    }
  } catch (err) {
    console.error('❌ loadChatHistory failed:', err);
    showErrorState();
  } finally {
    hideLoading();
  }
}

function setupEventListeners() {
  document.addEventListener('click', async e => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('view-button')) {
      window.location.href = `analyze.html?id=${id}`;
    }
    if (e.target.classList.contains('delete-button')) {      if (confirm('Delete this analysis?')) {
        try {
          await deleteAnalysis(id);
          await loadChatHistory();
        } catch {
          alert('Failed to delete. Try again.');
        }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Always refresh when this page is (re)loaded or the user navigates back
  loadChatHistory();
  setupEventListeners();
});
