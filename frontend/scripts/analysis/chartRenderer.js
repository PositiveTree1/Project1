function renderStackedColumnChart(columnChartData, callback) {
    // Retrieve original data and sender list
    const originalData = columnChartData.data;
    const senders = columnChartData.senders;
    
    // Get the timeline section container
    const timelineSection = document.getElementById("timelineSection");
    if (!timelineSection) {
        console.error("Error: timelineSection not found in the HTML.");
        return;
    }
    timelineSection.innerHTML = ""; // Clear any existing content
    
    // Add "Date & Times" title
    const dateTimesTitle = document.createElement('h1');
    dateTimesTitle.className = 'title main-title';
    dateTimesTitle.textContent = 'Date & Times';
    timelineSection.appendChild(dateTimesTitle);

    // Create container for Timeline chart
    const timelineCard = document.createElement('div');
    timelineCard.className = 'chart-card timeline-chart-card';
    timelineSection.appendChild(timelineCard);
    
    // Add title above the container
    const timelineTitle = document.createElement('h2');
    timelineTitle.className = 'chart-card-title';
    timelineTitle.textContent = 'Timeline';
    timelineCard.appendChild(timelineTitle);
    
    // Create chart container div with special class for wider desktop view
    const columnChartDiv = document.createElement('div');
    columnChartDiv.id = 'columnchartdiv';
    columnChartDiv.className = 'timeline-chart-container';
    timelineCard.appendChild(columnChartDiv);

    // Calculate total messages per day (sum of all senders)
    const dailyTotals = originalData.map(dayData => {
        let total = 0;
        for (const sender in dayData) {
            if (sender !== 'date' && sender !== 'dateLabel') {
                total += dayData[sender] || 0;
            }
        }
        return {
            date: dayData.date,
            dateLabel: dayData.dateLabel,
            total: total
        };
    });

    // Limit data points to approximately 130 by grouping days if necessary
    const maxDataPoints = 130;
    let limitedData = dailyTotals;
    if (dailyTotals.length > maxDataPoints) {
        const chunkSize = Math.ceil(dailyTotals.length / maxDataPoints);
        limitedData = [];
        
        for (let i = 0; i < dailyTotals.length; i += chunkSize) {
            const chunk = dailyTotals.slice(i, i + chunkSize);
            const chunkTotal = chunk.reduce((sum, day) => sum + day.total, 0);
            
            limitedData.push({
                date: chunk[0].date,
                dateLabel: chunk[0].dateLabel,
                total: chunkTotal // Total messages in this time period
            });
        }
    }

    // Clear any existing content (already done above)
    columnChartDiv.innerHTML = "";
    
    // Create and configure the canvas element with proper responsive settings
    const canvas = document.createElement("canvas");
    canvas.id = "columnChartCanvas";
    canvas.style.width = "100%";
    canvas.style.maxWidth = "100%";
    canvas.style.display = "block";
    canvas.style.height = window.innerWidth < 768 ? "200px" : "300px";
    columnChartDiv.appendChild(canvas);
    
    
    // Prepare labels from the limited data using the dateLabel field
    const labels = limitedData.map(dp => dp.dateLabel);
    
    // Use the total message counts for the chart
    const dataValues = limitedData.map(dp => dp.total);

    // Create a single dataset for the message values
    const dataset = {
        label: "Messages",
        data: dataValues,
        borderColor: "#a044ff",
        backgroundColor: "rgba(106, 48, 147, 0.1)",
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 0,
        borderCapStyle: 'round',
        borderJoinStyle: 'round',
        fill: {
            target: 'origin',
            above: 'rgba(106, 48, 147, 0.1)'
        }
    };

    // Create the Chart.js line chart with no legend
    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [dataset]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 0,    // Remove default padding
                    right: 0,   // Remove default padding
                    top: 10,
                    bottom: 10
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} messages`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { display: false },
                    ticks: {
                        autoSkip: false,
                        maxRotation: 0,
                        minRotation: 0,
                        padding: 5,
                        callback: function(value, index, ticks) {
                            if (index === 0 || index === ticks.length - 1) return labels[index];
                            const interval = Math.ceil(ticks.length / 5);
                            if (index % interval === 0) return labels[index];
                            return "";
                        }
                    }
                },
                y: {
                    display: true,
                    grid: { display: false },
                    beginAtZero: true
                }
            }
        }
    });

    // Invoke the callback (if provided) once the chart is rendered
    if (callback) callback();
}


function renderHourlyChart(hourlyData) {
    // Compute average messages per hour across all senders.
    const averageHourlyData = hourlyData.map(dp => {
        let sum = 0, count = 0;
        for (let key in dp) {
            if (key !== "hour") {
                sum += dp[key];
                count++;
            }
        }
        return { hour: dp.hour, average: count ? sum / count : 0 };
    });

    // Get the timeline section
    const timelineSection = document.getElementById("timelineSection");

    // Create a container for the Hourly chart
    const hourlyCard = document.createElement('div');
    hourlyCard.className = 'chart-card';
    timelineSection.appendChild(hourlyCard);

    // Add title
    const hourlyTitle = document.createElement('h2');
    hourlyTitle.className = 'chart-card-title';
    hourlyTitle.textContent = 'Hourly Activity';
    hourlyCard.appendChild(hourlyTitle);

    // Create chart container
    const hourlyChartDiv = document.createElement('div');
    hourlyChartDiv.id = 'hourlychartdiv';
    hourlyCard.appendChild(hourlyChartDiv);

    // Create canvas for Chart.js
    const canvas = document.createElement("canvas");
    hourlyChartDiv.appendChild(canvas);

    // Prepare labels (time labels) and data arrays.
    const labels = averageHourlyData.map(dp => dp.hour);
    const dataValues = averageHourlyData.map(dp => dp.average);

    // Create the Chart.js line chart
    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '', // No legend label
                data: dataValues,
                borderColor: "#a044ff", // --secondary-color
                backgroundColor: "rgba(106, 48, 147, 0.1)", // --primary-color with 10% opacity
                borderWidth: 3,
                tension: 0.3,
                pointRadius: 0, // Remove data points
                borderCapStyle: 'round',
                borderJoinStyle: 'round',
                fill: {
                    target: 'origin',
                    above: "rgba(106, 48, 147, 0.1)" // --primary-color with 10% opacity
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // Hide legend
                tooltip: {
                    backgroundColor: '#6a3093', // --primary-color
                    titleColor: '#fff',
                    bodyColor: '#f3e5ff', // --accent-color
                    borderColor: '#a044ff', // --secondary-color
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { 
                        display: false,
                        color: 'rgba(106, 48, 147, 0.1)' // --primary-color with 10% opacity
                    },
                    ticks: {
                        color: '#6a3093', // --primary-color
                        autoSkip: false,
                        maxRotation: 0,
                        minRotation: 0,
                        padding: 10,
                        callback: function(value, index, ticks) {
                            if (index === 0 || index === ticks.length - 1) return labels[index];
                            const interval = Math.ceil(ticks.length / 5);
                            return (index % interval === 0) ? labels[index] : "";
                        }
                    }
                },
                y: {
                    display: true,
                    grid: { 
                        display: false,
                        color: 'rgba(106, 48, 147, 0.1)' // --primary-color with 10% opacity
                    },
                    ticks: {
                        color: '#6a3093' // --primary-color
                    },
                    beginAtZero: true
                }
            }
        }
    });
}


// In chartRenderer.js

function renderWeekdayChart(weekdayData) {
    // Compute average messages per weekday across all senders.
    const averageWeekdayData = weekdayData.map(dp => {
        const senderValues = Object.keys(dp).filter(key => key !== "weekday").map(key => dp[key]);
        const sum = senderValues.reduce((acc, val) => acc + val, 0);
        const count = senderValues.length;
        return { weekday: dp.weekday, average: count ? sum / count : 0 };
    });

    const timelineSection = document.getElementById("timelineSection");
    
    // Create container for Weekday chart
    const weekdayCard = document.createElement('div');
    weekdayCard.className = 'chart-card';
    timelineSection.appendChild(weekdayCard);
    
    // Add title
    const weekdayTitle = document.createElement('h2');
    weekdayTitle.className = 'chart-card-title';
    weekdayTitle.textContent = 'Weekday Activity';
    weekdayCard.appendChild(weekdayTitle);
    
    // Create chart container
    const weekdayChartDiv = document.createElement('div');
    weekdayChartDiv.id = 'weekdaychartdiv';
    weekdayCard.appendChild(weekdayChartDiv);

    // Create and append canvas
    const canvas = document.createElement("canvas");
    weekdayChartDiv.appendChild(canvas);
    
    // Prepare the labels and data arrays.
    const labels = averageWeekdayData.map(dp => dp.weekday);
    const dataValues = averageWeekdayData.map(dp => dp.average);

    // Create the Chart.js line chart with your color scheme
    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '', // No legend label
                data: dataValues,
                borderColor: "#a044ff", // --secondary-color
                backgroundColor: "rgba(106, 48, 147, 0.1)", // --primary-color with 10% opacity
                borderWidth: 3,
                tension: 0.3,
                pointRadius: 0, // Remove data points
                borderCapStyle: 'round',
                borderJoinStyle: 'round',
                fill: {
                    target: 'origin',
                    above: "rgba(106, 48, 147, 0.1)" // --primary-color with 10% opacity
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Hide legend
                },
                tooltip: {
                    backgroundColor: '#6a3093', // --primary-color
                    titleColor: '#fff',
                    bodyColor: '#f3e5ff', // --accent-color
                    borderColor: '#a044ff', // --secondary-color
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { 
                        display: false,
                        color: 'rgba(106, 48, 147, 0.1)' // --primary-color with 10% opacity
                    },
                    ticks: {
                        color: '#6a3093', // --primary-color
                        autoSkip: false,
                        maxRotation: 0,
                        minRotation: 0,
                        padding: 10,
                        callback: function(value, index, ticks) {
                            // Always show first and last labels.
                            if (index === 0 || index === ticks.length - 1) return labels[index];
                            // Otherwise, calculate an interval to show a few labels.
                            const interval = Math.ceil(ticks.length / 5);
                            if (index % interval === 0) return labels[index];
                            return "";
                        }
                    }
                },
                y: {
                    display: true,
                    grid: { 
                        display: false,
                        color: 'rgba(106, 48, 147, 0.1)' // --primary-color with 10% opacity
                    },
                    ticks: {
                        color: '#6a3093' // --primary-color
                    },
                    beginAtZero: true
                }
            }
        }
    });
}


function renderPersonBoxes(stats, uniqueWords, topEmojis, longestMessage, colors) {
    const personBoxesContainer = document.getElementById("personBoxesContainer");
    personBoxesContainer.innerHTML = ""; // Clear any existing boxes

    // Add "Content Analysis" title with proper spacing container
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");
    if (chatAnalyticsSection) {
        // Remove any existing title container to avoid duplicates
        const existingTitleContainer = chatAnalyticsSection.querySelector(".content-analysis-header");
        if (existingTitleContainer) existingTitleContainer.remove();
        
        // Create a container div for the title with proper spacing
        const titleContainer = document.createElement("div");
        titleContainer.className = "content-analysis-header";
        
        // Create the title element
        const contentAnalysisTitle = document.createElement("h1");
        contentAnalysisTitle.className = "title main-title";
        contentAnalysisTitle.textContent = "Content Analysis";
        
        // Add the title to the container
        titleContainer.appendChild(contentAnalysisTitle);
        
        // Insert the container before the person boxes
        personBoxesContainer.parentNode.insertBefore(titleContainer, personBoxesContainer);
    }

    // Calculate the total number of messages
    const totalMessages = Object.values(stats).reduce((sum, count) => sum + count, 0);

    // Loop through each person in the stats
    Object.entries(stats).forEach(([sender, count]) => {
        const box = document.createElement("div");
        box.classList.add("person-box");

        // Add the person's name
        const name = document.createElement("h2");
        name.textContent = sender;
        box.appendChild(name);

        // Add the message count and percentage
        const messageCountContainer = document.createElement("div");
        messageCountContainer.style.display = "flex";
        messageCountContainer.style.alignItems = "center";
        messageCountContainer.style.marginBottom = "10px";

        const messageCountText = document.createElement("span");
        messageCountText.textContent = `Messages: ${count}`;
        messageCountText.style.marginRight = "10px";
        messageCountContainer.appendChild(messageCountText);

        const percentage = ((count / totalMessages) * 100).toFixed(1); // Calculate percentage
        const percentageBar = document.createElement("div");
        percentageBar.style.width = "100px";
        percentageBar.style.height = "8px";
        percentageBar.style.backgroundColor = "#e0e0e0";
        percentageBar.style.borderRadius = "4px";
        percentageBar.style.position = "relative";
        percentageBar.style.overflow = "hidden";

        const percentageFill = document.createElement("div");
        percentageFill.style.width = `${percentage}%`;
        percentageFill.style.height = "100%";
        percentageFill.style.backgroundColor = colors[sender] || "#3e0057"; // Use the sender's color
        percentageFill.style.borderRadius = "4px";
        percentageBar.appendChild(percentageFill);

        const percentageText = document.createElement("span");
        percentageText.textContent = `${percentage}%`;
        percentageText.style.marginLeft = "10px";
        percentageText.style.fontSize = "14px";
        percentageText.style.color = "#666";

        messageCountContainer.appendChild(percentageBar);
        messageCountContainer.appendChild(percentageText);
        box.appendChild(messageCountContainer);

        // Add unique words count
        const uniqueWordsCount = document.createElement("p");
        uniqueWordsCount.textContent = `Unique Words: ${uniqueWords[sender]?.size || 0}`;
        box.appendChild(uniqueWordsCount);

        // Add longest message word count
        const longestMessageCount = document.createElement("p");
        longestMessageCount.textContent = `Longest Message: ${longestMessage[sender] || 0} words`;
        box.appendChild(longestMessageCount);

        // Add average words per message
        const averageWords = document.createElement("p");
        averageWords.textContent = `Avg Words/Message: ${window.averageWordsPerMessage[sender] || 0}`;
        box.appendChild(averageWords);

        // Add total swear words (with subtle styling)
        if (window.totalSwearWordsPerSender) {
            const swearWordsTotal = document.createElement("p");
            swearWordsTotal.textContent = `Total Curse Words: ${window.totalSwearWordsPerSender[sender] || 0}`;
            swearWordsTotal.style.marginTop = "10px"; // Add some spacing
            swearWordsTotal.style.color = "#70328f"; // Lighter color for subtle distinction
            swearWordsTotal.style.fontSize = "16px"; // Slightly smaller font size
            swearWordsTotal.style.fontStyle = "italic"; // Italic for a subtle difference
            box.appendChild(swearWordsTotal);
        }

        // Add top 3 emojis
        const emojiTitle = document.createElement("p");
        emojiTitle.textContent = "Top Emojis:";
        emojiTitle.style.fontWeight = "bold";
        emojiTitle.style.marginTop = "10px";
        box.appendChild(emojiTitle);

        const emojiList = document.createElement("div");
        emojiList.style.display = "flex";
        emojiList.style.flexWrap = "wrap";
        emojiList.style.gap = "5px";
        emojiList.style.marginTop = "5px";

        const topEmojisForSender = topEmojis[sender] || [];
        topEmojisForSender.forEach(([emoji, emojiCount]) => {
            const emojiItem = document.createElement("span");
            emojiItem.textContent = `${emoji} ×${emojiCount}`;
            emojiItem.style.fontSize = "18px";
            emojiItem.style.padding = "5px";
            emojiItem.style.backgroundColor = "#f0f0f0";
            emojiItem.style.borderRadius = "5px";
            emojiList.appendChild(emojiItem);
        });

        if (topEmojisForSender.length === 0) {
            const noEmojiText = document.createElement("span");
            noEmojiText.textContent = "N/A";
            noEmojiText.style.fontSize = "16px";
            noEmojiText.style.color = "#666";
            emojiList.appendChild(noEmojiText);
        }

        box.appendChild(emojiList);

        // Add the box to the container
        personBoxesContainer.appendChild(box);
    });
}
function renderCommunalWords(topCommunalWords) {
    const communalWordsContainer = document.getElementById("communalWordsContainer");
    communalWordsContainer.innerHTML = ""; // Clear any existing content

    // Add the title dynamically
    if (!document.querySelector('#communalWordsTitle')) {
        communalWordsContainer.insertAdjacentHTML('beforebegin', '<h2 id="communalWordsTitle" class="title subtitle">Top Words</h2>');
    }

    const communalWordsDiv = document.createElement("div");
    communalWordsDiv.id = "communalWords";
    communalWordsContainer.appendChild(communalWordsDiv);

    topCommunalWords.forEach((wordData, index) => {
        const wordElement = document.createElement("span");
        wordElement.textContent = wordData.word;
        wordElement.style.fontSize = `${Math.max(20, 40 - index * 2)}px`; // Larger words for higher counts
        wordElement.style.margin = "10px";
        wordElement.style.display = "inline-block";
        wordElement.style.animation = `float ${3 + index * 0.5}s infinite ease-in-out`;

        communalWordsDiv.appendChild(wordElement);
    });
}

function renderFloatingEmojis(topCommunalEmojis) {
    const floatingEmojisContainer = document.getElementById("floatingEmojisContainer");
    floatingEmojisContainer.innerHTML = "";
    
    // Add title
    if (!document.querySelector('#floatingEmojisTitle')) {
        floatingEmojisContainer.insertAdjacentHTML('beforebegin', '<h2 id="floatingEmojisTitle" class="title subtitle">Top Emojis</h2>');
    }
    // Create grid
    const gridContainer = document.createElement("div");
    gridContainer.id = "emojiGrid";
    floatingEmojisContainer.appendChild(gridContainer);

    // Add emojis
    topCommunalEmojis.forEach((emojiData, index) => {
        const emojiElement = document.createElement("div");
        emojiElement.className = "emoji-item";
        
        // Format large numbers
        const count = emojiData.count > 999 ? 
            `${(emojiData.count/1000).toFixed(1)}k` : 
            emojiData.count;
        
        emojiElement.innerHTML = `
            <span class="emoji">${emojiData.emoji}</span>
            <span class="count">×${count}</span>
        `;

        // Animation
        const duration = 3 + (index * 0.2);
        emojiElement.style.animation = `float ${duration}s ${index * 0.1}s infinite ease-in-out`;
        
        gridContainer.appendChild(emojiElement);
    });
}

// New function to render the Chat Analytics title
function renderChatAnalyticsTitle() {
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");
    // Remove any previous Chat Analytics title (if it exists)
    const previousTitle = chatAnalyticsSection.querySelector("h1.title.main-title");
    if (previousTitle) {
      previousTitle.remove();
    }
    // Create the Chat Analytics title element
    const titleElement = document.createElement("h1");
    titleElement.className = "title main-title";
    titleElement.textContent = "Chat Analytics";
    // Insert the title at the top of the chat analytics section
    chatAnalyticsSection.insertAdjacentElement("afterbegin", titleElement);
}
  
// In chartRenderer.js - modify renderConversationAnalysis
function renderConversationAnalysis(conversationStarts, conversationEnds) {
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");

    // Remove any existing Conversation Analysis section
    let convAnalysisSection = document.getElementById("conversationAnalysisSection");
    if (convAnalysisSection) {
        convAnalysisSection.remove();
    }

    // Create a new container for Conversation Analysis
    convAnalysisSection = document.createElement("div");
    convAnalysisSection.id = "conversationAnalysisSection";
    chatAnalyticsSection.appendChild(convAnalysisSection);

    // Add the "Conversation Analysis" title
    const convTitle = document.createElement("h2");
    convTitle.className = "title main-title";
    convTitle.textContent = "Conversation Analysis";
    convAnalysisSection.appendChild(convTitle);

    // Create the white container for "Who started the most conversations?"
    const startedContainer = document.createElement("div");
    startedContainer.className = "conversation-stats-container";
    convAnalysisSection.appendChild(startedContainer);

    // Build the "Who started the most conversations?" content
    let startedHTML = '<div class="conversation-stats">';
    startedHTML += '<p class="stat-summary">Who started the most conversations?</p>';
    startedHTML += '<ul class="conversation-list">';
    for (const sender in conversationStarts) {
        startedHTML += `<li><strong>${sender}:</strong> ${conversationStarts[sender]} times</li>`;
    }
    startedHTML += '</ul>';

    startedHTML += '</div>';

    startedContainer.innerHTML = startedHTML;

    // Create the white container for "Who ended the most conversations?" (only if there are exactly two people)
    if (Object.keys(conversationEnds).length === 2) {
        const endedContainer = document.createElement("div");
        endedContainer.className = "conversation-stats-container";
        endedContainer.style.marginTop = "20px";
        convAnalysisSection.appendChild(endedContainer);

        // Build the "Who ended the most conversations?" content
        let endedHTML = '<div class="conversation-stats">';
        endedHTML += '<p class="stat-summary">Who ended the most conversations?</p>';
        endedHTML += '<ul class="conversation-list">';
        for (const sender in conversationEnds) {
            endedHTML += `<li><strong>${sender}:</strong> ${conversationEnds[sender]} times</li>`;
        }
        endedHTML += '</ul>';

        endedHTML += '</div>';

        endedContainer.innerHTML = endedHTML;
    }
}

function renderPersonSelectionPanel(people) {
    // Save the full list globally
    const container = document.getElementById('personSelectionContainer');
    if (container) {
        container.remove();
    }
    
    // Still save the people list globally in case other functions need it
    window.allPeople = people;
}
  
function updateSelectedPeople() {
    const container = document.getElementById("personSelectionContainer");
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    let selected = [];
    checkboxes.forEach(chk => {
        if (chk.checked && chk.value !== "Other") {
            selected.push(chk.value);
        }
    });
    window.selectedPeople = selected;
    
    // "Other" will be computed as allPeople not selected.
    const allPeople = window.allPeople || [];
    const other = allPeople.filter(p => !selected.includes(p));
    window.selectedPeopleOther = other;
    
    // Now trigger re-rendering of the relevant analytics.
    if (window.renderPersonBoxes) {
        renderPersonBoxes(window.stats, window.uniqueWords, window.topEmojis, window.longestMessage, window.colors || {});
    }
    
    // Trigger recalculation of the entire dataset
    if (window.processChatLogFile) {
        const fileInput = document.getElementById('fileInput');
        const region = document.getElementById('regionSelect').value;
        const file = fileInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                processChatLogFile(text, region);
            };
            reader.readAsText(file);
        }
    }
}

function renderDoubleMessages(doubleMessageCounts) {
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");

    // Remove any existing section
    let doubleMessagesSection = document.getElementById("doubleMessagesSection");
    if (doubleMessagesSection) {
        doubleMessagesSection.remove();
    }

    // Create new container
    doubleMessagesSection = document.createElement("div");
    doubleMessagesSection.id = "doubleMessagesSection";
    chatAnalyticsSection.appendChild(doubleMessagesSection);

    // Create the white container box
    const container = document.createElement("div");
    container.className = "double-messages-container";
    doubleMessagesSection.appendChild(container);

    // Add title INSIDE the container
    const title = document.createElement("h2");
    title.className = "title subtitle";
    title.textContent = "Double Messages";
    container.appendChild(title);

    // Create radial container
    const radialContainer = document.createElement("div");
    radialContainer.className = "double-messages-radial";
    container.appendChild(radialContainer);

    

    // Find the maximum count for scaling the progress
    const maxCount = Math.max(...Object.values(doubleMessageCounts));

    // Create a radial progress chart for each sender
    for (const sender in doubleMessageCounts) {
        const count = doubleMessageCounts[sender];

        // Create the radial container
        const radial = document.createElement("div");
        radial.className = "radial";

        // Create the SVG element
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 100 100");

        // Create the background circle
        const backgroundCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        backgroundCircle.setAttribute("cx", "50");
        backgroundCircle.setAttribute("cy", "50");
        backgroundCircle.setAttribute("r", "45");
        backgroundCircle.classList.add("background");
        svg.appendChild(backgroundCircle);

        // Create the progress circle
        const progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        progressCircle.setAttribute("cx", "50");
        progressCircle.setAttribute("cy", "50");
        progressCircle.setAttribute("r", "45");
        progressCircle.classList.add("progress");
        progressCircle.style.stroke = window.colors[sender] || "#3d9c7d"; // Use the sender's color from the legend
        progressCircle.style.strokeDasharray = "282.743"; // Circumference of the circle (2 * π * r)
        progressCircle.style.strokeDashoffset = `${282.743 * (1 - (count / maxCount))}`; // Adjust progress
        svg.appendChild(progressCircle);

        // Add the SVG to the radial container
        radial.appendChild(svg);

        // Create the label
        const label = document.createElement("div");
        label.className = "label";

        // Add the sender name
        const name = document.createElement("div");
        name.className = "name";
        name.textContent = sender;
        label.appendChild(name);

        // Add the count
        const countText = document.createElement("div");
        countText.className = "count";
        countText.textContent = count;
        label.appendChild(countText);

        // Add the label to the radial container
        radial.appendChild(label);

        // Add the radial to the container
        radialContainer.appendChild(radial);
    }
}

function renderResponseTimes(responseStats) {
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");

    // Remove any existing Response Times section
    let responseTimesSection = document.getElementById("responseTimesSection");
    if (responseTimesSection) {
        responseTimesSection.remove();
    }

    // Create a new container for the Response Times section
    responseTimesSection = document.createElement("div");
    responseTimesSection.id = "responseTimesSection";
    responseTimesSection.className = "response-times-container"; // Add the class for styling
    chatAnalyticsSection.appendChild(responseTimesSection);

    // Add the title (styled as a subtitle)
    const title = document.createElement("h2");
    title.className = "title subtitle"; // Use the same class as other subtitles
    title.textContent = "Response Times";
    responseTimesSection.appendChild(title);

    // Create the stats container
    const statsContainer = document.createElement("div");
    statsContainer.className = "response-times-stats";
    responseTimesSection.appendChild(statsContainer);

    // Add stats for each sender
    for (const sender in responseStats) {
        const { averageTime, immediatePercentage } = responseStats[sender];

        // Create a stat container
        const stat = document.createElement("div");
        stat.className = "response-times-stat";

        // Add the sender name
        const name = document.createElement("div");
        name.className = "name";
        name.textContent = sender;
        stat.appendChild(name);

        // Add the average response time
        const time = document.createElement("div");
        time.className = "time";
        time.textContent = `Average Response Time: ${averageTime} minutes`;
        stat.appendChild(time);

        // Add the percentage of immediate replies
        const immediate = document.createElement("div");
        immediate.className = "immediate";
        immediate.textContent = `Immediate Replies: ${immediatePercentage}%`;
        stat.appendChild(immediate);

        // Add the stat to the container
        statsContainer.appendChild(stat);
    }
}
function renderChatFocusChart(percentages, senders) {
    const chatFocusSection = document.getElementById("chatAnalyticsSection");

    // Remove any existing Chat Focus section
    let chatFocusContainer = document.getElementById("chatFocusContainer");
    if (chatFocusContainer) {
        chatFocusContainer.remove();
    }

    // Create a new container for the Chat Focus section
    chatFocusContainer = document.createElement("div");
    chatFocusContainer.id = "chatFocusContainer";
    chatFocusContainer.className = "chat-focus-container";
    chatFocusSection.appendChild(chatFocusContainer);

    // Add the title (styled as a subtitle)
    const title = document.createElement("h2");
    title.className = "title subtitle";
    title.textContent = "Chat Focus";
    chatFocusContainer.appendChild(title);

    // Create the chart container
    const chartDiv = document.createElement("div");
    chartDiv.className = "chart-focus-wrapper";
    chatFocusContainer.appendChild(chartDiv);

    // Create canvas element
    const canvas = document.createElement("canvas");
    canvas.id = "chatFocusChart";
    chartDiv.appendChild(canvas);

    // Create a container for the labels
    const labelsContainer = document.createElement("div");
    labelsContainer.className = "chart-labels";
    chatFocusContainer.appendChild(labelsContainer);

    // Prepare data for Chart.js
    const data = {
        labels: senders,
        datasets: [{
            data: [percentages.personA, percentages.personB],
            backgroundColor: [
                window.colors[senders[0]] || '#36A2EB',
                window.colors[senders[1]] || '#FF6384'
            ],
            borderColor: '#fff',
            borderWidth: 2,
            cutout: '70%' // This makes it a donut chart
        }]
    };

    // Create the Chart.js donut chart
    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // We'll use our custom legend
                }
            }
        }
    });

    // Add custom labels with colors
    senders.forEach((sender, index) => {
        const percentageKey = `person${index === 0 ? 'A' : 'B'}`;
        const percentageValue = percentages[percentageKey];

        const labelDiv = document.createElement("div");
        labelDiv.className = "chart-label";

        const colorBox = document.createElement("div");
        colorBox.className = "color-box";
        colorBox.style.backgroundColor = window.colors[sender]; // Use the color from global colors object

        const nameSpan = document.createElement("span");
        nameSpan.className = "name";
        nameSpan.textContent = `${sender} (${percentageValue}%)`;

        labelDiv.appendChild(colorBox);
        labelDiv.appendChild(nameSpan);
        labelsContainer.appendChild(labelDiv);
    });
}

function renderContentAnalysis(contentStats) {
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");

    // Remove any existing Content Analysis section
    let contentAnalysisSection = document.getElementById("contentAnalysisSection");
    if (contentAnalysisSection) {
        contentAnalysisSection.remove();
    }

    // Create a new container for the Content Analysis section
    contentAnalysisSection = document.createElement("div");
    contentAnalysisSection.id = "contentAnalysisSection";
    chatAnalyticsSection.appendChild(contentAnalysisSection);

    // Add the title (using the same style as "Date & Times")
    const titleElement = document.createElement("h1");
    titleElement.className = "title main-title"; // Use the same class as "Date & Times"
    titleElement.textContent = "Content Analysis";
    contentAnalysisSection.appendChild(titleElement);

    // Create the stats container
    const statsContainer = document.createElement("div");
    statsContainer.className = "content-analysis-container";
    contentAnalysisSection.appendChild(statsContainer);

    // Get the list of senders in a consistent order (alphabetically)
    const senders = Object.keys(contentStats.laughs).sort();

    // Add stats for laughs, questions, and apologies
    const stats = [
        { title: "Laughs", data: contentStats.laughs },
        { title: "Questions", data: contentStats.questions },
        { title: "Apologies", data: contentStats.apologies },
    ];

    stats.forEach(stat => {
        const statDiv = document.createElement("div");
        statDiv.className = "content-analysis-stat";

        const title = document.createElement("h2");
        title.textContent = stat.title;
        title.className = "content-analysis-stat-title";
        statDiv.appendChild(title);

        // Convert the data into an array of { sender, count } objects
        const statData = Object.keys(stat.data).map(sender => ({
            sender,
            count: stat.data[sender] || 0,
        }));

        // Sort the data by count (descending)
        statData.sort((a, b) => b.count - a.count);

        // Display only the top 3 on small screens
        const top3 = statData.slice(0, 3);

        // Create a container for the rankings
        const rankingsContainer = document.createElement("div");
        rankingsContainer.className = "rankings-container";

        top3.forEach((item, index) => {
            const rankItem = document.createElement("div");
            rankItem.className = "rank-item";

            // Add a medal icon for 1st, 2nd, and 3rd place
            let medalIcon = "";
            if (index === 0) medalIcon = "🥇"; // Gold medal
            else if (index === 1) medalIcon = "🥈"; // Silver medal
            else if (index === 2) medalIcon = "🥉"; // Bronze medal

            rankItem.innerHTML = `
                <span class="medal">${medalIcon}</span>
                <span class="rank-sender">${item.sender}</span>
                <span class="rank-count">${item.count}</span>
            `;

            rankingsContainer.appendChild(rankItem);
        });

        statDiv.appendChild(rankingsContainer);
        statsContainer.appendChild(statDiv);
    });
}

function renderInteractions(interactions) {
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");

    // Remove any existing Interactions section
    let interactionsSection = document.getElementById("interactionsSection");
    if (interactionsSection) {
        interactionsSection.remove();
    }

    // Create a new container for the Interactions section
    interactionsSection = document.createElement("div");
    interactionsSection.id = "interactionsSection";
    chatAnalyticsSection.appendChild(interactionsSection);

    // Create a white box for the interactions
    const interactionsBox = document.createElement("div");
    interactionsBox.className = "interactions-box";
    interactionsSection.appendChild(interactionsBox);

    // Add a subtitle inside the box
    const subtitle = document.createElement("h3");
    subtitle.className = "interactions-subtitle";
    subtitle.textContent = "Top Interactions";
    interactionsBox.appendChild(subtitle);

    // Flatten and sort all interactions
    const allInteractions = [];
    Object.keys(interactions).forEach(sender => {
        Object.keys(interactions[sender]).forEach(receiver => {
            // Skip if sender and receiver are the same
            if (sender === receiver) return;

            // Check if the reverse interaction already exists
            const reverseInteraction = allInteractions.find(
                interaction => interaction.sender === receiver && interaction.receiver === sender
            );

            if (reverseInteraction) {
                // Keep the interaction with the higher count
                if (interactions[sender][receiver] > reverseInteraction.count) {
                    reverseInteraction.sender = sender;
                    reverseInteraction.receiver = receiver;
                    reverseInteraction.count = interactions[sender][receiver];
                }
            } else {
                // Add the interaction to the list
                allInteractions.push({
                    sender,
                    receiver,
                    count: interactions[sender][receiver],
                });
            }
        });
    });

    // Sort interactions by count (descending) and take the top 5
    const topInteractions = allInteractions
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Create a list for the top interactions
    const interactionList = document.createElement("ul");
    interactionList.className = "interaction-list";
    interactionsBox.appendChild(interactionList);

    topInteractions.forEach(interaction => {
        const interactionItem = document.createElement("li");
        interactionItem.className = "interaction-item";

        // Create a flex container for the interaction
        const flexContainer = document.createElement("div");
        flexContainer.style.display = "flex";
        flexContainer.style.flexDirection = "column"; // Stack names and count vertically
        flexContainer.style.alignItems = "center"; // Center align items
        flexContainer.style.gap = "5px"; // Add spacing between elements

        // Sender and Receiver (bold)
        const names = document.createElement("div");
        names.innerHTML = `<strong>${interaction.sender}</strong> & <strong>${interaction.receiver}</strong>`;
        names.style.textAlign = "center"; // Center align names
        flexContainer.appendChild(names);

        // Interaction count
        const interactionCount = document.createElement("div");
        interactionCount.textContent = `${interaction.count} times`;
        interactionCount.style.fontSize = "15px"; // Smaller font size for count
        interactionCount.style.color = "#666"; // Lighter color for count
        flexContainer.appendChild(interactionCount);

        // Append the flex container to the interaction item
        interactionItem.appendChild(flexContainer);

        // Append the interaction item to the list
        interactionList.appendChild(interactionItem);
    });
}

// Default color palette
const defaultColors = [
    "#36A2EB", "#FF6384", "#FFCE56", "#4BC0C0", "#9966FF", 
    "#FF9F40", "#C9CBCF", "#7F7F7F", "#FFA1B5", "#86C7F7"
];

// Function to get a color for a sender
function getColorForSender(sender, index) {
    if (window.colors && window.colors[sender]) {
        return window.colors[sender];
    }
    return defaultColors[index % defaultColors.length];
}
  
function renderMonthlyChartChartJS(monthlyData) {
    // Compute overall total per month (sum of all sender values)
    const overallData = monthlyData.map(dp => {
        let sum = Object.keys(dp)
            .filter(key => key !== "month")
            .reduce((acc, key) => acc + dp[key], 0);
        return { month: dp.month, total: sum };
    });

    const timelineSection = document.getElementById("timelineSection");
    
    // Create container for Monthly chart
    const monthlyCard = document.createElement('div');
    monthlyCard.className = 'chart-card';
    timelineSection.appendChild(monthlyCard);
    
    // Add title
    const monthlyTitle = document.createElement('h2');
    monthlyTitle.className = 'chart-card-title';
    monthlyTitle.textContent = 'Monthly Activity';
    monthlyCard.appendChild(monthlyTitle);
    
    // Create chart container
    const monthlyChartDiv = document.createElement('div');
    monthlyChartDiv.id = 'monthlychartdiv';
    monthlyCard.appendChild(monthlyChartDiv);

    // Create and append canvas for Chart.js
    const canvas = document.createElement('canvas');
    monthlyChartDiv.appendChild(canvas);

    // Prepare chart data using overallData
    const labels = overallData.map(dp => dp.month);
    const dataValues = overallData.map(dp => dp.total);

    // Create the Chart.js line chart
    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '', // No legend label
                data: dataValues,
                borderColor: "#a044ff", // --secondary-color
                backgroundColor: "rgba(106, 48, 147, 0.1)", // --primary-color with 10% opacity
                borderWidth: 3,
                tension: 0.3,
                pointRadius: 0, // Remove data points
                borderCapStyle: 'round',
                borderJoinStyle: 'round',
                fill: {
                    target: 'origin',
                    above: "rgba(106, 48, 147, 0.1)" // --primary-color with 10% opacity
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Hide legend
                },
                tooltip: {
                    backgroundColor: '#6a3093', // --primary-color
                    titleColor: '#fff',
                    bodyColor: '#f3e5ff', // --accent-color
                    borderColor: '#a044ff', // --secondary-color
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    display: true,
                    title: { display: false },
                    grid: { 
                        display: false,
                        color: 'rgba(106, 48, 147, 0.1)' // --primary-color with 10% opacity
                    },
                    ticks: {
                        color: '#6a3093' // --primary-color
                    }
                },
                y: {
                    display: true,
                    title: { display: false },
                    grid: { 
                        display: false,
                        color: 'rgba(106, 48, 147, 0.1)' // --primary-color with 10% opacity
                    },
                    ticks: {
                        color: '#6a3093' // --primary-color
                    },
                    beginAtZero: true
                }
            }
        }
    });
}


function renderCallStats() {
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");

    // Remove any existing section
    let callStatsSection = document.getElementById("callStatsSection");
    if (callStatsSection) {
        callStatsSection.remove();
    }

    // Create new container (ALWAYS create it, even if no calls)
    callStatsSection = document.createElement("div");
    callStatsSection.id = "callStatsSection";
    callStatsSection.className = "conversation-stats-container";
    chatAnalyticsSection.appendChild(callStatsSection);

    // Add title (ALWAYS show title)
    const title = document.createElement("h2");
    title.className = "title subtitle";
    title.textContent = "Call Statistics";
    callStatsSection.appendChild(title);

    const statsContainer = document.createElement("div");
    statsContainer.className = "conversation-stats";
    callStatsSection.appendChild(statsContainer);

    // Show total calls (will be 0 if no calls)
    const totalCalls = document.createElement("p");
    totalCalls.className = "stat-summary";
    totalCalls.textContent = `Total Calls: ${window.callStats?.total || 0}`;
    statsContainer.appendChild(totalCalls);

    // Handle case when there are calls
    if (window.callStats?.longestCalls?.length > 0) {
        const longestTitle = document.createElement("p");
        longestTitle.className = "stat-summary";
        longestTitle.textContent = "Longest Calls:";
        longestTitle.style.marginTop = "15px";
        statsContainer.appendChild(longestTitle);

        const callsList = document.createElement("ul");
        callsList.className = "conversation-list";
        statsContainer.appendChild(callsList);

        window.callStats.longestCalls.forEach((call, index) => {
            const callItem = document.createElement("li");
            callItem.innerHTML = `
                <strong>${index + 1}.</strong> ${call.sender} - 
                ${call.formattedDuration} (${call.type})
            `;
            callsList.appendChild(callItem);
        });
    } 
    // Handle case when there are calls but no duration info
    else if (window.callStats?.total > 0) {
        const noDuration = document.createElement("p");
        noDuration.className = "stat-summary";
        noDuration.textContent = "Call duration information not available";
        noDuration.style.marginTop = "15px";
        statsContainer.appendChild(noDuration);
    }
    // Handle case when no calls at all
    else {
        const noCalls = document.createElement("p");
        noCalls.className = "stat-summary";
        noCalls.textContent = "No calls found in this chat";
        noCalls.style.marginTop = "15px";
        statsContainer.appendChild(noCalls);
    }
}

function renderConvoStats() {
    // Only render if there are exactly two people and stats are available.
    const people = Object.keys(window.stats || {});
    if (people.length !== 2 || !window.convoStats) return;

    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");
    if (!chatAnalyticsSection) return;

    // Remove any existing stats section.
    let convoStatsSection = document.getElementById("convoStatsSection");
    if (convoStatsSection) convoStatsSection.remove();

    // Create a new container.
    convoStatsSection = document.createElement("div");
    convoStatsSection.id = "convoStatsSection";
    convoStatsSection.className = "conversation-stats-container";
    chatAnalyticsSection.appendChild(convoStatsSection);

    // Title.
    const title = document.createElement("h2");
    title.className = "title subtitle";
    title.textContent = "Conversation Stats";
    convoStatsSection.appendChild(title);

    // Stats container.
    const statsContainer = document.createElement("div");
    statsContainer.className = "conversation-stats";
    convoStatsSection.appendChild(statsContainer);

    // Display overall average conversation length.
    const avgLength = document.createElement("p");
    avgLength.className = "convo-stat";
    avgLength.textContent = `Average conversation length: ${window.convoStats.averageLength} messages`;
    statsContainer.appendChild(avgLength);

    // Display frequency and percentage change.
    const freq = document.createElement("p");
    freq.className = "convo-stat";
    
    const changeValue = window.convoStats.freqPercentageChange;
    const last30 = window.convoStats.frequencyLast30;
    const prev30 = window.convoStats.frequencyPrev30;
    
    switch(window.convoStats.trend) {
        case "up":
            freq.innerHTML = `Conversations in past 30 days: <span class="trend-value trend-up">▲${Math.abs(changeValue)}% increase</span>`;
            break;
        case "down":
            freq.innerHTML = `Conversations in past 30 days: <span class="trend-value trend-down">▼${Math.abs(changeValue)}% decrease</span>`;
            break;
        case "equal":
            freq.innerHTML = `Conversations in past 30 days: <span class="trend-value trend-neutral">0% change</span> (${last30} vs ${prev30})`;
            break;
        case "none":
            freq.textContent = "No recent conversations";
            break;
        default:
            freq.textContent = `Conversation frequency: ${last30} in last 30 days`;
    }
    
    statsContainer.appendChild(freq);
}

function renderEngagementChart(engagementData, senders) {
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");

    // Remove any existing Engagement section
    let engagementContainer = document.getElementById("engagementContainer");
    if (engagementContainer) {
        engagementContainer.remove();
    }

    // Create a new container for the Engagement section
    engagementContainer = document.createElement("div");
    engagementContainer.id = "engagementContainer";
    engagementContainer.className = "conversation-stats-container";
    chatAnalyticsSection.appendChild(engagementContainer);

    // Add the title (styled as a subtitle)
    const title = document.createElement("h2");
    title.className = "title subtitle";
    title.textContent = "Engagement Ratio during convos";
    engagementContainer.appendChild(title);

    // Create the chart container
    const chartDiv = document.createElement("div");
    chartDiv.className = "chart-focus-wrapper";
    engagementContainer.appendChild(chartDiv);

    // Create canvas element
    const canvas = document.createElement("canvas");
    canvas.id = "engagementChart";
    chartDiv.appendChild(canvas);

    // Create a container for the labels
    const labelsContainer = document.createElement("div");
    labelsContainer.className = "chart-labels";
    engagementContainer.appendChild(labelsContainer);

    // Prepare data for Chart.js
    const data = {
        labels: senders,
        datasets: [{
            data: [engagementData.participant1, engagementData.participant2],
            backgroundColor: [
                window.colors[senders[0]] || '#36A2EB',
                window.colors[senders[1]] || '#FF6384'
            ],
            borderColor: '#fff',
            borderWidth: 2,
            cutout: '70%' // This makes it a donut chart
        }]
    };

    // Create the Chart.js donut chart
    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // We'll use our custom legend
                }
            }
        }
    });

    // Add custom labels with colors (reverted to original style)
    senders.forEach((sender, index) => {
        const percentage = index === 0 ? engagementData.participant1 : engagementData.participant2;

        const labelDiv = document.createElement("div");
        labelDiv.className = "chart-label";

        const colorBox = document.createElement("div");
        colorBox.className = "color-box";
        colorBox.style.backgroundColor = window.colors[sender];

        const nameSpan = document.createElement("span");
        nameSpan.className = "name";
        nameSpan.textContent = `${sender} (${percentage.toFixed(1)}%)`;

        labelDiv.appendChild(colorBox);
        labelDiv.appendChild(nameSpan);
        labelsContainer.appendChild(labelDiv);
    });
}

function renderStreakStats(streakStats) {
    const chatAnalyticsSection = document.getElementById("chatAnalyticsSection");
    
    // Remove any existing streak section
    let streakSection = document.getElementById("streakSection");
    if (streakSection) {
        streakSection.remove();
    }
    
    // Create a new container for the streak section
    streakSection = document.createElement("div");
    streakSection.id = "streakSection";
    streakSection.className = "conversation-stats-container";
    chatAnalyticsSection.appendChild(streakSection);
    
    // Add the title
    const title = document.createElement("h2");
    title.className = "title subtitle";
    title.textContent = "Longest Conversation Streak";
    streakSection.appendChild(title);
    
    // Create the stats container
    const statsContainer = document.createElement("div");
    statsContainer.className = "streak-stats";
    streakSection.appendChild(statsContainer);
    
    // Format dates for display
    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        const [year, month, day] = dateStr.split('-');
        return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    
    // Create the streak display
    const streakDiv = document.createElement("div");
    streakDiv.className = "streak-display";
    
    // Create the fire animation
    const fireDiv = document.createElement("div");
    fireDiv.className = "streak-fire";
    fireDiv.style.setProperty('--streak-intensity', Math.min(streakStats.maxStreak / 30, 1)); // Cap at 30 days for max intensity
    
    // Create fire elements
    for (let i = 0; i < 5; i++) {
        const flame = document.createElement("div");
        flame.className = `flame flame-${i+1}`;
        fireDiv.appendChild(flame);
    }
    
    streakDiv.appendChild(fireDiv);
    
    // Create streak info
    const infoDiv = document.createElement("div");
    infoDiv.className = "streak-info";
    
    if (streakStats.maxStreak > 0) {
        infoDiv.innerHTML = `
            <p class="streak-count">${streakStats.maxStreak} days</p>
            <p class="streak-dates">${formatDate(streakStats.maxStreakStartDate)} to ${formatDate(streakStats.maxStreakEndDate)}</p>
        `;
    } else {
        infoDiv.innerHTML = `<p class="no-streak">No significant conversation streaks found</p>`;
    }
    
    streakDiv.appendChild(infoDiv);
    statsContainer.appendChild(streakDiv);
}

