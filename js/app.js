/* ============================================================
   app.js  -  Arranque de la aplicacion y navegacion
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  Store.load();

  Dashboard.init();
  Routines.init();
  History.init();

  // Navegacion por pestañas
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => UI.showView(tab.dataset.view));
  });

  // Modal: cerrar con la X, con click fuera o con Escape
  $('#modal-close').addEventListener('click', () => UI.closeModal());
  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal') UI.closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#modal').hidden) UI.closeModal();
  });

  // Exportar / importar datos
  $('#export-data').addEventListener('click', exportData);
  $('#import-data').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', importData);

  // Si quedo una sesion a medias, arrancamos ahi
  UI.showView(Store.getActiveSession() ? 'workout' : 'dashboard');
});

function exportData() {
  const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gym-tracker-${toISODate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  UI.toast('Datos exportados');
}

function importData(event) {
  const file = event.target.files[0];
  event.target.value = '';   // permite volver a elegir el mismo archivo
  if (!file) return;

  const reader = new FileReader();

  reader.onerror = () => importError(file, 'No se pudo leer el archivo.');

  reader.onload = () => {
    let incoming;
    try {
      incoming = Store.parseImport(reader.result);
    } catch (err) {
      console.error(err);
      importError(file, 'No parece ser un backup de Gym Tracker. Tiene que ser el archivo .json que genera el botón Exportar.');
      return;
    }
    confirmImport(file, incoming);
  };

  reader.readAsText(file);
}

/** Muestra que se va a importar y que se va a perder, antes de tocar nada. */
function confirmImport(file, incoming) {
  const current = Store.summarize();
  const next = Store.summarize(incoming);

  UI.openModal({
    title: 'Confirmar importación',
    body: `
      <p style="margin-top:0">Archivo: <strong>${escapeHtml(file.name)}</strong></p>
      <div class="stats-grid" style="margin-bottom:12px">
        <div class="stat-card">
          <span class="stat-label">Vas a importar</span>
          <strong class="stat-value">${next.routines} <small>rutinas</small></strong>
          <strong class="stat-value">${next.sessions} <small>sesiones</small></strong>
        </div>
        <div class="stat-card">
          <span class="stat-label">Se van a reemplazar</span>
          <strong class="stat-value">${current.routines} <small>rutinas</small></strong>
          <strong class="stat-value">${current.sessions} <small>sesiones</small></strong>
        </div>
      </div>
      <p class="li-sub" style="margin-bottom:0">La importación <strong>reemplaza todos los datos de este dispositivo</strong>, no los combina. Si querés conservar lo que tenés acá, cancelá y usá Exportar primero.</p>
    `,
    actions: [
      { label: 'Cancelar', onClick: () => UI.closeModal() },
      {
        label: 'Importar y reemplazar',
        className: 'btn-primary',
        onClick: () => {
          Store.applyImport(incoming);
          showImportResult(next);
        }
      }
    ]
  });
}

/** Confirmacion explicita de que la importacion termino bien. */
function showImportResult(summary) {
  UI.showView('dashboard');
  UI.openModal({
    title: '✅ Datos importados',
    body: `
      <p style="margin-top:0">Se importaron correctamente:</p>
      <div class="list">
        <div class="list-item"><span class="li-title">Rutinas</span><span class="li-title">${summary.routines}</span></div>
        <div class="list-item"><span class="li-title">Sesiones</span><span class="li-title">${summary.sessions}</span></div>
      </div>
    `,
    actions: [
      { label: 'Ver rutinas', onClick: () => { UI.closeModal(); UI.showView('routines'); } },
      { label: 'Ir al dashboard', className: 'btn-primary', onClick: () => UI.closeModal() }
    ]
  });
}

function importError(file, detail) {
  UI.openModal({
    title: '⚠️ No se pudo importar',
    body: `
      <p style="margin-top:0">No se importó nada: <strong>tus datos actuales quedaron intactos</strong>.</p>
      <p class="li-sub" style="margin-bottom:0">${escapeHtml(file.name)} — ${escapeHtml(detail)}</p>
    `,
    actions: [{ label: 'Entendido', className: 'btn-primary', onClick: () => UI.closeModal() }]
  });
}
