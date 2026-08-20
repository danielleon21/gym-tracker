/* ============================================================
   routines.js  -  CRUD de rutinas (plantillas de entrenamiento)
   ============================================================ */

const Routines = {
  init() {
    $('#new-routine').addEventListener('click', () => this.openEditor(null));
  },

  render() {
    const routines = Store.getRoutines();
    const container = $('#routines-list');

    if (routines.length === 0) {
      container.innerHTML = UI.emptyState('No tenés rutinas todavía. Creá la primera con "+ Nueva rutina".');
      return;
    }

    container.innerHTML = routines.map(r => `
      <article class="routine-card">
        <h3>${escapeHtml(r.name)}</h3>
        ${r.notes ? `<span class="li-sub">${escapeHtml(r.notes)}</span>` : ''}
        <div class="routine-ex">
          ${r.exercises.map(e => `<span>• ${escapeHtml(e.name)} — ${e.sets}x${e.reps}${e.weight ? ` @ ${e.weight}kg` : ''}</span>`).join('')
            || '<span>Sin ejercicios</span>'}
        </div>
        <div class="routine-actions">
          <button class="btn btn-primary btn-sm" data-start="${r.id}">Entrenar</button>
          <button class="btn btn-sm" data-edit="${r.id}">Editar</button>
          <button class="btn btn-sm" data-duplicate="${r.id}">Duplicar</button>
          <button class="btn btn-sm btn-danger" data-delete="${r.id}">Borrar</button>
        </div>
      </article>
    `).join('');

    $$('[data-start]', container).forEach(b =>
      b.addEventListener('click', () => Workout.start(b.dataset.start)));
    $$('[data-edit]', container).forEach(b =>
      b.addEventListener('click', () => this.openEditor(b.dataset.edit)));
    $$('[data-duplicate]', container).forEach(b =>
      b.addEventListener('click', () => this.duplicate(b.dataset.duplicate)));
    $$('[data-delete]', container).forEach(b =>
      b.addEventListener('click', () => this.remove(b.dataset.delete)));
  },

  /** Abre el modal de alta/edicion. id = null para crear una nueva. */
  openEditor(id) {
    const routine = id ? Store.getRoutine(id) : { id: null, name: '', notes: '', exercises: [] };
    if (!routine) return;

    const body = `
      <div class="field">
        <label for="r-name">Nombre de la rutina</label>
        <input class="input" id="r-name" placeholder="Push A, Pierna, Full body..." value="${escapeHtml(routine.name)}">
      </div>
      <div class="field">
        <label for="r-notes">Notas (opcional)</label>
        <input class="input" id="r-notes" placeholder="Descanso 90s, enfoque en técnica..." value="${escapeHtml(routine.notes || '')}">
      </div>
      <div class="field">
        <label>Ejercicios</label>
        <div id="ex-rows"></div>
        <button class="btn btn-sm" id="add-ex" type="button">+ Agregar ejercicio</button>
      </div>
    `;

    UI.openModal({
      title: id ? 'Editar rutina' : 'Nueva rutina',
      body,
      actions: [
        { label: 'Cancelar', onClick: () => UI.closeModal() },
        { label: 'Guardar', className: 'btn-primary', onClick: () => this.saveFromEditor(routine.id) }
      ]
    });

    const rows = $('#ex-rows');
    const addRow = (ex = { name: '', sets: 3, reps: 10, weight: '' }) => {
      const div = document.createElement('div');
      div.className = 'field-row ex-row';
      div.innerHTML = `
        <div class="field" style="flex:3">
          <input class="input ex-name" placeholder="Ejercicio" value="${escapeHtml(ex.name)}">
        </div>
        <div class="field"><input class="input ex-sets" type="number" min="1" placeholder="Series" value="${ex.sets ?? ''}"></div>
        <div class="field"><input class="input ex-reps" type="number" min="1" placeholder="Reps" value="${ex.reps ?? ''}"></div>
        <div class="field"><input class="input ex-weight" type="number" min="0" step="0.5" placeholder="Kg" value="${ex.weight ?? ''}"></div>
        <div class="field"><button class="btn btn-icon btn-danger" type="button" title="Quitar">✕</button></div>
      `;
      div.querySelector('button').addEventListener('click', () => div.remove());
      rows.appendChild(div);
    };

    routine.exercises.forEach(addRow);
    if (routine.exercises.length === 0) addRow();
    $('#add-ex').addEventListener('click', () => addRow());
  },

  saveFromEditor(id) {
    const name = $('#r-name').value.trim();
    if (!name) {
      UI.toast('Poné un nombre a la rutina');
      return;
    }

    const exercises = $$('.ex-row').map(row => ({
      id: uid(),
      name: row.querySelector('.ex-name').value.trim(),
      sets: Number(row.querySelector('.ex-sets').value) || 3,
      reps: Number(row.querySelector('.ex-reps').value) || 10,
      weight: row.querySelector('.ex-weight').value === '' ? '' : Number(row.querySelector('.ex-weight').value)
    })).filter(e => e.name);

    if (exercises.length === 0) {
      UI.toast('Agregá al menos un ejercicio');
      return;
    }

    Store.saveRoutine({
      id: id || uid(),
      name,
      notes: $('#r-notes').value.trim(),
      exercises,
      createdAt: id ? Store.getRoutine(id).createdAt : new Date().toISOString()
    });

    UI.closeModal();
    UI.toast(id ? 'Rutina actualizada' : 'Rutina creada');
    this.render();
  },

  duplicate(id) {
    const routine = Store.getRoutine(id);
    if (!routine) return;
    Store.saveRoutine({
      ...structuredClone(routine),
      id: uid(),
      name: `${routine.name} (copia)`,
      createdAt: new Date().toISOString()
    });
    UI.toast('Rutina duplicada');
    this.render();
  },

  remove(id) {
    const routine = Store.getRoutine(id);
    if (!routine) return;
    UI.confirm(`¿Borrar la rutina "${routine.name}"? Las sesiones ya registradas se conservan.`, () => {
      Store.deleteRoutine(id);
      UI.toast('Rutina eliminada');
      this.render();
    });
  }
};
