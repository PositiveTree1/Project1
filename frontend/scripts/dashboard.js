// scripts/dashboard.js

function loadChatHistory() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const userId = user.sub;
    const userChats = JSON.parse(localStorage.getItem(`userChats_${userId}`)) || [];
    
    const totalChatsElement = document.getElementById('totalChats');
    const emptyState = document.getElementById('emptyState');
    const chatList = document.getElementById('chatList');
    
    totalChatsElement.textContent = userChats.length;
    
    if (userChats.length === 0) {
        emptyState.style.display = 'flex';
        chatList.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        chatList.style.display = 'grid';
        renderChatCards(userChats);
    }
}

function renderChatCards(chats) {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    
    chats.forEach((chat, index) => {
        const chatCard = document.createElement('div');
        chatCard.className = 'chat-card';
        chatCard.innerHTML = `
            <div class="chat-header">
                <h3>${chat.chatName || `Chat ${index + 1}`}</h3>
                <span class="chat-date">${formatDate(chat.analyzedDate)}</span>
            </div>
            <div class="chat-stats">
                <div class="stat-item">
                    <span class="stat-value">${chat.totalMessages || 0}</span>
                    <span class="stat-label">Messages</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${chat.participants?.length || 2}</span>
                    <span class="stat-label">People</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${chat.timePeriod || 'N/A'}</span>
                    <span class="stat-label">Period</span>
                </div>
            </div>
            <div class="chat-actions">
                <button class="view-button" data-chat-id="${chat.id}">View Analysis</button>
                <button class="delete-button" data-chat-id="${chat.id}">Delete</button>
            </div>
        `;
        chatList.appendChild(chatCard);
    });
    
    document.querySelectorAll('.view-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const chatId = e.target.getAttribute('data-chat-id');
            viewChatAnalysis(chatId);
        });
    });
    
    document.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const chatId = e.target.getAttribute('data-chat-id');
            deleteChat(chatId);
        });
    });
}

function formatDate(dateString) {
    if (!dateString) return 'Date not available';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function viewChatAnalysis(chatId) {
    alert(`Viewing analysis for chat ${chatId}`);
    window.location.href = 'analyze.html';
}

function deleteChat(chatId) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    
    const userId = user.sub;
    let userChats = JSON.parse(localStorage.getItem(`userChats_${userId}`)) || [];
    userChats = userChats.filter(chat => chat.id !== chatId);
    localStorage.setItem(`userChats_${userId}`, JSON.stringify(userChats));
    loadChatHistory();
}

function saveChatAnalysis(analysisData) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const userId = user.sub;
    let userChats = JSON.parse(localStorage.getItem(`userChats_${userId}`)) || [];
    
    const newChat = {
        id: Date.now().toString(),
        analyzedDate: new Date().toISOString(),
        chatName: `Chat with ${Object.keys(analysisData.stats).join(' & ')}`,
        totalMessages: Object.values(analysisData.stats).reduce((a, b) => a + b, 0),
        participants: Object.keys(analysisData.stats),
        timePeriod: `${analysisData.dateRange.startDate.toLocaleDateString()} - ${analysisData.dateRange.endDate.toLocaleDateString()}`,
        data: analysisData
    };
    
    userChats.unshift(newChat);
    localStorage.setItem(`userChats_${userId}`, JSON.stringify(userChats));
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        loadChatHistory();
    }
});