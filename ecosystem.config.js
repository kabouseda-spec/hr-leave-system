module.exports = {
  apps: [
    {
      name: 'hr-backend',
      script: 'src/index.js',
      cwd: 'C:\\Users\\karim.a\\projects\\hr-leave-system\\backend',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        JWT_SECRET: 'hr_leave_system_secret_2026_secure',
        JWT_EXPIRES_IN: '8h',
        DB_PATH: 'C:\\Users\\karim.a\\projects\\hr-leave-system\\backend\\hr_leave.db',
        FRONTEND_URL: 'http://localhost:5173',
      },
    },
    {
      name: 'hr-frontend',
      script: 'start.cjs',
      cwd: 'C:\\Users\\karim.a\\projects\\hr-leave-system\\frontend',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
