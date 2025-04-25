// document.getElementById('processButton').addEventListener('click', () => {
//     const fileInput = document.getElementById('fileInput');
//     const region = document.getElementById('regionSelect').value;
//     const resultsDiv = document.getElementById('results');

//     if (fileInput.files.length === 0) {
//         alert('Please select a file.');
//         return;
//     }

//     const file = fileInput.files[0];
//     const reader = new FileReader();

//     reader.onload = (event) => {
//         const text = event.target.result;
//         const { stats, columnChartData, dateRange } = processChatLog(text, region);
//         // displayStats(stats);
//         renderStackedColumnChart(columnChartData);
//         renderDonutChart(stats);
//     };

//     reader.readAsText(file);
// });

// function processChatLog(text, region) {
//     const lines = text.split('\n');
//     const stats = {};
//     let startDate = null;
//     let endDate = null;
//     const messageCounts = {};

//     lines.forEach(line => {
//         const regex = region === "US"
//             ? /\[(\d{2})\/(\d{2})\/(\d{4}), \d{2}:\d{2}:\d{2}\] ([^:]+):/
//             : /\[(\d{2})\/(\d{2})\/(\d{4}), \d{2}:\d{2}:\d{2}\] ([^:]+):/;

//         const match = line.match(regex);
//         if (match) {
//             const day = region === "US" ? match[2] : match[1];
//             const month = region === "US" ? match[1] : match[2];
//             const year = match[3];
//             const sender = match[4].trim();
//             const formattedDate = `${year}-${month}-${day}`;
            
//             stats[sender] = (stats[sender] || 0) + 1;
//             messageCounts[formattedDate] = (messageCounts[formattedDate] || {});
//             messageCounts[formattedDate][sender] = (messageCounts[formattedDate][sender] || 0) + 1;

//             const currentDate = new Date(`${year}-${month}-${day}`);
//             if (!startDate || currentDate < startDate) startDate = currentDate;
//             if (!endDate || currentDate > endDate) endDate = currentDate;
//         }
//     });

//     const columnChartData = generateColumnChartData(messageCounts, startDate, endDate);
//     return { stats, columnChartData, dateRange: { startDate, endDate } };
// }

// function generateColumnChartData(messageCounts, startDate, endDate) {
//     const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
//     const intervalSize = Math.ceil(totalDays / 100); // Divide into ~50 intervals

//     const columnChartData = [];
//     const senders = new Set();

//     let currentIntervalStart = new Date(startDate);
//     while (currentIntervalStart <= endDate) {
//         const intervalEnd = new Date(currentIntervalStart);
//         intervalEnd.setDate(intervalEnd.getDate() + intervalSize);

//         const label = `${currentIntervalStart.toISOString().slice(0, 10)}`;
//         const dataPoint = { interval: label };

//         for (const date in messageCounts) {
//             const dateObj = new Date(date);
//             if (dateObj >= currentIntervalStart && dateObj < intervalEnd) {
//                 for (const sender in messageCounts[date]) {
//                     dataPoint[sender] = (dataPoint[sender] || 0) + messageCounts[date][sender];
//                     senders.add(sender);
//                 }
//             }
//         }

//         columnChartData.push(dataPoint);
//         currentIntervalStart.setDate(currentIntervalStart.getDate() + intervalSize);
//     }

//     return { data: columnChartData, senders: Array.from(senders) };
// }

// function displayStats(stats) {
//     const resultsDiv = document.getElementById('results');
//     resultsDiv.innerHTML = '<h2>Message Counts:</h2>';

//     for (const [sender, count] of Object.entries(stats)) {
//         resultsDiv.innerHTML += `<p><strong>${sender}:</strong> ${count} messages</p>`;
//     }
// }

// function renderDonutChart(stats) {
//     if (window.pieChart) window.pieChart.dispose();

//     const chartData = Object.entries(stats).map(([sender, count]) => ({
//         sender,
//         messages: count
//     }));

//     window.pieChart = am5.ready(() => {
//         const root = am5.Root.new("piechartdiv");
//         root.setThemes([am5themes_Animated.new(root)]);

//         // Create the donut chart itself
//         const chart = root.container.children.push(
//             am5percent.PieChart.new(root, {
//                 layout: root.verticalLayout,
//                 innerRadius: am5.percent(50) // Donut effect
//             })
//         );

//         // Add pie series to chart
//         const series = chart.series.push(
//             am5percent.PieSeries.new(root, {
//                 valueField: "messages",
//                 categoryField: "sender"
//             })
//         );

//         series.data.setAll(chartData);

//         // Hide labels and annotation lines for a cleaner look
//         series.labels.template.set("visible", false);
//         series.ticks.template.set("visible", false);

//         // Set up tooltips
//         series.set("tooltip", am5.Tooltip.new(root, {
//             labelText: "{category}: {value}"
//         }));

//         // Now let's manually create the legends below the chart
//         const legendContainer = document.getElementById("legendContainer");
//         legendContainer.innerHTML = ""; // Clear any existing legends

//         chartData.forEach((dataPoint, index) => {
//             const color = series.get("colors").getIndex(index).toCSSHex(); // Get the color for the legend

//             // Create the legend item div
//             const legendItem = document.createElement("div");
//             legendItem.style.display = "flex";
//             legendItem.style.alignItems = "center";
//             legendItem.style.margin = "5px";
//             legendItem.style.whiteSpace = "nowrap";

//             // Create a colored box for the legend
//             const colorBox = document.createElement("span");
//             colorBox.style.display = "inline-block";
//             colorBox.style.width = "15px";
//             colorBox.style.height = "15px";
//             colorBox.style.marginRight = "5px";
//             colorBox.style.backgroundColor = color;

//             // Add the sender's name and message count to the legend
//             const text = document.createElement("span");
//             text.innerText = `${dataPoint.sender} (${dataPoint.messages})`;

//             // Append the color box and text to the legend item
//             legendItem.appendChild(colorBox);
//             legendItem.appendChild(text);

//             // Append the legend item to the legend container
//             legendContainer.appendChild(legendItem);
//         });
//     });
// }


// function renderStackedColumnChart(columnChartData) {
//     if (window.columnChart) window.columnChart.dispose();

//     const chartData = columnChartData.data;
//     const senders = columnChartData.senders;

//     window.columnChart = am5.ready(() => {
//         const root = am5.Root.new("columnchartdiv");
//         root.setThemes([am5themes_Animated.new(root)]);

//         const chart = root.container.children.push(
//             am5xy.XYChart.new(root, {
//                 panX: false,
//                 panY: false,
//                 wheelX: "panX",
//                 wheelY: "zoomX"
//             })
//         );

//         const xAxis = chart.xAxes.push(
//             am5xy.CategoryAxis.new(root, {
//                 categoryField: "interval",
//                 renderer: am5xy.AxisRendererX.new(root, {}),
//                 tooltip: am5.Tooltip.new(root, {})
//             })
//         );
//         xAxis.data.setAll(chartData);

//         xAxis.get("renderer").labels.template.setAll({
//             rotation: -45,
//             maxWidth: 80,
//             oversizedBehavior: "truncate"
//         });

//         const yAxis = chart.yAxes.push(
//             am5xy.ValueAxis.new(root, {
//                 renderer: am5xy.AxisRendererY.new(root, {})
//             })
//         );

//         senders.forEach(sender => {
//             const series = chart.series.push(
//                 am5xy.ColumnSeries.new(root, {
//                     name: sender,
//                     xAxis,
//                     yAxis,
//                     valueYField: sender,
//                     categoryXField: "interval",
//                     stacked: true
//                 })
//             );
//             series.data.setAll(chartData);
//         });

//         // 🚨 Removed the legend completely 🚨
//     });
// }
