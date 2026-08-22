/* ============================================================
   storage.js  -  Capa de datos (localStorage) y utilidades
   ============================================================ */

const STORAGE_KEY = 'gymtracker.v1';
const DEFAULT_REST_SECONDS = 90;

const DEFAULT_DATA = {
  routines: [],
  sessions: [],
  activeSession: null
};

/* ---------- Utilidades generales ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Fecha local en formato YYYY-MM-DD (no usar toISOString: desplaza por UTC). */
function toISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convierte 'YYYY-MM-DD' a un Date local (evita el parseo UTC del ISO). */
function fromISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatDate(iso) {
  const d = fromISODate(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatDateShort(iso) {
  const d = fromISODate(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Segundos a 'mm:ss', para el temporizador de descanso. */
function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------- Store ---------- */

const Store = {
  data: structuredClone(DEFAULT_DATA),

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.data = Object.assign(structuredClone(DEFAULT_DATA), JSON.parse(raw));
      }
    } catch (err) {
      console.error('No se pudo leer el almacenamiento local:', err);
      this.data = structuredClone(DEFAULT_DATA);
    }
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.error('No se pudo guardar:', err);
      UI.toast('Error al guardar los datos');
    }
  },

  /* ----- Rutinas ----- */

  getRoutines() {
    return this.data.routines;
  },

  getRoutine(id) {
    return this.data.routines.find(r => r.id === id) || null;
  },

  saveRoutine(routine) {
    const idx = this.data.routines.findIndex(r => r.id === routine.id);
    if (idx >= 0) {
      this.data.routines[idx] = routine;
    } else {
      this.data.routines.push(routine);
    }
    this.save();
    return routine;
  },

  deleteRoutine(id) {
    this.data.routines = this.data.routines.filter(r => r.id !== id);
    this.save();
  },

  /* ----- Sesiones ----- */

  /** Sesiones ordenadas de la mas reciente a la mas antigua. */
  getSessions() {
    return [...this.data.sessions].sort((a, b) => b.date.localeCompare(a.date));
  },

  getSession(id) {
    return this.data.sessions.find(s => s.id === id) || null;
  },

  saveSession(session) {
    const idx = this.data.sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      this.data.sessions[idx] = session;
    } else {
      this.data.sessions.push(session);
    }
    this.save();
    return session;
  },

  deleteSession(id) {
    this.data.sessions = this.data.sessions.filter(s => s.id !== id);
    this.save();
  },

  /* ----- Sesion en curso ----- */

  getActiveSession() {
    return this.data.activeSession;
  },

  setActiveSession(session) {
    this.data.activeSession = session;
    this.save();
  },

  clearActiveSession() {
    this.data.activeSession = null;
    this.save();
  },

  /* ----- Import / export ----- */

  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  /**
   * Valida el contenido de un backup y lo devuelve parseado, SIN aplicarlo.
   * Se separa de applyImport para poder mostrarle al usuario que va a importar
   * antes de pisar sus datos actuales.
   */
  parseImport(json) {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed.routines) || !Array.isArray(parsed.sessions)) {
      throw new Error('El archivo no tiene el formato esperado');
    }
    return parsed;
  },

  /** Reemplaza todos los datos por los del backup ya validado. */
  applyImport(parsed) {
    this.data = Object.assign(structuredClone(DEFAULT_DATA), parsed);
    this.save();
  },

  /** Cuenta que hay en un set de datos, para los resumenes de importacion. */
  summarize(data = this.data) {
    return {
      routines: data.routines.length,
      sessions: data.sessions.length
    };
  }
};

/* ---------- Calculos derivados ---------- */

const Stats = {
  /** Volumen de una sesion: suma de peso x reps de las series completadas. */
  sessionVolume(session) {
    let total = 0;
    for (const entry of session.entries || []) {
      for (const set of entry.sets || []) {
        if (set.done) total += (Number(set.weight) || 0) * (Number(set.reps) || 0);
      }
    }
    return Math.round(total);
  },

  sessionSets(session) {
    return (session.entries || []).reduce(
      (n, e) => n + (e.sets || []).filter(s => s.done).length, 0);
  },

  /** Mapa { 'YYYY-MM-DD': { count, volume } } para el heatmap. */
  volumeByDate(sessions) {
    const map = {};
    for (const s of sessions) {
      if (!map[s.date]) map[s.date] = { count: 0, volume: 0 };
      map[s.date].count += 1;
      map[s.date].volume += this.sessionVolume(s);
    }
    return map;
  },

  /** Dias consecutivos entrenando hasta hoy (o hasta ayer si hoy aun no entreno). */
  currentStreak(sessions) {
    const dates = new Set(sessions.map(s => s.date));
    if (dates.size === 0) return 0;

    const cursor = new Date();
    if (!dates.has(toISODate(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
      if (!dates.has(toISODate(cursor))) return 0;
    }

    let streak = 0;
    while (dates.has(toISODate(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  },

  /** Nombres de ejercicio unicos presentes en el historial. */
  exerciseNames(sessions) {
    const names = new Set();
    for (const s of sessions) {
      for (const e of s.entries || []) names.add(e.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  },

  /** Historial de un ejercicio: [{ date, topWeight, volume, sets }] mas reciente primero. */
  exerciseHistory(sessions, name) {
    const rows = [];
    for (const s of sessions) {
      for (const e of s.entries || []) {
        if (e.name !== name) continue;
        const done = (e.sets || []).filter(x => x.done);
        if (done.length === 0) continue;
        rows.push({
          date: s.date,
          topWeight: Math.max(...done.map(x => Number(x.weight) || 0)),
          volume: Math.round(done.reduce((t, x) => t + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0)),
          sets: done.length,
          detail: done.map(x => `${x.weight || 0}kg x ${x.reps || 0}`).join(', ')
        });
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }
};
