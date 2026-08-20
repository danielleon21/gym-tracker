# Gym Tracker

Manejador de sesiones de gimnasio. Sin dependencias, sin build: HTML + CSS + JavaScript puro,
con los datos guardados en el `localStorage` del navegador.

## Qué incluye el MVP

- **Dashboard** con estadísticas del mes (sesiones, racha, volumen total) y un **heatmap anual
  mes por mes** donde se ve qué días entrenaste y con cuánta intensidad (el color depende del
  volumen del día comparado con tu mejor día del año).
- **Rutinas**: crear, editar, duplicar y borrar plantillas con sus ejercicios (series, reps y peso objetivo).
- **Entrenar**: iniciar una sesión desde una rutina (o una sesión libre), cargar peso/reps reales
  serie por serie y marcarlas como completadas. La sesión en curso se guarda sola: si cerrás el
  navegador la retomás donde ibas.
- **Histórico**: listado de todas las sesiones con detalle, y progreso por ejercicio (mejor peso,
  volumen acumulado y evolución de las últimas 12 sesiones).
- **Exportar / importar** los datos en JSON, para hacer backup o pasarlos a otra computadora.

## Cómo usarlo

🔗 **App en vivo:** https://danielleon21.github.io/gym-tracker/

Los datos se guardan en el `localStorage` de tu navegador, así que son propios de cada
dispositivo/navegador donde entres. Usá Exportar/Importar para pasarlos entre dispositivos
o hacer un backup.

### Correrlo en tu máquina

Abrí `index.html` en el navegador. No hace falta servidor ni instalar nada.

Cada push a la rama `main` de este repo redespliega automáticamente la app en vivo (GitHub Pages,
sirviendo `main` desde la raíz).

## Estructura

```
gym-tracker/
├── index.html          # Estructura de las 4 vistas + modal
├── css/style.css       # Estilos (tema oscuro, responsive)
└── js/
    ├── storage.js      # Modelo de datos, localStorage y cálculos (Store, Stats)
    ├── ui.js           # Modal, toast y navegación entre vistas
    ├── dashboard.js    # Estadísticas y heatmap
    ├── routines.js     # ABM de rutinas
    ├── workout.js      # Sesión de entrenamiento en curso
    ├── history.js      # Historial y progreso por ejercicio
    └── app.js          # Arranque, pestañas, export/import
```

## Modelo de datos

Todo vive bajo la clave `gymtracker.v1`:

```js
{
  routines: [
    { id, name, notes, createdAt,
      exercises: [{ id, name, sets, reps, weight }] }
  ],
  sessions: [
    { id, routineId, routineName, date: 'YYYY-MM-DD', startedAt, finishedAt, notes,
      entries: [{ exerciseId, name, sets: [{ weight, reps, done }] }] }
  ],
  activeSession: null   // la sesión en curso, con la misma forma que una sesión guardada
}
```

Al finalizar una sesión solo se guardan las series marcadas como completadas.

## Ideas para después del MVP

- Gráfico de evolución de peso con SVG en lugar de barras.
- Récords personales (PR) por ejercicio y aviso cuando se superan.
- Temporizador de descanso entre series.
- Biblioteca de ejercicios con grupo muscular, para filtrar el histórico.
- Sincronización en la nube (Supabase) si querés usarlo desde el celular y la compu.
