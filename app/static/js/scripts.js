// Inicializar mapa Leaflet
const map = L.map('map').setView([-9.119, -77.034], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Ejemplo de puntos de zonas
const zonas = [
  {lat: -9.119, lng: -77.034, label: 'Zona 1'},
  {lat: -9.12, lng: -77.035, label: 'Zona 2'},
  {lat: -9.121, lng: -77.036, label: 'Zona 3'}
];

const latlngs = zonas.map(z => [z.lat, z.lng]);
zonas.forEach(z => L.marker([z.lat, z.lng]).addTo(map).bindPopup(z.label));

const polyline = L.polyline(latlngs, {color: 'yellow'}).addTo(map);
map.fitBounds(polyline.getBounds());

// Métricas iniciales
document.getElementById('distanciaTotal').textContent = '12.5 km';
document.getElementById('tiempoTotal').textContent = '35 min';

// Gráfico scatter
const ctx = document.getElementById('scatterChart').getContext('2d');
const scatterChart = new Chart(ctx, {
  type: 'scatter',
  data: {
    datasets: [{
      label: 'Distancia vs Tiempo',
      data: [
        {x: 1.2, y: 6},
        {x: 2.5, y: 10},
        {x: 3.8, y: 15}
      ],
      pointBackgroundColor: 'black'
    }]
  },
  options: {
    scales: {
      x: { title: { display: true, text: 'Distancia (km)' }},
      y: { title: { display: true, text: 'Tiempo (min)' }}
    }
  }
});

function actualizarFiltro() {
  const filtro = document.getElementById('filtro').value;
  alert(`Filtro seleccionado: ${filtro} (Aquí deberías llamar a tu API y actualizar datos)`);
}


function subirArchivos() {
  const form = document.getElementById('formularioArchivos');
  const formData = new FormData(form);

  document.getElementById('mensajeEstado').innerText = 'Subiendo archivos...';

  fetch('/api/subir-csv', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    document.getElementById('mensajeEstado').innerText = data.mensaje;
    // Aquí podrías procesar los datos recibidos
  })
  .catch(error => {
    console.error(error);
    document.getElementById('mensajeEstado').innerText = 'Error al subir los archivos.';
  });
}


function ejecutarOptimizacion() {
      const poblacion = document.getElementById('poblacion').value;
      const generaciones = document.getElementById('generaciones').value;
      const mutacion = document.getElementById('mutacion').value;

      document.getElementById('mensajeEstado').innerText = 'Procesando optimización...';

      fetch('/api/optimizar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          poblacion: poblacion,
          generaciones: generaciones,
          mutacion: mutacion
        })
      })
      .then(response => response.json())
      .then(data => {
        document.getElementById('mensajeEstado').innerText = data.mensaje;
        // Aquí podrías actualizar tablas con data.resultados si tu API los retorna
      })
      .catch(error => {
        console.error(error);
        document.getElementById('mensajeEstado').innerText = 'Error al ejecutar la optimización.';
      });
    }