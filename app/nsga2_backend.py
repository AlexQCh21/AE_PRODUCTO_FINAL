from flask import Flask, request, jsonify, render_template
import pandas as pd
import numpy as np
import json
from werkzeug.utils import secure_filename
import os

port = int(os.environ.get("PORT", 8080)) 

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Asegurar que el directorio de uploads existe
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Variables globales para almacenar datos
zonas_data = []
distancias_data = []

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/api/subir-csv', methods=['POST'])
def subir_csv():
    try:
        if 'zonas' not in request.files or 'distancias' not in request.files:
            return jsonify({
                'success': False,
                'mensaje': 'Faltan archivos. Debe subir ambos CSV.'
            })
        
        archivo_zonas = request.files['zonas']
        archivo_distancias = request.files['distancias']
        
        if archivo_zonas.filename == '' or archivo_distancias.filename == '':
            return jsonify({
                'success': False,
                'mensaje': 'No se seleccionaron archivos.'
            })
        
        # Procesar archivo de zonas
        df_zonas = pd.read_csv(archivo_zonas)
        zonas_procesadas = []
        
        for _, row in df_zonas.iterrows():
            zona = {
                'id': int(row['id']),
                'nombre_zona': str(row['nombre_zona']),
                'latitud': float(row['latitud']),
                'longitud': float(row['longitud']),
                'volumen_estimado_kg': int(row['volumen_estimado_kg']),
                'prioridad': int(row['prioridad']),
                'penalizacion_min': int(row['penalizacion_min'])
            }
            zonas_procesadas.append(zona)
        
        # Procesar archivo de distancias
        df_distancias = pd.read_csv(archivo_distancias)
        distancias_procesadas = []
        
        for _, row in df_distancias.iterrows():
            distancia = {
                'origen': int(row['origen']),
                'destino': int(row['destino']),
                'distancia_km': float(row['distancia_km']),
                'tiempo_estimado_min': int(row['tiempo_estimado_min'])
            }
            distancias_procesadas.append(distancia)
        
        # Almacenar globalmente
        global zonas_data, distancias_data
        zonas_data = zonas_procesadas
        distancias_data = distancias_procesadas
        
        return jsonify({
            'success': True,
            'zonas': zonas_procesadas,
            'distancias': distancias_procesadas,
            'zonas_preview': zonas_procesadas[:3],  # Primeras 3 para preview
            'distancias_preview': distancias_procesadas[:3],  # Primeras 3 para preview
            'mensaje': f'Archivos procesados correctamente: {len(zonas_procesadas)} zonas, {len(distancias_procesadas)} distancias.'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'mensaje': f'Error al procesar archivos: {str(e)}'
        })

@app.route('/api/optimizar', methods=['POST'])
def optimizar_rutas():
    try:
        data = request.get_json()
        print("Datos recibidos:", data)
        
        # Extraer parámetros
        poblacion = data.get('poblacion', 50)
        generaciones = data.get('generaciones', 100)
        mutacion = data.get('mutacion', 0.1)
        zonas = data.get('zonas', [])
        distancias = data.get('distancias', [])
        
        print(f"Parámetros: población={poblacion}, generaciones={generaciones}, mutación={mutacion}")
        print(f"Datos: {len(zonas)} zonas, {len(distancias)} distancias")
        
        if len(zonas) == 0 or len(distancias) == 0:
            return jsonify({
                'success': False,
                'mensaje': 'No hay datos de zonas o distancias para optimizar.'
            })
        
        # Simular algoritmo NSGA-II (aquí implementarías tu algoritmo real)
        rutas_optimizadas = simular_nsga2(zonas, distancias, poblacion, generaciones, mutacion)
        print(f"Rutas generadas: {len(rutas_optimizadas)}")
        
        if len(rutas_optimizadas) == 0:
            return jsonify({
                'success': False,
                'mensaje': 'No se generaron rutas optimizadas.'
            })
        
        # Encontrar la mejor ruta (ejemplo: menor tiempo total)
        mejor_ruta = min(rutas_optimizadas, key=lambda r: r['tiempo'])
        print(f"Mejor ruta: {mejor_ruta}")
        
        # Agregar coordenadas a la mejor ruta
        mejor_ruta['coordenadas'] = []
        for zona_id in mejor_ruta['ruta']:
            zona = next((z for z in zonas if z['id'] == zona_id), None)
            if zona:
                mejor_ruta['coordenadas'].append({
                    'id': zona_id,
                    'lat': zona['latitud'],
                    'lng': zona['longitud'],
                    'nombre': zona['nombre_zona']
                })
        
        print(f"Coordenadas agregadas: {len(mejor_ruta['coordenadas'])}")
        
        return jsonify({
            'success': True,
            'rutas': rutas_optimizadas,
            'mejor_ruta': mejor_ruta,
            'mensaje': f'Optimización completada con {len(rutas_optimizadas)} rutas generadas.'
        })
        
    except Exception as e:
        print(f"Error en optimización: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'mensaje': f'Error en la optimización: {str(e)}'
        })

def simular_nsga2(zonas, distancias, poblacion, generaciones, mutacion):
    """
    Simulación del algoritmo NSGA-II para rutas de recolección.
    En una implementación real, aquí iría tu algoritmo NSGA-II completo.
    """
    
    # Crear matriz de distancias
    matriz_dist = {}
    for dist in distancias:
        key = (dist['origen'], dist['destino'])
        matriz_dist[key] = {
            'distancia': dist['distancia_km'],
            'tiempo': dist['tiempo_estimado_min']
        }
    
    # Generar rutas aleatorias como ejemplo
    rutas_generadas = []
    zona_ids = [z['id'] for z in zonas]
    
    for _ in range(min(poblacion // 10, 20)):  # Generar algunas rutas de ejemplo
        ruta_random = zona_ids.copy()
        np.random.shuffle(ruta_random)
        
        # Calcular métricas de la ruta
        distancia_total = 0
        tiempo_total = 0
        
        for i in range(len(ruta_random) - 1):
            origen = ruta_random[i]
            destino = ruta_random[i + 1]
            
            # Buscar distancia en la matriz
            if (origen, destino) in matriz_dist:
                distancia_total += matriz_dist[(origen, destino)]['distancia']
                tiempo_total += matriz_dist[(origen, destino)]['tiempo']
            elif (destino, origen) in matriz_dist:
                distancia_total += matriz_dist[(destino, origen)]['distancia']
                tiempo_total += matriz_dist[(destino, origen)]['tiempo']
            else:
                # Distancia estimada si no está en la matriz
                distancia_total += np.random.uniform(1, 5)
                tiempo_total += np.random.uniform(5, 15)
        
        # Agregar penalizaciones por prioridad
        for zona_id in ruta_random:
            zona = next((z for z in zonas if z['id'] == zona_id), None)
            if zona:
                tiempo_total += zona['penalizacion_min']
        
        rutas_generadas.append({
            'ruta': ruta_random,
            'distancia': round(distancia_total, 2),
            'tiempo': round(tiempo_total, 1)
        })
    
    return rutas_generadas

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=port)