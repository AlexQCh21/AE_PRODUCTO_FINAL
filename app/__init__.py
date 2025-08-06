from flask import Flask

# Crea la aplicación
app = Flask(__name__)

# Importa las rutas desde el archivo routes.py
from app import routes
