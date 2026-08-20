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
    const maxWeight = Math.max(1, ...rows.map(r => r.topWeight));
    const best = Math.max(...rows.map(r => r.topWeight));
    const totalVolume = rows.reduce((t, r) => t + r.volume, 0);

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-label">Mejor peso</span><strong class="stat-value">${best} <small>kg</small></strong></div>
        <div class="stat-card"><span class="stat-label">Sesiones</span><strong class="stat-value">${rows.length}</strong></div>
        <div class="stat-card"><span class="stat-label">Volumen acumulado</span><strong class="stat-value">${totalVolume.toLocaleString('es-AR')} <small>kg</small></strong></div>
      </div>
      <div class="progress-bars">
        ${rows.map(r => `
          <div class="pb-row" title="${escapeHtml(r.detail)}">
            <span class="pb-date">${formatDateShort(r.date)}</span>
            <span class="pb-track"><span class="pb-fill" style="width:${Math.round(r.topWeight / maxWeight * 100)}%"></span></span>
            <span>${r.topWeight} kg · ${r.sets} series</span>
          </div>
        `).join('')}
      </div>
    `;
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
