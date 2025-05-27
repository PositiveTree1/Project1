/**
 * Rebuilds Chart.js charts from saved metadata.
 * @param {object} charts - metadata.charts object containing chart configurations
 */
export function restoreAllCharts(charts) {
  if (!charts) return;
  restoreTimelineChart(charts.timeline);
  restoreHourlyChart(charts.hourly);
  restoreMonthlyChart(charts.monthly);
  restoreWeekdayChart(charts.weekday);
  restoreChatFocusChart(charts.chatFocus);
  restoreEngagementChart(charts.engagement);
}

/**
 * Restore the timeline (stacked column / line) chart
 * @param {object} config - Chart.js configuration object
 */
// restoreCharts.js

export function restoreTimelineChart(config) {
  if (!config) return;

  // 1) get or build the canvas
  let canvas = document.getElementById('columnChartCanvas');
  if (!canvas) {
    const section = document.getElementById('timelineSection');
    section.innerHTML = `
      <div class="chart-card timeline-chart-card">
        <h2 class="chart-card-title">Timeline</h2>
        <div id="columnchartdiv" class="timeline-chart-container">
          <canvas id="columnChartCanvas"></canvas>
        </div>
      </div>
    `;
    canvas = document.getElementById('columnChartCanvas');
    if (!canvas) {
      console.error('restoreTimelineChart: failed to create canvas');
      return;
    }
  }

  // 2) destroy old and recreate
  const ctx = canvas.getContext('2d');
  if (window.timelineChart) window.timelineChart.destroy();
  const chart = new Chart(ctx, config);
  window.timelineChart = chart;

  // 3) re‐apply your tick thinning
  const isMobile = window.innerWidth < 768;
  chart.options.scales.x = {
    display: true,
    grid: { display: false },
    ticks: {
      autoSkip: isMobile,
      maxTicksLimit: isMobile ? 6 : undefined,
      maxRotation: 0,
      minRotation: 0,
      padding: 5,
      callback: function(value, index, allTicks) {
        if (isMobile) {
          // let Chart.js drop some for you
          return this.getLabelForValue(value);
        }
        // desktop: show first/last + every Nth
        if (index === 0 || index === allTicks.length - 1) return chart.data.labels[index];
        const interval = Math.ceil(allTicks.length / 5);
        return (index % interval === 0) ? chart.data.labels[index] : '';
      }
    }
  };

  // 4) update to pick up the new options
  chart.update();
}


export function restoreHourlyChart(config) {
  if (!config) return;

  // 1) Find or build the wrapper + canvas
  let wrapper = document.getElementById('hourlychartdiv');
  if (!wrapper) {
    const section = document.getElementById('timelineSection');
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.innerHTML = `
      <h2 class="chart-card-title">Hourly Activity</h2>
      <div id="hourlychartdiv"><canvas id="hourlyChartCanvas"></canvas></div>
    `;
    section.appendChild(card);
    wrapper = document.getElementById('hourlychartdiv');
  }
  // Now grab the canvas
  const canvas = wrapper.querySelector('canvas');
  if (!canvas) return;

  // 2) Destroy old
  if (window.hourlyChart) window.hourlyChart.destroy();

  // 3) Recreate
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, config);

  // 4) Re-apply your axis/tick settings
  chart.options.scales.x = {
    grid: { display: false },
    ticks: {
      autoSkip: false,
      maxRotation: 0,
      minRotation: 0,
      padding: 10,
      callback: (value, index, ticks) => {
        const labels = chart.data.labels;
        if (index === 0 || index === labels.length - 1) return labels[index];
        const interval = Math.ceil(labels.length / 5);
        return (index % interval === 0) ? labels[index] : '';
      }
    }
  };
  chart.update();

  window.hourlyChart = chart;
}

export function restoreMonthlyChart(config) {
  if (!config) return;

  let wrapper = document.getElementById('monthlychartdiv');
  if (!wrapper) {
    const section = document.getElementById('timelineSection');
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.innerHTML = `
      <h2 class="chart-card-title">Monthly Activity</h2>
      <div id="monthlychartdiv"><canvas id="monthlyChartCanvas"></canvas></div>
    `;
    section.appendChild(card);
    wrapper = document.getElementById('monthlychartdiv');
  }
  const canvas = wrapper.querySelector('canvas');
  if (!canvas) return;

  if (window.monthlyChart) window.monthlyChart.destroy();

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, config);

  chart.options.scales.x = {
    grid: { display: false },
    ticks: {
      autoSkip: true,
      maxRotation: 0,
      padding: 5
    }
  };
  chart.update();

  window.monthlyChart = chart;
}

export function restoreWeekdayChart(config) {
  if (!config) return;

  let wrapper = document.getElementById('weekdaychartdiv');
  if (!wrapper) {
    const section = document.getElementById('timelineSection');
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.innerHTML = `
      <h2 class="chart-card-title">Weekday Activity</h2>
      <div id="weekdaychartdiv"><canvas id="weekdayChartCanvas"></canvas></div>
    `;
    section.appendChild(card);
    wrapper = document.getElementById('weekdaychartdiv');
  }
  const canvas = wrapper.querySelector('canvas');
  if (!canvas) return;

  if (window.weekdayChart) window.weekdayChart.destroy();

  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, config);

  chart.options.scales.x = {
    grid: { display: false },
    ticks: {
      autoSkip: false,
      maxRotation: 0,
      padding: 5
    }
  };
  chart.update();

  window.weekdayChart = chart;
}

/**
 * Restores the Chat Focus donut chart
 * @param {{type,data,options}} config
 */
/** Restore Chat Focus donut */
export function restoreChatFocusChart(config) {
  if (!config) return;
  let wrapper = document.getElementById('chatFocusContainer');
  if (!wrapper) {
    document.getElementById('chatAnalyticsSection')
      .insertAdjacentHTML('beforeend', `
        <div id="chatFocusContainer" class="chart-focus-container">
          <h2 class="title subtitle">Chat Focus</h2>
          <div class="chart-focus-wrapper"><canvas id="chatFocusChart"></canvas></div>
          <div class="chart-labels"></div>
        </div>`);
    wrapper = document.getElementById('chatFocusContainer');
  }
  const canvas = wrapper.querySelector('canvas');
  const ctx    = canvas.getContext('2d');
  if (window.chatFocusChart && typeof window.chatFocusChart.destroy === "function") {
    window.chatFocusChart.destroy();
}

  window.chatFocusChart = new Chart(ctx, config);
}

/** Restore Engagement Ratio donut */
export function restoreEngagementChart(config) {
  if (!config) return;
  let wrapper = document.getElementById('engagementContainer');
  if (!wrapper) {
    document.getElementById('chatAnalyticsSection')
      .insertAdjacentHTML('beforeend', `
        <div id="engagementContainer" class="conversation-stats-container">
          <h2 class="title subtitle">Engagement Ratio during convos</h2>
          <div class="chart-focus-wrapper"><canvas id="engagementChart"></canvas></div>
          <div class="chart-labels"></div>
        </div>`);
    wrapper = document.getElementById('engagementContainer');
  }
  const canvas = wrapper.querySelector('canvas');
  const ctx    = canvas.getContext('2d');
  if (window.engagementChart && typeof window.engagementChart.destroy === "function") {
    window.engagementChart.destroy();
}
  window.engagementChart = new Chart(ctx, config);
}
