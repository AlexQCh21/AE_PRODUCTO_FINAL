from app import app
from flask import render_template

#Aquí van las rutas del proyecto

@app.route('/')
def index():
    return render_template('index.html')
