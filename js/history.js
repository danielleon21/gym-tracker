/* ============================================================
   history.js  -  Historial de sesiones y progreso por ejercicio
   ============================================================ */

const History = {
  selectedExercise: null,

  init() {
    $('#exercise-filter').addEventListener('change', e => {
      this.selectedExercise = e.target.value;
      this.renderProgress(Store.getSessions());
    });
  },

  render() {
    const sessions = Store.getSessions();
    this.renderFilter(sessions);
    this.renderProgress(sessions);
    this.renderList(sessions);
  },

  renderFilter(sessions) {
    const names = Stats.exerciseNames(sessions);
    const select = $('#exercise-filter');

    if (names.length === 0) {
      select.innerHTML = '<option>Sin datos</option>';
      this.selectedExercise = null;
      return;
    }
    if (!names.includes(this.selectedExercise)) this.selectedExercise = names[0];

    select.innerHTML = names
      .map(n => `<option value="${escapeHtml(n)}"${n === this.selectedExercise ? ' selected' : ''}>${escapeHtml(n)}</option>`)
      .join('');
  },

  renderProgress(sessions) {
    const container = $('#exercise-progress');
    if (!this.selectedExercise) {
      container.innerHTML = UI.emptyState('Cuando guardes sesiones vas a ver acá la evolución de cada ejercicio.');
      return;
    }

    const rows = Stats.exerciseHistory(sessions, this.selectedExercise).slice(0, 12).reverse();
    const best = Math.max(...rows.map(r => r.topWeight));
    const totalVolume = rows.reduce((t, r) => t + r.volume, 0);

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-label">Mejor peso</span><strong class="stat-value">${best} <small>kg</small></strong></div>
        <div class="stat-card"><span class="stat-label">Sesiones</span><strong class="stat-value">${rows.length}</strong></div>
        <div class="stat-card"><span class="stat-label">Volumen acumulado</span><strong class="stat-value">${totalVolume.toLocaleString('es-AR')} <small>kg</small></strong></div>
      </div>
      <div class="chart-wrap">
        ${this.buildChartSvg(rows)}
        <div class="chart-tooltip" role="tooltip"></div>
      </div>
    `;

    this.bindChartEvents(container, rows);
  },

  /** Genera el <svg> de la evolución de peso máximo por sesión. */
  buildChartSvg(rows) {
    const W = 640, H = 220;
    const padL = 34, padR = 12, padT = 16, padB = 26;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const baseY = padT + innerH;

    const maxRaw = Math.max(...rows.map(r => r.topWeight));
    const yMax = Math.max(5, Math.ceil((maxRaw * 1.15) / 5) * 5);
    const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

    const xStep = rows.length > 1 ? innerW / (rows.length - 1) : 0;
    const points = rows.map((r, i) => ({
      ...r,
      x: padL + (rows.length > 1 ? i * xStep : innerW / 2),
      y: padT + innerH - (r.topWeight / yMax) * innerH
    }));

    const gridLines = yTicks.map(t => {
      const y = (padT + innerH - (t / yMax) * innerH).toFixed(1);
      return `<line class="chart-grid" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" />
        <text class="chart-axis-y" x="${padL - 8}" y="${y}" dy="0.32em" text-anchor="end">${Math.round(t)}</text>`;
    }).join('');

    const showEvery = rows.length > 8 ? 2 : 1;
    const xLabels = points.map((p, i) => {
      if (i % showEvery !== 0 && i !== points.length - 1) return '';
      return `<text class="chart-axis-x" x="${p.x.toFixed(1)}" y="${H - 8}" text-anchor="middle">${formatDateShort(p.date)}</text>`;
    }).join('');

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPath = points.length > 1
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${baseY.toFixed(1)} L${points[0].x.toFixed(1)},${baseY.toFixed(1)} Z`
      : '';

    const dots = points.map((p, i) => `<circle class="chart-dot" data-i="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" />`).join('');

    return `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso máximo de ${escapeHtml(this.selectedExercise)} por sesión">
        <defs>
          <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.28" />
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
          </linearGradient>
        </defs>
        ${gridLines}
        <line class="chart-grid" x1="${padL}" x2="${W - padR}" y1="${baseY.toFixed(1)}" y2="${baseY.toFixed(1)}" />
        ${areaPath ? `<path class="chart-area" d="${areaPath}" fill="url(#chart-area-grad)" />` : ''}
        ${points.length > 1 ? `<path class="chart-line" d="${linePath}" fill="none" />` : ''}
        ${dots}
        ${xLabels}
        <line class="chart-crosshair" x1="0" x2="0" y1="${padT}" y2="${baseY.toFixed(1)}" />
        <circle class="chart-highlight" r="6" cx="-99" cy="-99" />
        <rect class="chart-overlay" x="${padL}" y="${padT}" width="${innerW}" height="${innerH}" fill="transparent" data-pad-l="${padL}" data-x-step="${xStep}" />
      </svg>
    `;
  },

  /** Cablea el hover/crosshair del gráfico de evolución. */
  bindChartEvents(container, rows) {
    const wrap = $('.chart-wrap', container);
    const svg = $('.chart-svg', wrap);
    const overlay = $('.chart-overlay', svg);
    const tooltip = $('.chart-tooltip', wrap);
    const crosshair = $('.chart-crosshair', svg);
    const highlight = $('.chart-highlight', svg);
    if (!overlay || rows.length === 0) return;

    const padL = Number(overlay.dataset.padL);
    const xStep = Number(overlay.dataset.xStep);
    const dots = $$('.chart-dot', svg);
    const viewBoxW = svg.viewBox.baseVal.width;

    const showPoint = (i, clientX, clientY) => {
      const r = rows[i];
      const dot = dots[i];
      const x = Number(dot.getAttribute('cx'));
      const y = Number(dot.getAttribute('cy'));

      crosshair.setAttribute('x1', x); crosshair.setAttribute('x2', x);
      crosshair.classList.add('is-visible');
      highlight.setAttribute('cx', x); highlight.setAttribute('cy', y);
      highlight.classList.add('is-visible');

      tooltip.innerHTML = `
        <span class="tt-date">${formatDate(r.date)}</span>
        <span class="tt-weight">${r.topWeight} kg</span> · ${r.sets} series
        <span class="tt-date">${escapeHtml(r.detail)}</span>
      `;
      tooltip.classList.add('is-visible');

      const wrapRect = wrap.getBoundingClientRect();
      let left = clientX - wrapRect.left + 14;
      let top = clientY - wrapRect.top - 14;
      const ttW = tooltip.offsetWidth, ttH = tooltip.offsetHeight;
      if (left + ttW > wrapRect.width) left = clientX - wrapRect.left - ttW - 14;
      if (top < 0) top = 0;
      if (top + ttH > wrapRect.height) top = wrapRect.height - ttH;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };

    const onMove = e => {
      const rect = svg.getBoundingClientRect();
      const scaleX = viewBoxW / rect.width;
      const px = (e.clientX - rect.left) * scaleX;
      let idx = rows.length > 1 ? Math.round((px - padL) / xStep) : 0;
      idx = Math.max(0, Math.min(rows.length - 1, idx));
      showPoint(idx, e.clientX, e.clientY);
    };

    const onLeave = () => {
      crosshair.classList.remove('is-visible');
      highlight.classList.remove('is-visible');
      tooltip.classList.remove('is-visible');
    };

    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerdown', onMove);
    overlay.addEventListener('pointerleave', onLeave);
  },

  renderList(sessions) {
    const container = $('#history-list');
    if (sessions.length === 0) {
      container.innerHTML = UI.emptyState('Todavía no hay sesiones guardadas.');
      return;
    }

    container.innerHTML = sessions.map(s => `
      <div class="list-item">
        <div class="li-main">
          <span class="li-title">${escapeHtml(s.routineName)}</span>
          <span class="li-sub">${formatDate(s.date)} · ${s.entries.length} ejercicios · ${Stats.sessionSets(s)} series · ${Stats.sessionVolume(s).toLocaleString('es-AR')} kg</span>
        </div>
        <div class="li-actions">
          <button class="btn btn-sm" data-detail="${s.id}">Ver</button>
          <button class="btn btn-sm btn-danger" data-del="${s.id}">Borrar</button>
        </div>
      </div>
    `).join('');

    $$('[data-detail]', container).forEach(b =>
      b.addEventListener('click', () => this.showSessionDetail(b.dataset.detail)));
    $$('[data-del]', container).forEach(b =>
      b.addEventListener('click', () => this.removeSession(b.dataset.del)));
  },

  showSessionDetail(id) {
    const s = Store.getSession(id);
    if (!s) return;

    const body = `
      <p class="li-sub" style="margin-top:0">${formatDate(s.date)} · ${Stats.sessionVolume(s).toLocaleString('es-AR')} kg de volumen</p>
      ${s.notes ? `<p class="li-sub">📝 ${escapeHtml(s.notes)}</p>` : ''}
      ${s.entries.map(e => `
        <section class="exercise-block">
          <header><h3>${escapeHtml(e.name)}</h3></header>
          ${e.sets.map((set, i) => `
            <div class="li-sub">Serie ${i + 1}: ${set.weight || 0} kg × ${set.reps || 0} reps</div>
          `).join('')}
        </section>
      `).join('')}
    `;

    UI.openModal({
      title: s.routineName,
      body,
      actions: [{ label: 'Cerrar', className: 'btn-primary', onClick: () => UI.closeModal() }]
    });
  },

  removeSession(id) {
    UI.confirm('¿Borrar esta sesión del historial?', () => {
      Store.deleteSession(id);
      UI.toast('Sesión eliminada');
      this.render();
    });
  }
};
