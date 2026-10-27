/**
 * CrimeSense — Dynamic Insights, Transparency & Model Performance Module
 */

const InsightsEngine = {
  async loadInsights() {
    const container = document.getElementById('insightsContainer');
    if (!container) return;

    try {
      const resp = await fetch('/api/insights');
      if (!resp.ok) throw new Error('Failed to load insights');
      const data = await resp.json();

      let html = '';

      // 1. Historical Insights
      html += `
        <div style="margin-bottom:32px;">
          <h3 style="font-size:1.4rem; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-blue);"></i> Historical Trends & Trajectory
          </h3>
          <div class="insights-grid">
            ${data.historical.map(item => `
              <div class="insight-card">
                <span class="insight-badge">Historical Factor</span>
                <h4 class="insight-title">${item.title}</h4>
                <p class="insight-detail">${item.detail}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // 2. Temporal Insights
      html += `
        <div style="margin-bottom:32px;">
          <h3 style="font-size:1.4rem; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-business-time" style="color:var(--accent-cyan);"></i> Temporal & Diurnal Patterns
          </h3>
          <div class="insights-grid">
            ${data.temporal.map(item => `
              <div class="insight-card">
                <span class="insight-badge" style="color:var(--accent-cyan);">Time Factor</span>
                <h4 class="insight-title">${item.title}</h4>
                <p class="insight-detail">${item.detail}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // 3. Location Insights
      html += `
        <div style="margin-bottom:32px;">
          <h3 style="font-size:1.4rem; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-location-dot" style="color:var(--risk-med);"></i> Geographic & Zone Concentration
          </h3>
          <div class="insights-grid">
            ${data.geographic.map(item => `
              <div class="insight-card">
                <span class="insight-badge" style="color:var(--risk-med);">Geographic Factor</span>
                <h4 class="insight-title">${item.title}</h4>
                <p class="insight-detail">${item.detail}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // 4. Crime Category Insights
      html += `
        <div>
          <h3 style="font-size:1.4rem; margin-bottom:14px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-fingerprint" style="color:var(--accent-indigo);"></i> Crime Typology & Prevalence
          </h3>
          <div class="insights-grid">
            ${data.crime_type.map(item => `
              <div class="insight-card">
                <span class="insight-badge" style="color:var(--accent-indigo);">Typology Factor</span>
                <h4 class="insight-title">${item.title}</h4>
                <p class="insight-detail">${item.detail}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = `<div style="color:var(--risk-very-high); padding:20px;">Could not load insights: ${e.message}</div>`;
    }
  },

  async loadDataTransparency() {
    const tableBody = document.getElementById('dataQualityTableBody');
    if (!tableBody) return;

    try {
      const resp = await fetch('/api/data/quality');
      if (!resp.ok) throw new Error('Data quality fetch failed');
      const data = await resp.json();

      tableBody.innerHTML = data.columns.map(col => `
        <tr>
          <td><b>${col.column}</b></td>
          <td><code>${col.dtype}</code></td>
          <td>${col.non_null_rows}</td>
          <td>${col.missing_rows} (${col.missing_pct}%)</td>
          <td>
            <span style="font-size:0.8rem; font-weight:700; color:${col.missing_rows === 0 ? 'var(--risk-low)' : 'var(--risk-med)'};">
              ${col.missing_rows === 0 ? '✓ Complete' : 'Imputed / Handled'}
            </span>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.warn('Data transparency loading error:', e);
    }
  },

  async loadModelPerformance() {
    const metricsContainer = document.getElementById('modelMetricsContainer');
    const compTable = document.getElementById('modelCompTableBody');
    const cmContainer = document.getElementById('confusionMatrixContainer');
    if (!metricsContainer) return;

    try {
      const resp = await fetch('/api/model/performance');
      if (!resp.ok) throw new Error('Model performance fetch failed');
      const data = await resp.json();

      const activeMetrics = (data.metrics || []).find(m => m.Model === data.best_model_name) || (data.metrics || [])[0] || {};

      metricsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(59,130,246,0.15); color:var(--accent-blue);"><i class="fa-solid fa-bullseye"></i></div>
          <div class="stat-info">
            <div class="stat-value">${(activeMetrics.Accuracy * 100).toFixed(1)}%</div>
            <div class="stat-label">Model Accuracy</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(6,182,212,0.15); color:var(--accent-cyan);"><i class="fa-solid fa-crosshairs"></i></div>
          <div class="stat-info">
            <div class="stat-value">${(activeMetrics.Precision * 100).toFixed(1)}%</div>
            <div class="stat-label">Weighted Precision</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(99,102,241,0.15); color:var(--accent-indigo);"><i class="fa-solid fa-arrows-rotate"></i></div>
          <div class="stat-info">
            <div class="stat-value">${(activeMetrics.Recall * 100).toFixed(1)}%</div>
            <div class="stat-label">Weighted Recall</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background:rgba(16,185,129,0.15); color:var(--risk-low);"><i class="fa-solid fa-award"></i></div>
          <div class="stat-info">
            <div class="stat-value">${(activeMetrics.F1 * 100).toFixed(1)}%</div>
            <div class="stat-label">Weighted F1 Score</div>
          </div>
        </div>
      `;

      // 4 Model comparison table
      if (compTable && data.metrics) {
        compTable.innerHTML = data.metrics.map(m => `
          <tr style="${m.Model === data.best_model_name ? 'background:rgba(59,130,246,0.1); font-weight:700;' : ''}">
            <td>
              ${m.Model}
              ${m.Model === data.best_model_name ? '<span style="font-size:0.75rem; background:var(--accent-blue); color:#fff; padding:2px 6px; border-radius:4px; margin-left:6px;">BEST PIPELINE</span>' : ''}
            </td>
            <td>${(m.Accuracy * 100).toFixed(1)}%</td>
            <td>${(m.Precision * 100).toFixed(1)}%</td>
            <td>${(m.Recall * 100).toFixed(1)}%</td>
            <td><b>${(m.F1 * 100).toFixed(1)}%</b></td>
          </tr>
        `).join('');
      }

      // Render Confusion Matrix
      if (cmContainer && data.confusion_matrices && data.class_labels) {
        const matrix = data.confusion_matrices[data.best_model_name] || [];
        const labels = data.class_labels;

        let cmHtml = `
          <table class="cm-table">
            <thead>
              <tr>
                <th style="font-size:0.75rem; color:var(--text-muted); padding:6px;">Actual \\ Pred</th>
                ${labels.map(l => `<th style="font-size:0.72rem; color:var(--text-secondary); padding:4px 6px; max-width:60px; overflow:hidden; text-overflow:ellipsis;">${l.slice(0, 5)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
        `;

        matrix.forEach((row, rIdx) => {
          cmHtml += `<tr><td style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); padding-right:8px; text-align:right;">${labels[rIdx].slice(0, 6)}</td>`;
          const maxInRow = Math.max(...row);
          row.forEach((val, cIdx) => {
            const isDiag = rIdx === cIdx;
            const intensity = maxInRow > 0 ? (val / maxInRow) : 0;
            const bg = isDiag 
              ? `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`
              : (val > 0 ? `rgba(255, 255, 255, ${0.03 + intensity * 0.15})` : 'transparent');
            cmHtml += `<td class="cm-cell" style="background:${bg};" title="Actual: ${labels[rIdx]}, Predicted: ${labels[cIdx]} (${val})">${val}</td>`;
          });
          cmHtml += `</tr>`;
        });

        cmHtml += `</tbody></table>`;
        cmContainer.innerHTML = cmHtml;
      }

      // Feature Importance Chart
      if (data.feature_importance && data.feature_importance.features) {
        setTimeout(() => {
          Charts.renderFeatureImportance(
            'modelFeatureImportanceChart',
            data.feature_importance.features,
            data.feature_importance.scores
          );
        }, 50);
      }
    } catch (e) {
      console.warn('Model performance loading error:', e);
    }
  }
};
