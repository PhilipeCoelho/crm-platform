#!/bin/bash
# ==============================================================================
# Script de Configuração Rápida da VM Oracle Cloud (Ubuntu) - Vamuss CRM SDR
# ==============================================================================
set -e

echo "🚀 [1/5] Atualizando pacotes do sistema..."
sudo apt update && sudo apt upgrade -y

echo "📦 [2/5] Instalando Node.js 22 LTS, Git e utilitários essenciais..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git build-essential ufw iptables-persistent

echo "⚡ [3/5] Instalando PM2 (Process Manager 24/7)..."
sudo npm install -g pm2

echo "🛡️ [4/5] Configurando regras de firewall local da Oracle VM..."
# A Oracle Cloud aplica regras estritas de iptables no Ubuntu por defeito
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5173 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
sudo netfilter-persistent save || true

echo "✅ [5/5] Ambiente preparado com sucesso!"
echo "Node.js versão: $(node -v)"
echo "NPM versão: $(npm -v)"
echo "PM2 versão: $(pm2 -v)"
echo ""
echo "👉 Próximo passo: Clonar o repositório, copiar o .env e a pasta data/whatsapp_web_auth, e iniciar com:"
echo "   pm2 start api/index.js --name 'vamuss-sdr'"
echo "   pm2 save && pm2 startup"
