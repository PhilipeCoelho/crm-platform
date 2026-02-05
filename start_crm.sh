#!/bin/bash

echo "🚀 Iniciando Assistente do CRM..."
echo "📂 Verificando diretório do projeto..."
cd "$(dirname "$0")"

echo ""
echo "📦 Instalando dependências..."
npm install

if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  Parece que houve um erro na instalação."
    echo "♻️  Tentando limpar cache e reinstalar (modo de reparo)..."
    rm -rf node_modules package-lock.json
    npm install
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Tudo pronto!"
    echo "🚀 Iniciando server..."
    echo "🌍 O navegador deve abrir em: http://localhost:5173"
    echo ""
    npm run dev
else
    echo ""
    echo "❌ Erro fatal. Não foi possível iniciar o projeto."
fi
