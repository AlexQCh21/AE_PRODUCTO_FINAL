// Variables globales para almacenar datos - con respaldo en localStorage
let rutasOptimizadas = [];
let zonasData = [];
let distanciasData = [];
let mejorRuta = null;
let scatterChart = null;
let map = null;

// Funciones para manejar persistencia de datos
function guardarDatos() {
  try {
    localStorage.setItem('zonasData', JSON.stringify(zonasData));
    localStorage.setItem('distanciasData', JSON.stringify(distanciasData));
    console.log('Datos guardados en localStorage');
  } catch (error) {
    console.error('Error guardando datos:', error);
  }
}

function cargarDatos() {
  try {
    const zonasGuardadas = localStorage.getItem('zonasData');
    const distanciasGuardadas = localStorage.getItem('distanciasData');
    
    if (zonasGuardadas) {
      zonasData = JSON.parse(zonasGuardadas);
      console.log('Zonas cargadas desde localStorage:', zonasData.length);
    }
    
    if (distanciasGuardadas) {
      distanciasData = JSON.parse(distanciasGuardadas);
      console.log('Distancias cargadas desde localStorage:', distanciasData.length);
    }
  } catch (error) {
    console.error('Error cargando datos:', error);
    zonasData = [];
    distanciasData = [];
  }
}

function limpiarDatos() {
  localStorage.removeItem('zonasData');
  localStorage.removeItem('distanciasData');
  zonasData = [];
  distanciasData = [];
  console.log('Datos limpiados');
}

// Función para inicializar el mapa
function inicializarMapa() {
  // Verificar que el contenedor del mapa existe
  const mapContainer = document.getElementById('map');
  if (!mapContainer) {
    console.error('Contenedor del mapa no encontrado');
    return;
  }

  // Inicializar mapa Leaflet
  map = L.map('map').setView([-9.119, -78.523], 13); // Coordenadas de Nuevo Chimbote
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
}

// Grupos de capas para el mapa
let rutaActual = null;
let marcadoresZonas = null;

// Inicializar grupos de capas cuando el mapa esté listo
function inicializarCapas() {
  if (map) {
    rutaActual = L.layerGroup().addTo(map);
    marcadoresZonas = L.layerGroup().addTo(map);
  }
}

// Función para subir y procesar archivos CSV
function subirArchivos() {
  const form = document.getElementById('formularioArchivos');
  const formData = new FormData(form);

  // Validar que ambos archivos estén seleccionados
  const zonasFile = formData.get('zonas');
  const distanciasFile = formData.get('distancias');
  
  if (!zonasFile || !distanciasFile || zonasFile.size === 0 || distanciasFile.size === 0) {
    document.getElementById('mensajeEstado').innerText = 'Por favor selecciona ambos archivos CSV válidos.';
    return;
  }

  document.getElementById('mensajeEstado').innerText = 'Subiendo y procesando archivos...';

  fetch('/api/subir-csv', {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Respuesta completa del servidor:', data);
    
    // Buscar datos en cualquier formato posible
    let zonasProcessed = [];
    let distanciasProcessed = [];
    
    // Intentar diferentes estructuras de respuesta
    if (data.zonas && Array.isArray(data.zonas)) {
      zonasProcessed = data.zonas;
    } else if (data.zonas_preview && Array.isArray(data.zonas_preview)) {
      zonasProcessed = data.zonas_preview;
      console.warn('Solo se encontró preview de zonas');
    }
    
    if (data.distancias && Array.isArray(data.distancias)) {
      distanciasProcessed = data.distancias;
    } else if (data.distancias_preview && Array.isArray(data.distancias_preview)) {
      distanciasProcessed = data.distancias_preview;
      console.warn('Solo se encontró preview de distancias');
    }
    
    console.log('Datos extraídos:', {
      zonas: zonasProcessed.length,
      distancias: distanciasProcessed.length
    });
    
    if (zonasProcessed.length === 0 || distanciasProcessed.length === 0) {
      document.getElementById('mensajeEstado').innerText = 
        'Error: No se pudieron extraer datos válidos de los archivos CSV. Revisa el formato.';
      return;
    }
    
    // Asignar datos globales
    zonasData = zonasProcessed;
    distanciasData = distanciasProcessed;
    
    // Guardar en localStorage
    guardarDatos();
    
    console.log('Datos asignados correctamente:', {
      zonas: zonasData.length,
      distancias: distanciasData.length
    });
    
    // Actualizar interfaz
    actualizarTablaZonas(zonasData);
    actualizarTablaDistancias(distanciasData);
    
    if (map) {
      mostrarZonasEnMapa(zonasData);
    }
    
    const mensaje = (zonasProcessed.length <= 5 && distanciasProcessed.length <= 10) ? 
      `ADVERTENCIA: Datos limitados cargados: ${zonasData.length} zonas, ${distanciasData.length} distancias` :
      `Archivos procesados exitosamente: ${zonasData.length} zonas, ${distanciasData.length} distancias`;
    
    document.getElementById('mensajeEstado').innerText = mensaje;
  })
  .catch(error => {
    console.error('Error:', error);
    document.getElementById('mensajeEstado').innerText = `Error al subir los archivos: ${error.message}`;
  });
}

// Función para ejecutar optimización NSGA-II
function ejecutarOptimizacion() {
  console.log('=== EJECUTAR OPTIMIZACIÓN ===');
  
  // Intentar cargar datos desde localStorage si están vacías las variables
  if ((!zonasData || zonasData.length === 0) || (!distanciasData || distanciasData.length === 0)) {
    console.log('Intentando cargar datos desde localStorage...');
    cargarDatos();
  }
  
  // Validar parámetros
  const poblacion = parseInt(document.getElementById('poblacion').value);
  const generaciones = parseInt(document.getElementById('generaciones').value);
  const mutacion = parseFloat(document.getElementById('mutacion').value);

  console.log('Parámetros:', { poblacion, generaciones, mutacion });
  console.log('zonasData actual:', zonasData);
  console.log('distanciasData actual:', distanciasData);
  console.log('Longitudes:', { zonas: zonasData.length, distancias: distanciasData.length });

  if (!poblacion || !generaciones || !mutacion || poblacion < 10 || generaciones < 5 || mutacion <= 0 || mutacion >= 1) {
    document.getElementById('mensajeEstado').innerText = 
      'Por favor ingresa parámetros válidos (Población ≥ 10, Generaciones ≥ 5, Mutación 0.01-0.99).';
    return;
  }

  // Verificar que tenemos datos
  if (!zonasData || !distanciasData || zonasData.length === 0 || distanciasData.length === 0) {
    console.error('No hay datos disponibles:', { zonasData, distanciasData });
    document.getElementById('mensajeEstado').innerText = 
      'Primero debe cargar los archivos CSV o usar datos de prueba.';
    return;
  }

  document.getElementById('mensajeEstado').innerText = 'Ejecutando optimización NSGA-II...';

  const requestData = {
    poblacion: poblacion,
    generaciones: generaciones,
    mutacion: mutacion,
    zonas: zonasData,
    distancias: distanciasData
  };

  console.log('Enviando datos al servidor:', {
    poblacion,
    generaciones, 
    mutacion,
    zonasCount: zonasData.length,
    distanciasCount: distanciasData.length
  });

  fetch('/api/optimizar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  })
  .then(response => {
    console.log('Respuesta del servidor:', response.status, response.statusText);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Datos recibidos del servidor:', data);
    if (data.success) {
      rutasOptimizadas = data.rutas;
      mejorRuta = data.mejor_ruta;
      
      console.log('Rutas optimizadas:', rutasOptimizadas.length);
      console.log('Mejor ruta:', mejorRuta);
      
      // Actualizar métricas
      actualizarMetricas(mejorRuta);
      
      // Actualizar gráfico de frente de Pareto
      actualizarGraficoPareto(rutasOptimizadas);
      
      // Mostrar mejor ruta en el mapa
      if (map) {
        mostrarRutaEnMapa(mejorRuta);
      } else {
        console.error('Mapa no inicializado');
      }
      
      // Habilitar filtros
      const filtroElement = document.getElementById('filtro');
      if (filtroElement) {
        filtroElement.disabled = false;
      }
      
      document.getElementById('mensajeEstado').innerText = 
        `Optimización completada: ${rutasOptimizadas.length} rutas generadas.`;
    } else {
      console.error('Error del servidor:', data);
      document.getElementById('mensajeEstado').innerText = data.mensaje || 'Error en la optimización.';
    }
  })
  .catch(error => {
    console.error('Error en fetch:', error);
    document.getElementById('mensajeEstado').innerText = `Error al ejecutar la optimización: ${error.message}`;
  });
}

// Función para actualizar tabla de zonas
function actualizarTablaZonas(zonas) {
  const tbody = document.getElementById('tablaZonas');
  tbody.innerHTML = '';
  
  zonas.forEach(zona => {
    const fila = tbody.insertRow();
    fila.innerHTML = `
      <td>${zona.id}</td>
      <td>${zona.nombre_zona}</td>
      <td>${zona.latitud.toFixed(4)}</td>
      <td>${zona.longitud.toFixed(4)}</td>
      <td>${zona.volumen_estimado_kg}</td>
      <td>${zona.prioridad}</td>
      <td>${zona.penalizacion_min} min</td>
    `;
  });
}

// Función para actualizar tabla de distancias
function actualizarTablaDistancias(distancias) {
  const tbody = document.getElementById('tablaDistancias');
  tbody.innerHTML = '';
  
  // Mostrar solo primeras 20 entradas para no sobrecargar la interfaz
  const distanciasLimitadas = distancias.slice(0, 20);
  
  distanciasLimitadas.forEach(dist => {
    const fila = tbody.insertRow();
    fila.innerHTML = `
      <td>${dist.origen}</td>
      <td>${dist.destino}</td>
      <td>${dist.distancia_km.toFixed(2)} km</td>
      <td>${dist.tiempo_estimado_min} min</td>
    `;
  });
  
  if (distancias.length > 20) {
    const filaInfo = tbody.insertRow();
    filaInfo.innerHTML = `<td colspan="4" style="text-align:center; font-style:italic;">Mostrando 20 de ${distancias.length} entradas totales</td>`;
  }
}

// Función para mostrar zonas en el mapa
function mostrarZonasEnMapa(zonas) {
  if (!map) {
    console.error('Mapa no inicializado para mostrar zonas');
    return;
  }
  
  if (!marcadoresZonas) {
    marcadoresZonas = L.layerGroup().addTo(map);
  }
  
  marcadoresZonas.clearLayers();
  
  console.log('Mostrando zonas en mapa:', zonas.length);
  
  zonas.forEach(zona => {
    const marker = L.marker([zona.latitud, zona.longitud])
      .bindPopup(`
        <b>${zona.nombre_zona}</b><br>
        ID: ${zona.id}<br>
        Volumen: ${zona.volumen_estimado_kg} kg<br>
        Prioridad: ${zona.prioridad}<br>
        Penalización: ${zona.penalizacion_min} min
      `);
    marcadoresZonas.addLayer(marker);
  });
  
  // Ajustar vista del mapa a todas las zonas
  if (zonas.length > 0) {
    const bounds = L.latLngBounds(zonas.map(z => [z.latitud, z.longitud]));
    map.fitBounds(bounds, { padding: [20, 20] });
  }
}

// Función para mostrar ruta en el mapa
function mostrarRutaEnMapa(ruta) {
  if (!map) {
    console.error('Mapa no inicializado para mostrar ruta');
    return;
  }
  
  if (!rutaActual) {
    rutaActual = L.layerGroup().addTo(map);
  }
  
  rutaActual.clearLayers();
  
  if (!ruta || !ruta.coordenadas) {
    console.error('Ruta sin coordenadas:', ruta);
    return;
  }
  
  console.log('Mostrando ruta en mapa:', ruta);
  
  // Crear líneas conectando las zonas en orden
  const coordenadas = ruta.coordenadas.map(coord => [coord.lat, coord.lng]);
  
  // Dibujar ruta
  const polyline = L.polyline(coordenadas, {
    color: '#0a8754',
    weight: 4,
    opacity: 0.8
  });
  rutaActual.addLayer(polyline);
  
  // Agregar marcadores numerados para el orden de visita
  ruta.coordenadas.forEach((coord, index) => {
    const marker = L.circleMarker([coord.lat, coord.lng], {
      radius: 15,
      fillColor: '#fbb13c',
      color: '#0a8754',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    }).bindPopup(`Parada ${index + 1}: ${coord.nombre || 'Zona ' + coord.id}`);
    
    // Agregar número en el marcador
    marker.bindTooltip(`${index + 1}`, {
      permanent: true,
      direction: 'center',
      className: 'ruta-numero'
    });
    
    rutaActual.addLayer(marker);
  });
  
  // Ajustar vista a la ruta
  map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
}

// Función para actualizar métricas
function actualizarMetricas(ruta) {
  if (!ruta) return;
  
  document.getElementById('distanciaTotal').textContent = `${ruta.distancia.toFixed(2)} km`;
  document.getElementById('tiempoTotal').textContent = `${ruta.tiempo.toFixed(1)} min`;
}

// Función para actualizar gráfico de frente de Pareto
function actualizarGraficoPareto(rutas) {
  console.log('=== CREANDO GRÁFICO ===');
  console.log('Actualizando gráfico Pareto con', rutas.length, 'rutas');
  console.log('Rutas recibidas:', rutas);
  
  const canvas = document.getElementById('scatterChart');
  if (!canvas) {
    console.error('Canvas del gráfico no encontrado');
    document.getElementById('mensajeEstado').innerText = 'Error: Canvas del gráfico no encontrado';
    return;
  }
  
  console.log('Canvas encontrado:', canvas);
  
  // Verificar Chart.js
  if (typeof Chart === 'undefined') {
    console.error('Chart.js no está disponible');
    document.getElementById('mensajeEstado').innerText = 'Error: Chart.js no está disponible';
    return;
  }
  
  const ctx = canvas.getContext('2d');
  console.log('Contexto del canvas:', ctx);
  
  // Destruir gráfico anterior si existe
  if (scatterChart) {
    console.log('Destruyendo gráfico anterior');
    scatterChart.destroy();
    scatterChart = null;
  }
  
  // Preparar datos para el gráfico
  const datos = rutas.map((ruta, index) => {
    console.log(`Ruta ${index + 1}:`, ruta);
    return {
      x: parseFloat(ruta.distancia),
      y: parseFloat(ruta.tiempo),
      label: `Ruta ${index + 1}`
    };
  });
  
  console.log('Datos procesados para gráfico:', datos);
  
  // Verificar que tenemos datos válidos
  if (datos.length === 0) {
    console.error('No hay datos válidos para el gráfico');
    document.getElementById('mensajeEstado').innerText = 'No hay datos válidos para crear el gráfico';
    return;
  }
  
  try {
    console.log('Creando nuevo gráfico...');
    
    scatterChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Rutas Optimizadas (Distancia vs Tiempo)',
          data: datos,
          backgroundColor: '#0a8754',
          borderColor: '#fbb13c',
          pointBackgroundColor: '#0a8754',
          pointBorderColor: '#fbb13c',
          pointRadius: 8,
          pointHoverRadius: 12,
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000
        },
        plugins: {
          title: {
            display: true,
            text: 'Frente de Pareto - Análisis de Rutas NSGA-II',
            font: {
              family: 'Roboto',
              size: 18,
              weight: '600'
            },
            color: '#2c2c2c'
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: {
                family: 'Roboto',
                size: 14
              },
              color: '#2c2c2c'
            }
          },
          tooltip: {
            callbacks: {
              title: function(context) {
                const index = context[0].dataIndex;
                return `Ruta ${index + 1}`;
              },
              label: function(context) {
                return [
                  `Distancia: ${context.parsed.x.toFixed(2)} km`,
                  `Tiempo: ${context.parsed.y.toFixed(1)} min`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Distancia Total (km)',
              font: {
                family: 'Roboto',
                size: 14,
                weight: '500'
              },
              color: '#2c2c2c'
            },
            grid: {
              color: 'rgba(44,44,44,0.1)',
              lineWidth: 1
            }
          },
          y: {
            title: {
              display: true,
              text: 'Tiempo Total (min)',
              font: {
                family: 'Roboto',
                size: 14,
                weight: '500'
              },
              color: '#2c2c2c'
            },
            grid: {
              color: 'rgba(44,44,44,0.1)',
              lineWidth: 1
            }
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const rutaSeleccionada = rutas[index];
            console.log('Ruta seleccionada desde gráfico:', rutaSeleccionada);
            
            // Agregar coordenadas si no las tiene
            if (!rutaSeleccionada.coordenadas && zonasData.length > 0) {
              rutaSeleccionada.coordenadas = [];
              for (const zona_id of rutaSeleccionada.ruta) {
                const zona = zonasData.find(z => z.id === zona_id);
                if (zona) {
                  rutaSeleccionada.coordenadas.push({
                    id: zona_id,
                    lat: zona.latitud,
                    lng: zona.longitud,
                    nombre: zona.nombre_zona
                  });
                }
              }
            }
            
            mostrarRutaEnMapa(rutaSeleccionada);
            actualizarMetricas(rutaSeleccionada);
            
            document.getElementById('mensajeEstado').innerText = 
              `Ruta ${index + 1} seleccionada: ${rutaSeleccionada.distancia.toFixed(2)} km, ${rutaSeleccionada.tiempo.toFixed(1)} min`;
          }
        }
      }
    });
    
    console.log('¡Gráfico creado exitosamente!');
    console.log('Instancia del gráfico:', scatterChart);
    
    // Forzar actualización visual
    setTimeout(() => {
      if (scatterChart) {
        scatterChart.update();
        console.log('Gráfico actualizado');
      }
    }, 100);
    
  } catch (error) {
    console.error('Error creando gráfico:', error);
    console.error('Stack trace:', error.stack);
    document.getElementById('mensajeEstado').innerText = `Error creando gráfico: ${error.message}`;
  }
}

// Función para filtrar y mostrar rutas según criterio
function actualizarFiltro() {
  const filtro = document.getElementById('filtro').value;
  
  if (rutasOptimizadas.length === 0) {
    document.getElementById('mensajeEstado').innerText = 'No hay rutas optimizadas para filtrar.';
    return;
  }
  
  let rutaSeleccionada;
  
  switch (filtro) {
    case 'prioridad':
      // Buscar ruta que optimice por prioridad (menor tiempo total con penalizaciones)
      rutaSeleccionada = rutasOptimizadas.reduce((mejor, actual) => 
        actual.tiempo < mejor.tiempo ? actual : mejor
      );
      break;
      
    case 'distancia':
      // Buscar ruta con menor distancia
      rutaSeleccionada = rutasOptimizadas.reduce((mejor, actual) => 
        actual.distancia < mejor.distancia ? actual : mejor
      );
      break;
      
    default:
      rutaSeleccionada = mejorRuta;
  }
  
  // Actualizar visualización
  mostrarRutaEnMapa(rutaSeleccionada);
  actualizarMetricas(rutaSeleccionada);
  
  document.getElementById('mensajeEstado').innerText = 
    `Filtro aplicado: ${filtro}. Distancia: ${rutaSeleccionada.distancia.toFixed(2)} km, Tiempo: ${rutaSeleccionada.tiempo.toFixed(1)} min`;
}

// Función de prueba para cargar datos sin archivos CSV
function cargarDatosPrueba() {
  console.log('Cargando datos de prueba...');
  
  // Datos de prueba
  const zonasEjemplo = [
    {id: 1, nombre_zona: "Centro", latitud: -9.119, longitud: -78.523, volumen_estimado_kg: 150, prioridad: 1, penalizacion_min: 5},
    {id: 2, nombre_zona: "Norte", latitud: -9.115, longitud: -78.520, volumen_estimado_kg: 200, prioridad: 2, penalizacion_min: 3},
    {id: 3, nombre_zona: "Sur", latitud: -9.125, longitud: -78.525, volumen_estimado_kg: 180, prioridad: 1, penalizacion_min: 4},
    {id: 4, nombre_zona: "Este", latitud: -9.120, longitud: -78.518, volumen_estimado_kg: 120, prioridad: 3, penalizacion_min: 2},
    {id: 5, nombre_zona: "Oeste", latitud: -9.118, longitud: -78.528, volumen_estimado_kg: 160, prioridad: 2, penalizacion_min: 6}
  ];
  
  const distanciasEjemplo = [
    {origen: 1, destino: 2, distancia_km: 2.5, tiempo_estimado_min: 8},
    {origen: 1, destino: 3, distancia_km: 3.2, tiempo_estimado_min: 12},
    {origen: 1, destino: 4, distancia_km: 2.8, tiempo_estimado_min: 10},
    {origen: 1, destino: 5, distancia_km: 2.1, tiempo_estimado_min: 7},
    {origen: 2, destino: 3, distancia_km: 4.1, tiempo_estimado_min: 15},
    {origen: 2, destino: 4, distancia_km: 1.9, tiempo_estimado_min: 7},
    {origen: 2, destino: 5, distancia_km: 3.5, tiempo_estimado_min: 13},
    {origen: 3, destino: 4, distancia_km: 3.5, tiempo_estimado_min: 13},
    {origen: 3, destino: 5, distancia_km: 4.8, tiempo_estimado_min: 18},
    {origen: 4, destino: 5, distancia_km: 3.1, tiempo_estimado_min: 11}
  ];
  
  // Asignar datos
  zonasData = zonasEjemplo;
  distanciasData = distanciasEjemplo;
  
  // Guardar en localStorage
  guardarDatos();
  
  console.log('Datos de prueba cargados y guardados:', {
    zonas: zonasData.length,
    distancias: distanciasData.length
  });
  
  // Actualizar interfaz
  actualizarTablaZonas(zonasData);
  actualizarTablaDistancias(distanciasData);
  
  if (map) {
    mostrarZonasEnMapa(zonasData);
  }
  
  document.getElementById('mensajeEstado').innerText = 
    `Datos de prueba cargados: ${zonasData.length} zonas, ${distanciasData.length} distancias.`;
}

// Función para verificar estado de datos (debug)
function verificarEstadoDatos() {
  console.log('=== ESTADO ACTUAL DE DATOS ===');
  
  // Intentar cargar desde localStorage primero
  cargarDatos();
  
  console.log('zonasData:', zonasData);
  console.log('distanciasData:', distanciasData);
  console.log('Longitudes:', {
    zonas: zonasData ? zonasData.length : 'undefined',
    distancias: distanciasData ? distanciasData.length : 'undefined'
  });
  console.log('Tipos:', {
    zonas: typeof zonasData,
    distancias: typeof distanciasData
  });
  
  // Verificar localStorage
  const zonasLS = localStorage.getItem('zonasData');
  const distanciasLS = localStorage.getItem('distanciasData');
  console.log('localStorage zonas:', zonasLS ? 'presente' : 'vacío');
  console.log('localStorage distancias:', distanciasLS ? 'presente' : 'vacío');
  
  // Mostrar en el mensaje de estado también
  const estado = `Datos actuales: ${zonasData ? zonasData.length : 0} zonas, ${distanciasData ? distanciasData.length : 0} distancias`;
  document.getElementById('mensajeEstado').innerText = estado;
  
  // Si hay datos, actualizar las tablas
  if (zonasData && zonasData.length > 0) {
    actualizarTablaZonas(zonasData);
    if (map) mostrarZonasEnMapa(zonasData);
  }
  if (distanciasData && distanciasData.length > 0) {
    actualizarTablaDistancias(distanciasData);
  }
  
  return {
    zonasCount: zonasData ? zonasData.length : 0,
    distanciasCount: distanciasData ? distanciasData.length : 0
  };
}

// Inicializar cuando la página carga
document.addEventListener('DOMContentLoaded', function() {
  // Cargar datos desde localStorage al iniciar
  cargarDatos();
  
  // Verificar que Chart.js esté cargado
  if (typeof Chart === 'undefined') {
    console.error('Chart.js no está cargado');
    document.getElementById('mensajeEstado').innerText = 'Error: Chart.js no está cargado';
    return;
  }
  
  console.log('Chart.js versión:', Chart.version);
  
  // Inicializar mapa
  inicializarMapa();
  
  // Inicializar capas después de un pequeño delay
  setTimeout(() => {
    inicializarCapas();
    
    // Si hay datos cargados, actualizar interfaz
    if (zonasData.length > 0) {
      actualizarTablaZonas(zonasData);
      mostrarZonasEnMapa(zonasData);
    }
    if (distanciasData.length > 0) {
      actualizarTablaDistancias(distanciasData);
    }
    
    if (zonasData.length > 0 || distanciasData.length > 0) {
      document.getElementById('mensajeEstado').innerText = 
        `Datos restaurados: ${zonasData.length} zonas, ${distanciasData.length} distancias.`;
    }
  }, 100);
  
  // Deshabilitar filtro hasta que haya optimización
  const filtroElement = document.getElementById('filtro');
  if (filtroElement) {
    filtroElement.disabled = true;
  }
  
  // Agregar estilos CSS para los números de ruta
  const style = document.createElement('style');
  style.textContent = `
    .ruta-numero {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      color: #fff !important;
      font-weight: bold !important;
      font-size: 12px !important;
      font-family: 'Roboto Mono', monospace !important;
    }
  `;
  document.head.appendChild(style);
  
  // Verificar que el canvas existe
  const canvas = document.getElementById('scatterChart');
  if (canvas) {
    console.log('Canvas del gráfico encontrado');
  } else {
    console.error('Canvas del gráfico no encontrado');
  }
});