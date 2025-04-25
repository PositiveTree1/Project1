function getColorForSender(sender) {
    // If you already have a global colors object (from another chart), use it.
    if (window.colors && window.colors[sender]) {
      return window.colors[sender];
    }
    // Otherwise, fallback to a list of colors.
    const fallbackColors = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"];
    return fallbackColors[Math.floor(Math.random() * fallbackColors.length)];
  }
  
  function renderMonthlyChartChartJS(monthlyData) {
    // Remove any previous Chart.js chart
    let container = document.getElementById("monthlyChartContainer");
    if (!container) {
      // Create a container if it doesn't exist; append it after the monthlychartdiv placeholder
      container = document.createElement("div");
      container.id = "monthlyChartContainer";
      const placeholder = document.getElementById("monthlychartdiv");
      if (placeholder) {
        placeholder.parentNode.insertBefore(container, placeholder.nextSibling);
      } else {
        document.body.appendChild(container);
      }
    }
    container.innerHTML = ""; // Clear any existing chart
  
    // Create and insert the canvas element for Chart.js
    const canvas = document.createElement("canvas");
    canvas.id = "monthlyChartCanvas";
    container.appendChild(canvas);
  
    // Prepare the chart data
    const labels = monthlyData.map(dp => dp.month);
    let senders = [];
    if (monthlyData.length > 0) {
      // Assume every data point has the same keys, aside from 'month'
      senders = Object.keys(monthlyData[0]).filter(key => key !== "month");
    }
    const datasets = senders.map(sender => ({
      label: sender,
      data: monthlyData.map(dp => dp[sender]),
      borderColor: getColorForSender(sender),
      backgroundColor: getColorForSender(sender),
      tension: 0, // 0 produces straight segments; adjust if you want a slight curve
      fill: false
    }));
  
    // Create the Chart.js line chart
    const ctx = canvas.getContext("2d");
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Month'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Average Messages per Day'
            }
          }
        }
      }
    });
  }
  