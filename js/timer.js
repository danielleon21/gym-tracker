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
  audioCtx: null,
  wakeLock: null,
  currentSession: null,

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
    this.unlockAudio();
    this.requestWakeLock();
    this.mount(session);
  },

  pause(session) {
    const t = session.restTimer;
    if (t.status !== 'running') return;
    t.remaining = this.remainingNow(t);
    t.status = 'paused';
    t.endAt = null;
    Store.setActiveSession(session);
    this.releaseWakeLock();
    this.mount(session);
  },

  /** Reinicia el conteo desde la duracion configurada y lo arranca. */
  restart(session) {
    const t = session.restTimer;
    t.status = 'running';
    t.remaining = t.duration;
    t.endAt = Date.now() + t.duration * 1000;
    Store.setActiveSession(session);
    this.unlockAudio();
    this.requestWakeLock();
    this.mount(session);
  },

  /** Corta el conteo y vuelve al estado inicial (sin arrancar). */
  stop(session) {
    const t = session.restTimer;
    t.status = 'idle';
    t.remaining = t.duration;
    t.endAt = null;
    Store.setActiveSession(session);
    this.releaseWakeLock();
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

  /* ---------- Avisos: sonido, vibracion y pantalla activa ---------- */

  /**
   * Crea (o reactiva) el AudioContext dentro del gesto del usuario que
   * arranca el descanso. iOS/Safari solo deja sonar audio si el contexto
   * se desbloqueo en respuesta a un toque; reusarlo despues (cuando el
   * descanso termina solo) ya no necesita gesto.
   */
  unlockAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.audioCtx) this.audioCtx = new AudioCtx();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
  },

  /** Dos beeps cortos para avisar que el descanso termino. */
  playBeep() {
    const ctx = this.audioCtx;
    if (!ctx) return;
    const now = ctx.currentTime;
    [[880, 0], [660, 0.22]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = now + delay;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + 0.18);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  },

  /** No-op silencioso en navegadores sin Vibration API (todo iOS). */
  vibrate() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  },

  /** Evita que la pantalla se apague mientras el descanso esta corriendo. */
  async requestWakeLock() {
    if (this.wakeLock || !('wakeLock' in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
    } catch (err) {
      console.warn('No se pudo mantener la pantalla activa:', err);
    }
  },

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  },

  /**
   * Cablea los controles de la tarjeta del temporizador y arranca el
   * refresco visual si corresponde. Se llama cada vez que se pinta la
   * vista de entrenamiento, asi que primero corta cualquier intervalo
   * anterior para no acumular varios corriendo en paralelo.
   */
  mount(session) {
    this.stopTicking();
    this.currentSession = session;
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
          this.releaseWakeLock();
          this.playBeep();
          this.vibrate();
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

/**
 * El navegador libera el wake lock solo al ocultarse la pestaña. Si el
 * descanso sigue corriendo cuando volvemos a mirarla, lo volvemos a pedir.
 */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const t = RestTimer.currentSession?.restTimer;
  if (t && t.status === 'running') RestTimer.requestWakeLock();
});
