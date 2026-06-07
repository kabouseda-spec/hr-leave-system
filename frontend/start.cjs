const { spawn } = require('child_process');
const path = require('path');

const vite = spawn(
  process.execPath,
  [path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0', '--port', '5173'],
  { cwd: __dirname, stdio: 'inherit', env: { ...process.env } }
);

vite.on('exit', code => process.exit(code));
process.on('SIGINT', () => vite.kill('SIGINT'));
process.on('SIGTERM', () => vite.kill('SIGTERM'));
