module.exports = {
  apps: [
    {
      name: 'centralnimozek-backend',
      cwd: '/home/david/centralnimozekcehupo/backend',
      script: 'server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/home/david/centralnimozekcehupo/backend/logs/error.log',
      out_file: '/home/david/centralnimozekcehupo/backend/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'centralnimozek-frontend',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: '/home/david/centralnimozekcehupo/frontend/dist',
        PM2_SERVE_PORT: 5200,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M'
    },
    {
      name: 'centralnimozek-demo-frontend',
      script: 'serve',
      env: {
        PM2_SERVE_PATH: '/home/david/centralnimozekcehupo/frontend/dist',
        PM2_SERVE_PORT: 5201,
        PM2_SERVE_SPA: 'true',
        PM2_SERVE_HOMEPAGE: '/index.html'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M'
    },
    {
      name: 'centralnimozek-backup',
      script: 'backup_manager.py',
      interpreter: 'python3',
      cwd: '/home/david/centralnimozekcehupo',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      error_file: '/home/david/centralnimozekcehupo/logs/backup-error.log',
      out_file: '/home/david/centralnimozekcehupo/logs/backup-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
