/* ============================================================
   ui.js  -  Modal generico, toast y navegacion entre vistas
   ============================================================ */

const UI = {
  toastTimer: null,

  /** Muestra un mensaje breve en la parte inferior. */
  toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  },

  /**
   * Abre el modal.
   * @param {{title:string, body:string, actions:Array<{label,className,onClick}>}} opts
   */
  openModal({ title, body, actions = [] }) {
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;

    const foot = $('#modal-foot');
    foot.innerHTML = '';
    for (const action of actions) {
      const btn = document.createElement('button');
      btn.className = `btn ${action.className || ''}`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => action.onClick(btn));
      foot.appendChild(btn);
    }

    $('#modal').hidden = false;
    const firstInput = $('#modal-body input, #modal-body textarea');
    if (firstInput) firstInput.focus();
  },

  closeModal() {
    $('#modal').hidden = true;
    $('#modal-body').innerHTML = '';
    $('#modal-foot').innerHTML = '';
  },

  /** Confirmacion con el mismo estilo que el resto de la app. */
  confirm(message, onConfirm) {
    this.openModal({
      title: 'Confirmar',
      body: `<p style="margin:0">${escapeHtml(message)}</p>`,
      actions: [
        { label: 'Cancelar', onClick: () => this.closeModal() },
        {
          label: 'Sí, continuar',
          className: 'btn-primary',
          onClick: () => { this.closeModal(); onConfirm(); }
        }
      ]
    });
  },

  /** Cambia la vista visible y refresca su contenido. */
  showView(name) {
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === `view-${name}`));
    $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === name));

    if (name !== 'workout') {
      RestTimer.stopTicking();
      RestTimer.releaseWakeLock();
    }

    if (name === 'dashboard') Dashboard.render();
    if (name === 'routines') Routines.render();
    if (name === 'workout') Workout.render();
    if (name === 'history') History.render();
  },

  emptyState(text) {
    return `<p class="empty">${escapeHtml(text)}</p>`;
  }
};
