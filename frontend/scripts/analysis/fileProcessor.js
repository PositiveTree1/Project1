import stopWords from '../../words/stopWords.js'; // Import the stop words list
import swearWords from '../../words/words.js'; // Import the swear words list
import { preprocessChatForAI, analyzeWithAI } from '../../aiProcessor.js';

let selectedFile = null;

export function initFileProcessor() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', function() {
        if (this.files.length === 0) return;
        selectedFile = this.files[0];
        document.getElementById('fileName').textContent = selectedFile.name;
    });
}

export function processSelectedFile() {
    const fileInput = document.getElementById('fileInput');
    // Try to get the file from the file input; if not available, use window.selectedFile
    const file = fileInput.files[0] || window.selectedFile;
    if (!file) {
        throw new Error('Please select a file first');
    }
    const region = document.getElementById('regionSelect').value;
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onload = function(event) {
            try {
                let processingPromise;
                if (file.name.endsWith('.zip')) {
                    processingPromise = processZipFile(event.target.result);
                } else {
                    processingPromise = Promise.resolve(processChatLogFile(event.target.result, region));
                }
                
                processingPromise.then(() => {
                    document.dispatchEvent(new Event('processingComplete'));
                    resolve();
                }).catch(reject);
            } catch (error) {
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


function processZipFile(arrayBuffer) {
    return JSZip.loadAsync(arrayBuffer).then((zip) => {
        const txtFile = Object.keys(zip.files).find((filename) => filename.endsWith('.txt'));
        if (!txtFile) {
            throw new Error('No .txt file found in the ZIP archive');
        }
        return zip.files[txtFile].async('text');
    }).then((text) => {
        return processChatLogFile(text, document.getElementById('regionSelect').value);
    });
}

function processChatLogFile(text, region) {
    // Initialize colors if not already initialized
    if (!window.colors) {
        window.colors = {};
    }
    
    // Process data
    const { stats, columnChartData, dateRange, hourlyData, hourlySenders, monthlyData, weekdayData, conversations } = processChatLog(text, region);
    const callStats = analyzeCalls(text, region); // Separate call analysis
    
    window.stats = stats;
    window.callStats = callStats; // Store call stats globally
    window.conversations = conversations;

    window.chatText = text;

    const { uniqueWords, topEmojis, longestMessage, topCommunalWords, topCommunalEmojis, averageWordsPerMessage, averageSwearWordsPerMessage } = calculateAdditionalStats(text, region);
    const { conversationStarts, conversationEnds } = analyzeConversations(text, region);
    // const ignoredCounts = analyzeIgnoredMessages(text, region);
    const doubleMessageCounts = calculateDoubleMessages(text, region);
    // const responseStats = calculateResponseTimes(text, region);
    const chatFocusPercentages = calculateChatFocus(text, Object.keys(stats));
    const contentStats = analyzeContent(text, region);
    const interactions = analyzeInteractions(text, region);

    window.convoStats = calculateConvoStats(text, region);

    const streakStats = calculateStreakStats(text, region);
    

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
    window.conversationStarts = conversationStarts;
    window.conversationEnds = conversationEnds;
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
    if (people.length > 2) {
        renderPersonSelectionPanel(people);
    }

    // Render the stacked column chart, and when done, render the other charts
    if (window.renderStackedColumnChart) {
        renderStackedColumnChart(columnChartData, () => {
            // Stacked column chart (now a curved line chart) has rendered.
            // Now render the other charts:
            renderMonthlyChartChartJS(monthlyData);
            renderWeekdayChart(weekdayData);
            if (window.renderHourlyChart) renderHourlyChart(hourlyData);
            if (window.renderPersonBoxes) renderPersonBoxes(stats, uniqueWords, topEmojis, longestMessage, window.colors || {});
            if (window.renderCommunalWords) renderCommunalWords(topCommunalWords);
            if (window.renderFloatingEmojis) renderFloatingEmojis(topCommunalEmojis);

            if (window.renderConversationAnalysis) {
                renderConversationAnalysis(conversationStarts, conversationEnds);
            }

            if (Object.keys(stats).length === 2) {
                if (window.renderDoubleMessages) renderDoubleMessages(doubleMessageCounts);
                if (window.renderChatFocusChart) renderChatFocusChart(chatFocusPercentages, Object.keys(stats));
            }

            if (window.renderContentAnalysis) {
                renderContentAnalysis(contentStats);
            }

            if (Object.keys(stats).length > 2 && window.renderInteractions) {
                renderInteractions(interactions);
            }
            if (window.renderCallStats) {
                renderCallStats(callStats);
            }
            if (people.length === 2) {
                renderConvoStats(text, region);
            }
            if (Object.keys(stats).length === 2 && window.engagementData) {
                if (window.renderEngagementChart) renderEngagementChart(window.engagementData, Object.keys(stats));
            }

            // Add this with the other render calls
            if (window.renderStreakStats) renderStreakStats(streakStats);

            if (people.length === 2) {
                window.aiAnalysis = renderAIAnalysisSection();
                
                if (window.aiAnalysis?.button) {
                    // Remove any existing listener to prevent duplicates
                    window.aiAnalysis.button.removeEventListener('click', handleAIClick);
                    window.aiAnalysis.button.addEventListener('click', handleAIClick);
                }
            }

            document.dispatchEvent(new Event('processingComplete'));
    
            // Scroll to results if needed
            const resultsSection = document.getElementById('results');
            if (resultsSection) {
                setTimeout(() => {
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
              
              
        });
    } else {
        // Fallback if renderStackedColumnChart is not defined
        renderMonthlyChartChartJS(monthlyData);
        renderWeekdayChart(weekdayData);
        if (window.renderHourlyChart) renderHourlyChart(hourlyData);
        if (window.renderPersonBoxes) renderPersonBoxes(stats, uniqueWords, topEmojis, longestMessage, window.colors || {});
        if (window.renderCommunalWords) renderCommunalWords(topCommunalWords);
        if (window.renderFloatingEmojis) renderFloatingEmojis(topCommunalEmojis);

        if (window.renderConversationAnalysis) {
            renderConversationAnalysis(conversationStarts, conversationEnds);
        }

        if (Object.keys(stats).length === 2) {
            if (window.renderDoubleMessages) renderDoubleMessages(doubleMessageCounts);
            // if (window.renderResponseTimes) renderResponseTimes(responseStats);
            if (window.renderChatFocusChart) renderChatFocusChart(chatFocusPercentages, Object.keys(stats));
        }

        if (window.renderContentAnalysis) {
            renderContentAnalysis(contentStats);
        }

        if (Object.keys(stats).length > 2 && window.renderInteractions) {
            renderInteractions(interactions);
        }
        if (window.renderCallStats) {
            renderCallStats(callStats);
        }
        if (people.length === 2) {
            renderConvoStats(text, region);
        }

        if (Object.keys(stats).length === 2 && window.engagementData) {
            if (window.renderEngagementChart) renderEngagementChart(window.engagementData, Object.keys(stats));
        }
        // Add this with the other render calls
        if (window.renderStreakStats) renderStreakStats(streakStats);

        // In your initialization code (where you process the chat)
        if (people.length === 2) {
            window.aiAnalysis = renderAIAnalysisSection();
            
            if (window.aiAnalysis?.button) {
                // Remove any existing listener to prevent duplicates
                window.aiAnalysis.button.removeEventListener('click', handleAIClick);
                window.aiAnalysis.button.addEventListener('click', handleAIClick);
            }
        }

        document.dispatchEvent(new Event('processingComplete'));
        
        // Scroll to results if needed
        const resultsSection = document.getElementById('results');
        if (resultsSection) {
            setTimeout(() => {
                resultsSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
          
    }
} 

window.initFileProcessor = initFileProcessor;
window.processSelectedFile = processSelectedFile;

function processChatLog(text, region) {
    const lines = text.split('\n');
    const stats = {};
    let startDate = null;
    let endDate = null;
    const messageCounts = {};

    let conversations = [];
    let currentConversation = [];
    let previousTimestamp = null;
    const conversationGap = 40 * 60 * 1000; // 30 minutes in milliseconds
    const messageGap = 10 * 60 * 1000; // 10 minutes in milliseconds
    const minMessages = 16; // Minimum 4 messages (2 per participant)

    // Track days for hourly average and monthly days
    const allDays = new Set();
    const daysPerMonth = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    monthNames.forEach(month => daysPerMonth[month] = new Set());

    // Hourly stats (per sender)
    const hourlySenderStats = Array(24).fill(null).map(() => ({}));
    const hourlySendersSet = new Set();

    // Monthly stats (per sender)
    const perMonthCounts = {};
    monthNames.forEach(month => perMonthCounts[month] = {});

    // Weekday stats (per sender)
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const perWeekdayCounts = {};
    weekdayNames.forEach(day => perWeekdayCounts[day] = {});

    // Media placeholders to exclude
    const mediaPlaceholders = [
        "‎Voice call",
        "‎Missed voice call",
        "‎image omitted",
        "‎GIF omitted",
        "‎sticker omitted",
        "‎video omitted",
        "‎audio omitted",
        "‎This message was deleted."
    ];

    lines.forEach(line => {
        // Skip lines that contain media placeholders
        if (mediaPlaceholders.some(placeholder => line.includes(placeholder))) {
            return; // Skip this line
        }

        const regex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):\d{2}:\d{2}\] ([^:]+):/;
        const match = line.match(regex);
        if (match) {
            const day = region === "US" ? match[2] : match[1];
            const monthStr = region === "US" ? match[1] : match[2];
            const year = match[3];
            const hour = parseInt(match[4], 10);
            const sender = match[5].trim();
            const formattedDate = `${year}-${monthStr}-${day}`;
            const monthNum = parseInt(monthStr, 10);
            const monthName = monthNames[monthNum - 1];
            const dateObj = new Date(`${year}-${monthStr}-${day}`);
            const dateObjConvo = new Date(`${year}-${monthStr}-${day}T${hour}:${match[5]}:${match[6]}`);
            const weekdayName = weekdayNames[dateObj.getDay()];

            // Check if we should start a new conversation
            if (previousTimestamp && (dateObjConvo - previousTimestamp) > conversationGap) {
                // Finalize current conversation if it meets criteria
                finalizeConversation(currentConversation, conversations, minMessages);
                currentConversation = [];
            }

            if (currentConversation.length >= 3) {
                const lastThreeSenders = currentConversation.slice(-3).map(m => m.sender);
                if (new Set(lastThreeSenders).size === 1) {
                    // Remove the last messages that form a monologue
                    currentConversation = currentConversation.slice(0, -3);
                    // Finalize what we have so far if it meets criteria
                    finalizeConversation(currentConversation, conversations, minMessages);
                    currentConversation = [];
                }
            }

            // Add message to current conversation
            currentConversation.push({
                sender: sender,
                timestamp: dateObjConvo,
                text: line.split(": ").slice(1).join(": ") // Store message text
            });

            previousTimestamp = dateObjConvo;

            // Update overall stats
            stats[sender] = (stats[sender] || 0) + 1;

            // Track days for averages
            allDays.add(formattedDate);
            daysPerMonth[monthName].add(formattedDate);

            // Update message counts per date (formatted as "YYYY-MM-DD")
            messageCounts[formattedDate] = messageCounts[formattedDate] || {};
            messageCounts[formattedDate][sender] = (messageCounts[formattedDate][sender] || 0) + 1;

            // Update hourly sender stats
            hourlySenderStats[hour][sender] = (hourlySenderStats[hour][sender] || 0) + 1;
            hourlySendersSet.add(sender);

            // Update monthly counts per sender
            perMonthCounts[monthName][sender] = (perMonthCounts[monthName][sender] || 0) + 1;

            // Update weekday counts per sender
            perWeekdayCounts[weekdayName][sender] = (perWeekdayCounts[weekdayName][sender] || 0) + 1;

            // Update date range
            if (!startDate || dateObj < startDate) startDate = dateObj;
            if (!endDate || dateObj > endDate) endDate = dateObj;
        }
    });

    const columnChartData = generateColumnChartData(messageCounts, startDate, endDate);
    const totalDays = allDays.size;

    // Build hourly data with averages
    const hourlyData = [];
    for (let hour = 0; hour < 24; hour++) {
        const dataPoint = { hour: `${hour}:00` };
        const sendersInHour = hourlySenderStats[hour];
        for (const sender in sendersInHour) {
            dataPoint[sender] = totalDays ? sendersInHour[sender] / totalDays : 0;
        }
        hourlyData.push(dataPoint);
    }

    // Build monthly data with averages
    const monthlyData = monthNames.map(month => {
        const sendersInMonth = perMonthCounts[month];
        const daysInMonth = daysPerMonth[month].size;
        const dataPoint = { month: month };
        for (const sender in sendersInMonth) {
            dataPoint[sender] = daysInMonth ? sendersInMonth[sender] / daysInMonth : 0;
        }
        return dataPoint;
    });

    // Build weekday data with averages
    const weekdayData = weekdayNames.map(weekday => {
        const sendersInWeekday = perWeekdayCounts[weekday];
        const daysInWeekday = Math.ceil(totalDays / 7); // Average days per weekday
        const dataPoint = { weekday: weekday };
        for (const sender in sendersInWeekday) {
            dataPoint[sender] = daysInWeekday ? sendersInWeekday[sender] / daysInWeekday : 0;
        }
        return dataPoint;
    });

    finalizeConversation(currentConversation, conversations, minMessages);

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

function calculateAdditionalStats(text, region) {
    const lines = text.split('\n');
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
        // Skip lines that contain media placeholders
        if (mediaPlaceholders.some(placeholder => line.includes(placeholder))) {
            return; // Skip this line
        }

        const regex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):\d{2}:\d{2}\] ([^:]+):/;
        const match = line.match(regex);
        if (match) {
            const sender = match[5].trim();
            const message = line.split(": ").slice(1).join(": "); // Extract the message part

            // Track total messages per sender
            totalMessagesPerSender[sender] = (totalMessagesPerSender[sender] || 0) + 1;

            // Track swear words
            if (!totalSwearWordsPerSender[sender]) totalSwearWordsPerSender[sender] = 0;
            const words = message.split(/\s+/).filter(word => word.trim() !== "");
            words.forEach(word => {
                const lowerWord = word.toLowerCase();
                if (swearWords.includes(lowerWord)) {
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

function analyzeConversations(text, region) {
    const lines = text.split('\n');
    const conversationStarts = {};
    const conversationEnds = {}; // Track who ended conversations
    const conversationStartThreshold = 40 * 60 * 1000; // 40 minutes in milliseconds
    const conversationMessageThreshold = 20 * 60 * 1000; // 20 minutes in milliseconds
    const minMessagesForConversation = 7; // Minimum number of messages to count as a conversation
    let previousTimestamp = null;

    let currentConversation = []; // Track messages in the current conversation
    let currentConversationStart = null; // Track the start time of the current conversation

    // Use the same regex as before to extract the date and time.
    const regex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\] ([^:]+):/;

    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            // Extract date, time, and sender
            const day = region === "US" ? match[2] : match[1];
            const month = region === "US" ? match[1] : match[2];
            const year = match[3];
            const hour = match[4];
            const minute = match[5];
            const second = match[6];
            const sender = match[7].trim();

            // Convert to timestamp
            const currentTimestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();

            // Check if the time gap exceeds the conversation start threshold (40 minutes)
            if (!previousTimestamp || (currentTimestamp - previousTimestamp) > conversationStartThreshold) {
                // End the previous conversation if it has at least 7 messages and all messages are within 20 minutes of each other
                if (currentConversation.length >= minMessagesForConversation) {
                    let isValidConversation = true;

                    // Check if all messages in the conversation are within 20 minutes of each other
                    for (let i = 1; i < currentConversation.length; i++) {
                        if (currentConversation[i].timestamp - currentConversation[i - 1].timestamp > conversationMessageThreshold) {
                            isValidConversation = false;
                            break;
                        }
                    }

                    if (isValidConversation) {
                        const lastSender = currentConversation[currentConversation.length - 1].sender;
                        conversationEnds[lastSender] = (conversationEnds[lastSender] || 0) + 1; // Increment the count for the last sender

                        const firstSender = currentConversation[0].sender;
                        conversationStarts[firstSender] = (conversationStarts[firstSender] || 0) + 1; // Increment the count for the sender who started the conversation
                    }
                }

                // Start a new conversation
                currentConversation = [];
                currentConversationStart = currentTimestamp;
            }

            // Add the message to the current conversation
            currentConversation.push({ sender, timestamp: currentTimestamp });

            previousTimestamp = currentTimestamp;
        }
    });

    // End the last conversation if it has at least 7 messages and all messages are within 20 minutes of each other
    if (currentConversation.length >= minMessagesForConversation) {
        let isValidConversation = true;

        // Check if all messages in the conversation are within 20 minutes of each other
        for (let i = 1; i < currentConversation.length; i++) {
            if (currentConversation[i].timestamp - currentConversation[i - 1].timestamp > conversationMessageThreshold) {
                isValidConversation = false;
                break;
            }
        }

        if (isValidConversation) {
            const lastSender = currentConversation[currentConversation.length - 1].sender;
            conversationEnds[lastSender] = (conversationEnds[lastSender] || 0) + 1;

            const firstSender = currentConversation[0].sender;
            conversationStarts[firstSender] = (conversationStarts[firstSender] || 0) + 1;
        }
    }

    return { conversationStarts, conversationEnds };
}

// function analyzeIgnoredMessages(text, region) {
//     const lines = text.split('\n');
//     const ignoredCounts = {}; // Track how many times each sender was ignored
//     const groupingThreshold = 3 * 60 * 1000; // 1 minute in milliseconds (for grouping messages)
//     const ignoreThreshold = 40 * 60 * 1000; // 20 minutes in milliseconds (for ignoring messages)
//     let previousSender = null; // Track the sender of the previous message
//     let previousTimestamp = null; // Track the timestamp of the previous message
//     let currentGroupStart = null; // Track the start of the current message group

//     // Regex to extract date, time, and sender from each line
//     const regex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\] ([^:]+):/;

//     lines.forEach(line => {
//         const match = line.match(regex);
//         if (match) {
//             // Extract date, time, and sender
//             const day = region === "US" ? match[2] : match[1];
//             const month = region === "US" ? match[1] : match[2];
//             const year = match[3];
//             const hour = match[4];
//             const minute = match[5];
//             const second = match[6];
//             const sender = match[7].trim();

//             // Convert to timestamp (in milliseconds)
//             const currentTimestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();

//             // Check if the current message belongs to the same group as the previous message
//             if (
//                 previousSender === sender &&
//                 currentTimestamp - previousTimestamp <= groupingThreshold
//             ) {
//                 // This message is part of the same group; do nothing
//             } else {
//                 // This message starts a new group
//                 if (previousSender && currentTimestamp - previousTimestamp > ignoreThreshold) {
//                     // The previous group was ignored
//                     ignoredCounts[previousSender] = (ignoredCounts[previousSender] || 0) + 1;
//                 }
//                 // Start tracking the new group
//                 currentGroupStart = currentTimestamp;
//             }

//             // Update previous sender and timestamp
//             previousSender = sender;
//             previousTimestamp = currentTimestamp;
//         }
//     });

//     // Check if the last message group was ignored
//     if (previousSender && Date.now() - previousTimestamp > ignoreThreshold) {
//         ignoredCounts[previousSender] = (ignoredCounts[previousSender] || 0) + 1;
//     }

//     return ignoredCounts;
// }

function calculateDoubleMessages(text, region) {
    const lines = text.split('\n');
    const doubleMessageCounts = {}; // Track double messages per sender
    let previousSender = null; // Track the sender of the previous message

    // Regex to extract date, time, and sender from each line
    const regex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\] ([^:]+):/;

    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const sender = match[7].trim();

            // Check if the current sender is the same as the previous sender
            if (sender === previousSender) {
                // Increment the double message count for this sender
                doubleMessageCounts[sender] = (doubleMessageCounts[sender] || 0) + 1;
            }

            // Update the previous sender
            previousSender = sender;
        }
    });

    return doubleMessageCounts;
}

// function calculateResponseTimes(text, region) {
//     const lines = text.split('\n');
//     const responseTimes = {}; // Track response times for each sender
//     const immediateReplies = {}; // Track immediate replies (within 1 minute) for each sender
//     const totalReplies = {}; // Track total replies for each sender
//     let previousSender = null; // Track the sender of the previous message
//     let previousTimestamp = null; // Track the timestamp of the previous message

//     // Regex to extract date, time, and sender from each line
//     const regex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\] ([^:]+):/;

//     lines.forEach(line => {
//         const match = line.match(regex);
//         if (match) {
//             // Extract date, time, and sender
//             const day = region === "US" ? match[2] : match[1];
//             const month = region === "US" ? match[1] : match[2];
//             const year = match[3];
//             const hour = match[4];
//             const minute = match[5];
//             const second = match[6];
//             const sender = match[7].trim();

//             // Convert to timestamp (in milliseconds)
//             const currentTimestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();

//             // Check if the current sender is different from the previous sender
//             if (previousSender && sender !== previousSender) {
//                 const timeDiff = currentTimestamp - previousTimestamp; // Calculate time difference
//                 responseTimes[previousSender] = responseTimes[previousSender] || { totalTime: 0, count: 0 };
//                 responseTimes[previousSender].totalTime += timeDiff;
//                 responseTimes[previousSender].count += 1;

//                 // Check if the reply was immediate (within 1 minute)
//                 if (timeDiff <= 60 * 1000) {
//                     immediateReplies[previousSender] = (immediateReplies[previousSender] || 0) + 1;
//                 }

//                 // Track total replies
//                 totalReplies[previousSender] = (totalReplies[previousSender] || 0) + 1;
//             }

//             // Update previous sender and timestamp
//             previousSender = sender;
//             previousTimestamp = currentTimestamp;
//         }
//     });

//     // Calculate average response time and immediate reply percentage for each sender
//     const stats = {};
//     for (const sender in responseTimes) {
//         const averageTime = responseTimes[sender].totalTime / responseTimes[sender].count; // Average in milliseconds
//         const immediatePercentage = ((immediateReplies[sender] || 0) / (totalReplies[sender] || 1)) * 100; // Percentage of immediate replies

//         stats[sender] = {
//             averageTime: (averageTime / 1000 / 60).toFixed(1), // Convert to minutes
//             immediatePercentage: immediatePercentage.toFixed(1), // Round to 1 decimal place
//         };
//     }

//     return stats;
// }

function generateColumnChartData(messageCounts, startDate, endDate) {
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
    personA: 0, // Messages focused on Person A
    personB: 0, // Messages focused on Person B
};

// Regex to extract the message content
const regex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\] ([^:]+): (.+)/;

lines.forEach(line => {
    const match = line.match(regex);
    if (match) {
        const sender = match[7].trim();
        const message = match[8].toLowerCase(); // Convert to lowercase for easier matching

        // Check if the message is about Person A or Person B
        const isAboutPersonA = message.includes(senders[0].toLowerCase());
        const isAboutPersonB = message.includes(senders[1].toLowerCase());

        // Check for "I" or "I'm" (focus on the sender)
        const isAboutSelf = message.includes("i ") || message.includes("i'm ") || message.includes("im ") || message.includes("i'll ") || 
        message.includes("i am ") || message.includes("ill ") || message.includes("i've ") || message.includes("ive ") || 
        message.includes("me ") || message.includes("my ") || message.includes("mine ") || message.includes("myslf ") || 
        message.includes("self ") || message.includes("i m ") || message.includes("I'm ") || message.includes("imma ") || 
        message.includes("mah ") || message.includes("i'v ") || message.includes("i'l ");


        // Check for "you" or "you're" (focus on the other person)
        const isAboutOther = message.includes("you ") || message.includes("you're ") || message.includes("youre ") || 
                message.includes("ur ") || message.includes("yoou ") || message.includes("u ") || message.includes("yu ") || 
                message.includes("u're ") || message.includes("yoo ") || message.includes("yore ") || message.includes("you r ") || 
                message.includes("yer ") || message.includes("yuor ") || message.includes("urself ") || message.includes("urs ") || 
                message.includes("your ") || message.includes("yourself ") || message.includes("yo're ") || message.includes("urselfs ");


        if (sender === senders[0]) {
            // Person A is speaking
            if (isAboutPersonB || isAboutOther) {
                focusCounts.personB += 1; // Focus on Person B
            } else if (isAboutPersonA || isAboutSelf) {
                focusCounts.personA += 1; // Focus on Person A
            }
        } else if (sender === senders[1]) {
            // Person B is speaking
            if (isAboutPersonA || isAboutOther) {
                focusCounts.personA += 1; // Focus on Person A
            } else if (isAboutPersonB || isAboutSelf) {
                focusCounts.personB += 1; // Focus on Person B
            }
        }
    }
});

// Calculate percentages
const totalMessages = focusCounts.personA + focusCounts.personB;
const percentages = {
    personA: ((focusCounts.personA / totalMessages) * 100).toFixed(1),
    personB: ((focusCounts.personB / totalMessages) * 100).toFixed(1),
};

return percentages;
}

function analyzeContent(text, region) {
    const lines = text.split('\n');
    const contentStats = {
        laughs: {},
        questions: {},
        apologies: {},
    };

    // Get the list of senders from global stats
    const senders = Object.keys(window.stats || {});

    // Flexible regex pattern: allows one or two digits for day/month, optional spaces after comma.
    const regex = /\[(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{1,2}):(\d{1,2})\]\s*([^:]+):\s*(.+)/;

    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            // Normalize the sender to lowercase
            const sender = match[7].trim().toLowerCase();
            const message = match[8].toLowerCase();

            const laughPatterns = ["lol", "lmao", "lmfao", "rofl", "haha", "hehe", "hah", "heh", "bahaha", "xD", "lulz", "lool", "lel", "lawl", "😂", "😆", "🤣"];
            if (laughPatterns.some(pattern => message.includes(pattern))) {
                contentStats.laughs[sender] = (contentStats.laughs[sender] || 0) + 1;
            }
            
            // Check for questions
            const questionPatterns = ["?", "what", "wut", "wat", "how", "hw", "why", "y", "when", "wen", "where", "wer", "who", "whom", "which", 
                                      "whitch", "is there", "is thr", "are you", "r u", "wht", "can you", "cud u", "could you", "shud u", "should you"];
            if (questionPatterns.some(pattern => message.includes(pattern))) {
                contentStats.questions[sender] = (contentStats.questions[sender] || 0) + 1;
            }
            
            // Check for apologies
            const apologyPatterns = ["sorry", "srry", "sry", "apologies", "apology", "mb", "my bad", "forgive me", "i apologize", "pardon me", 
                                     "excuse me", "oops", "oopsie", "so sorry", "so srry", "so sry", "terribly sorry"];
            if (apologyPatterns.some(pattern => message.includes(pattern))) {
                contentStats.apologies[sender] = (contentStats.apologies[sender] || 0) + 1;
            }
        }
    });

    return contentStats;
}

function analyzeInteractions(text, region) {
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

function analyzeCalls(text, region) {
    const lines = text.split('\n');
    const callStats = {
        total: 0,
        longestCalls: []
    };

    lines.forEach(line => {
        // Remove invisible characters
        const cleanLine = line.replace(/[\u200E\u200F]/g, "");
        const callRegex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\] ([^:]+): (.*)/;
        const callMatch = cleanLine.match(callRegex);

        if (callMatch) {
            // Use trimmed text for safety
            const callText = callMatch[8].trim();
            const isVoiceCall = callText.startsWith("Voice call");
            const isVideoCall = callText.startsWith("Video call");
            
            if (isVoiceCall || isVideoCall) {
                callStats.total++;
                const duration = extractCallDuration(callText);
                if (duration > 0) {
                    callStats.longestCalls.push({
                        sender: callMatch[7].trim(),
                        duration: duration,
                        formattedDuration: formatDuration(duration),
                        type: isVideoCall ? "Video" : "Voice"
                    });
                }
            }
        }
    });

    // Sort and keep top 3
    callStats.longestCalls.sort((a, b) => b.duration - a.duration);
    callStats.longestCalls = callStats.longestCalls.slice(0, 3);

    // Make it available globally
    window.callStats = callStats;
    return callStats;
}


function formatDuration(minutes) {
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    
    if (mins > 0) {
        return `${mins} min`;
    } else {
        return `${secs} sec`;
    }
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

function calculateConvoStats(text, region) {
    const lines = text.split('\n');
    const parsedMessages = [];
    const timestampRegex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\]/;
    const senderRegex = /\] ([^:]+):/;

    // Settings for grouping
    const maxGap = 10 * 60 * 1000;      // 10 minutes between messages
    const newConvoGap = 30 * 60 * 1000; // 30 minutes gap to start new conversation
    const minDuration = 2 * 60 * 1000;  // 2 minute minimum duration
    const minMessages = 4;              // 4 messages minimum (2 per participant)

    // Parse messages
    lines.forEach(line => {
        const timeMatch = line.match(timestampRegex);
        if (timeMatch) {
            const day = region === "US" ? timeMatch[2] : timeMatch[1];
            const month = region === "US" ? timeMatch[1] : timeMatch[2];
            const year = timeMatch[3];
            const hour = timeMatch[4];
            const minute = timeMatch[5];
            const second = timeMatch[6];
            const timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).getTime();
            
            let sender = null;
            const senderMatch = line.match(senderRegex);
            if (senderMatch) {
                sender = senderMatch[1].trim();
            }
            
            parsedMessages.push({ timestamp, sender, line });
        }
    });
    
    // Sort messages by time
    parsedMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Group messages into candidate conversations
    let candidateConvos = [];
    let currentGroup = [];
    
    for (let i = 0; i < parsedMessages.length; i++) {
        const message = parsedMessages[i];
        
        if (currentGroup.length === 0) {
            currentGroup.push(message);
        } else {
            const gap = message.timestamp - parsedMessages[i - 1].timestamp;
            
            // Check for monologues (3+ messages from same sender)
            if (currentGroup.length >= 3) {
                const lastThreeSenders = currentGroup.slice(-3).map(m => m.sender);
                if (new Set(lastThreeSenders).size === 1) {
                    // Finalize previous group if it meets criteria
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
                // Finalize current group if it meets criteria
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
    
    // Finalize the last group
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

    // Merge conversations if gap between them is less than newConvoGap
    const mergedConvos = [];
    if (candidateConvos.length > 0) {
        let currentMerged = { ...candidateConvos[0] };
        
        for (let i = 1; i < candidateConvos.length; i++) {
            const convo = candidateConvos[i];
            if (convo.startTime - currentMerged.endTime < newConvoGap) {
                // Merge
                currentMerged.endTime = convo.endTime;
                currentMerged.messageCount += convo.messageCount;
            } else {
                mergedConvos.push(currentMerged);
                currentMerged = { ...convo };
            }
        }
        mergedConvos.push(currentMerged);
    }

    // Calculate statistics
    const overallCount = mergedConvos.length;
    const totalMessages = mergedConvos.reduce((sum, conv) => sum + conv.messageCount, 0);
    const overallAverage = overallCount > 0 ? totalMessages / overallCount : 0;

    // Define time periods for frequency comparison
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    const last30 = mergedConvos.filter(conv => conv.startTime >= now - thirtyDays);
    const prev30 = mergedConvos.filter(conv => conv.startTime < now - thirtyDays && conv.startTime >= now - 2 * thirtyDays);

    // Calculate percentage change
    let freqPercentageChange = 0;
    if (prev30.length > 0) {
        freqPercentageChange = ((last30.length - prev30.length) / prev30.length) * 100;
    } else if (last30.length > 0) {
        freqPercentageChange = 100;
    }

    return {
        averageLength: overallAverage.toFixed(1),
        frequencyLast30: last30.length,
        frequencyPrev30: prev30.length,
        freqPercentageChange: Number(freqPercentageChange.toFixed(1)),
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
function calculateStreakStats(text, region) {
    const lines = text.split('\n');
    // Regex for format: "[12/04/2023, 17:09:50] Camille: Message"
    const regex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\] ([^:]+):/;
    
    // Track daily messages and which senders contributed each day.
    const dailyMessages = {};
    
    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            const day = region === "US" ? match[2] : match[1];
            const month = region === "US" ? match[1] : match[2];
            const year = match[3];
            const dateKey = `${year}-${month}-${day}`; // Format: YYYY-MM-DD
            
            const sender = match[7].trim();
            
            if (!dailyMessages[dateKey]) {
                dailyMessages[dateKey] = { count: 0, senders: new Set() };
            }
            dailyMessages[dateKey].count++;
            dailyMessages[dateKey].senders.add(sender);
        }
    });
    
    // Get sorted dates in ascending order.
    const sortedDates = Object.keys(dailyMessages).sort();
    
    // Filter valid dates: at least 7 messages and at least 2 different senders.
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




function displayAIResults(data, originalNames) {
    const aiSection = document.getElementById("aiAnalysisSection");
    if (!aiSection) return;
  
    // Remove loading container if it exists
    const loadingContainer = document.getElementById("aiLoadingContainer");
    if (loadingContainer) {
        loadingContainer.remove();
    }

    // Remove any existing analysis results from a previous run
    const oldResults = aiSection.querySelectorAll(".analysis-result");
    oldResults.forEach(el => el.remove());
  
    // Remove the (now unused) Analyze with AI button if it exists to avoid an empty container.
    const aiButton = document.getElementById("aiAnalysisButton");
    if (aiButton && aiButton.parentNode) {
      aiButton.parentNode.removeChild(aiButton);
    }
  
    // Create Overall Analysis container (Overall Connection and Evolution)
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
  
    // Append Overall Analysis container to the AI section.
    aiSection.appendChild(overallContainer);
  
    // Participant Analysis
    let participantA = null;
    let participantB = null;
  
    if (data.participants?.length === 2) {
        const [p1, p2] = data.participants;
  
        // Use your stringSimilarity helper to match names
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
  
        // Force original names from the chat
        participantA.name = originalNames.personA;
        participantB.name = originalNames.personB;
  
        // Create a container for each participant’s analysis.
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
  
    // Response Analysis (if available)
    const renderResponseAnalysis = () => {
        try {
            const responseContainer = document.createElement("div");
            responseContainer.className = "ai-results-container analysis-result";
            
            // Use original names consistently
            const nameA = originalNames.personA;
            const nameB = originalNames.personB;

            // Get explanations using multiple fallback strategies
            const explanationA = data.responseAnalysis?.[nameA]?.explanation ||
                               data.responseAnalysis?.participantA?.explanation ||
                               data.participants?.[0]?.responsePattern ||
                               "No response analysis available";

            const explanationB = data.responseAnalysis?.[nameB]?.explanation ||
                               data.responseAnalysis?.participantB?.explanation ||
                               data.participants?.[1]?.responsePattern ||
                               "No response analysis available";

            responseContainer.innerHTML = `
                <div class="ai-section">
                    <h3>Response Patterns</h3>
                    <div class="response-analysis-content">
                        <div class="participant-response">
                            <h4>${nameA}</h4>
                            <p>${explanationA}</p>
                        </div>
                        <div class="participant-response">
                            <h4>${nameB}</h4>
                            <p>${explanationB}</p>
                        </div>
                    </div>
                </div>
            `;

            aiSection.appendChild(responseContainer);
        } catch (error) {
            console.error('Failed to render response analysis:', error);
            const errorDiv = document.createElement("div");
            errorDiv.className = "ai-error";
            errorDiv.textContent = "Could not display response analysis (see console for details)";
            aiSection.appendChild(errorDiv);
        }
    };

    // Ensure this runs last and has proper error handling
    setTimeout(() => {
        if (data.responseAnalysis || data.participants) {
            renderResponseAnalysis();
        }
    }, 100); // Small delay to ensure other elements are rendered first

  
    // Call the function to show the pop-up notification.
    showAnalysisCompletedPopup();
}

  

function showAnalysisCompletedPopup() {
    const popup = document.createElement("div");
    popup.className = "ai-popup";
    popup.innerHTML = `
        <div class="ai-popup-content">
            <button class="close-popup" onclick="this.parentElement.parentElement.remove()">×</button>
            <h2>AI Analysis Completed</h2>
            <p>Your chat analysis is now available.</p>
        </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => {
        if (popup.parentElement) {
            popup.parentElement.removeChild(popup);
        }
    }, 3000);
}


// Helper function for string similarity comparison
function stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // Simple similarity check - can be enhanced with more advanced algorithms
    str1 = str1.toLowerCase().trim();
    str2 = str2.toLowerCase().trim();
    
    // Check for exact match
    if (str1 === str2) return 1;
    
    // Check if one is contained in the other
    if (str1.includes(str2)) return 0.8;
    if (str2.includes(str1)) return 0.8;
    
    // Check for common patterns (like first name matching)
    const str1FirstWord = str1.split(' ')[0];
    const str2FirstWord = str2.split(' ')[0];
    if (str1FirstWord === str2FirstWord) return 0.7;
    
    // Check for abbreviations
    if (str1.startsWith(str2FirstWord) || str2.startsWith(str1FirstWord)) {
        return 0.6;
    }
    
    return 0;
}

   
async function handleAIClick() {
    // Check again for sign-in status before proceeding
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
      // Should not run analysis if not signed in
      return;
    }
  
    // Get the chat file (assuming the file input is present and already processed)
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
  
        const preprocessed = preprocessChatForAI(text, document.getElementById('regionSelect').value);
        if (!preprocessed) {
          alert('AI analysis is only available for chats with exactly two participants.');
          return;
        }
  
        // (Optionally, you might want to disable the analysis spinner here)
        const results = await analyzeWithAI(preprocessed.processedText);
        
        // Add artificial delay for larger files
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 500)); // Minimum 500ms delay
        const processingTime = Date.now() - startTime;
        
        if (processingTime < 1000) { // Add extra delay if processing was too fast
            await new Promise(resolve => setTimeout(resolve, 1000 - processingTime));
        }

        // Force UI refresh
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        displayAIResults(results, preprocessed.originalNames);
    } catch (error) {
        console.error('AI analysis failed:', error);
        // Fallback UI showing error
        const aiSection = document.getElementById("aiAnalysisSection");
        if (aiSection) {
            const errorDiv = document.createElement("div");
            errorDiv.className = "ai-error";
            errorDiv.innerHTML = `
                <h3>Analysis Error</h3>
                <p>${error.message}</p>
                <p>Full analysis data is available in console.</p>
            `;
            aiSection.appendChild(errorDiv);
        }
        // Still log the results if they exist
        if (results) console.log("Raw AI Results:", results);
    }
    };
  
    if (file.name.endsWith('.zip')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
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
        // When signed in: show loading state initially
        aiSection.innerHTML = `
            <h2 class="title subtitle">AI Analysis</h2>
            <div class="ai-analysis-container">
                <div id="aiLoadingContainer" class="ai-results-container loading">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Analyzing with AI...</div>
                </div>
            </div>
        `;
        // Auto-start the AI analysis after a short delay
        setTimeout(() => {
            handleAIClick();
        }, 500);
    } else {
        // When not signed in: display structured placeholders with selective blur
        aiSection.innerHTML = `
            <h2 class="title subtitle">AI Analysis</h2>
            <div class="ai-analysis-container">
                <!-- Overall Connection Placeholder -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3>Overall Connection</h3>
                        <div class="blurred-background">
                            <div class="blurred-content">
                                <p><strong>Placeholder</strong></p>
                                <p>Curabitur non nisi erat. Fusce ac mi id ipsum congue maximus ut a mauris. Ut in iaculis enim. Nunc sollicitudin quam odio, eu porttitor dui facilisis sed.</p>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Participant 1 Analysis Placeholder -->
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
                                    <p>Mauris commodo sem et mollis molestie. Vivamus mollis dui quis elementum consequat. Suspendisse commodo in ligula ut scelerisque.</p>
                                </div>
                            </div>
                            <div class="flags-section">
                                <div class="green-flags">
                                    <h4>Green Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item green-flag">
                                            <strong>Positive Trait:</strong> Mauris commodo sem et mollui quis eleme commodo in ligula ut scelerisque.
                                        </div>
                                        <div class="flag-item green-flag">
                                            <strong>Positive Trait:</strong> Sign in to see green flags
                                        </div>
                                    </div>
                                </div>
                                <div class="red-flags">
                                    <h4>Red Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item red-flag">
                                            <strong>Potential Concern:</strong>usequat. Suspendisse commodo in ligula ut scelerisque. Sed fringilla in neque at ornare. Aliquam erat volutpat. Nu
                                        </div>
                                        <div class="flag-item red-flag">
                                            <strong>Potential Concern:</strong> Mauris commodo s molestie. Vivamus mollis dui quis elementum consequat. Suspendisse commodo in ligula ut scelerisque. Sed fringilla in neque at ornare. Aliquam erat 
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="relationship-tip">
                                <h4>Relationship Tip</h4>
                                <div class="blurred-content">
                                    <div class="tip-item">
                                        <strong>Suggestion:</strong>
                                        <p>Mauris commodo sem et mollis molestie. Vivgula. Nunc tortor enim, auctor at lacinia vel, pulvinar quis neque.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton1" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Participant 2 Analysis Placeholder -->
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
                                    <p>Mauris commodo sem et mollis molestie. Vivamus mollis dui quis elementum consequat. Suspendisse commodo in ligula ut scelerisque.</p>
                                </div>
                            </div>
                            <div class="flags-section">
                                <div class="green-flags">
                                    <h4>Green Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item green-flag">
                                            <strong>Positive Trait:</strong> Mauris commodo sollis dui quis elementum consequat. Suspendisse commodo in ligula ut scelerisque.
                                        </div>
                                        <div class="flag-item green-flag">
                                            <strong>Positive Trait:</strong> Sign in to see green flags
                                        </div>
                                    </div>
                                </div>
                                <div class="red-flags">
                                    <h4>Red Flags</h4>
                                    <div class="blurred-content">
                                        <div class="flag-item red-flag">
                                            <strong>Potential Concern:</strong> Mauris commodo sem et mollis molestie. Vivula ut scelerisque. Sed fringilla in neque at ornare. Aliquam erat volutpat. Nu
                                        </div>
                                        <div class="flag-item red-flag">
                                            <strong>Potential Concern:</strong>  mollis molestie. Vivamus isse commodo in ligula ut scelerisque. Sed fringilla in neque at ornare. Aliquam erat 
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="relationship-tip">
                                <h4>Relationship Tip</h4>
                                <div class="blurred-content">
                                    <div class="tip-item">
                                        <strong>Suggestion:</strong>
                                        <p>ui quis elementum consequat. Suspendisse commodo in ligula ut scelerisque. Sed fringilla in neque at ornare. Aliquam erat volutpat. Nulla et ultricies ligula. Nunc tortor enim, auctor at lacinia vel, pulvinar quis neque.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton2" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
                <!-- Response Analysis Placeholder -->
                <div class="ai-results-container placeholder">
                    <div class="ai-section">
                        <h3 class="title subtitle">Response Analysis</h3>
                        <div class="blurred-background">
                            <div class="blurred-content">
                                <div class="ai-content">
                                    <p>Integer tempus ligula sit amet mauris ullamcorper, et accumsan odio ornare. Curabitur eleifend odio quis velit congue fermentum.                                     
                                     </p>
                                </div>
                                <div class="ai-content">
                                    <p>Nullam pulvinar mauris nec urna tincidunt ull.Nullam pulvinar mauris nec urna tincidunt ullamvida. Ut id p r mauris nec urna tincidunt ullamvida. Ut id p                                 
                                     </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ai-container-overlay">
                        <div class="ai-container-overlay-content">
                            <p>Sign in to see full analysis</p>
                            <div id="aiSigninButton3" class="g-signin2"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize Google Sign-In buttons after a small delay
        setTimeout(() => {
            if (window.google && google.accounts && google.accounts.id) {
                initializeAllGoogleSignins();
            }
        }, 100);
    }
    
    // Append the AI analysis section to the designated container
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");
    (chatAnalyticsSection || document.body).appendChild(aiSection);
    return aiSection;
}