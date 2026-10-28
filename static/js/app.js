/**
 * CrimeVision AI — Core Application Controller & State Engine
 */

const CrimeVisionApp = {
  activePage: 'home',
  summary: null,
  currentFilters: {},
  tablePage: 1,
  tableLimit: 25,
  tableSortBy: 'Date',
  tableSortOrder: 'desc',

  async init() {
    this.initTheme();
    this.bindSidebarEvents();
    this.bindFilterEvents();
    this.bindPredictionForm();
    this.bindDataExplorerEvents();
    this.bindUploadModal();
    this.bindResetModal();

    // Fetch initial summary & populate dropdowns
    await this.loadSummary();

    // Hash routing
    const hash = window.location.hash.replace('#', '');
    const validPages = ['home', 'dashboard', 'analytics', 'map', 'prediction', 'trends', 'hotspots', 'data', 'model', 'about'];
    if (hash && validPages.includes(hash)) {
      this.showPage(hash);
    } else {
      this.showPage('home');
    }
  },

  initTheme() {
    const saved = localStorage.getItem('crimevision_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateThemeIcon(saved);

    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('crimevision_theme', next);
        this.updateThemeIcon(next);
      });
    }
  },

  updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggleBtn i');
    if (icon) {
      icon.className = theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
  },

  bindSidebarEvents() {
    // Sidebar toggle (collapse / expand)
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebar = document.getElementById('sidebar');
    const mainWrapper = document.getElementById('mainWrapper');

    if (toggleBtn && sidebar && mainWrapper) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainWrapper.classList.toggle('expanded');
      });
    }

    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }

    // Navigation links
    document.querySelectorAll('.menu-link[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        this.showPage(page);
        if (sidebar) sidebar.classList.remove('mobile-open');
      });
    });
  },

  showPage(pageId) {
    this.activePage = pageId;
    window.location.hash = pageId;

    // Update active menu link
    document.querySelectorAll('.menu-link[data-page]').forEach(link => {
      if (link.getAttribute('data-page') === pageId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Hide all, show target
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Trigger page-specific data loaders
    if (pageId === 'dashboard') {
      this.loadDashboardData();
    } else if (pageId === 'analytics') {
      this.loadAnalyticsPage();
    } else if (pageId === 'map') {
      setTimeout(() => {
        IndiaCrimeMap.init();
        if (IndiaCrimeMap.map) IndiaCrimeMap.map.invalidateSize();
      }, 100);
    } else if (pageId === 'trends') {
      this.loadTrendsPage();
    } else if (pageId === 'hotspots') {
      this.loadHotspotsPage();
    } else if (pageId === 'data') {
      this.loadDataTable();
    } else if (pageId === 'model') {
      this.loadModelPerformancePage();
    }
  },

  async loadSummary() {
    try {
      const resp = await fetch('/api/dashboard-summary');
      if (!resp.ok) throw new Error('Summary fetch failed');
      this.summary = await resp.json();

      this.populateLandingStats();
      this.populateFilters();
    } catch (e) {
      console.warn('[CrimeVisionApp] Backend summary error:', e);
    }
  },

  populateLandingStats() {
    if (!this.summary) return;

    const elRec = document.getElementById('statLandingRecords');
    const elStates = document.getElementById('statLandingStates');
    const elZones = document.getElementById('statLandingZones');
    const elPeriod = document.getElementById('statLandingPeriod');

    if (elRec) elRec.innerText = this.summary.total_dataset_records.toLocaleString();
    if (elStates) elStates.innerText = `${this.summary.total_states} States`;
    if (elZones) elZones.innerText = `${this.summary.total_zones} Sectors`;
    if (elPeriod) elPeriod.innerText = this.summary.data_period;
  },

  populateFilters() {
    if (!this.summary) return;

    const fill = (selectId, items, placeholder = 'All') => {
      const el = document.getElementById(selectId);
      if (!el) return;
      let opts = `<option value="all">${placeholder}</option>`;
      items.forEach(it => { opts += `<option value="${it}">${it}</option>`; });
      el.innerHTML = opts;
    };

    fill('filterState', this.summary.states, 'All States');
    fill('filterCity', this.summary.cities, 'All Cities');
    fill('filterZone', this.summary.zones, 'All Zones');
    fill('filterYear', this.summary.years, 'All Years');

    // Prediction selects
    fill('predStateSelect', this.summary.states, 'Select State');
    fill('predCitySelect', this.summary.cities, 'Select City');
    fill('predZoneSelect', this.summary.zones, 'Select Zone');

    // Cascade: when State changes in prediction, filter Cities
    const predState = document.getElementById('predStateSelect');
    if (predState) {
      predState.addEventListener('change', () => {
        const selState = predState.value;
        if (selState && selState !== 'all') {
          const citiesInState = this.getCitiesForState(selState);
          fill('predCitySelect', citiesInState, 'Select City');
        }
      });
    }
  },

  getCitiesForState(stateName) {
    const map = {
      'Maharashtra': ['Mumbai', 'Pune'],
      'Delhi NCT': ['New Delhi'],
      'Karnataka': ['Bengaluru'],
      'Uttar Pradesh': ['Ghaziabad'],
      'West Bengal': ['Kolkata'],
      'Telangana': ['Hyderabad'],
      'Tamil Nadu': ['Chennai']
    };
    return map[stateName] || this.summary.cities;
  },

  bindFilterEvents() {
    const btnApply = document.getElementById('btnApplyFilters');
    const btnReset = document.getElementById('btnResetFilters');

    if (btnApply) {
      btnApply.addEventListener('click', () => {
        this.currentFilters = {
          state: document.getElementById('filterState')?.value || 'all',
          city: document.getElementById('filterCity')?.value || 'all',
          zone: document.getElementById('filterZone')?.value || 'all',
          crime_type: document.getElementById('filterCrimeType')?.value || 'all',
          year: document.getElementById('filterYear')?.value || 'all',
          time_window: document.getElementById('filterTimeWindow')?.value || 'all',
          day: document.getElementById('filterDay')?.value || 'all'
        };

        if (this.activePage === 'dashboard') this.loadDashboardData();
        else if (this.activePage === 'analytics') this.loadAnalyticsPage();
        else if (this.activePage === 'trends') this.loadTrendsPage();
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        ['filterState', 'filterCity', 'filterZone', 'filterCrimeType', 'filterYear', 'filterTimeWindow', 'filterDay'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = 'all';
        });
        this.currentFilters = {};
        if (this.activePage === 'dashboard') this.loadDashboardData();
        else if (this.activePage === 'analytics') this.loadAnalyticsPage();
      });
    }
  },

  buildQuery(extra = {}) {
    const merged = { ...this.currentFilters, ...extra };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== 'all') params.append(k, v);
    }
    return params.toString();
  },

  // 1. Dashboard Controller
  async loadDashboardData() {
    const q = this.buildQuery();
    try {
      const [sumResp, anaResp, hotResp] = await Promise.all([
        fetch(`/api/dashboard-summary?${q}`).then(r => r.json()),
        fetch(`/api/analytics?${q}`).then(r => r.json()),
        fetch(`/api/hotspots?${q}`).then(r => r.json())
      ]);

      // KPIs
      document.getElementById('kpiTotalCrimes').innerText = sumResp.total_crimes.toLocaleString();
      document.getElementById('kpiHighRiskZones').innerText = sumResp.high_risk_zones;
      document.getElementById('kpiCommonCrime').innerText = sumResp.most_common_crime;
      document.getElementById('kpiPeakHour').innerText = sumResp.peak_crime_hour;
      document.getElementById('kpiModelAcc').innerText = `${sumResp.model_accuracy}%`;
      
      const riskEl = document.getElementById('kpiCurrentRisk');
      if (riskEl) {
        riskEl.innerText = `${sumResp.current_risk}%`;
        riskEl.style.color = sumResp.current_risk_level === 'HIGH' ? 'var(--risk-high)' : (sumResp.current_risk_level === 'MEDIUM' ? 'var(--risk-med)' : 'var(--risk-low)');
      }

      // Charts
      ChartsEngine.renderCategoryDonut('dashCategoryDonut', anaResp.categories.labels, anaResp.categories.counts);
      ChartsEngine.renderYearlyTrend('dashYearlyTrend', anaResp.yearly.labels, anaResp.yearly.counts);

      // Top 5 Hotspots Table
      const tableBody = document.getElementById('dashHotspotsBody');
      if (tableBody) {
        tableBody.innerHTML = hotResp.slice(0, 5).map((h, i) => `
          <tr>
            <td><b>#${i + 1}</b></td>
            <td><b>${h.zone}</b><br/><small style="color:var(--text-muted);">${h.city}, ${h.state}</small></td>
            <td>${h.crime_count}</td>
            <td>
              <span class="risk-badge badge-${h.risk_level.toLowerCase()}">${h.risk_level} (${h.risk_score}%)</span>
            </td>
            <td>${h.peak_time}</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.warn('Dashboard data fetch error:', e);
    }
  },

  // 2. Crime Analytics Page Controller
  async loadAnalyticsPage() {
    const q = this.buildQuery();
    try {
      const resp = await fetch(`/api/analytics?${q}`);
      if (!resp.ok) throw new Error('Analytics failed');
      const data = await resp.json();

      ChartsEngine.renderBarChart('anaCategoryChart', data.categories.labels, data.categories.counts, '#3b82f6');
      ChartsEngine.renderYearlyTrend('anaYearlyChart', data.yearly.labels, data.yearly.counts);
      ChartsEngine.renderBarChart('anaMonthlyChart', data.monthly.labels.map(m => m.slice(0, 3)), data.monthly.counts, '#06b6d4');
      ChartsEngine.renderBarChart('anaDailyChart', data.daily.labels, data.daily.counts, '#6366f1');
      ChartsEngine.renderHourlyLine('anaHourlyChart', data.hourly.labels, data.hourly.counts);
      ChartsEngine.renderBarChart('anaTimeWindowChart', data.time_windows.labels, data.time_windows.counts, '#f59e0b');
      ChartsEngine.renderHorizontalBar('anaLocationChart', data.locations.labels, data.locations.counts, '#8b5cf6');
      ChartsEngine.renderBarChart('anaSeasonChart', data.seasons.labels, data.seasons.counts, '#10b981');

      // Heatmaps
      ChartsEngine.renderDayTimeHeatmap('anaDayTimeHeatmap', data.day_time_heatmap.days, data.day_time_heatmap.windows, data.day_time_heatmap.matrix);
      ChartsEngine.renderMonthTimeHeatmap('anaMonthTimeHeatmap', data.month_time_heatmap.months, data.month_time_heatmap.windows, data.month_time_heatmap.matrix);
    } catch (e) {
      console.warn('Analytics loading error:', e);
    }
  },

  // 3. Hotspots Page Controller
  async loadHotspotsPage() {
    const q = this.buildQuery();
    try {
      const [hotResp, clResp] = await Promise.all([
        fetch(`/api/hotspots?${q}`).then(r => r.json()),
        fetch('/api/clusters').then(r => r.json())
      ]);

      const tableBody = document.getElementById('hotspotsTableBody');
      if (tableBody) {
        tableBody.innerHTML = hotResp.map((h, i) => `
          <tr>
            <td><b>${i + 1}</b></td>
            <td><b>${h.zone}</b><br/><small style="color:var(--text-muted);">${h.location}</small></td>
            <td>${h.city}, ${h.state}</td>
            <td><b>${h.crime_count}</b></td>
            <td>${h.dominant_crime}</td>
            <td>
              <span class="risk-badge badge-${h.risk_level.toLowerCase()}">${h.risk_level} (${h.risk_score}%)</span>
            </td>
            <td>${h.peak_time}</td>
            <td>
              <button class="btn-page" onclick="CrimeVisionApp.analyzeZoneInPrediction('${h.state}', '${h.city}', '${h.zone}')">Forecast</button>
            </td>
          </tr>
        `).join('');
      }

      // Render clusters grid
      const clGrid = document.getElementById('clustersGridContainer');
      if (clGrid) {
        clGrid.innerHTML = clResp.map(cl => `
          <div class="card" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:0.75rem; font-weight:800; color:var(--primary-blue);">CLUSTER 0${cl.cluster_id}</span>
              <span class="risk-badge badge-${cl.risk_level.toLowerCase()}" style="font-size:0.72rem;">${cl.risk_level} RISK</span>
            </div>
            <h3 style="font-size:1.1rem; font-weight:700;">${cl.city} Region</h3>
            <p style="font-size:0.82rem; color:var(--text-muted); margin:4px 0 10px 0;">Center: [${cl.center[0]}, ${cl.center[1]}]</p>
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; border-top:1px solid var(--border-color); padding-top:8px;">
              <span>Incidents: <b>${cl.crime_count}</b></span>
              <span>Primary: <b>${cl.dominant_crime}</b></span>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.warn('Hotspots fetch error:', e);
    }
  },

  // 4. Trends Page Controller
  async loadTrendsPage() {
    const q = this.buildQuery();
    try {
      const resp = await fetch(`/api/trends?${q}`);
      if (!resp.ok) throw new Error('Trends fetch error');
      const data = await resp.json();

      ChartsEngine.renderYearlyTrend('trendLongitudinalChart', data.periods, data.counts);

      // Monthly category comparison
      const mLabels = data.monthly_comparison.months.map(m => m.slice(0, 3));
      ChartsEngine.renderBarChart('trendMonthlyTheft', mLabels, data.monthly_comparison.categories['Theft'], '#3b82f6');
      ChartsEngine.renderBarChart('trendMonthlyBurglary', mLabels, data.monthly_comparison.categories['Burglary'], '#f59e0b');
      ChartsEngine.renderBarChart('trendMonthlyVehicle', mLabels, data.monthly_comparison.categories['Vehicle Theft'], '#06b6d4');

      // Dynamic insights cards
      const insContainer = document.getElementById('trendInsightsContainer');
      if (insContainer && data.insights) {
        insContainer.innerHTML = data.insights.map(ins => `
          <div class="card" style="padding:18px; border-left:4px solid var(--primary-blue);">
            <div style="display:flex; align-items:flex-start; gap:12px;">
              <i class="fa-solid fa-bolt" style="color:var(--primary-blue); margin-top:2px;"></i>
              <p style="font-size:0.9rem; color:var(--text-primary); margin:0;">${ins}</p>
            </div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.warn('Trends loading error:', e);
    }
  },

  // 5. Prediction Console Form Controller
  bindPredictionForm() {
    const form = document.getElementById('predictionForm');
    const dateInput = document.getElementById('predDateInput');
    const dayInput = document.getElementById('predDayDerived');

    if (dateInput && dayInput) {
      dateInput.addEventListener('change', () => {
        try {
          const d = new Date(dateInput.value);
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          dayInput.value = days[d.getDay()];
        } catch (e) {}
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.runRiskPrediction();
      });
    }
  },

  async runRiskPrediction() {
    const state = document.getElementById('predStateSelect').value;
    const city = document.getElementById('predCitySelect').value;
    const zone = document.getElementById('predZoneSelect').value;
    const crimeType = document.getElementById('predCrimeTypeSelect').value;
    const date = document.getElementById('predDateInput').value;
    const time = document.getElementById('predTimeInput').value;
    const timeWindow = document.getElementById('predTimeWindowSelect').value;

    const resBox = document.getElementById('predictionResultBox');
    if (!resBox) return;

    resBox.innerHTML = `
      <div class="card" style="text-align:center; padding:50px 20px;">
        <div class="spinner"></div>
        <h3 style="font-size:1.15rem; margin-top:14px;">Analyzing Historical Property Crime Patterns...</h3>
        <p style="font-size:0.85rem; color:var(--text-muted);">Evaluating diurnal density, spatial frequency, and XGBoost classification matrix</p>
      </div>
    `;

    try {
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, city, zone, crime_type: crimeType, date, time, time_window: timeWindow })
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Prediction failed');
      }

      const res = await resp.json();
      this.renderPredictionResult(resBox, res);
    } catch (e) {
      resBox.innerHTML = `
        <div class="card" style="padding:30px; text-align:center; color:var(--risk-high);">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:10px;"></i>
          <h3>Prediction Error</h3>
          <p style="color:var(--text-muted); font-size:0.9rem;">${e.message}</p>
        </div>
      `;
    }
  },

  renderPredictionResult(container, res) {
    const badgeClass = `badge-${res.risk_level.toLowerCase()}`;

    container.innerHTML = `
      <div class="card" style="padding:28px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <span style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.06em;">
              Statistical Risk Forecast
            </span>
            <div style="display:flex; align-items:center; gap:10px; margin-top:6px;">
              <span class="risk-badge ${badgeClass}" style="font-size:1.1rem; padding:6px 16px;">
                ● ${res.risk_level} RISK
              </span>
            </div>
          </div>
          <div style="text-align:right;">
            <b style="font-size:1rem;">${res.selected_zone}</b><br/>
            <small style="color:var(--text-muted);">${res.selected_city}, ${res.selected_state} · ${res.selected_window}</small>
          </div>
        </div>

        <div class="risk-gauge-box">
          <div class="gauge-circle" style="border-color:${res.risk_color}; box-shadow:0 0 24px ${res.risk_color}33;">
            <span class="gauge-pct" style="color:${res.risk_color};">${res.probability}%</span>
            <span class="gauge-lbl">PROBABILITY</span>
          </div>
          <div style="flex:1;">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Forecasted Category</div>
            <h3 style="font-size:1.4rem; font-weight:900; color:var(--text-primary); margin:2px 0 6px 0;">${res.crime_category}</h3>
            <p style="font-size:0.86rem; color:var(--text-secondary); margin:0;">
              Estimated risk for <b>${res.selected_date} (${res.selected_day})</b> during <b>${res.selected_time}</b>.
            </p>
          </div>
        </div>

        <!-- Pattern Signals -->
        <div style="margin-top:24px; border-top:1px solid var(--border-color); padding-top:20px;">
          <h4 style="font-size:1rem; margin-bottom:12px;">Pattern Signals (Why this risk?)</h4>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${res.pattern_signals.map(s => `
              <div>
                <div style="display:flex; justify-content:space-between; font-size:0.84rem; font-weight:600; margin-bottom:4px;">
                  <span>${s.name} <small style="color:var(--text-muted);">(${s.weight})</small></span>
                  <span>${s.score}%</span>
                </div>
                <div style="height:6px; background:var(--bg-input); border-radius:3px; overflow:hidden;">
                  <div style="height:100%; width:${s.score}%; background:linear-gradient(90deg, var(--primary-blue), var(--accent-cyan));"></div>
                </div>
                <small style="color:var(--text-muted); font-size:0.78rem;">${s.detail}</small>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Disclaimer Banner -->
        <div class="disclaimer-banner">
          <i class="fa-solid fa-circle-info" style="font-size:1.1rem; margin-top:2px;"></i>
          <div>
            <b>Statistical Forecast Disclaimer:</b> ${res.disclaimer}
          </div>
        </div>

        <!-- Actions -->
        <div style="display:flex; gap:12px; margin-top:20px;">
          <button class="btn-secondary" onclick="CrimeVisionApp.showPage('map')">
            <i class="fa-solid fa-map"></i> View on Map
          </button>
          <button class="btn-secondary" onclick="CrimeVisionApp.showPage('analytics')">
            <i class="fa-solid fa-chart-line"></i> Deep Analytics
          </button>
        </div>
      </div>
    `;
  },

  // 6. Data Explorer Table Controller
  bindDataExplorerEvents() {
    const searchIn = document.getElementById('dataSearchInput');
    const limitSel = document.getElementById('dataLimitSelect');
    const btnPrev = document.getElementById('btnDataPrev');
    const btnNext = document.getElementById('btnDataNext');
    const btnExport = document.getElementById('btnExportCsv');

    if (searchIn) {
      let timeout;
      searchIn.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          this.tablePage = 1;
          this.loadDataTable();
        }, 300);
      });
    }

    if (limitSel) {
      limitSel.addEventListener('change', () => {
        this.tableLimit = parseInt(limitSel.value);
        this.tablePage = 1;
        this.loadDataTable();
      });
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (this.tablePage > 1) {
          this.tablePage--;
          this.loadDataTable();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        this.tablePage++;
        this.loadDataTable();
      });
    }

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        window.location.href = `/api/crimes/export?${this.buildQuery()}`;
      });
    }
  },

  async loadDataTable() {
    const tableBody = document.getElementById('dataExplorerBody');
    if (!tableBody) return;

    const search = document.getElementById('dataSearchInput')?.value || '';
    const q = `search=${encodeURIComponent(search)}&sort_by=${this.tableSortBy}&sort_order=${this.tableSortOrder}&page=${this.tablePage}&limit=${this.tableLimit}&${this.buildQuery()}`;

    tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px;"><div class="spinner"></div></td></tr>`;

    try {
      const resp = await fetch(`/api/crimes?${q}`);
      if (!resp.ok) throw new Error('Data fetch failed');
      const d = await resp.json();

      tableBody.innerHTML = d.records.map(r => `
        <tr>
          <td><code>${r.Crime_ID}</code></td>
          <td>${r.Date} <small style="color:var(--text-muted);">${r.Time}</small></td>
          <td><b>${r.State}</b></td>
          <td>${r.City}</td>
          <td>${r.Zone}</td>
          <td><b>${r.Crime_Type}</b></td>
          <td>${r.Time_Window}</td>
          <td>
            <span class="risk-badge badge-${r.Risk_Zone.toLowerCase()}" style="font-size:0.7rem;">${r.Risk_Zone}</span>
          </td>
        </tr>
      `).join('');

      document.getElementById('dataPageInfo').innerText = `Page ${d.page} of ${d.total_pages} (${d.total_records.toLocaleString()} records)`;
      document.getElementById('btnDataPrev').disabled = (d.page <= 1);
      document.getElementById('btnDataNext').disabled = (d.page >= d.total_pages);
    } catch (e) {
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--risk-high); padding:20px;">Error: ${e.message}</td></tr>`;
    }
  },

  // 7. Upload Modal
  bindUploadModal() {
    const modal = document.getElementById('uploadModal');
    const openBtn = document.getElementById('btnOpenUpload');
    const closeBtn = document.getElementById('btnCloseUpload');
    const cancelBtn = document.getElementById('btnCancelUpload');
    const fileInput = document.getElementById('fileUploadInput');
    const dropZone = document.getElementById('fileDropZone');
    const browseBtn = document.getElementById('btnBrowseFile');
    const statusBox = document.getElementById('uploadStatusBox');
    const stepsContainer = document.getElementById('uploadStepsContainer');
    const stepsSummary = document.getElementById('uploadStepsSummary');
    const stepsList = document.getElementById('uploadStepsList');
    const previewContainer = document.getElementById('uploadPreviewContainer');
    const previewBox = document.getElementById('uploadPreviewBox');
    const actionsBar = document.getElementById('uploadActionsBar');
    const fileInfoLabel = document.getElementById('uploadFileInfoLabel');
    const applyBtn = document.getElementById('btnApplyUpload');

    let currentFile = null;

    const resetModal = () => {
      currentFile = null;
      if (fileInput) fileInput.value = '';
      if (statusBox) statusBox.innerHTML = '';
      if (stepsContainer) stepsContainer.style.display = 'none';
      if (stepsList) stepsList.innerHTML = '';
      if (previewContainer) previewContainer.style.display = 'none';
      if (previewBox) previewBox.innerHTML = '';
      if (actionsBar) actionsBar.style.display = 'none';
      if (applyBtn) {
        applyBtn.style.display = 'none';
        applyBtn.disabled = false;
        applyBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Apply Dataset to Platform';
      }
    };

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        resetModal();
        modal.classList.add('open');
        if (this.refreshDatasetStatus) this.refreshDatasetStatus();
      });
    }

    const closeModal = () => {
      if (modal) modal.classList.remove('open');
      resetModal();
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Browse button triggers file input
    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    // Dropzone click triggers file input
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', (e) => {
        if (e.target !== browseBtn && !browseBtn.contains(e.target)) {
          fileInput.click();
        }
      });

      // Drag and drop event handlers
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove('dragover');
        });
      });

      dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
          handleFile(files[0]);
        }
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFile(e.target.files[0]);
        }
      });
    }

    const handleFile = async (file) => {
      currentFile = file;
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        statusBox.innerHTML = `
          <div style="background:rgba(239, 68, 68, 0.15); border:1px solid var(--risk-high); color:var(--risk-high); padding:10px 14px; border-radius:6px; font-size:0.88rem;">
            <i class="fa-solid fa-triangle-exclamation"></i> Unsupported file format (.${ext}). Please upload a .csv or .xlsx dataset.
          </div>`;
        return;
      }

      // Show validating state
      statusBox.innerHTML = `
        <div style="background:rgba(59, 130, 246, 0.1); border:1px solid var(--primary-blue); color:var(--text-primary); padding:12px 14px; border-radius:6px; display:flex; align-items:center; gap:10px; font-size:0.88rem;">
          <div class="spinner"></div>
          <div>
            <b>Analyzing ${file.name}...</b>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">Running 10-step validation engine & column detection</div>
          </div>
        </div>
      `;

      if (stepsContainer) stepsContainer.style.display = 'none';
      if (previewContainer) previewContainer.style.display = 'none';
      if (actionsBar) actionsBar.style.display = 'none';

      const formData = new FormData();
      formData.append('file', file);

      try {
        const resp = await fetch('/api/upload?apply=false', {
          method: 'POST',
          body: formData
        });
        const res = await resp.json();

        // Render 10 Steps
        if (res.steps && stepsContainer && stepsList) {
          stepsContainer.style.display = 'block';
          const passedCount = res.steps.filter(s => s.status === 'passed').length;
          const warnCount = res.steps.filter(s => s.status === 'warning').length;
          const failCount = res.steps.filter(s => s.status === 'failed').length;

          if (stepsSummary) {
            stepsSummary.innerHTML = `
              <span style="color:var(--risk-low);">${passedCount} Passed</span> · 
              <span style="color:var(--risk-med);">${warnCount} Warnings</span> · 
              <span style="color:var(--risk-high);">${failCount} Issues</span>
            `;
          }

          stepsList.innerHTML = res.steps.map(s => {
            const badgeClass = s.status === 'passed' ? 'badge-low' : (s.status === 'warning' ? 'badge-med' : 'badge-very-high');
            const icon = s.status === 'passed' ? 'fa-check' : (s.status === 'warning' ? 'fa-exclamation' : 'fa-xmark');
            return `
              <div class="upload-step-item step-${s.status}">
                <div>
                  <div style="font-weight:700; color:var(--text-primary);">
                    Step ${s.step}: ${s.title}
                  </div>
                  <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
                    ${s.detail}
                  </div>
                </div>
                <span class="risk-badge ${badgeClass}" style="font-size:0.7rem; text-transform:uppercase;">
                  <i class="fa-solid ${icon}" style="margin-right:3px;"></i> ${s.status}
                </span>
              </div>
            `;
          }).join('');
        }

        // Render Preview Table
        if (res.preview && res.preview.length > 0 && previewContainer && previewBox) {
          previewContainer.style.display = 'block';
          const cols = Object.keys(res.preview[0]);
          let tHtml = `
            <table class="upload-preview-table">
              <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
              <tbody>
          `;
          res.preview.forEach(row => {
            tHtml += `<tr>${cols.map(c => `<td>${row[c] !== null && row[c] !== undefined ? row[c] : ''}</td>`).join('')}</tr>`;
          });
          tHtml += `</tbody></table>`;
          previewBox.innerHTML = tHtml;
        }

        if (resp.ok && res.success) {
          statusBox.innerHTML = `
            <div style="background:rgba(16, 185, 129, 0.15); border:1px solid var(--risk-low); color:var(--risk-low); padding:10px 14px; border-radius:6px; font-size:0.88rem; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-circle-check" style="font-size:1.1rem;"></i>
              <div>
                <b>Validation Passed!</b> Ready to apply <b>${res.rows.toLocaleString()}</b> verified crime records.
              </div>
            </div>
          `;

          if (actionsBar) {
            actionsBar.style.display = 'flex';
            if (fileInfoLabel) fileInfoLabel.innerHTML = `<b>${file.name}</b> (${(file.size / 1024).toFixed(1)} KB) · <b>${res.rows.toLocaleString()}</b> valid records detected`;
            if (applyBtn) applyBtn.style.display = 'inline-flex';
          }
        } else {
          statusBox.innerHTML = `
            <div style="background:rgba(239, 68, 68, 0.15); border:1px solid var(--risk-high); color:var(--risk-high); padding:10px 14px; border-radius:6px; font-size:0.88rem;">
              <i class="fa-solid fa-triangle-exclamation"></i> <b>Validation Failed:</b> ${res.error || 'The file could not be parsed.'}
            </div>
          `;
        }
      } catch (err) {
        statusBox.innerHTML = `
          <div style="background:rgba(239, 68, 68, 0.15); border:1px solid var(--risk-high); color:var(--risk-high); padding:10px 14px; border-radius:6px; font-size:0.88rem;">
            <i class="fa-solid fa-triangle-exclamation"></i> Server upload error: ${err.message}
          </div>
        `;
      }
    };

    // Apply dataset to live platform
    if (applyBtn) {
      applyBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        applyBtn.disabled = true;
        applyBtn.innerHTML = `<div class="spinner" style="width:16px; height:16px; margin-right:6px;"></div> Applying to Platform...`;

        const formData = new FormData();
        formData.append('file', currentFile);

        try {
          const resp = await fetch('/api/upload?apply=true', {
            method: 'POST',
            body: formData
          });
          const res = await resp.json();

          if (resp.ok && res.success) {
            applyBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Applied Successfully!`;
            statusBox.innerHTML = `
              <div style="background:rgba(16, 185, 129, 0.2); border:1px solid var(--risk-low); color:var(--risk-low); padding:12px 14px; border-radius:6px; font-size:0.92rem; font-weight:700;">
                <i class="fa-solid fa-check-double"></i> Dataset applied to CrimeVision! Dashboard stats, maps, and model predictions updated.
              </div>
            `;

            // Reload all components across the platform
            await this.loadSummary();
            this.loadDashboardData();
            this.loadDataTable();
            if (this.activePage === 'analytics') this.loadAnalyticsPage();
            if (this.activePage === 'trends') this.loadTrendsPage();
            if (this.activePage === 'hotspots') this.loadHotspotsPage();
            if (window.IndiaCrimeMap && typeof IndiaCrimeMap.loadMapData === 'function') {
              IndiaCrimeMap.loadMapData();
            }

            setTimeout(() => {
              closeModal();
            }, 1500);
          } else {
            applyBtn.disabled = false;
            applyBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Try Again`;
            statusBox.innerHTML = `
              <div style="background:rgba(239, 68, 68, 0.15); border:1px solid var(--risk-high); color:var(--risk-high); padding:10px 14px; border-radius:6px; font-size:0.88rem;">
                <i class="fa-solid fa-triangle-exclamation"></i> Error applying dataset: ${res.error || 'Failed to apply.'}
              </div>
            `;
          }
        } catch (err) {
          applyBtn.disabled = false;
          applyBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Try Again`;
          statusBox.innerHTML = `
            <div style="background:rgba(239, 68, 68, 0.15); border:1px solid var(--risk-high); color:var(--risk-high); padding:10px 14px; border-radius:6px; font-size:0.88rem;">
              <i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.message}
            </div>
          `;
        }
      });
    }
  },

  // 7b. Reset & Restore Dataset Controller
  bindResetModal() {
    const resetModal = document.getElementById('resetModal');
    const openBtn = document.getElementById('btnOpenReset');
    const closeBtn = document.getElementById('btnCloseReset');
    const cancelBtn = document.getElementById('btnCancelReset');

    const restorePrevBtn = document.getElementById('btnDoRestorePrevious');
    const resetDefBtn = document.getElementById('btnDoResetDefault');
    const feedbackBox = document.getElementById('resetFeedbackBox');

    // Controls inside Upload Modal
    const uploadModalRestorePrev = document.getElementById('btnUploadModalRestorePrev');
    const uploadModalResetDef = document.getElementById('btnUploadModalResetDefault');
    const uploadStatusBox = document.getElementById('uploadStatusBox');

    const fetchStatus = async () => {
      try {
        const resp = await fetch('/api/dataset/status');
        if (!resp.ok) return null;
        const s = await resp.json();

        // Update elements in Reset Modal
        const curRowsEl = document.getElementById('resetCurrentRows');
        const defRowsEl = document.getElementById('resetDefaultRows');
        const prevRowsEl = document.getElementById('resetPreviousRows');
        const prevSub = document.getElementById('btnRestorePrevSubtext');

        if (curRowsEl) curRowsEl.innerText = `${s.current_rows.toLocaleString()} records across ${s.states_count} states (${s.is_default ? 'Original Project Dataset' : 'Custom Upload'})`;
        if (defRowsEl) defRowsEl.innerText = `${s.default_rows.toLocaleString()} records (7 States, 2021–2025)`;

        if (prevRowsEl) {
          if (s.has_previous && s.previous_rows > 0) {
            prevRowsEl.innerText = `${s.previous_rows.toLocaleString()} records (Ready to restore)`;
            prevRowsEl.style.color = 'var(--primary-blue)';
            if (restorePrevBtn) {
              restorePrevBtn.disabled = false;
              restorePrevBtn.style.opacity = '1';
              restorePrevBtn.style.cursor = 'pointer';
            }
            if (prevSub) prevSub.innerText = `Revert to dataset prior to last upload (${s.previous_rows.toLocaleString()} records)`;
          } else {
            prevRowsEl.innerText = `No previous upload backup available`;
            prevRowsEl.style.color = 'var(--text-muted)';
            if (restorePrevBtn) {
              restorePrevBtn.disabled = true;
              restorePrevBtn.style.opacity = '0.45';
              restorePrevBtn.style.cursor = 'not-allowed';
            }
            if (prevSub) prevSub.innerText = `No previous upload backup recorded yet`;
          }
        }

        // Update status in Upload Modal
        const uploadModalStatus = document.getElementById('uploadModalDatasetStatus');
        if (uploadModalStatus) {
          uploadModalStatus.innerText = `Active: ${s.is_default ? 'Original Project Dataset' : 'Custom Dataset'} (${s.current_rows.toLocaleString()} records · ${s.states_count} states)`;
        }
        if (uploadModalRestorePrev) {
          uploadModalRestorePrev.style.display = (s.has_previous && s.previous_rows > 0) ? 'inline-flex' : 'none';
        }

        return s;
      } catch (e) {
        console.warn('Dataset status fetch error:', e);
        return null;
      }
    };

    this.refreshDatasetStatus = fetchStatus;

    // Open/Close Reset Modal
    if (openBtn && resetModal) {
      openBtn.addEventListener('click', () => {
        if (feedbackBox) feedbackBox.innerHTML = '';
        resetModal.classList.add('open');
        fetchStatus();
      });
    }

    const closeResetModal = () => {
      if (resetModal) resetModal.classList.remove('open');
      if (feedbackBox) feedbackBox.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeResetModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeResetModal);

    if (resetModal) {
      resetModal.addEventListener('click', (e) => {
        if (e.target === resetModal) closeResetModal();
      });
    }

    // Shared execution function
    const performReset = async (target, btnElement, targetFeedbackBox) => {
      const origHtml = btnElement ? btnElement.innerHTML : '';
      if (btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = `<div class="spinner" style="width:16px; height:16px; margin-right:6px;"></div> Restoring...`;
      }

      if (targetFeedbackBox) {
        targetFeedbackBox.innerHTML = `
          <div style="background:rgba(59, 130, 246, 0.1); border:1px solid var(--primary-blue); color:var(--text-primary); padding:10px 14px; border-radius:6px; font-size:0.86rem; display:flex; align-items:center; gap:8px;">
            <div class="spinner" style="width:16px; height:16px;"></div>
            <span>Restoring ${target === 'previous' ? 'previous upload version' : 'original default benchmark dataset'}...</span>
          </div>
        `;
      }

      try {
        const resp = await fetch(`/api/dataset/reset?target=${target}`, { method: 'POST' });
        const res = await resp.json();

        if (resp.ok && res.success) {
          if (targetFeedbackBox) {
            targetFeedbackBox.innerHTML = `
              <div style="background:rgba(16, 185, 129, 0.15); border:1px solid var(--risk-low); color:var(--risk-low); padding:10px 14px; border-radius:6px; font-size:0.88rem; font-weight:700;">
                <i class="fa-solid fa-circle-check"></i> ${res.message}
              </div>
            `;
          }

          // Reload all platform statistics & maps
          await this.loadSummary();
          this.loadDashboardData();
          this.loadDataTable();
          if (this.activePage === 'analytics') this.loadAnalyticsPage();
          if (this.activePage === 'trends') this.loadTrendsPage();
          if (this.activePage === 'hotspots') this.loadHotspotsPage();
          if (window.IndiaCrimeMap && typeof IndiaCrimeMap.loadMapData === 'function') {
            IndiaCrimeMap.loadMapData();
          }

          await fetchStatus();

          setTimeout(() => {
            closeResetModal();
            const uploadModal = document.getElementById('uploadModal');
            if (uploadModal) uploadModal.classList.remove('open');
          }, 1400);
        } else {
          if (targetFeedbackBox) {
            targetFeedbackBox.innerHTML = `
              <div style="background:rgba(239, 68, 68, 0.15); border:1px solid var(--risk-high); color:var(--risk-high); padding:10px 14px; border-radius:6px; font-size:0.88rem;">
                <i class="fa-solid fa-triangle-exclamation"></i> Error: ${res.error || 'Reset failed'}
              </div>
            `;
          }
        }
      } catch (err) {
        if (targetFeedbackBox) {
          targetFeedbackBox.innerHTML = `
            <div style="background:rgba(239, 68, 68, 0.15); border:1px solid var(--risk-high); color:var(--risk-high); padding:10px 14px; border-radius:6px; font-size:0.88rem;">
              <i class="fa-solid fa-triangle-exclamation"></i> Reset request failed: ${err.message}
            </div>
          `;
        }
      } finally {
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.innerHTML = origHtml;
        }
      }
    };

    // Button event listeners in Reset Modal
    if (restorePrevBtn) {
      restorePrevBtn.addEventListener('click', () => performReset('previous', restorePrevBtn, feedbackBox));
    }
    if (resetDefBtn) {
      resetDefBtn.addEventListener('click', () => performReset('default', resetDefBtn, feedbackBox));
    }

    // Button event listeners in Upload Modal
    if (uploadModalRestorePrev) {
      uploadModalRestorePrev.addEventListener('click', () => performReset('previous', uploadModalRestorePrev, uploadStatusBox));
    }
    if (uploadModalResetDef) {
      uploadModalResetDef.addEventListener('click', () => performReset('default', uploadModalResetDef, uploadStatusBox));
    }

    // Initial status fetch on startup
    fetchStatus();
  },

  // 8. Model Performance Page Controller
  async loadModelPerformancePage() {
    try {
      const resp = await fetch('/api/model-performance');
      if (!resp.ok) throw new Error('Model performance failed');
      const data = await resp.json();

      // Comparison table
      const tbody = document.getElementById('modelBenchmarkBody');
      if (tbody && data.metrics) {
        tbody.innerHTML = data.metrics.map(m => `
          <tr style="${m.model === data.best_model_name ? 'background:rgba(59,130,246,0.1); font-weight:700;' : ''}">
            <td>
              <b>${m.model}</b>
              ${m.model === data.best_model_name ? '<span class="badge-demo" style="background:var(--primary-blue); color:#fff; margin-left:6px;">BEST MODEL</span>' : ''}
            </td>
            <td>${m.accuracy}%</td>
            <td>${m.precision}%</td>
            <td>${m.recall}%</td>
            <td><b>${m.f1_score}%</b></td>
          </tr>
        `).join('');
      }

      // Confusion Matrix for Best Model
      const cmBox = document.getElementById('confusionMatrixBox');
      if (cmBox && data.confusion_matrices && data.classes) {
        const cm = data.confusion_matrices[data.best_model_name];
        const labels = data.classes;

        let cmHtml = `
          <table class="cm-table">
            <thead>
              <tr>
                <th style="font-size:0.75rem; color:var(--text-muted); padding:6px;">True \\ Pred</th>
                ${labels.map(l => `<th style="font-size:0.74rem; color:var(--text-secondary); padding:6px;">${l}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
        `;

        cm.forEach((row, rIdx) => {
          cmHtml += `<tr><td style="font-size:0.76rem; font-weight:700; padding-right:8px; text-align:right;">${labels[rIdx]}</td>`;
          const maxInRow = Math.max(...row);
          row.forEach((v, cIdx) => {
            const isDiag = rIdx === cIdx;
            const bg = isDiag ? 'rgba(59, 130, 246, 0.45)' : (v > 0 ? 'rgba(255, 255, 255, 0.05)' : 'transparent');
            cmHtml += `<td class="cm-cell" style="background:${bg};" title="Actual: ${labels[rIdx]}, Predicted: ${labels[cIdx]} (${v})">${v}</td>`;
          });
          cmHtml += `</tr>`;
        });

        cmHtml += `</tbody></table>`;
        cmBox.innerHTML = cmHtml;
      }

      // Feature Importance
      if (data.feature_importance) {
        ChartsEngine.renderHorizontalBar(
          'modelFeatureImportanceChart',
          data.feature_importance.features.map(f => f.replace('Zone_', '').replace('City_', '')),
          data.feature_importance.scores,
          '#6366f1'
        );
      }
    } catch (e) {
      console.warn('Model performance loading error:', e);
    }
  },

  // Cross-Navigation shortcut from Map to Prediction
  analyzeZoneInPrediction(state, city, zone) {
    this.showPage('prediction');
    setTimeout(() => {
      const sSel = document.getElementById('predStateSelect');
      const cSel = document.getElementById('predCitySelect');
      const zSel = document.getElementById('predZoneSelect');

      if (sSel) sSel.value = state;
      if (cSel) cSel.value = city;
      if (zSel) zSel.value = zone;
    }, 150);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  CrimeVisionApp.init();
});
