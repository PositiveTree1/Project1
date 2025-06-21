import stopWords from '../../words/stopWords.js'; // Import the stop words list
import swearWords from '../../words/words.js'; // Import the swear words list
import { preprocessChatForAI, analyzeWithAI , preprocessGroupChat, analyzeGroupChatWithAI} from '../../aiProcessor.js';
import { setupGoogleButton, checkUserCredits, deductCredit } from '../authCheck.js';
import { saveAnalysisHTML, updateAnalysisHTML } from '../api.js';


// after your imports
window._savedChartConfigs = {};


let selectedFile = null;


function getLocaleDateFormat() {
    const testDate = new Date(2000, 0, 15); // January 15, 2000
    const formatted = new Intl.DateTimeFormat(undefined, { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).format(testDate);
    const parts = formatted.split('/');
    if (parts.length >= 2) {
        if (parts[0] === '15') return 'EU'; // DD/MM/YYYY
        if (parts[0] === '01') return 'US'; // MM/DD/YYYY
    }
    return 'EU'; // Default to EU if undetermined
}

// Detect chat format: 'bracket' (e.g., [03/05/2025, 10:19:20]) or 'android' (e.g., 03/05/2025, 10:19 -)
function detectChatFormat(text) {
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.startsWith('[')) return 'bracket';
        if (/^\d{1,2}\/\d{1,2}\/\d{4},/.test(line)) return 'android';
    }
    throw new Error('Unable to detect chat format');
}

// Helper function to check if timestamps are in increasing order
function isIncreasing(timestamps) {
    for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] < timestamps[i - 1]) {
            return false;
        }
    }
    return true;
}

function detectDateFormat(text, chatFormat) {
    const lines = text.split('\n');
    let regex;
    
    // Define regex based on chat format
    if (chatFormat === 'bracket') {
        regex = /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?\]/;
    } else if (chatFormat === 'android') {
        regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))? -/;
    } else {
        throw new Error('Unknown chat format');
    }

    // Counters for format detection
    let usFormatCount = 0;
    let euFormatCount = 0;
    let unambiguousUS = 0;
    let unambiguousEU = 0;

    // First pass: quick detection based on unambiguous cases
    for (const line of lines.slice(0, 50)) { // Check first 50 lines for performance
        const match = line.match(regex);
        if (match) {
            const [_, num1, num2, year, hourStr, minute, second, period] = match;
            const hour = parseInt(hourStr, 10);
            
            // Check for unambiguous cases based on numbers
            if (num1 > 12) {
                // First number >12 must be day (EU format)
                unambiguousEU++;
                continue;
            }
            if (num2 > 12) {
                // Second number >12 must be month (US format)
                unambiguousUS++;
                continue;
            }

            // Handle AM/PM cases
            if (period) {
                if (hour > 12) {
                    // Invalid time (hour can't be >12 with AM/PM)
                    return 'EU'; // Assume EU format if invalid US format
                }
                if (hour <= 12) {
                    // Could be either format, we'll check validity
                    const monthUS = num1.padStart(2, '0');
                    const dayUS = num2.padStart(2, '0');
                    const dateUS = new Date(`${year}-${monthUS}-${dayUS}T${convert12to24(hourStr, period)}:${minute}:${second || '00'}`);
                    
                    const dayEU = num1.padStart(2, '0');
                    const monthEU = num2.padStart(2, '0');
                    const dateEU = new Date(`${year}-${monthEU}-${dayEU}T${convert12to24(hourStr, period)}:${minute}:${second || '00'}`);
                    
                    if (!isNaN(dateUS.getTime())) usFormatCount++;
                    if (!isNaN(dateEU.getTime())) euFormatCount++;
                }
            }
        }
    }

    // If we found unambiguous cases, use them
    if (unambiguousUS > 0 && unambiguousEU === 0) return 'US';
    if (unambiguousEU > 0 && unambiguousUS === 0) return 'EU';

    // Second pass: check chronological order for ambiguous cases
    if (usFormatCount > 0 || euFormatCount > 0) {
        const sampleLines = lines.slice(0, 30); // Check more lines for better accuracy
        const timestampsUS = [];
        const timestampsEU = [];

        for (const line of sampleLines) {
            const match = line.match(regex);
            if (match) {
                const [_, num1, num2, year, hourStr, minute, second, period] = match;
                const hour = convert12to24(hourStr, period || '');

                // Test US format
                const monthUS = num1.padStart(2, '0');
                const dayUS = num2.padStart(2, '0');
                const dateUS = new Date(`${year}-${monthUS}-${dayUS}T${hour}:${minute}:${second || '00'}`);
                if (!isNaN(dateUS.getTime())) timestampsUS.push(dateUS.getTime());

                // Test EU format
                const dayEU = num1.padStart(2, '0');
                const monthEU = num2.padStart(2, '0');
                const dateEU = new Date(`${year}-${monthEU}-${dayEU}T${hour}:${minute}:${second || '00'}`);
                if (!isNaN(dateEU.getTime())) timestampsEU.push(dateEU.getTime());
            }
        }

        // Check which format produces chronologically ordered timestamps
        const isUSIncreasing = isChronological(timestampsUS);
        const isEUIncreasing = isChronological(timestampsEU);

        if (isUSIncreasing && !isEUIncreasing) return 'US';
        if (isEUIncreasing && !isUSIncreasing) return 'EU';
        
        // If both are chronological, use the one with more valid dates
        if (timestampsUS.length > timestampsEU.length) return 'US';
        if (timestampsEU.length > timestampsUS.length) return 'EU';
    }

    // Final fallback to locale detection
    return getLocaleDateFormat();
}

// Helper function to convert 12-hour time to 24-hour
function convert12to24(hourStr, period) {
    let hour = parseInt(hourStr, 10);
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour.toString().padStart(2, '0');
}

// Improved chronological check with tolerance for minor out-of-order messages
function isChronological(timestamps, maxOutOfOrder = 2) {
    if (timestamps.length < 2) return true;
    
    let outOfOrderCount = 0;
    for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] < timestamps[i - 1]) {
            outOfOrderCount++;
            if (outOfOrderCount > maxOutOfOrder) return false;
        }
    }
    return true;
}

function parseTime(hourStr, minuteStr, period) {
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    
    if (period) {
        if (period === 'PM' && hour < 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
    }
    
    return { hour, minute };
}

function isValidDate(year, month, day) {
    month = parseInt(month, 10) - 1; // JS months are 0-11
    const date = new Date(year, month, day);
    return date.getFullYear() == year && 
           date.getMonth() == month && 
           date.getDate() == day;
}

export function initFileProcessor() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', function() {
        if (this.files.length === 0) return;
        selectedFile = this.files[0];
        document.getElementById('fileName').textContent = selectedFile.name;
    });
}

const isLowMemory = navigator.deviceMemory && navigator.deviceMemory < 1;

export async function processSelectedFile() {
    try {
        // Get user and UI elements
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const aiToggle = document.getElementById('aiToggle');
        const fileInput = document.getElementById('fileInput');
        
        // Get selected file
        const file = fileInput.files[0] || window.selectedFile;
        if (!file) {
            throw new Error('Please select a file first');
        }

        // Read file content
        const fileContent = await readFileContent(file);
        
        // Process file content based on type (zip or text)
        const processedText = await processFileContent(file, fileContent);
        
        // Detect chat format and analyze
        const chatFormat = detectChatFormat(processedText);
        const dateFormat = detectDateFormat(processedText, chatFormat);
        const { stats } = processChatLog(processedText);
        
        // Check if it's a group chat
        const isGroupChat = Object.keys(stats).length > 2;
        
        // Process the file for full analysis
        await processFullAnalysis(file, isGroupChat);
        
        return true;
    } catch (error) {
        console.error('Error processing file:', error);
        showChatTooShortPopup();
        return false;
    }
}

// Helper function to read file content
async function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        
        if (file.name.endsWith('.zip')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
}

// Helper function to process file content
async function processFileContent(file, content) {
    if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(content);
        const txtFile = Object.keys(zip.files).find(f => f.endsWith('.txt'));
        if (!txtFile) {
            throw new Error('No .txt file found in the ZIP archive');
        }
        return await zip.files[txtFile].async('text');
    }
    return content;
}

// Helper function to perform full analysis
async function processFullAnalysis(file, isGroupChat) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            try {
                const result = file.name.endsWith('.zip') 
                    ? await processZipFile(event.target.result)
                    : processChatLogFile(event.target.result);
                
                if (result === false) {
                    resolve();
                    return;
                }
                
                document.dispatchEvent(new Event('processingComplete'));
                resolve();
            } catch (error) {
                console.error('Analysis processing error:', error);
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        
        if (file.name.endsWith('.zip')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
}
function showAnalysisArrivingPopup() {
    const popup = document.createElement("div");
    popup.className = "ai-popup";
    popup.innerHTML = `
        <div class="ai-popup-content">
            <div class="ai-popup-progress">
                <div class="ai-popup-progress-bar"></div>
            </div>
            <div class="ai-popup-header">
                <h3 class="ai-popup-title">AI Analysis Arriving</h3>
                <button class="close-popup" onclick="this.closest('.ai-popup').remove()">×</button>
            </div>
            <p class="ai-popup-message">Your deep AI chat analysis is going to appear shortly.</p>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Remove the popup after animation completes
    setTimeout(() => {
        if (popup.parentElement) {
            popup.parentElement.removeChild(popup);
        }
    }, 3000);
    
    // Also remove when clicking outside
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.remove();
        }
    });
}

function showChatTooShortPopup() {
    const popup = document.createElement("div");
    popup.className = "ai-popup";
    popup.innerHTML = `
        <div class="ai-popup-content">
            <div class="ai-popup-progress">
                <div class="ai-popup-progress-bar"></div>
            </div>
            <div class="ai-popup-header">
                <h3 class="ai-popup-title">Chat Too Short</h3>
                <button class="close-popup" onclick="this.closest('.ai-popup').remove()">×</button>
            </div>
            <p class="ai-popup-message">Your chat is too short to analyze, please try again with a longer chat.</p>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Remove the popup after animation completes
    setTimeout(() => {
        if (popup.parentElement) {
            popup.parentElement.removeChild(popup);
        }
    }, 3000);
    
    // Also remove when clicking outside
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.remove();
        }
    });
}

function showNoCreditsPopup(needed = 1, current = 0) {
  const popup = document.createElement("div");
  popup.className = "ai-popup";
  popup.innerHTML = `
    <div class="ai-popup-content">
      <div class="ai-popup-progress">
        <div class="ai-popup-progress-bar2"></div>
      </div>
      <div class="ai-popup-header">
        <h3 class="ai-popup-title">Not Enough Credits</h3>
        <button class="close-popup" onclick="this.closest('.ai-popup').remove()">×</button>
      </div>
      <p class="ai-popup-message">
        You dont have enough credits to run the AI analysis, basic analysis will still be shown.
      </p>
      <p class="ai-popup-message">
        Please <a href="/credits.html" style="color: #007BFF;">buy more credits</a> to continue.
      </p>
    </div>
  `;

  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 5000);
  popup.addEventListener('click', e => {
    if (e.target === popup) popup.remove();
  });
}


  

function processZipFile(arrayBuffer) {
    return JSZip.loadAsync(arrayBuffer).then((zip) => {
        const txtFile = Object.keys(zip.files).find((filename) => filename.endsWith('.txt'));
        if (!txtFile) {
            throw new Error('No .txt file found in the ZIP archive');
        }
        return zip.files[txtFile].async('text');
    }).then((text) => {
        return processChatLogFile(text); // Remove the region parameter
    });
}

function showGroupChatNoAIPopup() {
    const popup = document.createElement("div");
    popup.className = "ai-popup";
    popup.innerHTML = `
        <div class="ai-popup-content">
            <div class="ai-popup-progress">
                <div class="ai-popup-progress-bar"></div>
            </div>
            <div class="ai-popup-header">
                <h3 class="ai-popup-title">Group Chat Detected</h3>
                <button class="close-popup" onclick="this.closest('.ai-popup').remove()">×</button>
            </div>
            <p class="ai-popup-message">AI analysis is currently only available for chats with exactly two participants.</p>
            <p class="ai-popup-message">You will not be charged</p>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Remove the popup after 5 seconds (longer than other popups)
    setTimeout(() => {
        if (popup.parentElement) {
            popup.parentElement.removeChild(popup);
        }
    }, 5000);
    
    // Also remove when clicking outside
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.remove();
        }
    });
}


function processChatLogFile(text) {
    const result = processChatLog(text);
    

    const isGroupChat = Object.keys(result.stats).length > 2;
    
    if (isGroupChat) {
        const aiToggle = document.getElementById('aiToggle');
        if (aiToggle && aiToggle.checked) {
            showGroupChatNoAIPopup();
        }
        
    } else {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const aiToggle = document.getElementById('aiToggle');
        
        // Only show "Analysis Arriving" if they have enough credits
        if (user.sub && aiToggle?.checked) {
            // Check credits first
            (async () => {
                try {
                    const creditResp = await fetch(`/api/user-credits/${user.sub}`);
                    const { credits = 0 } = await creditResp.json();
                    const needed = window.currentCreditsNeeded || 1;
                    
                    if (credits >= needed) {
                        showAnalysisArrivingPopup();
                    }
                    // If not enough credits, the no credits popup will be shown elsewhere
                } catch (error) {
                    console.error('Error checking credits:', error);
                }
            })();
        }
    }
    // Initialize colors if not already initialized
    if (!window.colors) window.colors = {};
    const {
        stats,
        columnChartData,
        dateRange,
        hourlyData,
        hourlySenders,
        monthlyData,
        weekdayData,
        conversations
    } = result;
    const callStats = analyzeCalls(text);
    
    window.stats = stats;
    window.callStats = callStats; // Store call stats globally
    window.conversations = conversations;

    window.chatText = text;


    const { uniqueWords, topEmojis, longestMessage, topCommunalWords, topCommunalEmojis, averageWordsPerMessage, averageSwearWordsPerMessage } = calculateAdditionalStats(text);
    // const ignoredCounts = analyzeIgnoredMessages(text, region);
    const doubleMessageCounts = calculateDoubleMessages(text);
    // const responseStats = calculateResponseTimes(text, region);
    const chatFocusPercentages = calculateChatFocus(text, Object.keys(stats));
    const contentStats = analyzeContent(text);
    const interactions = analyzeInteractions(text);

    window.convoStats = calculateConvoStats(text);

    const streakStats = calculateStreakStats(text);
    

    if (Object.keys(stats).length === 2) {
        window.engagementData = calculateEngagementRatio(conversations);
    }

    // Store other data globally...
    window.columnChartData = columnChartData;
    window.dateRange = dateRange;
    window.hourlyData = hourlyData;
    window.hourlySenders = hourlySenders;
    window.monthlyData = monthlyData;
    window.weekdayData = weekdayData;
    window.uniqueWords = uniqueWords;
    window.topEmojis = topEmojis;
    window.longestMessage = longestMessage;
    window.topCommunalWords = topCommunalWords;
    window.topCommunalEmojis = topCommunalEmojis;
    
    window.averageWordsPerMessage = averageWordsPerMessage;
    window.averageSwearWordsPerMessage = averageSwearWordsPerMessage;
    // window.ignoredCounts = ignoredCounts;
    window.doubleMessageCounts = doubleMessageCounts;
    // window.responseStats = responseStats;
    window.chatFocusPercentages = chatFocusPercentages;
    window.contentStats = contentStats;
    window.interactions = interactions;
    window.streakStats = streakStats;

    const people = Object.keys(stats);

    // Initialize colors for each person if not already set
    people.forEach((person, index) => {
        if (!window.colors[person]) {
            window.colors[person] = getColorForSender(person, index);
        }
    });

    // Render the person selection panel only if there are more than two people
    

    // Render the stacked column chart, and when done, render the other charts
    renderStackedColumnChart(columnChartData, () => {
        // Once timeline is drawn, draw the rest
            renderMonthlyChartChartJS(monthlyData);
            renderWeekdayChart(weekdayData);
            renderHourlyChart(hourlyData);
            // Stacked column chart (now a curved line chart) has rendered.
            // Now render the other charts:
            
            if (window.renderPersonBoxes) renderPersonBoxes(stats, uniqueWords, topEmojis, longestMessage, window.colors || {});
            if (window.renderCommunalWords) renderCommunalWords(topCommunalWords);
            if (window.renderFloatingEmojis) renderFloatingEmojis(topCommunalEmojis);

            

            if (Object.keys(stats).length === 2) {
                if (window.renderDoubleMessages) renderDoubleMessages(doubleMessageCounts);
            }
            if (window.renderContentAnalysis) {
                renderContentAnalysis(contentStats);
            }

            if (window.renderInteractions) {
                if (Object.keys(stats).length > 2) {
                    renderInteractions(interactions);
                } else {
                    // Remove interactions section if it exists for non-group chats
                    const interactionsSection = document.getElementById("interactionsSection");
                    if (interactionsSection) {
                        interactionsSection.remove();
                    }
                }
            }
            if (window.renderCallStats) {
                renderCallStats(callStats);
            }
            if (people.length === 2) {
                renderConvoStats(text);
            }
            

            // Add this with the other render calls
            if (window.renderStreakStats) renderStreakStats(streakStats);

            // … after your existing streakStats line
            const ghostingStats = calculateGhostingStats(text);
            window.ghostingStats = ghostingStats;    // make it globally available

            const responseTimeStats = calculateResponseTimes(text);
            window.responseTimeStats = responseTimeStats;

            if (people.length === 2) {
                window.aiAnalysis = renderAIAnalysisSection();
                
                if (window.aiAnalysis?.button) {
                    window.aiAnalysis.button.removeEventListener('click', handleAIClick);
                    window.aiAnalysis.button.addEventListener('click', handleAIClick);
                }
            } else if (people.length > 2) {
                window.aiAnalysis = renderGroupChatAIAnalysisSection();
                // No button exists, so no need to attach event listeners
            }

            document.dispatchEvent(new Event('processingComplete'));
    
            // Scroll to results if needed
            const resultsSection = document.getElementById('results');
            if (resultsSection) {
                setTimeout(() => {
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
            (async () => {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                if (!user.sub) return;

                const timelineHTML = document.getElementById('timelineSection').innerHTML;
                const chatHTML     = document.getElementById('chatAnalyticsSection').innerHTML;
                const html = `
                    <section id="timelineSection">${timelineHTML}</section>
                    <section id="chatAnalyticsSection">${chatHTML}</section>
                `;

                const metadata = {
                    participants: Object.keys(window.stats),
                    createdAt: new Date().toISOString(),
                    charts: {
                        timeline:    window._savedChartConfigs.timeline,
                        hourly:      window._savedChartConfigs.hourly,
                        monthly:     window._savedChartConfigs.monthly,
                        weekday:     window._savedChartConfigs.weekday,
                        chatFocus:   window._savedChartConfigs.chatFocus,
                        engagement:  window._savedChartConfigs.engagement,
                    }
                };

                

                const resp = await saveAnalysisHTML(user.sub, { html, metadata }, true);
                window.currentAnalysisId = resp.id;
                console.log('Analysis saved with ID =', resp.id);

                

            } catch (err) {
                console.error('Could not save analysis HTML:', err);
            }
        })();
    });
    return true;

}


window.initFileProcessor = initFileProcessor;
window.processSelectedFile = processSelectedFile;

function processChatLog(text) {
    try {
        // Detect chat and date formats
        const chatFormat = detectChatFormat(text);
        const dateFormat = detectDateFormat(text, chatFormat);
        window.chatFormat = chatFormat;
        window.dateFormat = dateFormat;

        // Define regex based on chat format
        let regex;
        if (chatFormat === 'bracket') {
            regex = /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?\] ([^:]+):/;
        } else if (chatFormat === 'android') {
            regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))? - ([^:]+):/;
        } else {
            throw new Error('Unknown chat format');
        }

        const lines = text.split('\n');
        const stats = {};
        let startDate = null;
        let endDate = null;
        const messageCounts = {};
        let conversations = [];
        let currentConversation = [];
        let previousTimestamp = null;
        const conversationGap = 40 * 60 * 1000; // 40 minutes
        const minMessages = 16;

        const allDays = new Set();
        const daysPerMonth = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        monthNames.forEach(month => { daysPerMonth[month] = new Set(); });

        const hourlySenderStats = Array(24).fill(null).map(() => ({}));
        const hourlySendersSet = new Set();

        const perMonthCounts = {};
        monthNames.forEach(month => { perMonthCounts[month] = {}; });

        const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const perWeekdayCounts = {};
        weekdayNames.forEach(day => { perWeekdayCounts[day] = {}; });

        const mediaPlaceholders = [
            "‎Voice call", "‎Missed voice call", "‎image omitted", "‎GIF omitted",
            "‎sticker omitted", "‎video omitted", "‎audio omitted", "‎This message was deleted."
        ];

        let validMessageCount = 0;

        for (const line of lines) {
            if (mediaPlaceholders.some(placeholder => line.includes(placeholder))) continue;

            const match = line.match(regex);
            if (match) {
                validMessageCount++;
                const num1 = match[1];
                const num2 = match[2];
                const year = match[3];
                let hour = parseInt(match[4], 10);
                const minute = match[5];
                const second = match[6] || '00';
                const period = match[7]; // AM/PM
                const sender = match[8].trim();

                // Convert 12-hour to 24-hour format if needed
                if (period) {
                    if (period === 'PM' && hour < 12) {
                        hour += 12;
                    } else if (period === 'AM' && hour === 12) {
                        hour = 0;
                    }
                }

                const day = dateFormat === 'US' ? num2.padStart(2, '0') : num1.padStart(2, '0');
                const month = dateFormat === 'US' ? num1.padStart(2, '0') : num2.padStart(2, '0');
                const formattedDate = `${year}-${month}-${day}`;
                const timestamp = new Date(`${formattedDate}T${hour.toString().padStart(2, '0')}:${minute}:${second.padStart(2, '0')}`);

                if (isNaN(timestamp.getTime())) {
                    console.warn('Invalid timestamp for line:', line);
                    continue;
                }

                const monthNum = parseInt(month, 10);
                const monthName = monthNames[monthNum - 1];
                const dateObj = new Date(formattedDate);
                const weekdayName = weekdayNames[dateObj.getDay()];

                if (previousTimestamp && (timestamp - previousTimestamp) > conversationGap) {
                    finalizeConversation(currentConversation, conversations, minMessages);
                    currentConversation = [];
                }

                if (currentConversation.length >= 3) {
                    const lastThreeSenders = currentConversation.slice(-3).map(m => m.sender);
                    if (new Set(lastThreeSenders).size === 1) {
                        currentConversation = currentConversation.slice(0, -3);
                        finalizeConversation(currentConversation, conversations, minMessages);
                        currentConversation = [];
                    }
                }

                currentConversation.push({
                    sender: sender,
                    timestamp: timestamp,
                    text: line.split(": ").slice(1).join(": ")
                });
                previousTimestamp = timestamp;

                stats[sender] = (stats[sender] || 0) + 1;
                allDays.add(formattedDate);
                daysPerMonth[monthName].add(formattedDate);
                messageCounts[formattedDate] = messageCounts[formattedDate] || {};
                messageCounts[formattedDate][sender] = (messageCounts[formattedDate][sender] || 0) + 1;
                hourlySenderStats[parseInt(hour)][sender] = (hourlySenderStats[parseInt(hour)][sender] || 0) + 1;
                hourlySendersSet.add(sender);
                perMonthCounts[monthName][sender] = (perMonthCounts[monthName][sender] || 0) + 1;
                perWeekdayCounts[weekdayName][sender] = (perWeekdayCounts[weekdayName][sender] || 0) + 1;

                if (!startDate || timestamp < startDate) startDate = timestamp;
                if (!endDate || timestamp > endDate) endDate = timestamp;
            }
        }

        finalizeConversation(currentConversation, conversations, minMessages);

        // Ensure we have valid stats before proceeding
        if (Object.keys(stats).length === 0) {
            throw new Error('No valid messages found in chat log');
        }

        const columnChartData = generateColumnChartData(messageCounts, startDate, endDate);
        const totalDays = allDays.size;

        const hourlyData = [];
        for (let hour = 0; hour < 24; hour++) {
            const dataPoint = { hour: `${hour}:00` };
            const sendersInHour = hourlySenderStats[hour];
            for (const sender in sendersInHour) {
                dataPoint[sender] = totalDays ? sendersInHour[sender] / totalDays : 0;
            }
            hourlyData.push(dataPoint);
        }

        const monthlyData = monthNames.map(month => {
            const sendersInMonth = perMonthCounts[month];
            const daysInMonth = daysPerMonth[month].size;
            const dataPoint = { month: month };
            for (const sender in sendersInMonth) {
                dataPoint[sender] = daysInMonth ? sendersInMonth[sender] / daysInMonth : 0;
            }
            return dataPoint;
        });

        const weekdayData = weekdayNames.map(weekday => {
            const sendersInWeekday = perWeekdayCounts[weekday];
            const daysInWeekday = Math.ceil(totalDays / 7);
            const dataPoint = { weekday: weekday };
            for (const sender in sendersInWeekday) {
                dataPoint[sender] = daysInWeekday ? sendersInWeekday[sender] / daysInWeekday : 0;
            }
            return dataPoint;
        });

        // Store stats globally
        window.stats = stats;

        return { 
            stats, 
            columnChartData, 
            dateRange: { startDate, endDate },
            hourlyData,
            hourlySenders: Array.from(hourlySendersSet),
            monthlyData,
            weekdayData,
            conversations 
        };
    } catch (err) {
        console.error('processChatLog error:', err);
        return false;
    }
}

function finalizeConversation(conversation, conversations, minMessages) {
    if (conversation.length < minMessages) return;

    // Check if we have at least 2 participants
    const participants = new Set(conversation.map(m => m.sender));
    if (participants.size < 2) return;

    // Check minimum duration (2 minutes)
    const duration = conversation[conversation.length - 1].timestamp - conversation[0].timestamp;
    if (duration < 2 * 60 * 1000) return;

    // Check maximum gap between messages (10 minutes)
    for (let i = 1; i < conversation.length; i++) {
        const gap = conversation[i].timestamp - conversation[i - 1].timestamp;
        if (gap > 10 * 60 * 1000) {
            // Split into valid segments
            let start = 0;
            for (let j = 1; j < conversation.length; j++) {
                const segmentGap = conversation[j].timestamp - conversation[j - 1].timestamp;
                if (segmentGap > 10 * 60 * 1000) {
                    // Check if the segment meets criteria
                    const segment = conversation.slice(start, j);
                    if (segment.length >= minMessages) {
                        const segmentParticipants = new Set(segment.map(m => m.sender));
                        if (segmentParticipants.size >= 2) {
                            conversations.push(segment);
                        }
                    }
                    start = j;
                }
            }
            // Add the last segment
            const lastSegment = conversation.slice(start);
            if (lastSegment.length >= minMessages) {
                const lastParticipants = new Set(lastSegment.map(m => m.sender));
                if (lastParticipants.size >= 2) {
                    conversations.push(lastSegment);
                }
            }
            return;
        }
    }

    // If we get here, all gaps are within limits
    conversations.push(conversation);
}

function calculateAdditionalStats(text) {
    const lines = text.split('\n');

    const regex = window.chatFormat === 'bracket' 
        ? /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?\] ([^:]+): (.*)/
        : /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))? - ([^:]+): (.*)/;
    const uniqueWords = {}; // Track unique words per sender
    const wordCounts = {}; // Track word usage per sender
    const emojiCounts = {}; // Track emoji usage per sender
    const longestMessage = {}; // Track the longest message (in words) per sender
    const communalWordCounts = {}; // Track word usage across all senders
    const communalEmojiCounts = {}; // Track emoji usage across all senders
    const totalWordsPerSender = {}; // Track total words per sender
    const totalMessagesPerSender = {}; // Track total messages per sender
    const totalSwearWordsPerSender = {}; // Track total swear words per sender

    // Updated emoji regex to capture full emoji sequences
    const emojiRegex = /(\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic})*)/gu;

    // Media placeholders to exclude
    const mediaPlaceholders = [
        "‎image omitted",
        "‎GIF omitted",
        "‎sticker omitted",
        "‎video omitted",
        "‎audio omitted",
    ];

    
    lines.forEach(line => {
            if (mediaPlaceholders.some(placeholder => line.includes(placeholder))) return;
            const match = line.match(regex);
            if (match) {
                const sender = match[8]?.trim(); // Safe access with optional chaining
                const message = match[9] || ''; // Fallback to empty string

                if (!sender) return;

                // Track total messages per sender
                totalMessagesPerSender[sender] = (totalMessagesPerSender[sender] || 0) + 1;

                // Track swear words
                // Improved version
                if (!totalSwearWordsPerSender[sender]) totalSwearWordsPerSender[sender] = 0;
                const words = message.split(/\s+/).filter(word => word.trim() !== "");
                words.forEach(word => {
                    const cleanWord = word.toLowerCase().replace(/[^\w\s]/g, ""); // Remove punctuation
                    if (cleanWord && swearWords.includes(cleanWord)) {
                        totalSwearWordsPerSender[sender]++;
                    }
                });

                // Track unique words
                if (!uniqueWords[sender]) uniqueWords[sender] = new Set();
                if (!wordCounts[sender]) wordCounts[sender] = {};
                if (!totalWordsPerSender[sender]) totalWordsPerSender[sender] = 0;

                // Update total words for the sender
                totalWordsPerSender[sender] += words.length;

                words.forEach(word => {
                    const lowerWord = word.toLowerCase().replace(/[^\w\s]/g, ""); // Remove punctuation
                    if (lowerWord.trim() !== "" && !stopWords.includes(lowerWord)) { // Exclude stop words
                        uniqueWords[sender].add(lowerWord);
                        wordCounts[sender][lowerWord] = (wordCounts[sender][lowerWord] || 0) + 1;

                        // Track communal word counts
                        communalWordCounts[lowerWord] = (communalWordCounts[lowerWord] || 0) + 1;
                    }
                });

                // Track emoji usage
                const emojis = message.match(emojiRegex) || [];
                if (!emojiCounts[sender]) emojiCounts[sender] = {};

                let previousEmoji = null;
                emojis.forEach(emoji => {
                    if (emoji !== previousEmoji) { // Ignore consecutive duplicates
                        emojiCounts[sender][emoji] = (emojiCounts[sender][emoji] || 0) + 1;

                        // Track communal emoji counts
                        communalEmojiCounts[emoji] = (communalEmojiCounts[emoji] || 0) + 1;
                        previousEmoji = emoji;
                    }
                });

                // Track the longest message (in words)
                const wordCount = words.length;
                if (!longestMessage[sender] || wordCount > longestMessage[sender]) {
                    longestMessage[sender] = wordCount;
                }
            }
            
        
    });

    // Calculate average words per message for each sender
    const averageWordsPerMessage = {};
    for (const sender in totalWordsPerSender) {
        const totalMessages = totalMessagesPerSender[sender] || 1; // Avoid division by zero
        averageWordsPerMessage[sender] = (totalWordsPerSender[sender] / totalMessages).toFixed(1); // Round to 2 decimal places
    }

    // Calculate average swear words per message for each sender
    const averageSwearWordsPerMessage = {};
    for (const sender in totalSwearWordsPerSender) {
        const totalMessages = totalMessagesPerSender[sender] || 1; // Avoid division by zero
        averageSwearWordsPerMessage[sender] = (totalSwearWordsPerSender[sender] / totalMessages).toFixed(2); // Round to 2 decimal places
    }

    // Store swear word stats globally
    window.totalSwearWordsPerSender = totalSwearWordsPerSender;
    window.averageSwearWordsPerMessage = averageSwearWordsPerMessage;

    // Calculate top 3 most used emojis for each sender
    const topEmojis = {};
    for (const sender in emojiCounts) {
        const sortedEmojis = Object.entries(emojiCounts[sender])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        topEmojis[sender] = sortedEmojis;
    }

    // Calculate top 15 communal words
    const topCommunalWords = Object.entries(communalWordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word, count]) => ({ word, count }));

    // Calculate top 5 communal emojis
    const topCommunalEmojis = Object.entries(communalEmojiCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)  // now taking top 7 instead of 5
        .map(([emoji, count]) => ({ emoji, count }));

    return { uniqueWords, topEmojis, longestMessage, topCommunalWords, topCommunalEmojis, averageWordsPerMessage, averageSwearWordsPerMessage };
}


function calculateDoubleMessages(text) {
    const lines = text.split('\n');
    const regex = window.chatFormat === 'bracket' 
        ? /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?\] ([^:]+):/
        : /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))? - ([^:]+):/;
    
    let previousSender = null;
    const doubleMessageCounts = {};
    
    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            // Group indices:
            // [1] = month
            // [2] = day
            // [3] = year
            // [4] = hour
            // [5] = minute
            // [6] = seconds (optional)
            // [7] = AM/PM (optional)
            // [8] = sender
            const sender = match[8]?.trim(); // Changed from 7 to 8 and added optional chaining
            
            if (!sender) return; // Skip if no sender found
            
            if (sender === previousSender) {
                doubleMessageCounts[sender] = (doubleMessageCounts[sender] || 0) + 1;
            }
            previousSender = sender;
        }
    });
    
    return doubleMessageCounts;
}

function generateColumnChartData(messageCounts, startDate, endDate) {
    if (!startDate || !endDate) {
        console.warn('Invalid date range for column chart');
        return { data: [], senders: [] };
    }

    if (startDate > endDate) {
        [startDate, endDate] = [endDate, startDate]; // Swap dates
    }

    const daysDifference = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const minDays = 10; // Minimum days for a meaningful chart
    if (daysDifference < minDays) {
        console.warn(`Date range too short for column chart (${daysDifference} days)`);
        return { data: [], senders: [] };
    }

    const columnChartData = [];
    const senders = new Set();
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const yyyy = currentDate.getFullYear();
        const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDate.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;

        const dateLabel = currentDate.toLocaleString("default", { month: "short", year: "numeric" });
        const dataPoint = { date: key, dateLabel };

        if (messageCounts[key]) {
            for (const sender in messageCounts[key]) {
                dataPoint[sender] = messageCounts[key][sender];
                senders.add(sender);
            }
        }
        columnChartData.push(dataPoint);

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return { data: columnChartData, senders: Array.from(senders) };
}


function calculateChatFocus(text, senders) {
    const lines = text.split('\n');
    const focusCounts = {
        personA: 0,
        personB: 0,
    };
    let totalFocusedMessages = 0;

    const regex = window.chatFormat === 'bracket'
        ? /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?\] ([^:]+): (.+)/
        : /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))? - ([^:]+): (.+)/;

    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            // Group indices:
            // [1] = month
            // [2] = day
            // [3] = year
            // [4] = hour
            // [5] = minute
            // [6] = seconds (optional)
            // [7] = AM/PM (optional)
            // [8] = sender
            // [9] = message
            const sender = match[8]?.trim(); // Changed from 7 to 8
            const message = (match[9] || '').toLowerCase().replace(/[^\w\s]/g, ' '); // Changed from 8 to 9

            if (!sender || senders.length < 2) return; // Safety check

            const nameA = senders[0].toLowerCase();
            const nameB = senders[1].toLowerCase();
            const isAboutSelf = /\b(i\s|i'm|im|i’ll|i will|i am|i've|ive|i have|i do|i did|i was|i feel|i think|me|my|mine|myself|i want|i need|i can't|i cannot|i don't|i wont|i shouldn't|i hate|i like|i love|i prefer|i hope|i believe|i guess|i suppose|i assume|i wonder|i know|i understand|i see|i thought|i wish)\b/i.test(message);
            const isAboutOther = /\b(you\s|you're\s|you are\s|youre\s|you'll\s|you will\s|you've\s|you have\s|you do\s|you did\s|you were\s|you feel\s|you think\s|ur\s|your\s|yours\s|yourself\s|you want\s|you need\s|you can't\s|you cannot\s|you don't\s|you shouldn’t\s|you hate\s|you like\s|you love\s|you prefer\s|you hope\s|you believe\s|you guess\s|you suppose\s|you assume\s|you wonder\s|you know\s|you understand\s|you see\s|you thought\s|you wish\s)/i.test(message);

            let focus = null;
            if (sender === senders[0]) {
                if (isAboutOther || message.includes(nameB)) {
                    focus = 'personB';
                } else if (isAboutSelf || message.includes(nameA)) {
                    focus = 'personA';
                }
            } else if (sender === senders[1]) {
                if (isAboutOther || message.includes(nameA)) {
                    focus = 'personA';
                } else if (isAboutSelf || message.includes(nameB)) {
                    focus = 'personB';
                }
            }

            if (focus) {
                focusCounts[focus]++;
                totalFocusedMessages++;
            }
        }
    });

    const minMessagesRequired = 20;
    if (totalFocusedMessages < minMessagesRequired) {
        console.warn('Too few focused messages for chat focus analysis');
        return { personA: 50, personB: 50 };
    }

    const focusPercentages = {
        personA: totalFocusedMessages > 0 ? ((focusCounts.personA / totalFocusedMessages) * 100).toFixed(1) : 50,
        personB: totalFocusedMessages > 0 ? ((focusCounts.personB / totalFocusedMessages) * 100).toFixed(1) : 50,
    };

    return focusPercentages;
}

function analyzeContent(text) {
    const lines = text.split('\n');
    const contentStats = {
        laughs: {},
        questions: {},
        apologies: {},
    };

    const senders = Object.keys(window.stats || {});
    const regex = window.chatFormat === 'bracket'
        ? /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?\] ([^:]+): (.+)/
        : /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))? - ([^:]+): (.+)/;

    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            // Group indices:
            // [1] = month
            // [2] = day
            // [3] = year
            // [4] = hour
            // [5] = minute
            // [6] = seconds (optional)
            // [7] = AM/PM (optional)
            // [8] = sender
            // [9] = message
            const sender = match[8]?.trim(); // Changed from 7 to 8
            const message = (match[9] || '').toLowerCase().replace(/[\u200E\u200F]/g, ''); // Changed from 8 to 9

            if (!sender) return; // Skip if no sender found

            // Text-based laughter with word boundaries
            const textLaughPatterns = /\b(lol|lmao|lmfao|rofl|haha|hehe|hahaha|hahahaha|hah|heh|bahaha|xd|lulz|lool|lel|lawl)\b/;
            // Emoji-based laughter
            const emojiLaughPatterns = /(😂|😆|🤣)/;

            // Check for either text or emoji laughter
            if (textLaughPatterns.test(message) || emojiLaughPatterns.test(message)) {
                contentStats.laughs[sender] = (contentStats.laughs[sender] || 0) + 1;
            }

            const questionPatterns = /\b(what|wut|wat|how|hw|why|y|when|wen|where|wer|who|whom|which|whitch|is\s+there|are\s+you|r\s+u|can\s+you|cud\s+u|could\s+you|shud\s+u|should\s+you|wht)\b|\?$/;
            if (questionPatterns.test(message)) {
                contentStats.questions[sender] = (contentStats.questions[sender] || 0) + 1;
            }

            const apologyPatterns = /\b(sorry|srry|sry|apologies|apology|mb|my\s+bad|forgive\s+me|i\s+apologize|pardon\s+me|excuse\s+me|oops|oopsie|so\s+sorry|so\s+srry|so\s+sry|terribly\s+sorry)\b/;
            if (apologyPatterns.test(message)) {
                contentStats.apologies[sender] = (contentStats.apologies[sender] || 0) + 1;
            }
        }
    });

    return contentStats;
}

function analyzeInteractions(text) {
    const lines = text.split('\n');
    const interactions = {}; // Track interactions between senders
    let previousSender = null; // Track the sender of the previous message

    // Regex to extract date, time, and sender from each line
    const regex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\] ([^:]+):/;

    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const sender = match[7].trim();

            // If there's a previous sender, track the interaction
            if (previousSender && sender !== previousSender) {
                if (!interactions[previousSender]) {
                    interactions[previousSender] = {};
                }
                interactions[previousSender][sender] = (interactions[previousSender][sender] || 0) + 1;
            }

            // Update the previous sender
            previousSender = sender;
        }
    });

    return interactions;
}

function analyzeCalls(text) {
    const lines = text.split('\n');
    const callStats = { total: 0, longestCalls: [] };
    
    // More flexible regex pattern to match call entries
    const callRegex = /(?:Voice|Video) call, (\d+ (?:min|sec|hour|hr|h|m|s))/;
    
    lines.forEach(line => {
        // More thorough cleaning of special characters
        const cleanLine = line.replace(/[\u200E-\u200F\u202A-\u202E]/g, "").trim();
        
        // Check if line contains a call entry
        if (cleanLine.includes("Voice call") || cleanLine.includes("Video call")) {
            callStats.total++;
            
            // Extract call duration
            const callMatch = cleanLine.match(callRegex);
            if (callMatch) {
                const durationText = callMatch[1];
                const duration = parseDuration(durationText);
                
                if (duration > 0) {
                    // Extract sender - this might need adjustment based on your full log format
                    const senderMatch = cleanLine.match(/(?:^|\])\s*([^:]+?):/);
                    const sender = senderMatch ? senderMatch[1].trim() : "Unknown";
                    
                    callStats.longestCalls.push({
                        sender: sender,
                        duration: duration,
                        formattedDuration: formatDuration(duration),
                        type: cleanLine.includes("Video call") ? "Video" : "Voice"
                    });
                }
            }
        }
    });
    
    callStats.longestCalls.sort((a, b) => b.duration - a.duration);
    callStats.longestCalls = callStats.longestCalls.slice(0, 3);
    window.callStats = callStats;
    return callStats;
}

// Helper function to parse duration text into seconds
function parseDuration(durationText) {
    const parts = durationText.split(' ');
    const value = parseInt(parts[0]);
    const unit = parts[1].toLowerCase();
    
    switch (unit) {
        case 'hour': case 'hr': case 'h': return value * 3600;
        case 'min': case 'm': return value * 60;
        case 'sec': case 's': return value;
        default: return 0;
    }
}

// Helper function to format seconds into HH:MM:SS
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0')
    ].join(':');
}

function extractCallDuration(callText) {
    // Clean the text from any invisible characters
    const cleanText = callText.replace(/[\u200E\u200F]/g, "");
    // Updated regex that does not expect the invisible character
    const durationMatch = cleanText.match(/,\s*(\d+)\s*(min|sec)/);
    
    if (durationMatch) {
        const value = parseInt(durationMatch[1], 10);
        const unit = durationMatch[2];
        
        // Convert to minutes for consistent comparison
        if (unit === 'sec') {
            return value / 60; // Convert seconds to minutes
        } else if (unit === 'min') {
            return value;
        }
    }
    
    return 0; // Default if no duration found
}
function calculateConvoStats(text) {
    const lines = text.split('\n');
    
    const regex = window.chatFormat === 'bracket' 
        ? /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?\] ([^:]+):/
        : /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))? - ([^:]+):/;
    
    const messages = [];
    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            // Group indices are different for bracket vs android format
            const num1 = match[1];
            const num2 = match[2];
            const year = match[3];
            const hour = match[4];
            const minute = match[5];
            const second = match[6] || '00';
            const sender = match[8].trim(); // Group 8 for both formats now
            const message = match[9] || ''; // Group 9 for message content
            
            const day = window.dateFormat === 'US' ? num2.padStart(2, '0') : num1.padStart(2, '0');
            const month = window.dateFormat === 'US' ? num1.padStart(2, '0') : num2.padStart(2, '0');
            const timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
            
            messages.push({ 
                sender, 
                message,
                timestamp,
                line 
            });
        }
    });

    // Sort messages by time (already sorted in original, but ensures consistency)
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // Group messages into conversations (unchanged)
    const maxGap = 10 * 60 * 1000;      // 10 minutes between messages
    const newConvoGap = 30 * 60 * 1000; // 30 minutes gap to start new conversation
    const minDuration = 2 * 60 * 1000;  // 2 minute minimum duration
    const minMessages = 4;              // 4 messages minimum

    let candidateConvos = [];
    let currentGroup = [];
    
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        
        if (currentGroup.length === 0) {
            currentGroup.push(message);
        } else {
            const gap = message.timestamp - messages[i - 1].timestamp;
            
            if (currentGroup.length >= 3) {
                const lastThreeSenders = currentGroup.slice(-3).map(m => m.sender);
                if (new Set(lastThreeSenders).size === 1) {
                    if (currentGroup.length >= minMessages) {
                        const participants = new Set(currentGroup.map(m => m.sender));
                        if (participants.size >= 2) {
                            const duration = currentGroup[currentGroup.length - 1].timestamp - currentGroup[0].timestamp;
                            if (duration >= minDuration) {
                                candidateConvos.push({
                                    startTime: currentGroup[0].timestamp,
                                    endTime: currentGroup[currentGroup.length - 1].timestamp,
                                    messageCount: currentGroup.length
                                });
                            }
                        }
                    }
                    currentGroup = [];
                }
            }
            
            if (gap <= maxGap) {
                currentGroup.push(message);
            } else {
                if (currentGroup.length >= minMessages) {
                    const participants = new Set(currentGroup.map(m => m.sender));
                    if (participants.size >= 2) {
                        const duration = currentGroup[currentGroup.length - 1].timestamp - currentGroup[0].timestamp;
                        if (duration >= minDuration) {
                            candidateConvos.push({
                                startTime: currentGroup[0].timestamp,
                                endTime: currentGroup[currentGroup.length - 1].timestamp,
                                messageCount: currentGroup.length
                            });
                        }
                    }
                }
                currentGroup = [message];
            }
        }
    }
    
    if (currentGroup.length >= minMessages) {
        const participants = new Set(currentGroup.map(m => m.sender));
        if (participants.size >= 2) {
            const duration = currentGroup[currentGroup.length - 1].timestamp - currentGroup[0].timestamp;
            if (duration >= minDuration) {
                candidateConvos.push({
                    startTime: currentGroup[0].timestamp,
                    endTime: currentGroup[currentGroup.length - 1].timestamp,
                    messageCount: currentGroup.length
                });
            }
        }
    }

    const mergedConvos = [];
    if (candidateConvos.length > 0) {
        let currentMerged = { ...candidateConvos[0] };
        for (let i = 1; i < candidateConvos.length; i++) {
            const convo = candidateConvos[i];
            if (convo.startTime - currentMerged.endTime < newConvoGap) {
                currentMerged.endTime = convo.endTime;
                currentMerged.messageCount += convo.messageCount;
            } else {
                mergedConvos.push(currentMerged);
                currentMerged = { ...convo };
            }
        }
        mergedConvos.push(currentMerged);
    }

    // Calculate average conversation length
    const totalMessages = mergedConvos.reduce((sum, conv) => sum + conv.messageCount, 0);
    const overallAverage = mergedConvos.length > 0 ? totalMessages / mergedConvos.length : 0;

    // Calculate message counts for frequency comparison
    const endDate = messages.length > 0 
        ? new Date(messages[messages.length - 1].timestamp)
        : new Date(); // Fallback to current date if no messages

    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const last30Start = endDate.getTime() - thirtyDays;
    const prev30Start = last30Start - thirtyDays;

    // Calculate message counts
    const messagesLast30 = messages.filter(msg => 
        msg.timestamp >= last30Start && msg.timestamp <= endDate.getTime()
    ).length;

    const messagesPrev30 = messages.filter(msg => 
        msg.timestamp >= prev30Start && msg.timestamp < last30Start
    ).length;

    // Calculate percentage change and trend
    let freqPercentageChange = 0;
    let trend = "none";

    if (messagesLast30 > 0 || messagesPrev30 > 0) {
        if (messagesPrev30 === 0) {
            trend = messagesLast30 > 0 ? "up" : "none";
            freqPercentageChange = messagesLast30 > 0 ? 100 : 0; // 100% increase if no previous messages
        } else {
            freqPercentageChange = ((messagesLast30 - messagesPrev30) / messagesPrev30) * 100;
            trend = freqPercentageChange > 0 ? "up" : 
                    freqPercentageChange < 0 ? "down" : "equal";
        }
    }

    return {
        averageLength: overallAverage.toFixed(1),
        frequencyLast30: messagesLast30,
        frequencyPrev30: messagesPrev30,
        freqPercentageChange: Number(freqPercentageChange.toFixed(1)),
        trend: trend,
        totalConversations: mergedConvos.length
    };
}


function calculateEngagementRatio(conversations) {
    const senders = Object.keys(window.stats);
    if (senders.length !== 2) return null;

    let totalMessageRatio1 = 0;
    let totalMessageRatio2 = 0;
    let totalWordRatio1 = 0;
    let totalWordRatio2 = 0;
    let validConversations = 0;

    conversations.forEach(conversation => {
        // Skip if not exactly 2 participants
        const participants = new Set(conversation.map(m => m.sender));
        if (participants.size !== 2) return;

        let messages1 = 0;
        let messages2 = 0;
        let words1 = 0;
        let words2 = 0;

        // Count messages and words per sender
        conversation.forEach(message => {
            const wordCount = message.text.split(/\s+/).length;
            if (message.sender === senders[0]) {
                messages1++;
                words1 += wordCount;
            } else {
                messages2++;
                words2 += wordCount;
            }
        });

        const totalMessages = messages1 + messages2;
        const totalWords = words1 + words2;

        // Only consider conversations that meet our new criteria
        if (totalMessages >= 4 && totalWords > 0) {
            // Calculate engagement scores (weighted 50% messages, 50% words)
            const messageEngagement1 = messages1 / totalMessages;
            const messageEngagement2 = messages2 / totalMessages;
            const wordEngagement1 = words1 / totalWords;
            const wordEngagement2 = words2 / totalWords;
            
            // Combine metrics with equal weight
            totalMessageRatio1 += messageEngagement1;
            totalMessageRatio2 += messageEngagement2;
            totalWordRatio1 += wordEngagement1;
            totalWordRatio2 += wordEngagement2;
            
            validConversations++;
        }
    });

    if (validConversations === 0) {
        return {
            participant1: 50,
            participant2: 50
        };
    }

    // Calculate average engagement scores
    const avgMessageEngagement1 = (totalMessageRatio1 / validConversations) * 100;
    const avgMessageEngagement2 = (totalMessageRatio2 / validConversations) * 100;
    const avgWordEngagement1 = (totalWordRatio1 / validConversations) * 100;
    const avgWordEngagement2 = (totalWordRatio2 / validConversations) * 100;

    // Combine metrics (equal weight)
    return {
        participant1: (avgMessageEngagement1 * 0.5) + (avgWordEngagement1 * 0.5),
        participant2: (avgMessageEngagement2 * 0.5) + (avgWordEngagement2 * 0.5),
        analyzedConversations: validConversations // Add this for debugging/display
    };
}

// Add this function to fileProcessor.js
function calculateStreakStats(text) {
    const lines = text.split('\n');
    // Updated regex to support both 12-hour (with AM/PM) and 24-hour formats
    const regex = window.chatFormat === 'bracket' 
        ? /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?\] ([^:]+):/
        : /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))? - ([^:]+):/;
    
    const dailyMessages = {};
    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const num1 = match[1];
            const num2 = match[2];
            const year = match[3];
            let hour = parseInt(match[4], 10);
            const minute = match[5];
            const second = match[6] || '00';
            const period = match[7]; // AM/PM
            const sender = match[8].trim(); // Updated group index due to added AM/PM capture

            // Convert 12-hour to 24-hour format if needed
            if (period) {
                if (period === 'PM' && hour < 12) {
                    hour += 12;
                } else if (period === 'AM' && hour === 12) {
                    hour = 0;
                }
            }

            const day = window.dateFormat === 'US' ? num2 : num1;
            const month = window.dateFormat === 'US' ? num1 : num2;
            const dateKey = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            if (!dailyMessages[dateKey]) {
                dailyMessages[dateKey] = { count: 0, senders: new Set() };
            }
            dailyMessages[dateKey].count++;
            dailyMessages[dateKey].senders.add(sender);
        }
    });
    
    // Get sorted dates in ascending order.
    const sortedDates = Object.keys(dailyMessages).sort();
    
    // Filter valid dates: at least 3 messages and at least 2 different senders.
    const validDates = sortedDates.filter(date => {
        const info = dailyMessages[date];
        return info.count >= 3 && info.senders.size >= 2;
    });
    
    // Calculate consecutive streaks from validDates.
    let currentStreak = 0;
    let maxStreak = 0;
    let streakStartDate = null;
    let maxStreakStartDate = null;
    let maxStreakEndDate = null;
    
    for (let i = 0; i < validDates.length; i++) {
        const date = validDates[i];
        const currentDateObj = new Date(date);
        
        if (i === 0) {
            // First valid day starts a new streak.
            currentStreak = 1;
            streakStartDate = date;
        } else {
            const prevDate = validDates[i - 1];
            const prevDateObj = new Date(prevDate);
            // Calculate the difference in days between the current and previous valid day.
            const diffDays = (currentDateObj - prevDateObj) / (1000 * 60 * 60 * 24);
            
            if (diffDays === 1) {
                // Day is consecutive, continue the streak.
                currentStreak++;
            } else {
                // Non-consecutive day: reset streak.
                currentStreak = 1;
                streakStartDate = date;
            }
        }
        
        // Update max streak if the current streak is longer.
        if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
            maxStreakStartDate = streakStartDate;
            maxStreakEndDate = date;
        }
    }
    
    // Calculate the elapsed duration between the first and last day of the max streak.
    // For instance, a streak spanning from the 1st to the 15th has an elapsed duration of 14 days.
    maxStreak = maxStreak - 1;    
    return {
        maxStreak,             // Inclusive count of valid consecutive days.
        maxStreakStartDate,    // Start date of the max streak.
        maxStreakEndDate       // End date of the max streak.
    };
}

function calculateGhostingStats(text) {
    const lines = text.split('\n');
    const ghostingCounts = {};
    const ghostingDetails = {};
    let previousMessage = null;

    const maxResponseThreshold = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

    const closingPhrases = [
        "bye", "goodbye", "good night", "gn", "night", "see you", "cya", "later", "ttyl",
        "talk later", "g'night", "sleep well", "sweet dreams", "take care", "catch you later",
        "😘"  // Added kissing emoji
    ];
    const minWordCount = 3;
    const ghostingThreshold = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

    const regex = window.chatFormat === 'bracket' 
        ? /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?\] ([^:]+): (.+)/
        : /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))? - ([^:]+): (.+)/;
    
    const messages = [];
    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const num1 = match[1];
            const num2 = match[2];
            const year = match[3];
            const hour = match[4];
            const minute = match[5];
            const second = match[6] || '00';
            const sender = match[8].trim(); // Group 8 for sender
            const message = match[9].trim(); // Group 9 for message
            
            const day = window.dateFormat === 'US' ? num2.padStart(2, '0') : num1.padStart(2, '0');
            const month = window.dateFormat === 'US' ? num1.padStart(2, '0') : num2.padStart(2, '0');
            const timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
            messages.push({ sender, message, timestamp });
        }
    });

    messages.forEach((current, index) => {
        if (index === messages.length - 1) return;

        const next = messages[index + 1];
        const timeDiff = next.timestamp - current.timestamp;
        const words = current.message.split(/\s+/).filter(word => word.trim() !== "");
        const isClosing = closingPhrases.some(phrase => current.message.toLowerCase().includes(phrase));
        const expectsResponse = words.some(word => word.endsWith('?')) || words.length >= minWordCount;

        if (
            current.sender !== next.sender &&
            timeDiff >= ghostingThreshold &&
            timeDiff <= maxResponseThreshold &&
            words.length >= minWordCount &&
            !isClosing &&
            expectsResponse
        ) {
            const ghostedBy = next.sender;
            ghostingCounts[ghostedBy] = (ghostingCounts[ghostedBy] || 0) + 1;

            if (!ghostingDetails[ghostedBy]) ghostingDetails[ghostedBy] = [];
            ghostingDetails[ghostedBy].push({
                timestamp: current.timestamp,
                message: current.message,
                sender: current.sender,
                responseDelay: timeDiff / (60 * 60 * 1000) // Convert to hours
            });
        }
    });

    const senders = Object.keys(window.stats || {});
    if (senders.length !== 2) return null;

    const [personA, personB] = senders;
    const countA = ghostingCounts[personA] || 0;
    const countB = ghostingCounts[personB] || 0;
    const total = countA + countB;

    const percentageA = total > 0 ? ((countA / total) * 100).toFixed(1) : 50;
    const percentageB = total > 0 ? ((countB / total) * 100).toFixed(1) : 50;

    return {
        ghosting: {
            participantA: {
                count: countA,
                percentage: parseFloat(percentageA),
                details: ghostingDetails[personA] || []
            },
            participantB: {
                count: countB,
                percentage: parseFloat(percentageB),
                details: ghostingDetails[personB] || []
            },
            analysis: total > 0
                ? `Analysis based on ${total} detected ghosting incidents where a message was unanswered for 3+ hours.`
                : "No significant ghosting incidents detected (messages with 10+ words unanswered for 3+ hours)."
        }
    };
}

export function calculateResponseTimes(text) {
    const lines = text.split('\n');
    const regex = window.chatFormat === 'bracket'
        ? /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))?\] ([^:]+): (.*)/
        : /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s(AM|PM))? - ([^:]+): (.*)/;

    const closingPatterns = [
        /^bye\b/i, /^goodbye\b/i, /\bthanks?\b/i, /\bthank you\b/i, /\bsee you\b/i,
        /\bttyl\b/i, /\bgood night\b/i, /\bgood morning\b/i, /\bgood afternoon\b/i,
        /later\b/i, /\bcatch you later\b/i, /\bsee you later\b/i, /\bgn\b/i, /\bnight\b/i,
        /\bbye for now\b/i, /\bciao\b/i, /\bcheers\b/i, /\bpeace\b/i, /\bOk\b/i, /\bAlright\b/i,
        /\bSure\b/i, /\b👌\b/i, /\b👍\b/i, /\bthx\b/i, /\bk\b/i, /\bkk\b/i, /\bgot it\b/i,
        /\byes\b/i, /😘/
    ];

    const maxResponseThreshold = 5 * 24 * 60 * 60 * 1000; // 5 days in ms
    const stats = {};
    const messages = [];

    // Step 1: Parse all messages
    for (const line of lines) {
        const match = line.match(regex);
        if (!match) continue;

        // Group indices depend on whether we have seconds and AM/PM
        let groups;
        if (window.chatFormat === 'bracket') {
            groups = {
                day: match[1],
                month: match[2],
                year: match[3],
                hour: match[4],
                minute: match[5],
                second: match[6] || '00',
                period: match[7],
                sender: match[8].trim(),
                content: match[9].trim()
            };
        } else { // android format
            groups = {
                day: match[1],
                month: match[2],
                year: match[3],
                hour: match[4],
                minute: match[5],
                second: match[6] || '00',
                period: match[7],
                sender: match[8].trim(),
                content: match[9].trim()
            };
        }

        // Convert 12-hour to 24-hour format if needed
        let hour = parseInt(groups.hour, 10);
        if (groups.period) {
            if (groups.period === 'PM' && hour < 12) {
                hour += 12;
            } else if (groups.period === 'AM' && hour === 12) {
                hour = 0;
            }
        }

        const day = window.dateFormat === 'US' ? groups.month.padStart(2, '0') : groups.day.padStart(2, '0');
        const month = window.dateFormat === 'US' ? groups.day.padStart(2, '0') : groups.month.padStart(2, '0');
        const timestamp = new Date(`${groups.year}-${month}-${day}T${hour.toString().padStart(2, '0')}:${groups.minute}:${groups.second}`).getTime();
        
        if (!isNaN(timestamp)) {
            messages.push({ 
                sender: groups.sender, 
                content: groups.content, 
                timestamp 
            });
        }
    }

    // Rest of the function remains the same...
    // Step 2: Sort messages by timestamp to ensure chronological order
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // Step 3: Analyze response times
    let prevSender = null;
    let prevTimestamp = null;
    let prevContent = null;

    for (const { sender, content, timestamp } of messages) {
        if (
            prevSender &&
            sender !== prevSender &&
            !closingPatterns.some(pattern => pattern.test(prevContent))
        ) {
            const diffMs = timestamp - prevTimestamp;
            const diffMinutes = diffMs / (1000 * 60);

            if (diffMs > 0 && diffMs <= maxResponseThreshold) {
                if (!stats[prevSender]) {
                    stats[prevSender] = { totalTime: 0, count: 0 };
                }

                stats[prevSender].totalTime += diffMinutes;
                stats[prevSender].count++;
            }
        }

        prevSender = sender;
        prevTimestamp = timestamp;
        prevContent = content;
    }

    // Step 4: Calculate average times
    const simplified = {};
    for (const [sender, data] of Object.entries(stats)) {
        const avg = data.count > 0 ? Math.round(data.totalTime / data.count) : 0;
        simplified[sender] = { averageTime: avg };
    }

    return simplified;
}

function createDonutSegment(cx, cy, r_outer, r_inner, startAngle, endAngle, color) {
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const x1 = cx + r_outer * Math.cos(startRad);
    const y1 = cy + r_outer * Math.sin(startRad);
    const x2 = cx + r_outer * Math.cos(endRad);
    const y2 = cy + r_outer * Math.sin(endRad);
    const x3 = cx + r_inner * Math.cos(endRad);
    const y3 = cy + r_inner * Math.sin(endRad);
    const x4 = cx + r_inner * Math.cos(startRad);
    const y4 = cy + r_inner * Math.sin(startRad);
    const largeArc = (endAngle - startAngle > 180) ? 1 : 0;
    const path = `
        M ${x1} ${y1}
        A ${r_outer} ${r_outer} 0 ${largeArc} 1 ${x2} ${y2}
        L ${x3} ${y3}
        A ${r_inner} ${r_inner} 0 ${largeArc} 0 ${x4} ${y4}
        Z
    `;
    return `<path d="${path.trim()}" fill="${color}" />`;
}

function createDonutChart(rawA, rawB, colorA, colorB) {
    let a = parseFloat(rawA);
    let b = parseFloat(rawB);

    if (isNaN(a)) a = 0;
    if (isNaN(b)) b = 0;
    const total = a + b;

    if (total === 0) {
        console.warn('No valid data for donut chart:', { rawA, rawB });
        const segmentA = createDonutSegment(50, 50, 45, 30, 0, 180, colorA || '#3d9c7d');
        const segmentB = createDonutSegment(50, 50, 45, 30, 180, 360, colorB || '#ff6b6b');
        return ``;
    }

    let angleA, angleB;
    if (total === 0) {
          console.warn('createDonutChart saw total=0 — rawA, rawB =', rawA, rawB);

        // split the donut in half
        angleA = 180;
        angleB = 180;
    } else {
        angleA = (a / total) * 360;
        angleB = 360 - angleA;
    }

  const segmentA = createDonutSegment(50, 50, 45, 30, 0,       angleA, colorA);
  const segmentB = createDonutSegment(50, 50, 45, 30, angleA, angleA + angleB, colorB);

  return `
    <svg viewBox="0 0 100 100">
      ${segmentA}
      ${segmentB}
    </svg>
  `;
}


function renderEmotionalHeatmap(heatmapData, person1, person2) {
    const container = document.createElement('div');
    container.className = 'emotional-heatmap-container';

    // Create legend
    const legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    legend.innerHTML = `
        <div class="legend-item">
            <div class="legend-color negative"></div>
            <span>Negative</span>
        </div>
        <div class="legend-item">
            <div class="legend-color neutral"></div>
            <span>Neutral</span>
        </div>
        <div class="legend-item">
            <div class="legend-color positive"></div>
            <span>Positive</span>
        </div>
        <div class="legend-item">
            <div class="legend-color love"></div>
            <span>Love</span>
        </div>
    `;
    container.appendChild(legend);

    // Create heatmap bars
    const heatmap = document.createElement('div');
    heatmap.className = 'heatmap-bars';

    heatmapData.forEach((score, index) => {
        let color;

        if (score <= 2) {
            // Red to orange (very negative to mildly negative)
            const t = score / 2;
            color = `rgb(255, ${Math.round(80 + 100 * t)}, 0)`; // red to dark orange
        } else if (score <= 4) {
            // Orange to yellow to gray (approaching neutral)
            const t = (score - 2) / 2;
            const r = Math.round(255 - 55 * t);
            const g = Math.round(180 + 50 * t);
            color = `rgb(${r}, ${g}, 100)`; // orange → olive → beige-gray
        } else if (score <= 6) {
            // Grey zone (neutral area)
            const grey = Math.round(160 + (score - 4) * 20);
            color = `rgb(${grey}, ${grey}, ${grey})`;
        } else if (score <= 8) {
            // Neutral to green (mildly positive to strongly positive)
            const t = (score - 6) / 2;
            const r = Math.round(160 - 80 * t);
            const g = Math.round(200 + 55 * t);
            color = `rgb(${r}, ${g}, 160)`; // grayish → light green → brighter green
        } else if (score < 10) {
            // Green to soft purple (positive)
            const t = (score - 8) / 2;
            const r = Math.round(160 + 40 * t);
            const g = Math.round(255 - 100 * t);
            const b = Math.round(200 + 30 * t);
            color = `rgb(${r}, ${g}, ${b})`; // pastel green to soft pinkish
        } else {
            // Score == 10 → distinct love pink
            color = '#ff69b4'; // hot pink
        }

        const bar = document.createElement('div');
        bar.className = 'heatmap-bar';
        bar.style.backgroundColor = color;
        bar.title = `Segment ${index + 1}: ${score.toFixed(1)}`;
        heatmap.appendChild(bar);
    });

    container.appendChild(heatmap);

    // Add heatmap timeline labels
    const timeline = document.createElement('div');
    timeline.className = 'heatmap-timeline';
    timeline.innerHTML = `
        <span>Start</span>
        <span>End</span>
    `;
    container.appendChild(timeline);

    return container;
}



function displayAIResults(data, originalNames) {

    const nameA = originalNames?.personA || (data.participants?.[0]?.name || "Participant A");
    const nameB = originalNames?.personB || (data.participants?.[1]?.name || "Participant B");

    window.emotionalHeatmap = data.emotionalHeatmap || null;


    const callId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const aiSection = document.getElementById("aiAnalysisSection");
    if (!aiSection) {
        console.error('AI Analysis Section not found in DOM');
        return;
    }


    const ghostingStats = window.ghostingStats || calculateGhostingStats(window.chatText);
    console.log(`Raw AI Response [Call ID: ${callId}]:`, JSON.stringify(data, null, 2));

    const loadingContainer = document.getElementById("aiLoadingContainer");
    if (loadingContainer) {
        loadingContainer.remove();
    }

    const titleEl = document.createElement("h2");
    titleEl.className = "title gradient-text";
    titleEl.textContent = "Deep AI";
    aiSection.insertBefore(titleEl, aiSection.firstChild);

    const oldResults = aiSection.querySelectorAll(".analysis-result");
    oldResults.forEach(el => el.remove());

    const overallContainer = document.createElement("div");
    overallContainer.className = "ai-results-container analysis-result";
    overallContainer.innerHTML = `
        <div class="ai-section">
            <h3>Overall Connection</h3>
            <p><strong>${data.overallConnection?.label || 'N/A'}</strong></p>
            <p>${data.overallConnection?.explanation || 'No explanation available'}</p>
        </div>
        <div class="ai-section">
            <h3>Evolution</h3>
            <p>${data.evolution?.description || 'No evolution analysis available'}</p>
        </div>
    `;
    aiSection.appendChild(overallContainer);

    if (data.chatOverview?.description) {
        const chatOverviewContainer = document.createElement("div");
        chatOverviewContainer.className = "ai-results-container analysis-result";
        chatOverviewContainer.innerHTML = `
            <div class="ai-section">
                <h3>Chat Overview</h3>
                <p>${data.chatOverview.description}</p>
            </div>
        `;
        aiSection.appendChild(chatOverviewContainer);
    }

    


  // ─── NORMALIZE AI PAYLOAD ─────────────────────────────────────────────
    // Get participant names from originalNames first, then fall back to data.participants
    
    // Normalize responseAnalysis
    if (data.responseAnalysis) {
        const raKeys = Object.keys(data.responseAnalysis);
        if (raKeys.length === 2) {
            // If we have exactly 2 keys, assume they're the participants
            const [raKey1, raKey2] = raKeys;
            data.responseAnalysis = {
                [nameA]: data.responseAnalysis[raKey1],
                [nameB]: data.responseAnalysis[raKey2]
            };
        } else {
            // Fallback to participantA/B structure
            data.responseAnalysis = {
                [nameA]: data.responseAnalysis?.participantA || null,
                [nameB]: data.responseAnalysis?.participantB || null
            };
        }
    }

    // Normalize conversationDynamics
    if (data.conversationDynamics) {
        const init = data.conversationDynamics.initiation || {};
        const endd = data.conversationDynamics.ending || {};
        
        data.conversationDynamics = {
            initiation: {
                participantA: Number(init[nameA] ?? init.participantA ?? 0),
                participantB: Number(init[nameB] ?? init.participantB ?? 0),
                analysis: init.analysis || ""
            },
            ending: {
                participantA: Number(endd[nameA] ?? endd.participantA ?? 0),
                participantB: Number(endd[nameB] ?? endd.participantB ?? 0),
                analysis: endd.analysis || ""
            }
        };
    }

    const respCont = document.createElement("div");
respCont.className = "ai-results-container analysis-result";

const raSec = document.createElement("div");
raSec.className = "ai-section";
raSec.innerHTML = `<h3>Response Times</h3>`;

const raA = data.responseAnalysis?.[nameA];
const raB = data.responseAnalysis?.[nameB];

if (raA?.explanation) {
    raSec.appendChild(createAnalysisContent(nameA, raA));
}

if (raB?.explanation) {
    raSec.appendChild(createAnalysisContent(nameB, raB));
}


respCont.appendChild(raSec);
aiSection.appendChild(respCont);



    // Handle Conversation Dynamics with improved validation
    // Conversation Dynamics (always render)
    const dyn = data.conversationDynamics || {};
    const init = dyn.initiation || {};
    const endd = dyn.ending || {};
    

   const dynCont = document.createElement("div");
    dynCont.className = "ai-results-container analysis-result";

        // Raw numeric values looked up by name
    const { initiation, ending } = data.conversationDynamics;
  const initA = initiation.participantA;
  const initB = initiation.participantB;
  const endA  = ending.participantA;
  const endB  = ending.participantB;
  const initAnalysis = initiation.analysis;
  const endAnalysis  = ending.analysis;

    // Initiation chart
    const initSec = document.createElement("div");
    initSec.className = "ai-section";
    initSec.innerHTML = `<h3>Who is the biggest conversation initiator?</h3>`;
    const initContent = document.createElement("div");
    initContent.className = "analysis-content";

    // Text side
    const textEl = document.createElement("div");
    textEl.className = "analysis-text";
  textEl.innerHTML = `<p>${initAnalysis || 'No initiation analysis available'}</p>`;

    // Chart side: only chart if we have real data
    const chartEl = document.createElement("div");
    chartEl.className = "analysis-chart";
    if (initA > 0 || initB > 0) {
      chartEl.innerHTML = createDonutChart(initA, initB, window.colors[nameA], window.colors[nameB]);
    } else {
      // remove the chart entirely if you prefer:
      chartEl.remove();
      textEl.innerHTML = '<p>No initiation data to display</p>';
    }

    initContent.appendChild(textEl);
    initContent.appendChild(chartEl);
    initSec.appendChild(initContent);
    dynCont.appendChild(initSec);

    // Ending chart—same pattern
    const endSec = document.createElement("div");
    endSec.className = "ai-section";
    endSec.innerHTML = `<h3>Who ended the most conversations?</h3>`;
    const endContent = document.createElement("div");
    endContent.className = "analysis-content";

    const endText = document.createElement("div");
    endText.className = "analysis-text";
  endText.innerHTML = `<p>${endAnalysis || 'No ending analysis available'}</p>`;

    const endChart = document.createElement("div");
    endChart.className = "analysis-chart";
    if (endA > 0 || endB > 0) {
      endChart.innerHTML = createDonutChart(endA, endB, window.colors[nameA], window.colors[nameB]);
    } else {
      endChart.remove();
      endText.innerHTML = '<p>No ending data to display</p>';
    }

    endContent.appendChild(endText);
    endContent.appendChild(endChart);
    endSec.appendChild(endContent);
    dynCont.appendChild(endSec);

    console.log('🔍 convDyn raw:', init, endd, 'computed:', { initA, initB, endA, endB });

    // Only append the Conversation Dynamics section if there’s *some* real data
    const hasInitData = initA + initB > 0;
   const hasEndData  = endA  + endB > 0;
    if (hasInitData || hasEndData) {
      aiSection.appendChild(dynCont);
    } else {
      console.warn('Skipping Conversation Dynamics: no data --', { hasInitData, hasEndData });
    }

    if (ghostingStats && data.participants?.length === 2) {
        const ghostingContainer = document.createElement("div");
        ghostingContainer.className = "ai-results-container analysis-result";

        const nameA = originalNames?.personA || data.participants[0]?.name || "Participant 1";
        const nameB = originalNames?.personB || data.participants[1]?.name || "Participant 2";

        const ghostingSection = document.createElement("div");
        ghostingSection.className = "ai-section";
        ghostingSection.innerHTML = `
            <h3>Who ghosted more often?</h3>
            <div class="analysis-content">
                <div class="analysis-text">
                    <p>${ghostingStats.ghosting.analysis || 'No ghosting analysis available'}</p>
                </div>
                <div class="analysis-chart">
                    ${createDonutChart(
                        ghostingStats.ghosting.participantA.percentage,
                        ghostingStats.ghosting.participantB.percentage,
                        window.colors[nameA] || '#3d9c7d',
                        window.colors[nameB] || '#ff6b6b'
                    )}
                </div>
            </div>
            <div class="ghosting-counts">
                <div class="ghosting-count-container">
                    <div class="ghosting-count">
                        <span class="label">${nameA}:</span>
                        <span class="count">${ghostingStats.ghosting.participantA.count}</span>
                        <span class="unit">times</span>
                    </div>
                </div>
                <div class="ghosting-count-container">
                    <div class="ghosting-count">
                        <span class="label">${nameB}:</span>
                        <span class="count">${ghostingStats.ghosting.participantB.count}</span>
                        <span class="unit">times</span>
                    </div>
                </div>
            </div>
        `;
        ghostingContainer.appendChild(ghostingSection);
        aiSection.appendChild(ghostingContainer);
    }

    if (data.emotionalHeatmap && data.emotionalHeatmap.length === 10) {
        const heatmapContainer = document.createElement("div");
        heatmapContainer.className = "ai-results-container analysis-result";
        
        const heatmapSection = document.createElement("div");
        heatmapSection.className = "ai-section";
        heatmapSection.innerHTML = `<h3>Emotional Heatmap</h3>`;
        
        const heatmap = renderEmotionalHeatmap(
            data.emotionalHeatmap,
            originalNames.personA,
            originalNames.personB
        );
        
        heatmapSection.appendChild(heatmap);
        heatmapContainer.appendChild(heatmapSection);
        aiSection.appendChild(heatmapContainer);
    }

    if (window.chatFocusPercentages && Object.keys(window.stats).length === 2) {
        const nameA = originalNames?.personA || (data.participants?.[0]?.name || "Participant A");
        const nameB = originalNames?.personB || (data.participants?.[1]?.name || "Participant B");

        // Create the AI-styled container
        const focusContainer = document.createElement("div");
        focusContainer.className = "ai-results-container analysis-result";

        // Build the content inside the container
        const focusContent = `
            <div class="ai-section">
                <h3>Who the chat focuses on the most?</h3>
                <div class="analysis-content">
                    <div class="analysis-text">
                        <p>${nameA} focuses on ${nameB} ${window.chatFocusPercentages.personB}% of the time, 
                        while ${nameB} focuses on ${nameA} ${window.chatFocusPercentages.personA}% of the time.</p>
                    </div>
                    <div class="analysis-chart">
                        ${createDonutChart(
                            window.chatFocusPercentages.personA,
                            window.chatFocusPercentages.personB,
                            window.colors[nameA] || '#3d9c7d',
                            window.colors[nameB] || '#ff6b6b'
                        )}
                    </div>
                </div>
                <div class="focus-counts">
                    <div class="focus-count-container">
                        <div class="focus-count">
                            <span class="focus-color" style="background-color: ${window.colors[nameA] || '#3d9c7d'}"></span>
                            <span class="label">${nameA}:</span>
                            <span class="percentage">${window.chatFocusPercentages.personA}%</span>
                        </div>
                    </div>
                    <div class="focus-count-container">
                        <div class="focus-count">
                            <span class="focus-color" style="background-color: ${window.colors[nameB] || '#ff6b6b'}"></span>
                            <span class="label">${nameB}:</span>
                            <span class="percentage">${window.chatFocusPercentages.personB}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        focusContainer.innerHTML = focusContent;

        // Append the styled container to the AI section
        aiSection.appendChild(focusContainer);
    }

    // Add Engagement Chart (right after chat focus)
if (window.engagementData) {
    const engagementContainer = document.createElement("div");
    engagementContainer.className = "ai-results-container analysis-result";
    
    const nameA = originalNames?.personA || (data.participants?.[0]?.name || "Participant A");
    const nameB = originalNames?.personB || (data.participants?.[1]?.name || "Participant B");
    
    engagementContainer.innerHTML = `
        <div class="ai-section">
            <h3>Who is the most engaged during conversations?</h3>
            <div class="analysis-content">
                <div class="analysis-text">
                    <p>${nameA} was more engaged in ${window.engagementData.participant1.toFixed(1)}% of conversations, 
                    while ${nameB} was more engaged in ${window.engagementData.participant2.toFixed(1)}% of conversations.</p>
                </div>
                <div class="analysis-chart">
                    ${createDonutChart(
                        window.engagementData.participant1,
                        window.engagementData.participant2,
                        window.colors[nameA] || '#3d9c7d',
                        window.colors[nameB] || '#ff6b6b'
                    )}
                </div>
            </div>
            <div class="engagement-counts">
                <div class="engagement-count-container">
                    <div class="engagement-count">
                        <span class="engagement-color" style="background-color: ${window.colors[nameA] || '#3d9c7d'}"></span>
                        <span class="label">${nameA}:</span>
                        <span class="percentage">${window.engagementData.participant1.toFixed(1)}%</span>
                    </div>
                </div>
                <div class="engagement-count-container">
                    <div class="engagement-count">
                        <span class="engagement-color" style="background-color: ${window.colors[nameB] || '#ff6b6b'}"></span>
                        <span class="label">${nameB}:</span>
                        <span class="percentage">${window.engagementData.participant2.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    aiSection.appendChild(engagementContainer);
}


    let participantA = null;
    let participantB = null;

    if (data.participants?.length === 2) {
        const [p1, p2] = data.participants;

        const score1A = stringSimilarity(p1.name, originalNames.personA);
        const score1B = stringSimilarity(p1.name, originalNames.personB);
        const score2A = stringSimilarity(p2.name, originalNames.personA);
        const score2B = stringSimilarity(p2.name, originalNames.personB);

        if (score1A + score2B > score1B + score2A) {
            participantA = p1;
            participantB = p2;
        } else {
            participantA = p2;
            participantB = p1;
        }

        participantA.name = originalNames.personA;
        participantB.name = originalNames.personB;

        [participantA, participantB].forEach((participant) => {
            const participantContainer = document.createElement("div");
            participantContainer.className = "ai-results-container analysis-result";
            participantContainer.innerHTML = `
                <div class="participant-analysis">
                    <h3>${participant.name}'s Analysis</h3>
                    <div class="interest-level">Interest: ${participant.interestLevel}/10</div>
                    <div class="communication-style">
                        <h4>Communication Style</h4>
                        <p>${participant.communicationStyle?.generalTraits || 'N/A'}</p>
                        <p>${participant.communicationStyle?.trustAndEmotionalDepth || 'N/A'}</p>
                    </div>
                    <div class="flags-section">
                        <div class="green-flags">
                            <h4>Green Flags</h4>
                            ${participant.greenFlags?.map(flag => `
                                <div class="flag-item green-flag">
                                    <strong>${flag.title || 'Positive'}:</strong> ${flag.description || 'N/A'}
                                </div>
                            `).join('') || '<p>No green flags identified</p>'}
                        </div>
                        <div class="red-flags">
                            <h4>Red Flags</h4>
                            ${participant.redFlags?.map(flag => `
                                <div class="flag-item red-flag">
                                    <strong>${flag.title || 'Concern'}:</strong> ${flag.description || 'N/A'}
                                </div>
                            `).join('') || '<p>No red flags identified</p>'}
                        </div>
                    </div>
                    <div class="relationship-tip">
                        <h4>Relationship Tip</h4>
                        <div class="tip-item">
                            <strong>${participant.relationshipTip?.title || 'Suggestion'}:</strong>
                            ${participant.relationshipTip?.description || 'N/A'}
                        </div>
                    </div>
                </div>
            `;
            aiSection.appendChild(participantContainer);
        });
    }

    aiSection.classList.add('ai-analysis-complete');


    showAnalysisCompletedPopup();
    (async () => {
        const user = JSON.parse(localStorage.getItem('user') || {});
        const id = window.currentAnalysisId;
        if (!user.sub || !id) return;

        const timelineHTML = document.getElementById('timelineSection').outerHTML;
        const chatHTML = document.getElementById('chatAnalyticsSection').outerHTML;
        const finalHTML = timelineHTML + chatHTML;

        try {
            await updateAnalysisHTML(user.sub, id, finalHTML, false);
            console.log('✅ AI analysis appended to existing record');
        } catch (err) {
            console.error('❌ Failed to update AI HTML:', err);
        }
    })();
}


function showAnalysisCompletedPopup() {
    const popup = document.createElement("div");
    popup.className = "ai-popup";
    popup.innerHTML = `
        <div class="ai-popup-content">
            <div class="ai-popup-progress">
                <div class="ai-popup-progress-bar"></div>
            </div>
            <div class="ai-popup-header">
                <h3 class="ai-popup-title">AI Analysis Completed</h3>
                <button class="close-popup" onclick="this.closest('.ai-popup').remove()">×</button>
            </div>
            <p class="ai-popup-message">Your chat analysis is now available below</p>
            <div class="ai-popup-footer">
                <a href="#aiAnalysisSection" class="ai-popup-button">View Results Now</a>
            </div>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    // Remove the popup after animation completes
    setTimeout(() => {
        if (popup.parentElement) {
            popup.parentElement.removeChild(popup);
        }
    }, 3000);
    
    // Also remove when clicking outside
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.remove();
        }
    });
}

// Helper function for string similarity comparison
function stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    str1 = str1.toLowerCase().trim();
    str2 = str2.toLowerCase().trim();

    // Exact match
    if (str1 === str2) return 1;

    // First word match
    const str1FirstWord = str1.split(' ')[0];
    const str2FirstWord = str2.split(' ')[0];
    if (str1FirstWord === str2FirstWord) return 0.9;

    // Partial match (contains)
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;

    // Abbreviation or prefix match
    if (str1.startsWith(str2FirstWord) || str2.startsWith(str1FirstWord)) return 0.7;

    // Fallback: use a simple Levenshtein distance
    const maxLen = Math.max(str1.length, str2.length);
    const distance = levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
}

function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

// In parallax.js, add this helper function
async function getUncompressedTextSize(file) {
    if (file.name.endsWith('.zip')) {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const txtFile = Object.keys(zip.files).find(f => f.endsWith('.txt'));
        if (!txtFile) return file.size; // fallback to compressed size if no txt found
        return zip.files[txtFile]._data.uncompressedSize;
    }
    return file.size; // for .txt files, use the actual size
}

let aiClickTimeout = null;
// Replace your existing handleAIClick with this:


let isProcessingAI = false;

async function handleAIClick() {

    if (isProcessingAI) return;
    isProcessingAI = true;


    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) return;

    const processButton = document.getElementById('processButton');
    if (processButton) {
        processButton.disabled = true;
        processButton.classList.add('processing');
    }

    const user = JSON.parse(localStorage.getItem('user') || {});
    const aiToggle = document.getElementById('aiToggle');
    if (aiToggle && !aiToggle.checked) {
        // If they toggled AI off mid-flow, just clean up any loading UI
        const loading = document.getElementById('aiLoadingContainer');
        if (loading) loading.remove();
        return;
    }

    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) {
        showErrorPopup('Please select a file first.');
        return;
    }

    const file = fileInput.files[0];
    const creditsNeeded = window.currentCreditsNeeded || 1;
    const credits = await checkUserCredits(user.sub);

    // === NEW: Prevent AI call when not enough credits ===
    if (credits < creditsNeeded) {
        showNoCreditsPopup(creditsNeeded, credits);
        return;
    }

    // === Otherwise, proceed with AI analysis ===
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            // extract chat text (zip or plain)…
            let text;
            if (file.name.endsWith('.zip')) {
                const zip = await JSZip.loadAsync(event.target.result);
                const txtFile = Object.keys(zip.files).find(f => f.endsWith('.txt'));
                if (!txtFile) throw new Error('No .txt file in ZIP');
                text = await zip.files[txtFile].async('text');
            } else {
                text = event.target.result;
            }

            // preprocess and guard group vs. 2-party…
            const pre = preprocessChatForAI(text);
            if (!pre) {
                showGroupChatNoAIPopup();
                return;
            }

            
            const results = await analyzeWithAI(pre.processedText, text);

            // deduct credits only on success
            const ok = await deductCredit(user.sub, creditsNeeded);
            if (!ok) console.error('Credit deduction failed');

            displayAIResults(results, pre.originalNames);

        } catch (err) {
            console.error('AI analysis failed:', err);
            renderAIError(err.message);
        } finally {
            isProcessingAI = false;
        if (processButton) {
            processButton.disabled = false;
            processButton.classList.remove('processing');
        }
    }
    };

    if (file.name.endsWith('.zip')) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}


function createAnalysisContent(name, analysis) {
    const contentDiv = document.createElement("div");
    contentDiv.className = "analysis-content";

    const textDiv = document.createElement("div");
    textDiv.className = "analysis-text";
    const p = document.createElement("p");
    p.innerHTML = `<strong>${name}:</strong> ${analysis.explanation || "No response pattern provided"}`;
    textDiv.appendChild(p);
    contentDiv.appendChild(textDiv);

    // Only add response time if we have window.responseTimeStats
    if (window.responseTimeStats?.[name]) {
        const timeContainer = document.createElement("div");
        timeContainer.className = "response-time-container";
        const timeDiv = document.createElement("div");
        timeDiv.className = "analysis-response-time";
        
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = "Avg resp:";
        
        const time = document.createElement("span");
        time.className = "time";
        time.textContent = window.responseTimeStats[name].averageTime.toFixed(1);
        
        const unit = document.createElement("span");
        unit.className = "unit";
        unit.textContent = "min";
        
        timeDiv.appendChild(label);
        timeDiv.appendChild(time);
        timeDiv.appendChild(unit);
        timeContainer.appendChild(timeDiv);
        contentDiv.appendChild(timeContainer);
    }

    return contentDiv;
}


function renderAIAnalysisSection() {
    // Remove any existing AI Analysis section if present
    let existingSection = document.getElementById("aiAnalysisSection");
    if (existingSection) existingSection.remove();
    
    // Create a new container for the AI analysis section
    const aiSection = document.createElement("div");
    aiSection.id = "aiAnalysisSection";
    aiSection.className = "ai-analysis-section";
    
    // Get participant names (if available)
    const people = Object.keys(window.stats || {});
    const person1 = people[0] || "Participant 1";
    const person2 = people[1] || "Participant 2";
    
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    if (isLoggedIn) {
        // Check the initial toggle state
        const aiToggle = document.getElementById('aiToggle');
        const shouldShowAI = aiToggle ? aiToggle.checked : true;
        
        // Check user credits
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const credits = parseInt(localStorage.getItem('userCredits') || '0', 10);
        const needed = window.currentCreditsNeeded || 1;
        
        if (shouldShowAI && credits >= needed) {
            // Only show loading container if they have enough credits
            const analysisContainer = document.createElement("div");
            analysisContainer.className = "ai-analysis-container";
            analysisContainer.innerHTML = `
                <div id="aiLoadingContainer" class="ai-results-container loading">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Analyzing with AI...</div>
                </div>
            `;
            aiSection.appendChild(analysisContainer);
            
            // Auto-start the AI analysis after a short delay
            setTimeout(() => {
                handleAIClick();
            }, 500);
        } else {
            aiSection.innerHTML = `
            <h2 class="title gradient-text">Deep AI</h2>
            <div class="ai-analysis-container">
                <!-- Overall Connection and Evolution -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Overall Connection</h3>
                        <div class="blurred-background">
                            <div class="blurred-content">
                                <p><strong>Close Friends</strong></p>
                                <p>The chat log reveals a long-standing friendship with a high degree of familiarity, inside jokes, shared experiences, and mutual support, even amidst playful teasing and occasional conflict.</p>
                            </div>
                        </div>
                    </div>
                    <div class="ai-section">
                        <h3>Evolution</h3>
                        <div class="blurred-background">
                            <div class="blurred-content">
                                <p>Initially, the interaction centers around a shared concern about a school-related event. As the chat progresses, the communication becomes more casual and playful, marked by frequent use of emojis and inside jokes. There are periods of intense engagement, followed by longer gaps in communication. Later exchanges delve into more personal matters, including relationship advice and emotional support. The final stages show a return to more casual banter, demonstrating the resilience of their friendship.</p>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>You don't have enough credits for AI analysis</p>
                            <a href="/credits.html" class="buy-credits-button">Buy Credits</a>
                        </div>
                    </div>
                </div>
                <!-- Chat Overview -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Chat Overview</h3>
                        <div class="blurred-background">
                            <div class="blurred-content">
                                <p>The conversation spans several months and covers a wide range of topics, including school-related events (tests, homework, teachers), shared activities (gaming, sleepovers), personal struggles (challenges, relationships), and inside jokes. The overall mood fluctuates between playful banter, serious discussions, and moments of frustration. Both participants are highly engaged, with frequent exchanges and multimedia sharing. Recurring themes include their competitive nature, anxieties about school performance, and their complex relationship dynamics with other individuals in their social circle. A significant portion of the conversation revolves around a self-imposed challenge to abstain from a certain activity, and the subsequent reactions and support between the two.</p>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>You don't have enough credits for AI analysis</p>
                            <a href="/credits.html" class="buy-credits-button">Buy Credits</a>
                        </div>
                    </div>
                </div>
                <!-- Response Analysis -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Response Times</h3>
                        <div class="analysis-content">
                            <div class="analysis-text blurred-content">
                                <p><strong>${person1}:</strong> Typically responds within 15-30 minutes, with occasional faster replies during active conversations. Shows consistent engagement patterns throughout the day.</p>
                            </div>
                            <div class="analysis-response-time blurred-content">
                                <span class="label">Avg resp:</span>
                                <span class="time">17</span>
                                <span class="unit">min</span>
                            </div>
                        </div>
                        <div class="analysis-content">
                            <div class="analysis-text blurred-content">
                                <p><strong>${person2}:</strong> Response times vary more significantly, from immediate replies to several hours. Most active in evenings and weekends.</p>
                            </div>
                            <div class="analysis-response-time blurred-content">
                                <span class="label">Avg resp:</span>
                                <span class="time">42</span>
                                <span class="unit">min</span>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>You don't have enough credits for AI analysis</p>
                            <a href="/credits.html" class="buy-credits-button">Buy Credits</a>
                        </div>
                    </div>
                </div>
                <!-- Conversation Dynamics -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Conversation Dynamics</h3>
                        <div class="sub-section">
                            <h4>Who initiates more conversations?</h4>
                            <div class="analysis-content">
                                <div class="analysis-text blurred-content">
                                    <p>While Anatole initiates slightly more conversations, the difference is not substantial. Both participants seem comfortable initiating conversations, suggesting a balanced dynamic.</p>
                                </div>
                                <div class="analysis-chart strong-chart-blur">
                                    ${createDonutChart(
                                        Math.floor(Math.random() * 61) + 20,
                                        Math.floor(Math.random() * 61) + 20,
                                        window.colors[person1] || '#3d9c7d',
                                        window.colors[person2] || '#ff6b6b'
                                    )}
                                </div>
                            </div>
                        </div>
                        <div class="sub-section">
                            <h4>Who ends more conversations?</h4>
                            <div class="analysis-content">
                                <div class="analysis-text blurred-content">
                                    <p>Anatole ends conversations slightly more often, often due to lack of response from Jamz. However, both participants contribute to the natural conclusion of conversations.</p>
                                </div>
                                <div class="analysis-chart strong-chart-blur">
                                    ${createDonutChart(
                                        Math.floor(Math.random() * 61) + 20,
                                        Math.floor(Math.random() * 61) + 20,
                                        window.colors[person1] || '#3d9c7d',
                                        window.colors[person2] || '#ff6b6b'
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>You don't have enough credits for AI analysis</p>
                            <a href="/credits.html" class="buy-credits-button">Buy Credits</a>
                        </div>
                    </div>
                </div>
                <!-- Emotional Heatmap -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Emotional Heatmap</h3>
                        <div class="emotional-heatmap-container">
                            <div class="heatmap-legend">
                                <div class="legend-item">
                                    <div class="legend-color negative"></div>
                                    <span>Negative</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color neutral"></div>
                                    <span>Neutral</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color positive"></div>
                                    <span>Positive</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color love"></div>
                                    <span>Love</span>
                                </div>
                            </div>
                            <div class="heatmap-bars strong-chart-blur">
                                ${[3, 5, 7, 8, 6, 4, 9, 7, 6, 8].map(score => {
                                    let color;
                                    if (score <= 2) color = `rgb(255, ${Math.round(80 + 100 * (score/2))}, 0)`;
                                    else if (score <= 4) color = `rgb(${Math.round(255 - 55 * ((score-2)/2))}, ${Math.round(180 + 50 * ((score-2)/2))}, 100)`;
                                    else if (score <= 6) {
                                        const grey = Math.round(160 + (score - 4) * 20);
                                        color = `rgb(${grey}, ${grey}, ${grey})`;
                                    }
                                    else if (score <= 8) color = `rgb(${Math.round(160 - 80 * ((score-6)/2))}, ${Math.round(200 + 55 * ((score-6)/2))}, 160)`;
                                    else if (score < 10) color = `rgb(${Math.round(160 + 40 * ((score-8)/2))}, ${Math.round(255 - 100 * ((score-8)/2))}, ${Math.round(200 + 30 * ((score-8)/2))})`;
                                    else color = '#ff69b4';
                                    return `<div class="heatmap-bar" style="background-color: ${color}"></div>`;
                                }).join('')}
                            </div>
                            <div class="heatmap-timeline">
                                <span>Start</span>
                                <span>End</span>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>You don't have enough credits for AI analysis</p>
                            <a href="/credits.html" class="buy-credits-button">Buy Credits</a>
                        </div>
                    </div>
                </div>
                <!-- Chat Focus -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Who the chat focuses on the most?</h3>
                        <div class="analysis-content">
                            <div class="analysis-text blurred-content">
                                <p>${person1} focuses on ${person2} 62% of the time, while ${person2} focuses on ${person1} 38% of the time.</p>
                            </div>
                            <div class="analysis-chart strong-chart-blur">
                                ${createDonutChart(
                                    38,
                                    62,
                                    window.colors[person1] || '#3d9c7d',
                                    window.colors[person2] || '#ff6b6b'
                                )}
                            </div>
                        </div>
                        <div class="focus-counts blurred-content">
                            <div class="focus-count-container">
                                <div class="focus-count">
                                    <span class="focus-color" style="background-color: ${window.colors[person1] || '#3d9c7d'}"></span>
                                    <span class="label">${person1}:</span>
                                    <span class="percentage">38%</span>
                                </div>
                            </div>
                            <div class="focus-count-container">
                                <div class="focus-count">
                                    <span class="focus-color" style="background-color: ${window.colors[person2] || '#ff6b6b'}"></span>
                                    <span class="label">${person2}:</span>
                                    <span class="percentage">62%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>You don't have enough credits for AI analysis</p>
                            <a href="/credits.html" class="buy-credits-button">Buy Credits</a>
                        </div>
                    </div>
                </div>
                <!-- Engagement Analysis -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Who is the most engaged during conversations?</h3>
                        <div class="analysis-content">
                            <div class="analysis-text blurred-content">
                                <p>${person1} was more engaged in 55% of conversations, while ${person2} was more engaged in 45% of conversations.</p>
                            </div>
                            <div class="analysis-chart strong-chart-blur">
                                ${createDonutChart(
                                    55,
                                    45,
                                    window.colors[person1] || '#3d9c7d',
                                    window.colors[person2] || '#ff6b6b'
                                )}
                            </div>
                        </div>
                        <div class="engagement-counts blurred-content">
                            <div class="engagement-count-container">
                                <div class="engagement-count">
                                    <span class="engagement-color" style="background-color: ${window.colors[person1] || '#3d9c7d'}"></span>
                                    <span class="label">${person1}:</span>
                                    <span class="percentage">55%</span>
                                </div>
                            </div>
                            <div class="engagement-count-container">
                                <div class="engagement-count">
                                    <span class="engagement-color" style="background-color: ${window.colors[person2] || '#ff6b6b'}"></span>
                                    <span class="label">${person2}:</span>
                                    <span class="percentage">45%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${isLoggedIn ? `
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>${credits < needed ? 'You don\'t have enough credits for AI analysis' : 'Sign in to see full analysis'}</p>
                            ${credits < needed ? '<a href="/credits.html" class="buy-credits-button">Buy Credits</a>' : '<div id="aiSigninButton14" class="g-signin2"></div>'}
                        </div>
                    </div>
                    ` : `
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton14" class="g-signin2"></div>
                        </div>
                    </div>
                    `}
                </div>
                <!-- Ghosting Analysis -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Who ghosted more often?</h3>
                        <div class="analysis-content">
                            <div class="analysis-text blurred-content">
                                <p>Analysis based on 43 detected ghosting incidents where a message was unanswered for 3+ hours.</p>
                            </div>
                            <div class="analysis-chart strong-chart-blur">
                                ${(() => {
                                    const p = Math.floor(Math.random() * 61) + 20;
                                    return createDonutChart(
                                        p,
                                        100 - p,
                                        window.colors[person1] || '#3d9c7d',
                                        window.colors[person2] || '#ff6b6b'
                                    );
                                })()}
                            </div>
                        </div>
                        <div class="ghosting-counts blurred-content">
                            <p>${person1}: 5 times</p>
                            <p>${person2}: 3 times</p>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>You don't have enough credits for AI analysis</p>
                            <a href="/credits.html" class="buy-credits-button">Buy Credits</a>
                        </div>
                    </div>
                </div>
                <!-- Participant 1 Analysis -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section participant-analysis">
                        <h3>${person1}'s Analysis</h3>
                        <div>
                            <div class="interest-level">
                                Interest: <span class="interest-level-score blurred-content">7/10</span>
                            </div>
                            <div class="communication-style">
                                <h4>Communication Style</h4>
                                <div class="blurred-content">
                                    <p>Enthusiastic, playful, and proactive. Uses informal language and inside jokes frequently. Shows a willingness to plan and organize activities.

Displays a high level of trust and emotional depth through shared vulnerabilities, support, and concern for Arthur's well-being.</p>
                                </div>
                            </div>
                            <div class="flags-section">
                                <div class="green-flags">
                                    <h4>Green Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item green-flag">
                                            <strong>Proactive Planning: Alexandre frequently initiates plans and activities, demonstrating initiative and a desire to spend time with Arthur.</strong> Example green flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="green-flags">
                                    <h4>Green Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item green-flag">
                                            <strong>Emotional Support: Alexandre offers support and understanding during times of stress or difficulty for Arthur, showing empathy and care.</strong> Example green flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="red-flags">
                                    <h4>Red Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item red-flag">
                                            <strong>Overreaction: Alexandre admits to overreacting at times, suggesting a need for better emotional regulation.</strong> Example red flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="red-flags">
                                    <h4>Red Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item red-flag">
                                            <strong>Impulsivity: Alexandre's actions, such as the incident with the 5ème student, suggest a tendency towards impulsive behavior.</strong> Example red flag.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="relationship-tip">
                                <h4>Relationship Tip</h4>
                                <div class="blurred-content">
                                    <div class="tip-item">
                                        <strong>Suggestion:</strong>
                                        <p>Mindfulness and Communication: Alexandre should focus on practicing mindfulness and improving communication skills to manage impulsive reactions and express emotions more constructively.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>You don't have enough credits for AI analysis</p>
                            <a href="/credits.html" class="buy-credits-button">Buy Credits</a>
                        </div>
                    </div>
                </div>
                <!-- Participant 2 Analysis -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section participant-analysis">
                        <h3>${person2}'s Analysis</h3>
                        <div>
                            <div class="interest-level">
                                Interest: <span class="interest-level-score blurred-content">7/10</span>
                            </div>
                            <div class="communication-style">
                                <h4>Communication Style</h4>
                                <div class="blurred-content">
                                    <p>Playful, responsive, and collaborative. Shares similar informal language and inside jokes as Alexandre. Contributes equally to planning and organizing activities.

Demonstrates trust and emotional depth through shared vulnerabilities, support, and concern for Alexandre's well-being.</p>
                                </div>
                            </div>
                            <div class="flags-section">
                                <div class="green-flags">
                                    <h4>Green Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item green-flag">
                                            <strong>Collaborative Spirit: Arthur actively participates in planning and executing activities with Alexandre, showing a willingness to collaborate and compromise.</strong> Example green flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="green-flags">
                                    <h4>Green Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item green-flag">
                                            <strong>Honest Communication: Arthur communicates openly and honestly about his feelings and experiences, fostering a strong foundation of trust.</strong> Example green flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="red-flags">
                                    <h4>Red Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item red-flag">
                                            <strong>Fear of Conflict: Arthur's avoidance of conflict with Alexandre's father might indicate a reluctance to address difficult situations directly.</strong> Example red flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="red-flags">
                                    <h4>Red Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item red-flag">
                                            <strong>Impulsivity: Arthur's actions, such as the incident with the smoke inhalation, suggest a tendency towards impulsive behavior.</strong> Example red flag.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="relationship-tip">
                                <h4>Relationship Tip</h4>
                                <div class="blurred-content">
                                    <div class="tip-item">
                                        <strong>Suggestion:</strong>
                                        <p>Assertiveness Training: Arthur should work on assertiveness training to improve communication in challenging situations and express needs more effectively.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>You don't have enough credits for AI analysis</p>
                            <a href="/credits.html" class="buy-credits-button">Buy Credits</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        }
    } else {
        // When not signed in: display structured placeholders with selective blur
        aiSection.innerHTML = `
            <h2 class="title gradient-text">Deep AI</h2>
            <div class="ai-analysis-container">
                <!-- Overall Connection and Evolution -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Overall Connection</h3>
                        <div class="blurred-background">
                            <div class="blurred-content">
                                <p><strong>Close Friends</strong></p>
                                <p>The chat log reveals a long-standing friendship with a high degree of familiarity, inside jokes, shared experiences, and mutual support, even amidst playful teasing and occasional conflict.</p>
                            </div>
                        </div>
                    </div>
                    <div class="ai-section">
                        <h3>Evolution</h3>
                        <div class="blurred-background">
                            <div class="blurred-content">
                                <p>Initially, the interaction centers around a shared concern about a school-related event. As the chat progresses, the communication becomes more casual and playful, marked by frequent use of emojis and inside jokes. There are periods of intense engagement, followed by longer gaps in communication. Later exchanges delve into more personal matters, including relationship advice and emotional support. The final stages show a return to more casual banter, demonstrating the resilience of their friendship.</p>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton5" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Chat Overview -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Chat Overview</h3>
                        <div class="blurred-background">
                            <div class="blurred-content">
                                <p>The conversation spans several months and covers a wide range of topics, including school-related events (tests, homework, teachers), shared activities (gaming, sleepovers), personal struggles (challenges, relationships), and inside jokes. The overall mood fluctuates between playful banter, serious discussions, and moments of frustration. Both participants are highly engaged, with frequent exchanges and multimedia sharing. Recurring themes include their competitive nature, anxieties about school performance, and their complex relationship dynamics with other individuals in their social circle. A significant portion of the conversation revolves around a self-imposed challenge to abstain from a certain activity, and the subsequent reactions and support between the two.</p>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton6" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Response Analysis -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Response Times</h3>
                        <div class="analysis-content">
                            <div class="analysis-text blurred-content">
                                <p><strong>${person1}:</strong> Typically responds within 15-30 minutes, with occasional faster replies during active conversations. Shows consistent engagement patterns throughout the day.</p>
                            </div>
                            <div class="analysis-response-time blurred-content">
                                <span class="label">Avg resp:</span>
                                <span class="time">17</span>
                                <span class="unit">min</span>
                            </div>
                        </div>
                        <div class="analysis-content">
                            <div class="analysis-text blurred-content">
                                <p><strong>${person2}:</strong> Response times vary more significantly, from immediate replies to several hours. Most active in evenings and weekends.</p>
                            </div>
                            <div class="analysis-response-time blurred-content">
                                <span class="label">Avg resp:</span>
                                <span class="time">42</span>
                                <span class="unit">min</span>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton7" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Conversation Dynamics -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Conversation Dynamics</h3>
                        <div class="sub-section">
                            <h4>Who initiates more conversations?</h4>
                            <div class="analysis-content">
                                <div class="analysis-text blurred-content">
                                    <p>While Anatole initiates slightly more conversations, the difference is not substantial. Both participants seem comfortable initiating conversations, suggesting a balanced dynamic.</p>
                                </div>
                                <div class="analysis-chart strong-chart-blur">
                                    ${createDonutChart(
                                        Math.floor(Math.random() * 61) + 20,
                                        Math.floor(Math.random() * 61) + 20,
                                        window.colors[person1] || '#3d9c7d',
                                        window.colors[person2] || '#ff6b6b'
                                    )}
                                </div>
                            </div>
                        </div>
                        <div class="sub-section">
                            <h4>Who ends more conversations?</h4>
                            <div class="analysis-content">
                                <div class="analysis-text blurred-content">
                                    <p>Anatole ends conversations slightly more often, often due to lack of response from Jamz. However, both participants contribute to the natural conclusion of conversations.</p>
                                </div>
                                <div class="analysis-chart strong-chart-blur">
                                    ${createDonutChart(
                                        Math.floor(Math.random() * 61) + 20,
                                        Math.floor(Math.random() * 61) + 20,
                                        window.colors[person1] || '#3d9c7d',
                                        window.colors[person2] || '#ff6b6b'
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton8" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Emotional Heatmap -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Emotional Heatmap</h3>
                        <div class="emotional-heatmap-container">
                            <div class="heatmap-legend">
                                <div class="legend-item">
                                    <div class="legend-color negative"></div>
                                    <span>Negative</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color neutral"></div>
                                    <span>Neutral</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color positive"></div>
                                    <span>Positive</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color love"></div>
                                    <span>Love</span>
                                </div>
                            </div>
                            <div class="heatmap-bars strong-chart-blur">
                                ${[3, 5, 7, 8, 6, 4, 9, 7, 6, 8].map(score => {
                                    let color;
                                    if (score <= 2) color = `rgb(255, ${Math.round(80 + 100 * (score/2))}, 0)`;
                                    else if (score <= 4) color = `rgb(${Math.round(255 - 55 * ((score-2)/2))}, ${Math.round(180 + 50 * ((score-2)/2))}, 100)`;
                                    else if (score <= 6) {
                                        const grey = Math.round(160 + (score - 4) * 20);
                                        color = `rgb(${grey}, ${grey}, ${grey})`;
                                    }
                                    else if (score <= 8) color = `rgb(${Math.round(160 - 80 * ((score-6)/2))}, ${Math.round(200 + 55 * ((score-6)/2))}, 160)`;
                                    else if (score < 10) color = `rgb(${Math.round(160 + 40 * ((score-8)/2))}, ${Math.round(255 - 100 * ((score-8)/2))}, ${Math.round(200 + 30 * ((score-8)/2))})`;
                                    else color = '#ff69b4';
                                    return `<div class="heatmap-bar" style="background-color: ${color}"></div>`;
                                }).join('')}
                            </div>
                            <div class="heatmap-timeline">
                                <span>Start</span>
                                <span>End</span>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton12" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Chat Focus -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Who the chat focuses on the most?</h3>
                        <div class="analysis-content">
                            <div class="analysis-text blurred-content">
                                <p>${person1} focuses on ${person2} 62% of the time, while ${person2} focuses on ${person1} 38% of the time.</p>
                            </div>
                            <div class="analysis-chart strong-chart-blur">
                                ${createDonutChart(
                                    38,
                                    62,
                                    window.colors[person1] || '#3d9c7d',
                                    window.colors[person2] || '#ff6b6b'
                                )}
                            </div>
                        </div>
                        <div class="focus-counts blurred-content">
                            <div class="focus-count-container">
                                <div class="focus-count">
                                    <span class="focus-color" style="background-color: ${window.colors[person1] || '#3d9c7d'}"></span>
                                    <span class="label">${person1}:</span>
                                    <span class="percentage">38%</span>
                                </div>
                            </div>
                            <div class="focus-count-container">
                                <div class="focus-count">
                                    <span class="focus-color" style="background-color: ${window.colors[person2] || '#ff6b6b'}"></span>
                                    <span class="label">${person2}:</span>
                                    <span class="percentage">62%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton13" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Engagement Analysis -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Who is the most engaged during conversations?</h3>
                        <div class="analysis-content">
                            <div class="analysis-text blurred-content">
                                <p>${person1} was more engaged in 55% of conversations, while ${person2} was more engaged in 45% of conversations.</p>
                            </div>
                            <div class="analysis-chart strong-chart-blur">
                                ${createDonutChart(
                                    55,
                                    45,
                                    window.colors[person1] || '#3d9c7d',
                                    window.colors[person2] || '#ff6b6b'
                                )}
                            </div>
                        </div>
                        <div class="engagement-counts blurred-content">
                            <div class="engagement-count-container">
                                <div class="engagement-count">
                                    <span class="engagement-color" style="background-color: ${window.colors[person1] || '#3d9c7d'}"></span>
                                    <span class="label">${person1}:</span>
                                    <span class="percentage">55%</span>
                                </div>
                            </div>
                            <div class="engagement-count-container">
                                <div class="engagement-count">
                                    <span class="engagement-color" style="background-color: ${window.colors[person2] || '#ff6b6b'}"></span>
                                    <span class="label">${person2}:</span>
                                    <span class="percentage">45%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${isLoggedIn ? `
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>${credits < needed ? 'You don\'t have enough credits for AI analysis' : 'Sign in to see full analysis'}</p>
                            ${credits < needed ? '<a href="/credits.html" class="buy-credits-button">Buy Credits</a>' : '<div id="aiSigninButton14" class="g-signin2"></div>'}
                        </div>
                    </div>
                    ` : `
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton14" class="g-signin2"></div>
                        </div>
                    </div>
                    `}
                </div>
                <!-- Ghosting Analysis -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Who ghosted more often?</h3>
                        <div class="analysis-content">
                            <div class="analysis-text blurred-content">
                                <p>Analysis based on 43 detected ghosting incidents where a message was unanswered for 3+ hours.</p>
                            </div>
                            <div class="analysis-chart strong-chart-blur">
                                ${(() => {
                                    const p = Math.floor(Math.random() * 61) + 20;
                                    return createDonutChart(
                                        p,
                                        100 - p,
                                        window.colors[person1] || '#3d9c7d',
                                        window.colors[person2] || '#ff6b6b'
                                    );
                                })()}
                            </div>
                        </div>
                        <div class="ghosting-counts blurred-content">
                            <p>${person1}: 5 times</p>
                            <p>${person2}: 3 times</p>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton9" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Participant 1 Analysis -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section participant-analysis">
                        <h3>${person1}'s Analysis</h3>
                        <div>
                            <div class="interest-level">
                                Interest: <span class="interest-level-score blurred-content">7/10</span>
                            </div>
                            <div class="communication-style">
                                <h4>Communication Style</h4>
                                <div class="blurred-content">
                                    <p>Enthusiastic, playful, and proactive. Uses informal language and inside jokes frequently. Shows a willingness to plan and organize activities.

Displays a high level of trust and emotional depth through shared vulnerabilities, support, and concern for Arthur's well-being.</p>
                                </div>
                            </div>
                            <div class="flags-section">
                                <div class="green-flags">
                                    <h4>Green Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item green-flag">
                                            <strong>Proactive Planning: Alexandre frequently initiates plans and activities, demonstrating initiative and a desire to spend time with Arthur.</strong> Example green flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="green-flags">
                                    <h4>Green Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item green-flag">
                                            <strong>Emotional Support: Alexandre offers support and understanding during times of stress or difficulty for Arthur, showing empathy and care.</strong> Example green flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="red-flags">
                                    <h4>Red Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item red-flag">
                                            <strong>Overreaction: Alexandre admits to overreacting at times, suggesting a need for better emotional regulation.</strong> Example red flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="red-flags">
                                    <h4>Red Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item red-flag">
                                            <strong>Impulsivity: Alexandre's actions, such as the incident with the 5ème student, suggest a tendency towards impulsive behavior.</strong> Example red flag.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="relationship-tip">
                                <h4>Relationship Tip</h4>
                                <div class="blurred-content">
                                    <div class="tip-item">
                                        <strong>Suggestion:</strong>
                                        <p>Mindfulness and Communication: Alexandre should focus on practicing mindfulness and improving communication skills to manage impulsive reactions and express emotions more constructively.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton10" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Participant 2 Analysis -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section participant-analysis">
                        <h3>${person2}'s Analysis</h3>
                        <div>
                            <div class="interest-level">
                                Interest: <span class="interest-level-score blurred-content">7/10</span>
                            </div>
                            <div class="communication-style">
                                <h4>Communication Style</h4>
                                <div class="blurred-content">
                                    <p>Playful, responsive, and collaborative. Shares similar informal language and inside jokes as Alexandre. Contributes equally to planning and organizing activities.

Demonstrates trust and emotional depth through shared vulnerabilities, support, and concern for Alexandre's well-being.</p>
                                </div>
                            </div>
                            <div class="flags-section">
                                <div class="green-flags">
                                    <h4>Green Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item green-flag">
                                            <strong>Collaborative Spirit: Arthur actively participates in planning and executing activities with Alexandre, showing a willingness to collaborate and compromise.</strong> Example green flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="green-flags">
                                    <h4>Green Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item green-flag">
                                            <strong>Honest Communication: Arthur communicates openly and honestly about his feelings and experiences, fostering a strong foundation of trust.</strong> Example green flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="red-flags">
                                    <h4>Red Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item red-flag">
                                            <strong>Fear of Conflict: Arthur's avoidance of conflict with Alexandre's father might indicate a reluctance to address difficult situations directly.</strong> Example red flag.
                                        </div>
                                    </div>
                                </div>
                                <div class="red-flags">
                                    <h4>Red Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item red-flag">
                                            <strong>Impulsivity: Arthur's actions, such as the incident with the smoke inhalation, suggest a tendency towards impulsive behavior.</strong> Example red flag.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="relationship-tip">
                                <h4>Relationship Tip</h4>
                                <div class="blurred-content">
                                    <div class="tip-item">
                                        <strong>Suggestion:</strong>
                                        <p>Assertiveness Training: Arthur should work on assertiveness training to improve communication in challenging situations and express needs more effectively.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton11" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize Google Sign-In buttons after a small delay
        setTimeout(() => {
            if (window.google && google.accounts && google.accounts.id) {
                setupGoogleButton();
            }
        }, 100);
    }
    
    // Append the AI analysis section to the designated container
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");
    (chatAnalyticsSection || document.body).appendChild(aiSection);
    const aiButton = aiSection.querySelector('#aiAnalysisButton');
    if (aiButton) {
        aiButton.removeEventListener('click', handleAIClick);
        aiButton.addEventListener('click', handleAIClick, { once: true });
    }
    return aiSection;
}


function renderGroupChatAIAnalysisSection() {
    let existingSection = document.getElementById("aiAnalysisSection");
    if (existingSection) existingSection.remove();
    
    const aiSection = document.createElement("div");
    aiSection.id = "aiAnalysisSection";
    aiSection.className = "ai-analysis-section";
    
    const deepAITitle = document.createElement("h2");
    deepAITitle.className = "title gradient-text";
    deepAITitle.textContent = "Deep AI";
    aiSection.appendChild(deepAITitle);
    
    const messageContainer = document.createElement("div");
    messageContainer.className = "ai-results-container";
    messageContainer.innerHTML = `
        <div class="ai-section">
            <h3>Group Chat Analysis</h3>
            <p>AI analysis is currently only available for chats with exactly two participants.</p>
            <p>Basic analytics are shown above.</p>
        </div>
    `;
    aiSection.appendChild(messageContainer);
    
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");
    (chatAnalyticsSection || document.body).appendChild(aiSection);
    return aiSection;
}

// New handler for group chat AI analysis
async function handleGroupAIClick() {
    // Check again for sign-in status before proceeding
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || {});
    const aiToggle = document.getElementById('aiToggle');
    if (aiToggle && !aiToggle.checked) {
        const aiLoadingContainer = document.getElementById('aiLoadingContainer');
        if (aiLoadingContainer) {
            aiLoadingContainer.remove();
        }
        return;
    }
  
    // Double-check credits before starting analysis
    const credits = await checkUserCredits(user.sub);
    if (credits < 1) {
      alert('You have no credits left. Please purchase more.');
      return;
    }

    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length === 0) {
      alert('Please select a file first.');
      return;
    }
  
    const file = fileInput.files[0];
    const reader = new FileReader();
  
    reader.onload = async (event) => {
        try {
            let text;
            if (file.name.endsWith('.zip')) {
                const arrayBuffer = event.target.result;
                const zip = await JSZip.loadAsync(arrayBuffer);
                const txtFile = Object.keys(zip.files).find(f => f.endsWith('.txt'));
                if (!txtFile) throw new Error('No .txt file in ZIP');
                text = await zip.files[txtFile].async('text');
            } else {
                text = event.target.result;
            }

            if (typeof text !== 'string') {
                throw new Error('Failed to extract text content');
            }

            const preprocessed = preprocessGroupChat(text); // Remove region parameter
            if (!preprocessed) {
                alert('Group chat analysis requires 3 or more participants');
                return;
            }

        const results = await analyzeGroupChatWithAI(preprocessed.processedText);

        // Only deduct credit AFTER successful analysis
        const ok = await deductCredit(user.sub, 1);
        if (!ok) {
          console.error('Credit deduction failed');
          // Don't throw error here since analysis already completed
        }

        // Add artificial delay for larger files
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 500));
        const processingTime = Date.now() - startTime;
        
        if (processingTime < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - processingTime));
        }

        displayGroupAIResults(results);

      } catch (error) {
        console.error('Group chat AI analysis failed:', error);
        const aiSection = document.getElementById("aiAnalysisSection");
        if (aiSection) {
            const errorDiv = document.createElement("div");
            errorDiv.className = "ai-error";
            errorDiv.innerHTML = `
                <h3>Analysis Error</h3>
                <p>${error.message}</p>
                <p>No credits were deducted for this failed analysis.</p>
            `;
            aiSection.appendChild(errorDiv);
        }
      }
    };
  
    if (file.name.endsWith('.zip')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
}

// New function to display group chat results
function displayGroupAIResults(data) {
    const aiSection = document.getElementById("aiAnalysisSection");
    if (!aiSection) return;

    aiSection.classList.add('ai-analysis-complete');
  
    // Remove loading container if it exists
    const loadingContainer = document.getElementById("aiLoadingContainer");
    if (loadingContainer) {
      loadingContainer.remove();
    }
  
    // Remove any existing analysis results from a previous run
    const oldResults = aiSection.querySelectorAll(".analysis-result");
    oldResults.forEach(el => el.remove());
  
    // Get the gradient container or create it if it doesn't exist
    let gradientContainer = aiSection.querySelector(".gradient-border-container");
    if (!gradientContainer) {
        gradientContainer = document.createElement("div");
        gradientContainer.className = "gradient-border-container";
        aiSection.appendChild(gradientContainer);
    }
    
    // Create container for the group analysis with the same style as 2-person analysis
    const groupContainer = document.createElement("div");
    groupContainer.className = "ai-results-container analysis-result";
    
    let htmlContent = '<h2 class="title subtitle">Group Chat Analysis</h2>';
    
    // Add Group Dynamics
    htmlContent += `
        <div class="ai-section">
            <h3>Group Dynamics</h3>
            <p>${data.groupDynamics || 'No group dynamics analysis available'}</p>
        </div>
    `;
    
    // Add Conversation Themes
    if (data.conversationThemes?.length > 0) {
        htmlContent += `
            <div class="ai-section">
                <h3>Conversation Themes</h3>
                <ul class="group-themes">
                    ${data.conversationThemes.map(theme => `<li>${theme}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    // Add Engagement Analysis
    htmlContent += `
        <div class="ai-section">
            <h3>Engagement Analysis</h3>
            <p>${data.engagementAnalysis || 'No engagement analysis available'}</p>
        </div>
    `;
    
    // Add Group Personality
    htmlContent += `
        <div class="ai-section">
            <h3>Group Personality</h3>
            <p>${data.groupPersonality || 'No group personality analysis available'}</p>
        </div>
    `;
    
    groupContainer.innerHTML = htmlContent;
    
    // Clear the gradient container and add the new content
    gradientContainer.innerHTML = '';
    gradientContainer.appendChild(groupContainer);
    
    // Show the analysis completed popup
    showAnalysisCompletedPopup();
    (async () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const id   = window.currentAnalysisId;
        if (!user.sub || !id) return;
      
        // 1) grab both sections by ID
        const timelineHTML = document.getElementById('timelineSection').outerHTML;
        const chatHTML     = document.getElementById('chatAnalyticsSection').outerHTML;
      
        // 2) reconstruct exactly how you saved it originally
        const finalHTML = timelineHTML + chatHTML;
      
        try {
          await updateAnalysisHTML(user.sub, id, finalHTML);
          console.log('✅ AI analysis appended to existing record');
        } catch (err) {
          console.error('❌ Failed to update AI HTML:', err);
        }
      })();
      
      
}

function createAIEncouragementContainer() {
    const container = document.createElement('div');
    container.className = 'gradient-border-container';
    container.innerHTML = `
        <div class="ai-results-container encouragement">
            <div class="ai-section">
                <h3>Unlock More Insights with AI</h3>
                <p>Enable AI analysis to get deeper insights such as red flags, response times, tips, overview, connection styles, ghosting insights, and more.</p>
            </div>
        </div>
    `;
    return container;
}
