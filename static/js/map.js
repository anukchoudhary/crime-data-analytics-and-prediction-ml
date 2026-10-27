/**
 * CrimeVision AI — India Interactive Crime Map Module (Leaflet)
 */

const IndiaCrimeMap = {
  map: null,
  zoneLayer: null,
  clusterLayer: null,
  heatmapLayer: null,
  zonesData: [],
  selectedZones: [],
  showHeatmap: true,
  showClusters: true,

  init() {
    if (this.map) return;

    // Center on India geographic overview
    this.map = L.map('indiaMap', {
      zoomControl: true,
      minZoom: 4,
      maxZoom: 18
    }).setView([22.5937, 78.9629], 5);

    // CartoDB Dark Matter / Positron
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    this.zoneLayer = L.layerGroup().addTo(this.map);
    this.clusterLayer = L.layerGroup().addTo(this.map);

    this.loadMapData();
    this.setupSearch();
  },

  async loadMapData() {
    try {
      const resp = await fetch('/api/zones');
      if (!resp.ok) throw new Error('Failed to load zones');
      this.zonesData = await resp.json();
      this.renderZones();

      // Also load clusters
      const clResp = await fetch('/api/clusters');
      if (clResp.ok) {
        const clusters = await clResp.json();
        this.renderClusters(clusters);
      }
    } catch (e) {
      console.error('[IndiaCrimeMap] Map data error:', e);
    }
  },

  renderZones() {
    this.zoneLayer.clearLayers();

    this.zonesData.forEach(z => {
      // Risk scale
      const c = z.total_crimes;
      let color = '#10b981';
      let riskLevel = 'LOW';
      let radius = 22;

      if (c >= 170) {
        color = '#ef4444';
        riskLevel = 'HIGH';
        radius = 32;
      } else if (c >= 130) {
        color = '#f59e0b';
        riskLevel = 'MEDIUM';
        radius = 26;
      }

      const marker = L.circleMarker([z.lat, z.lng], {
        radius: radius,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.45
      });

      marker.bindTooltip(`
        <div style="font-family:Inter,sans-serif; padding:4px;">
          <b style="font-size:13px;">${z.zone}</b><br/>
          <small style="color:#94a3b8;">${z.city}, ${z.state}</small><br/>
          <span style="color:${color}; font-weight:700;">● ${riskLevel} RISK (${c} cases)</span><br/>
          <small>Dominant: ${z.dominant_crime}</small>
        </div>
      `, { direction: 'top' });

      marker.on('click', () => {
        this.selectZone(z, riskLevel);
      });

      this.zoneLayer.addLayer(marker);
    });
  },

  renderClusters(clusters) {
    this.clusterLayer.clearLayers();
    if (!this.showClusters) return;

    clusters.forEach(cl => {
      const icon = L.divIcon({
        className: 'cluster-marker',
        html: `
          <div style="background:rgba(59,130,246,0.85); color:#fff; border-radius:50%; width:34px; height:34px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px; border:2px solid #fff; box-shadow:0 0 12px rgba(59,130,246,0.6);">
            ${cl.cluster_id}
          </div>
        `,
        iconSize: [34, 34]
      });

      const m = L.marker(cl.center, { icon });
      m.bindPopup(`
        <div style="font-family:Inter,sans-serif; font-size:12px;">
          <b>Cluster ${cl.cluster_id}: ${cl.city} Region</b><br/>
          <span>Incidents: <b>${cl.crime_count}</b></span><br/>
          <span>Primary: ${cl.dominant_crime}</span><br/>
          <small style="color:#64748b;">Risk: ${cl.risk_level}</small>
        </div>
      `);
      this.clusterLayer.addLayer(m);
    });
  },

  selectZone(z, riskLevel) {
    this.map.flyTo([z.lat, z.lng], 13, { duration: 1.2 });
    this.updateSidePanel(z, riskLevel);

    // Track for comparison
    if (!this.selectedZones.includes(z.zone)) {
      this.selectedZones.push(z.zone);
      if (this.selectedZones.length > 3) this.selectedZones.shift();
      this.updateComparisonWidget();
    }
  },

  updateSidePanel(z, riskLevel) {
    const panel = document.getElementById('zoneDetailPanel');
    if (!panel) return;

    const score = minMax(Math.round((z.total_crimes / 220) * 70 + 25), 25, 95);
    const color = riskLevel === 'HIGH' ? '#ef4444' : (riskLevel === 'MEDIUM' ? '#f59e0b' : '#10b981');

    panel.innerHTML = `
      <div class="zone-panel-header">
        <span class="zone-city-badge">${z.city}, ${z.state}</span>
        <h2 class="zone-title">${z.zone}</h2>
        <div style="margin-top:6px;">
          <span class="risk-badge" style="background:${color}22; color:${color}; border:1px solid ${color}44;">
            ${riskLevel} RISK (${score}% Probability)
          </span>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px;">
        <div style="background:var(--bg-input); padding:10px; border-radius:8px;">
          <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase;">Crime Count</div>
          <b style="font-size:1.1rem;">${z.total_crimes}</b>
        </div>
        <div style="background:var(--bg-input); padding:10px; border-radius:8px;">
          <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase;">Dominant Type</div>
          <b style="font-size:1.1rem;">${z.dominant_crime}</b>
        </div>
        <div style="background:var(--bg-input); padding:10px; border-radius:8px;">
          <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase;">Peak Window</div>
          <b style="font-size:0.95rem;">${z.peak_window}</b>
        </div>
        <div style="background:var(--bg-input); padding:10px; border-radius:8px;">
          <div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase;">Peak Day</div>
          <b style="font-size:0.95rem;">${z.peak_day}</b>
        </div>
      </div>

      <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5; margin-bottom:18px;">
        Sector Location: <b>${z.location}</b>. Real historical records demonstrate consistent property crime frequency during evening windows.
      </p>

      <button class="btn-header-cta" style="width:100%; justify-content:center;" onclick="CrimeVisionApp.analyzeZoneInPrediction('${z.state}', '${z.city}', '${z.zone}')">
        Analyze This Zone →
      </button>
    `;
  },

  updateComparisonWidget() {
    const compBox = document.getElementById('zoneComparisonContainer');
    if (!compBox) return;

    if (this.selectedZones.length === 0) {
      compBox.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">Click zones on the map to compare up to 3 sectors side-by-side.</p>`;
      return;
    }

    const profiles = this.selectedZones.map(name => this.zonesData.find(z => z.zone === name)).filter(Boolean);

    let html = `
      <div style="margin-top:16px;">
        <h4 style="font-size:0.95rem; margin-bottom:8px;">Multi-Zone Comparison (${profiles.length} Selected)</h4>
        <div class="data-table-container">
          <table class="crime-table">
            <thead>
              <tr>
                <th>Metric</th>
                ${profiles.map(p => `<th>${p.zone.slice(0, 14)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Crime Count</b></td>
                ${profiles.map(p => `<td><b>${p.total_crimes}</b></td>`).join('')}
              </tr>
              <tr>
                <td><b>Dominant Crime</b></td>
                ${profiles.map(p => `<td>${p.dominant_crime}</td>`).join('')}
              </tr>
              <tr>
                <td><b>Peak Time</b></td>
                ${profiles.map(p => `<td>${p.peak_window}</td>`).join('')}
              </tr>
              <tr>
                <td><b>City / State</b></td>
                ${profiles.map(p => `<td>${p.city}, ${p.state.slice(0, 4)}</td>`).join('')}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    compBox.innerHTML = html;
  },

  setupSearch() {
    const input = document.getElementById('mapSearchInput');
    if (!input) return;

    input.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) return;

      const match = this.zonesData.find(z => 
        z.zone.toLowerCase().includes(q) || 
        z.city.toLowerCase().includes(q) || 
        z.state.toLowerCase().includes(q)
      );

      if (match) {
        this.selectZone(match, match.total_crimes > 160 ? 'HIGH' : 'MEDIUM');
      }
    });
  },

  flyToCity(cityName) {
    const cityZones = this.zonesData.filter(z => z.city.toLowerCase() === cityName.toLowerCase());
    if (cityZones.length > 0) {
      this.map.flyTo([cityZones[0].lat, cityZones[0].lng], 11, { duration: 1.5 });
    }
  }
};

function minMax(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
