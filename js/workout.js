/* ============================================================
   workout.js  -  Sesion de entrenamiento en curso
   ============================================================ */

const Workout = {
  render() {
    const active = Store.getActiveSession();
    const container = $('#workout-container');

    if (!active) {
      this.renderPicker(container);
    } else {
      this.renderActive(container, active);
    }
  },

  /* ---------- Selector de rutina ---------- */

  renderPicker(container) {
    const routines = Store.getRoutines();

    container.innerHTML = `
      <div class="view-head">
        <h2>Empezar un entrenamiento</h2>
        <button class="btn" id="free-session">Sesión libre</button>
      </div>
      <div class="cards-grid" id="picker-list">
        ${routines.length === 0
          ? UI.emptyState('Creá una rutina en la pestaña "Rutinas" para poder entrenar, o arrancá una sesión libre.')
          : routines.map(r => `
            <article class="routine-card">
              <h3>${escapeHtml(r.name)}</h3>
              <div class="routine-ex">
                ${r.exercises.map(e => `<span>• ${escapeHtml(e.name)} — ${e.sets}x${e.reps}</span>`).join('')}
              </div>
              <div class="routine-actions">
                <button class="btn btn-primary btn-block" data-start="${r.id}">Entrenar esta rutina</button>
              </div>
            </article>
          `).join('')}
      </div>
    `;

    $$('[data-start]', container).forEach(b =>
      b.addEventListener('click', () => this.start(b.dataset.start)));
    $('#free-session').addEventListener('click', () => this.start(null));
  },

  /* ---------- Inicio de sesion ---------- */

  start(routineId) {
    const active = Store.getActiveSession();
    if (active) {
      UI.toast('Ya tenés una sesión en curso');
      UI.showView('workout');
      return;
    }

    const routine = routineId ? Store.getRoutine(routineId) : null;
    const history = Store.getSessions();

    const entries = (routine?.exercises || []).map(ex => {
      const last = this.lastPerformance(history, ex.name);
      return {
        exerciseId: ex.id,
        name: ex.name,
        sets: Array.from({ length: ex.sets || 3 }, () => ({
          weight: last?.weight ?? (ex.weight === '' ? '' : ex.weight),
          reps: last?.reps ?? ex.reps,
          done: false
        }))
      };
    });

    const session = {
      id: uid(),
      routineId: routine?.id || null,
      routineName: routine?.name || 'Sesión libre',
      date: toISODate(),
      startedAt: new Date().toISOString(),
      notes: '',
      entries
    };
    RestTimer.ensure(session, routine?.restSeconds ?? DEFAULT_REST_SECONDS);
    Store.setActiveSession(session);

    UI.showView('workout');
  },

  /** Ultimo peso/reps registrados para un ejercicio, para precargar la sesion. */
  lastPerformance(sessions, name) {
    for (const s of sessions) {
      for (const e of s.entries || []) {
        if (e.name !== name) continue;
        const done = (e.sets || []).filter(x => x.done);
        if (done.length) {
          const best = done.reduce((a, b) => (Number(b.weight) || 0) > (Number(a.weight) || 0) ? b : a);
          return { weight: best.weight, reps: best.reps };
        }
      }
    }
    return null;
  },

  /* ---------- Sesion activa ---------- */

  renderActive(container, session) {
    const volume = Stats.sessionVolume(session);
    const sets = Stats.sessionSets(session);

    container.innerHTML = `
      <div class="card">
        <div class="card-head">
          <h2>${escapeHtml(session.routineName)} <span class="badge">en curso</span></h2>
          <input class="input" type="date" id="session-date" value="${session.date}" style="width:auto">
        </div>
        <div class="stats-grid" style="margin-bottom:0">
          <div class="stat-card"><span class="stat-label">Series hechas</span><strong class="stat-value">${sets}</strong></div>
          <div class="stat-card"><span class="stat-label">Volumen</span><strong class="stat-value">${volume.toLocaleString('es-AR')} <small>kg</small></strong></div>
        </div>
      </div>

      <div class="card timer-card" id="rest-timer">
        <div class="card-head">
          <h2>⏱ Descanso</h2>
          <div class="timer-duration">
            <input class="input" id="timer-duration-input" type="number" min="5" step="5" style="width:80px">
            <span class="li-sub">seg</span>
          </div>
        </div>
        <div class="timer-display" id="timer-display">00:00</div>
        <div class="timer-controls">
          <button class="btn btn-primary" id="timer-start">Iniciar</button>
          <button class="btn" id="timer-pause">Pausar</button>
          <button class="btn" id="timer-restart">Reiniciar</button>
          <button class="btn btn-danger" id="timer-stop">Detener</button>
        </div>
      </div>

      <div id="entries"></div>

      <div class="card">
        <div class="field">
          <label for="session-notes">Notas de la sesión</label>
          <textarea class="input" id="session-notes" rows="2" placeholder="Cómo te sentiste, molestias, etc.">${escapeHtml(session.notes || '')}</textarea>
        </div>
        <div class="routine-actions">
          <button class="btn" id="add-exercise">+ Agregar ejercicio</button>
          <button class="btn btn-primary" id="finish-session">Finalizar y guardar</button>
          <button class="btn btn-danger" id="discard-session">Descartar</button>
        </div>
      </div>
    `;

    this.renderEntries(session);
    RestTimer.mount(session);

    $('#session-date').addEventListener('change', e => {
      session.date = e.target.value || toISODate();
      Store.setActiveSession(session);
    });
    $('#session-notes').addEventListener('input', e => {
      session.notes = e.target.value;
      Store.setActiveSession(session);
    });
    $('#add-exercise').addEventListener('click', () => this.addExercise(session));
    $('#finish-session').addEventListener('click', () => this.finish(session));
    $('#discard-session').addEventListener('click', () => this.discard());
  },

  renderEntries(session) {
    const wrap = $('#entries');

    if (session.entries.length === 0) {
      wrap.innerHTML = UI.emptyState('Agregá el primer ejercicio de la sesión.');
      return;
    }

    wrap.innerHTML = session.entries.map((entry, ei) => `
      <section class="exercise-block">
        <header>
          <h3>${escapeHtml(entry.name)}</h3>
          <button class="btn btn-sm btn-danger" data-remove-ex="${ei}">Quitar</button>
        </header>
        <div class="set-row set-head">
          <span></span><span>Peso (kg)</span><span>Reps</span><span>OK</span><span></span>
        </div>
        ${entry.sets.map((set, si) => `
          <div class="set-row${set.done ? ' is-done' : ''}">
            <span class="set-n">${si + 1}</span>
            <input class="input" type="number" min="0" step="0.5" value="${set.weight ?? ''}" data-field="weight" data-ei="${ei}" data-si="${si}">
            <input class="input" type="number" min="0" value="${set.reps ?? ''}" data-field="reps" data-ei="${ei}" data-si="${si}">
            <input class="chk" type="checkbox" ${set.done ? 'checked' : ''} data-field="done" data-ei="${ei}" data-si="${si}">
            <button class="btn btn-icon btn-danger" data-remove-set="${ei}:${si}" title="Quitar serie">✕</button>
          </div>
        `).join('')}
        <button class="btn btn-sm" data-add-set="${ei}">+ Serie</button>
      </section>
    `).join('');

    $$('[data-field]', wrap).forEach(input => {
      const evt = input.dataset.field === 'done' ? 'change' : 'input';
      input.addEventListener(evt, () => this.updateSet(session, input));
    });
    $$('[data-add-set]', wrap).forEach(b => b.addEventListener('click', () => {
      const entry = session.entries[Number(b.dataset.addSet)];
      const last = entry.sets[entry.sets.length - 1];
      entry.sets.push({ weight: last?.weight ?? '', reps: last?.reps ?? '', done: false });
      Store.setActiveSession(session);
      this.render();
    }));
    $$('[data-remove-set]', wrap).forEach(b => b.addEventListener('click', () => {
      const [ei, si] = b.dataset.removeSet.split(':').map(Number);
      session.entries[ei].sets.splice(si, 1);
      Store.setActiveSession(session);
      this.render();
    }));
    $$('[data-remove-ex]', wrap).forEach(b => b.addEventListener('click', () => {
      session.entries.splice(Number(b.dataset.removeEx), 1);
      Store.setActiveSession(session);
      this.render();
    }));
  },

  updateSet(session, input) {
    const set = session.entries[Number(input.dataset.ei)].sets[Number(input.dataset.si)];
    const field = input.dataset.field;

    if (field === 'done') {
      set.done = input.checked;
      Store.setActiveSession(session);
      this.render();          // el volumen del encabezado cambia
      return;
    }
    set[field] = input.value === '' ? '' : Number(input.value);
    Store.setActiveSession(session);
  },

  addExercise(session) {
    UI.openModal({
      title: 'Agregar ejercicio',
      body: `
        <div class="field">
          <label for="new-ex-name">Nombre</label>
          <input class="input" id="new-ex-name" placeholder="Press banca">
        </div>
        <div class="field-row">
          <div class="field"><label for="new-ex-sets">Series</label><input class="input" id="new-ex-sets" type="number" min="1" value="3"></div>
          <div class="field"><label for="new-ex-reps">Reps</label><input class="input" id="new-ex-reps" type="number" min="1" value="10"></div>
          <div class="field"><label for="new-ex-weight">Peso (kg)</label><input class="input" id="new-ex-weight" type="number" min="0" step="0.5"></div>
        </div>
      `,
      actions: [
        { label: 'Cancelar', onClick: () => UI.closeModal() },
        {
          label: 'Agregar',
          className: 'btn-primary',
          onClick: () => {
            const name = $('#new-ex-name').value.trim();
            if (!name) { UI.toast('Escribí el nombre del ejercicio'); return; }
            const nSets = Number($('#new-ex-sets').value) || 3;
            const reps = Number($('#new-ex-reps').value) || 10;
            const weightRaw = $('#new-ex-weight').value;
            session.entries.push({
              exerciseId: uid(),
              name,
              sets: Array.from({ length: nSets }, () => ({
                weight: weightRaw === '' ? '' : Number(weightRaw),
                reps,
                done: false
              }))
            });
            Store.setActiveSession(session);
            UI.closeModal();
            this.render();
          }
        }
      ]
    });
  },

  finish(session) {
    if (Stats.sessionSets(session) === 0) {
      UI.toast('Marcá al menos una serie como completada');
      return;
    }
    const saved = structuredClone(session);
    saved.finishedAt = new Date().toISOString();
    // Solo se guardan las series efectivamente realizadas
    saved.entries = saved.entries
      .map(e => ({ ...e, sets: e.sets.filter(s => s.done) }))
      .filter(e => e.sets.length > 0);
    delete saved.restTimer;   // estado efimero, no tiene sentido en el historico

    Store.saveSession(saved);
    Store.clearActiveSession();
    RestTimer.stopTicking();
    RestTimer.releaseWakeLock();
    UI.toast('¡Sesión guardada!');
    UI.showView('dashboard');
  },

  discard() {
    UI.confirm('¿Descartar la sesión en curso? Se pierden los datos cargados.', () => {
      Store.clearActiveSession();
      RestTimer.stopTicking();
      RestTimer.releaseWakeLock();
      UI.toast('Sesión descartada');
      this.render();
    });
  }
};
