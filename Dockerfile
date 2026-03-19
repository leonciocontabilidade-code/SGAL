FROM python:3.11-slim

WORKDIR /app

# Instalar Node.js para build do frontend
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependências Python
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Build do frontend
COPY frontend/ ./frontend/
RUN cd frontend && npm install && npm run build

# Copiar backend
COPY backend/ ./backend/

# Criar diretório de uploads
RUN mkdir -p /app/backend/uploads

EXPOSE 8000

CMD ["sh", "-c", "cd /app/backend && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
