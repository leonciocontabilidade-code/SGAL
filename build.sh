#!/usr/bin/env bash
set -e

echo "==> Instalando dependências Python..."
pip3 install -r backend/requirements.txt

echo "==> Instalando dependências Node.js e gerando build do frontend..."
cd frontend
npm install
npm run build
cd ..

echo "==> Build concluído!"
