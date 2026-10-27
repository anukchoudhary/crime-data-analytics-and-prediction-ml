/**
 * CrimeVision AI — Visualizations & Chart.js Engine
 */

const ChartsEngine = {
  instances: {},

  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      textColor: isDark ? '#f8fafc' : '#0f172a',
      textMuted: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      cardBg: isDark ? 'rgba(16, 26, 48, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      primary: '#3b82f6',
      cyan: '#06b6d4',
      indigo: '#6366f1',
      purple: '#8b5cf6',
      riskLow: '#10b981',
      riskMed: '#f59e0b',
      riskHigh: '#ef4444'
    };
  },

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  // 1. Property Crime Category Breakdown
  renderCategoryDonut(canvasId, labels, counts) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors();
    const colors = ['#3b82f6', '#f59e0b', '#06b6d4'];

    this.instances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: theme.cardBg
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: theme.textColor, padding: 12, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: theme.cardBg,
            titleColor: theme.textColor,
            bodyColor: theme.textMuted
          }
        },
        cutout: '70%'
      }
    });
  },

  // 2. Yearly Trend Line Chart
  renderYearlyTrend(canvasId, labels, counts) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors();
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');

    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Property Crimes',
          data: counts,
          borderColor: theme.primary,
          borderWidth: 3,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: theme.primary,
          pointBorderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: theme.cardBg, titleColor: theme.textColor, bodyColor: theme.textMuted }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textMuted, font: { weight: 600 } } },
          y: { grid: { color: theme.gridColor }, ticks: { color: theme.textMuted } }
        }
      }
    });
  },

  // 3. Generic Bar Chart
  renderBarChart(canvasId, labels, counts, color = '#3b82f6') {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors();

    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: color,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: theme.cardBg, titleColor: theme.textColor, bodyColor: theme.textMuted }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textMuted, font: { size: 11 } } },
          y: { grid: { color: theme.gridColor }, ticks: { color: theme.textMuted } }
        }
      }
    });
  },

  // 4. Horizontal Bar (Location / Zone)
  renderHorizontalBar(canvasId, labels, counts, color = '#06b6d4') {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors();

    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: color,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: theme.cardBg, titleColor: theme.textColor, bodyColor: theme.textMuted }
        },
        scales: {
          x: { grid: { color: theme.gridColor }, ticks: { color: theme.textMuted } },
          y: { grid: { display: false }, ticks: { color: theme.textMuted, font: { size: 11 } } }
        }
      }
    });
  },

  // 5. Hourly Continuous Line Chart
  renderHourlyLine(canvasId, labels, counts) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const theme = this.getThemeColors();

    this.instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Hourly Incidents',
          data: counts,
          borderColor: theme.cyan,
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.4,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: theme.cardBg, titleColor: theme.textColor, bodyColor: theme.textMuted }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: theme.textMuted } },
          y: { grid: { color: theme.gridColor }, ticks: { color: theme.textMuted } }
        }
      }
    });
  },

  // 6. Day x Time Heatmap Table Renderer
  renderDayTimeHeatmap(containerId, days, windows, matrix) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let maxVal = 1;
    matrix.forEach(row => {
      row.forEach(v => { if (v > maxVal) maxVal = v; });
    });

    let html = `<table style="width:100%; border-collapse:separate; border-spacing:4px;"><thead><tr><th></th>`;
    windows.forEach(w => {
      html += `<th style="font-size:0.75rem; color:var(--text-muted); padding:6px; font-weight:600;">${w}</th>`;
    });
    html += `</tr></thead><tbody>`;

    days.forEach((day, dIdx) => {
      html += `<tr><td style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); padding:4px 10px; white-space:nowrap;">${day}</td>`;
      windows.forEach((w, wIdx) => {
        const val = matrix[dIdx][wIdx] || 0;
        const ratio = val / maxVal;

        let bg;
        if (ratio === 0) bg = 'rgba(30, 41, 59, 0.3)';
        else if (ratio < 0.35) bg = `rgba(59, 130, 246, ${0.35 + ratio * 0.5})`;
        else if (ratio < 0.70) bg = `rgba(245, 158, 11, ${0.45 + ratio * 0.4})`;
        else bg = `rgba(239, 68, 68, ${0.65 + ratio * 0.35})`;

        html += `
          <td style="height:36px; border-radius:6px; text-align:center; vertical-align:middle; font-size:0.76rem; font-weight:700; color:#ffffff; background:${bg}; cursor:pointer;"
              title="${day} (${w}): ${val} cases">
            ${val}
          </td>
        `;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  },

  // 7. Month x Time Heatmap Table Renderer
  renderMonthTimeHeatmap(containerId, months, windows, matrix) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let maxVal = 1;
    matrix.forEach(row => {
      row.forEach(v => { if (v > maxVal) maxVal = v; });
    });

    let html = `<table style="width:100%; border-collapse:separate; border-spacing:4px;"><thead><tr><th></th>`;
    windows.forEach(w => {
      html += `<th style="font-size:0.75rem; color:var(--text-muted); padding:6px; font-weight:600;">${w}</th>`;
    });
    html += `</tr></thead><tbody>`;

    months.forEach((m, mIdx) => {
      html += `<tr><td style="font-size:0.78rem; font-weight:700; color:var(--text-secondary); padding:4px 8px; white-space:nowrap;">${m.slice(0, 3)}</td>`;
      windows.forEach((w, wIdx) => {
        const val = matrix[mIdx][wIdx] || 0;
        const ratio = val / maxVal;

        let bg;
        if (ratio === 0) bg = 'rgba(30, 41, 59, 0.3)';
        else if (ratio < 0.4) bg = `rgba(6, 182, 212, ${0.3 + ratio * 0.5})`;
        else if (ratio < 0.7) bg = `rgba(245, 158, 11, ${0.45 + ratio * 0.4})`;
        else bg = `rgba(239, 68, 68, ${0.6 + ratio * 0.4})`;

        html += `
          <td style="height:34px; border-radius:5px; text-align:center; vertical-align:middle; font-size:0.75rem; font-weight:700; color:#ffffff; background:${bg}; cursor:pointer;"
              title="${m} (${w}): ${val} incidents">
            ${val}
          </td>
        `;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }
};
