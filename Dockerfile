# Usa la imagen base oficial de Python 3.10
FROM python:3.10

# Establece el directorio de trabajo en el contenedor como /app
WORKDIR /app

# Copia solo el archivo requirements.txt al directorio de trabajo del contenedor
# Esto permite aprovechar el cache de Docker si los requirements no han cambiado
COPY requirements.txt .

# Instala las dependencias especificadas en requirements.txt
RUN pip install -r requirements.txt

# Copia todo el contenido de la carpeta "app" en tu proyecto local al directorio de trabajo (/app) en el contenedor
# Esto incluye tu código fuente, plantillas y archivos estáticos
COPY app/ .

# Expone el puerto 5000 (el que usa Flask por defecto)
EXPOSE 5000

# Comando por defecto para iniciar la aplicación Flask
CMD ["python", "nsga2_backend.py"]