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
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      Store.importJSON(reader.result);
      UI.toast('Datos importados');
      UI.showView('dashboard');
    } catch (err) {
      console.error(err);
      UI.toast('No se pudo importar el archivo');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
