/* ============================================================
   dashboard.js  -  Estadisticas + heatmap anual por mes
   ============================================================ */

const Dashboard = {
  year: new Date().getFullYear(),

  init() {
    $('#year-prev').addEventListener('click', () => { this.year--; this.render(); });
    $('#year-next').addEventListener('click', () => { this.year++; this.render(); });
  },

  render() {
    const sessions = Store.getSessions();
    this.renderStats(sessions);
    this.renderHeatmap(sessions);
    this.renderRecent(sessions);
  },

  renderStats(sessions) {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = sessions.filter(s => s.date.startsWith(prefix));
    const volume = thisMonth.reduce((t, s) => t + Stats.sessionVolume(s), 0);

    $('#stat-month').textContent = thisMonth.length;
    $('#stat-streak').innerHTML = `${Stats.currentStreak(sessions)} <small>días</small>`;
    $('#stat-volume').innerHTML = `${volume.toLocaleString('es-AR')} <small>kg</small>`;
    $('#stat-total').textContent = sessions.length;
  },

  renderHeatmap(sessions) {
    $('#year-label').textContent = this.year;

    const byDate = Stats.volumeByDate(sessions);
    const yearVolumes = Object.entries(byDate)
      .filter(([date]) => date.startsWith(String(this.year)))
      .map(([, v]) => v.volume);
    const maxVolume = Math.max(1, ...yearVolumes);
    const today = toISODate();

    let html = '';
    for (let month = 0; month < 12; month++) {
      html += `<div class="hm-month"><h4>${MESES[month]}</h4><div class="hm-grid">`;
      html += ['L', 'M', 'X', 'J', 'V', 'S', 'D']
        .map(d => `<span class="hm-dow">${d}</span>`).join('');

      const first = new Date(this.year, month, 1);
      // getDay() devuelve 0=domingo; lo convertimos a 0=lunes
      const offset = (first.getDay() + 6) % 7;
      for (let i = 0; i < offset; i++) html += '<span class="hm-day is-empty"></span>';

      const daysInMonth = new Date(this.year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const iso = `${this.year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const info = byDate[iso];
        const level = info ? this.levelFor(info.volume, maxVolume) : 0;
        const title = info
          ? `${formatDate(iso)} — ${info.count} sesión(es), ${info.volume.toLocaleString('es-AR')} kg`
          : formatDate(iso);
        html += `<span class="hm-day${iso === today ? ' is-today' : ''}" data-level="${level}" title="${escapeHtml(title)}"></span>`;
      }
      html += '</div></div>';
    }
    $('#heatmap').innerHTML = html;
  },

  /** Nivel 1-4 segun el volumen del dia comparado con el mejor dia del año. */
  levelFor(volume, maxVolume) {
    if (volume <= 0) return 1;               // entreno, pero sin series completadas
    const ratio = volume / maxVolume;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  },

  renderRecent(sessions) {
    const recent = sessions.slice(0, 5);
    if (recent.length === 0) {
      $('#recent-sessions').innerHTML = UI.emptyState('Todavía no registraste ninguna sesión. Creá una rutina y empezá a entrenar.');
      return;
    }
    $('#recent-sessions').innerHTML = recent.map(s => `
      <div class="list-item">
        <div class="li-main">
          <span class="li-title">${escapeHtml(s.routineName)}</span>
          <span class="li-sub">${formatDate(s.date)} · ${Stats.sessionSets(s)} series · ${Stats.sessionVolume(s).toLocaleString('es-AR')} kg</span>
        </div>
        <div class="li-actions">
          <button class="btn btn-sm" data-session-detail="${s.id}">Ver</button>
        </div>
      </div>
    `).join('');

    $$('[data-session-detail]', $('#recent-sessions')).forEach(btn => {
      btn.addEventListener('click', () => History.showSessionDetail(btn.dataset.sessionDetail));
    });
  }
};
