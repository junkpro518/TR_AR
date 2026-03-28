module.exports = {
  apps: [
    {
      name: 'tr-ar',
      script: '.next/standalone/server.js',
      cwd: '/var/www/tr-ar',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
}
