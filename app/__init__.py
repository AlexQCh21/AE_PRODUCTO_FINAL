from flask import Flask, request, jsonify, render_template
import pandas as pd
import os

# Crea la aplicación
app = Flask(__name__)

# Importa las rutas desde el archivo routes.py
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/subir-csv', methods=['POST'])
def subir_csv():
    if 'zonas' not in request.files or 'distancias' not in request.files:
        return jsonify({'mensaje': 'Archivos CSV incompletos'}), 400
    
    zonas_file = request.file['zonas']
    distancias_file = request.file['distancias']

    try:
        zonas_df = pd.read_csv(zonas_file)
        distancias_df = pd.read_csv(distancias_file)

        #Aquí guardar en el servidor
        #zonas_df.to_csv('zonas_subidas.csv', index=False)
        #distancias_df.to_csv('distancias_subidas.csv', index=False)

        return jsonify({'mensaje': 'Archivos cargado exitosamente',
                       'zonas_preview': zonas_df.head(3).to_dict(orient='records'),
                       'distancias_preview': distancias_df.head(3).to_dict(orient='records')
                       })
    except Exception as e:
        print(e)
        return jsonify({'mensaje': f'Error procesando archivos: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)    
    
    