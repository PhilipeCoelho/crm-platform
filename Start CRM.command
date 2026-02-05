#!/bin/bash
cd "$(dirname "$0")"
echo "Starting CRM Platform..."
echo "Opening browser..."
# The browser will open automatically thanks to vite.config.ts settings
npm run dev
