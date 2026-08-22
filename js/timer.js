/* ============================================================
   timer.js  -  Temporizador de descanso entre series
   ============================================================ */

/**
 * El estado vive dentro de session.restTimer y se persiste con cada
 * cambio, igual que el resto de la sesion activa. Usar Date.now() /
 * endAt en vez de solo restar segundos permite que el conteo siga
 * siendo correcto aunque se recargue la pagina a mitad de descanso.
 */
const RestTimer = {
  intervalId: null,

  /** Crea session.restTimer si todavia no existe (sesiones nuevas o viejas). */
  ensure(session, defaultDuration = DEFAULT_REST_SECONDS) {
    if (!session.restTimer) {
      session.restTimer = { duration: defaultDuration, remaining: defaultDuration, status: 'idle', endAt: null };
    }
    return session.restTimer;
  },

  /** Segundos restantes en este instante, recalculados si esta corriendo. */
  remainingNow(t) {
    if (t.status === 'running') {
      return Math.max(0, Math.round((t.endAt - Date.now()) / 1000));
    }
    return t.remaining;
  },

  start(session) {
    const t = session.restTimer;
    if (t.status === 'running') return;
    const base = t.status === 'paused' ? t.remaining : t.duration;
    t.status = 'running';
    t.remaining = base;
    t.endAt = Date.now() + base * 1000;
    Store.setActiveSession(session);
    this.mount(session);
  },

  pause(session) {
    const t = session.restTimer;
    if (t.status !== 'running') return;
    t.remaining = this.remainingNow(t);
    t.status = 'paused';
    t.endAt = null;
    Store.setActiveSession(session);
    this.mount(session);
  },

  /** Reinicia el conteo desde la duracion configurada y lo arranca. */
  restart(session) {
    const t = session.restTimer;
    t.status = 'running';
    t.remaining = t.duration;
    t.endAt = Date.now() + t.duration * 1000;
    Store.setActiveSession(session);
    this.mount(session);
  },

  /** Corta el conteo y vuelve al estado inicial (sin arrancar). */
  stop(session) {
    const t = session.restTimer;
    t.status = 'idle';
    t.remaining = t.duration;
    t.endAt = null;
    Store.setActiveSession(session);
    this.mount(session);
  },

  setDuration(session, seconds) {
    const t = session.restTimer;
    t.duration = Math.max(5, seconds || DEFAULT_REST_SECONDS);
    t.remaining = t.duration;
    Store.setActiveSession(session);
  },

  stopTicking() {
    clearInterval(this.intervalId);
    this.intervalId = null;
  },

  /**
   * Cablea los controles de la tarjeta del temporizador y arranca el
   * refresco visual si corresponde. Se llama cada vez que se pinta la
   * vista de entrenamiento, asi que primero corta cualquier intervalo
   * anterior para no acumular varios corriendo en paralelo.
   */
  mount(session) {
    this.stopTicking();
    const t = this.ensure(session);
    const card = $('#rest-timer');
    if (!card) return;   // la vista de entrenamiento no esta activa

    const display = $('#timer-display', card);
    const durationInput = $('#timer-duration-input', card);
    const btnStart = $('#timer-start', card);
    const btnPause = $('#timer-pause', card);
    const btnRestart = $('#timer-restart', card);
    const btnStop = $('#timer-stop', card);

    const paint = () => {
      const remaining = this.remainingNow(t);
      display.textContent = formatMMSS(remaining);
      card.classList.toggle('is-running', t.status === 'running');
      card.classList.toggle('is-paused', t.status === 'paused');
      btnStart.disabled = t.status === 'running';
      btnPause.disabled = t.status !== 'running';
      btnRestart.disabled = t.status === 'idle';
      btnStop.disabled = t.status === 'idle';
      durationInput.disabled = t.status !== 'idle';
      if (t.status === 'idle') durationInput.value = t.duration;
    };

    if (t.status === 'running') {
      this.intervalId = setInterval(() => {
        const remaining = this.remainingNow(t);
        if (remaining <= 0) {
          t.status = 'idle';
          t.remaining = t.duration;
          t.endAt = null;
          Store.setActiveSession(session);
          this.stopTicking();
          UI.toast('⏱ ¡Descanso terminado!');
          card.classList.add('is-finished');
          setTimeout(() => card.classList.remove('is-finished'), 3000);
          paint();
          return;
        }
        paint();
      }, 250);
    }

    paint();

    durationInput.addEventListener('change', () => {
      this.setDuration(session, Number(durationInput.value));
      paint();
    });
    btnStart.addEventListener('click', () => this.start(session));
    btnPause.addEventListener('click', () => this.pause(session));
    btnRestart.addEventListener('click', () => this.restart(session));
    btnStop.addEventListener('click', () => this.stop(session));
  }
};
