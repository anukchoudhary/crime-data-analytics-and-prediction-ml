/**
 * CrimeSense — Risk Prediction & Console Module
 */

const RiskEngine = {
  lastPrediction: null,
  comparisonData: [],
  currentSortCol: 'risk_score',
  currentSortAsc: false,

  init() {
    this.bindFormEvents();
    this.bindConsoleEvents();
  },

  bindFormEvents() {
    const form = document.getElementById('riskCheckForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const area = document.getElementById('riskAreaSelect').value;
      const date = document.getElementById('riskDateInput').value;
      const time = document.getElementById('riskTimeInput').value;
      const crimeType = document.getElementById('riskCrimeSelect').value;

      if (!area || !date || !time) {
        alert('Please select a valid zone, date, and time.');
        return;
      }

      await this.runPrediction({ area, date, time, crime_type: crimeType }, 'riskResultContainer');
    });
  },

  bindConsoleEvents() {
    const btn = document.getElementById('btnConsoleAnalyze');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const area = document.getElementById('consoleAreaSelect').value;
      const date = document.getElementById('consoleDateInput').value;
      const time = document.getElementById('consoleTimeInput').value;
      const crimeType = document.getElementById('consoleCrimeSelect').value;

      await this.runPrediction({ area, date, time, crime_type: crimeType }, 'consoleResultContainer', true);
    });
  },

  async runPrediction(payload, containerId, isConsole = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Show loading state
    container.innerHTML = `
      <div style="padding:40px; text-align:center;">
        <div class="spinner"></div>
        <p style="margin-top:14px; font-weight:600; color:var(--text-primary);">Evaluating historical crime patterns...</p>
        <p style="font-size:0.85rem; color:var(--text-muted);">Analyzing temporal density, zone frequency, and ML model predictions</p>
      </div>
    `;

    try {
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Prediction failed');
      }

      const res = await resp.json();
      this.lastPrediction = res;

      if (isConsole) {
        this.renderConsoleResult(container, res);
      } else {
        this.renderPredictionResult(container, res);
      }
    } catch (e) {
      container.innerHTML = `
        <div style="padding:30px; text-align:center; color:var(--risk-very-high);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:10px;"></i>
          <h3>Unable to calculate risk estimate</h3>
          <p style="color:var(--text-muted); font-size:0.9rem;">${e.message}</p>
        </div>
      `;
    }
  },

  renderPredictionResult(container, res) {
    let badgeClass = 'badge-low';
    if (res.risk_level === 'VERY HIGH') badgeClass = 'badge-vhigh';
    else if (res.risk_level === 'HIGH') badgeClass = 'badge-high';
    else if (res.risk_level === 'MEDIUM') badgeClass = 'badge-med';

    container.innerHTML = `
      <div class="result-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <span style="font-size:0.8rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.06em;">
              Predicted Risk Estimate
            </span>
            <div style="display:flex; align-items:center; gap:12px; margin-top:6px;">
              <span class="risk-level-badge ${badgeClass}">${res.risk_badge} ${res.risk_level}</span>
            </div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:0.82rem; color:var(--text-muted);">${res.area} (${res.district})</span><br/>
            <b style="font-size:0.95rem;">${res.date} at ${res.time} (${res.day_name})</b>
          </div>
        </div>

        <div class="risk-score-display">
          <div class="score-gauge" style="border-color:${res.risk_color}; box-shadow:0 0 24px ${res.risk_color}33;">
            <div class="gauge-val" style="color:${res.risk_color};">${res.risk_score}</div>
            <div class="gauge-denom">/ 100</div>
          </div>
          <div style="flex:1;">
            <div style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); font-weight:600; margin-bottom:4px;">
              Most Likely Crime Category
            </div>
            <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary); margin-bottom:6px;">
              ${res.predicted_crime_category}
            </div>
            <p style="font-size:0.88rem; color:var(--text-secondary); margin:0;">
              Model confidence: <b>${res.model_confidence}%</b> relative probability among 8 tracked crime classes.
            </p>
          </div>
        </div>

        <!-- Historical Pattern Summary Cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin:20px 0;">
          <div style="background:var(--bg-input); padding:12px; border-radius:8px; border:1px solid var(--border-color);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Zone Pattern</div>
            <div style="font-size:0.95rem; font-weight:700; margin-top:2px;">${res.historical_context.total_zone_crimes} Total Crimes</div>
          </div>
          <div style="background:var(--bg-input); padding:12px; border-radius:8px; border:1px solid var(--border-color);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Diurnal Peak</div>
            <div style="font-size:0.95rem; font-weight:700; margin-top:2px;">${res.historical_context.peak_hour} (${res.time_slot})</div>
          </div>
          <div style="background:var(--bg-input); padding:12px; border-radius:8px; border:1px solid var(--border-color);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Peak Day</div>
            <div style="font-size:0.95rem; font-weight:700; margin-top:2px;">${res.historical_context.peak_day}</div>
          </div>
          <div style="background:var(--bg-input); padding:12px; border-radius:8px; border:1px solid var(--border-color);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Trajectory</div>
            <div style="font-size:0.95rem; font-weight:700; margin-top:2px;">${res.historical_context.trend} Trend</div>
          </div>
        </div>

        <!-- Strict Analytical Disclaimer -->
        <div class="disclaimer-banner">
          <i class="fa-solid fa-circle-info" style="font-size:1.1rem; margin-top:2px;"></i>
          <div>
            <b>Analytical Estimate Notice:</b> ${res.disclaimer}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:20px;">
          <button class="btn-secondary" onclick="App.viewZoneOnMap('${res.area}')">
            <i class="fa-solid fa-map-location-dot"></i> View on Map
          </button>
          <button class="btn-secondary" onclick="App.exploreZonePatterns('${res.area}')">
            <i class="fa-solid fa-chart-simple"></i> Explore Patterns
          </button>
          <button class="btn-cta" onclick="document.getElementById('riskAreaSelect').focus();">
            <i class="fa-solid fa-rotate-right"></i> Run Another Prediction
          </button>
        </div>

        <!-- Why this prediction? (Explainability) -->
        <div class="explain-factors" style="margin-top:32px; border-top:1px solid var(--border-color); padding-top:24px;">
          <h3 style="font-size:1.25rem; margin-bottom:6px;">Why this risk estimate?</h3>
          <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:18px;">
            The composite risk score is derived from 5 empirical factors calculated directly from the historical dataset and model weights:
          </p>

          ${res.explainability_factors.map(f => `
            <div class="factor-item">
              <div class="factor-header">
                <span>${f.name} <small style="color:var(--text-muted);">(${f.weight} weight)</small></span>
                <span>${f.score} / 100</span>
              </div>
              <div class="factor-bar-bg">
                <div class="factor-bar-fill" style="width:${Math.min(100, f.score)}%;"></div>
              </div>
              <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">${f.description}</p>
            </div>
          `).join('')}

          ${res.feature_importance && res.feature_importance.features ? `
            <div style="margin-top:24px;">
              <h4 style="font-size:1rem; margin-bottom:8px;">Model Feature Importance (Top Predictors)</h4>
              <div style="height:220px;">
                <canvas id="predFeatureChart"></canvas>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Render feature importance chart if data available
    if (res.feature_importance && res.feature_importance.features) {
      setTimeout(() => {
        Charts.renderFeatureImportance(
          'predFeatureChart', 
          res.feature_importance.features, 
          res.feature_importance.scores
        );
      }, 50);
    }
  },

  renderConsoleResult(container, res) {
    let badgeClass = 'badge-low';
    if (res.risk_level === 'VERY HIGH') badgeClass = 'badge-vhigh';
    else if (res.risk_level === 'HIGH') badgeClass = 'badge-high';
    else if (res.risk_level === 'MEDIUM') badgeClass = 'badge-med';

    container.innerHTML = `
      <div class="card" style="padding:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <span style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Live Analyst Assessment</span>
            <h3 style="font-size:1.5rem; margin-top:2px;">${res.area}</h3>
          </div>
          <span class="risk-level-badge ${badgeClass}" style="font-size:1.1rem;">${res.risk_badge} ${res.risk_level}</span>
        </div>

        <div style="display:flex; align-items:center; gap:20px; background:var(--bg-secondary); padding:16px; border-radius:12px; margin-bottom:18px;">
          <div style="font-size:2.4rem; font-weight:900; color:${res.risk_color};">${res.risk_score}<span style="font-size:1rem; color:var(--text-muted);">/100</span></div>
          <div>
            <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted);">Likely Category</div>
            <b style="font-size:1.1rem; color:var(--text-primary);">${res.predicted_crime_category}</b>
            <div style="font-size:0.8rem; color:var(--text-secondary);">${res.model_confidence}% confidence</div>
          </div>
        </div>

        <!-- 4 Mini Sparkline Trends -->
        <div class="sparklines-grid">
          <div class="sparkline-card">
            <div class="sparkline-title">Year Trend</div>
            <div style="height:48px;"><canvas id="sparkYear"></canvas></div>
          </div>
          <div class="sparkline-card">
            <div class="sparkline-title">Monthly Curve</div>
            <div style="height:48px;"><canvas id="sparkMonth"></canvas></div>
          </div>
          <div class="sparkline-card">
            <div class="sparkline-title">Day Pattern</div>
            <div style="height:48px;"><canvas id="sparkDay"></canvas></div>
          </div>
          <div class="sparkline-card">
            <div class="sparkline-title">Hourly Diurnal</div>
            <div style="height:48px;"><canvas id="sparkHour"></canvas></div>
          </div>
        </div>

        <div style="margin-top:20px; display:flex; justify-content:space-between; align-items:center;">
          <small style="color:var(--text-muted); font-size:0.8rem;">Historical baseline: ${res.historical_context.total_zone_crimes} records</small>
          <button class="btn-secondary" style="padding:6px 14px; font-size:0.85rem;" onclick="App.exploreZonePatterns('${res.area}')">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Full Analysis
          </button>
        </div>
      </div>
    `;

    // Fetch and render mini sparklines
    this.renderConsoleSparklines(res.area);
  },

  async renderConsoleSparklines(zone) {
    try {
      const [yrResp, mResp, dResp, hResp] = await Promise.all([
        fetch(`/api/crimes/yearly?area=${encodeURIComponent(zone)}`),
        fetch(`/api/crimes/monthly?area=${encodeURIComponent(zone)}`),
        fetch(`/api/crimes/daily?area=${encodeURIComponent(zone)}`),
        fetch(`/api/crimes/hourly?area=${encodeURIComponent(zone)}`)
      ]);

      if (yrResp.ok) {
        const d = await yrResp.json();
        Charts.renderMiniSparkline('sparkYear', d.years, d.counts, '#3b82f6');
      }
      if (mResp.ok) {
        const d = await mResp.json();
        Charts.renderMiniSparkline('sparkMonth', d.months, d.counts, '#06b6d4');
      }
      if (dResp.ok) {
        const d = await dResp.json();
        Charts.renderMiniSparkline('sparkDay', d.days, d.counts, '#6366f1');
      }
      if (hResp.ok) {
        const d = await hResp.json();
        Charts.renderMiniSparkline('sparkHour', d.hours_24, d.counts_24, '#f59e0b');
      }
    } catch (e) {
      console.warn('Sparklines fetch issue:', e);
    }
  },

  async loadZoneComparison(date, time) {
    const tableBody = document.getElementById('compareTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px;"><div class="spinner"></div></td></tr>`;

    try {
      const resp = await fetch(`/api/compare?date=${date}&time=${time}`);
      if (!resp.ok) throw new Error('Failed to load comparison');
      this.comparisonData = await resp.json();
      this.renderComparisonTable();
    } catch (e) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--risk-very-high); padding:20px;">Error loading zones: ${e.message}</td></tr>`;
    }
  },

  renderComparisonTable() {
    const tableBody = document.getElementById('compareTableBody');
    if (!tableBody) return;

    // Sort data
    const sorted = [...this.comparisonData].sort((a, b) => {
      let vA = a[this.currentSortCol];
      let vB = b[this.currentSortCol];
      if (typeof vA === 'string') {
        return this.currentSortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      return this.currentSortAsc ? (vA - vB) : (vB - vA);
    });

    tableBody.innerHTML = sorted.map((row, idx) => `
      <tr>
        <td><b>#${idx + 1}</b></td>
        <td>
          <b>${row.zone}</b><br/>
          <small style="color:var(--text-muted);">${row.district} District</small>
        </td>
        <td>${row.historical_count} cases</td>
        <td>
          <span style="font-weight:700; color:${row.risk_color}; background:${row.risk_color}22; padding:3px 8px; border-radius:4px; font-size:0.8rem;">
            ${row.risk_level}
          </span>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <b style="width:28px;">${row.risk_score}</b>
            <div style="flex:1; height:6px; background:var(--bg-input); border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${row.risk_score}%; background:${row.risk_color};"></div>
            </div>
          </div>
        </td>
        <td>${row.predicted_crime}</td>
        <td>
          <button class="btn-secondary" style="padding:4px 10px; font-size:0.78rem;" onclick="App.exploreZonePatterns('${row.zone}')">
            Inspect
          </button>
        </td>
      </tr>
    `).join('');
  },

  sortComparison(column) {
    if (this.currentSortCol === column) {
      this.currentSortAsc = !this.currentSortAsc;
    } else {
      this.currentSortCol = column;
      this.currentSortAsc = false;
    }
    this.renderComparisonTable();
  }
};
