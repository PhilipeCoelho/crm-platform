/**
 * PM2 Ecosystem Configuration para Vamuss CRM + SDR Autonomous Daemon
 * Execução persistente em servidores de produção (VPS / Linux / macOS)
 */
module.exports = {
  apps: [
    {
      name: 'vamuss-crm-server',
      script: 'api/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        SDR_AUTONOMOUS_WORKER: 'true'
      }
    },
    {
      name: 'vamuss-sdr-daemon',
      script: 'scripts/sdr_worker_daemon.mjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        SDR_WORKER_INTERVAL_MINUTES: 5
      }
    }
  ]
};
