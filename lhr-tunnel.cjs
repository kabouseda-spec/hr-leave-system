const { spawn } = require('child_process');
const proc = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ServerAliveInterval=30',
  '-o', 'ServerAliveCountMax=10',
  '-R', '80:localhost:4000',
  'nokey@localhost.run'
], { stdio: ['ignore', 'pipe', 'pipe'] });

const extract = d => {
  const s = d.toString();
  process.stdout.write(s);
  const m = s.match(/https:\/\/[a-z0-9]+\.lhr\.life/);
  if (m) console.log('\n=== PUBLIC URL: ' + m[0] + ' ===\n');
};

proc.stdout.on('data', extract);
proc.stderr.on('data', extract);
proc.on('exit', code => process.exit(code || 1));
process.on('SIGTERM', () => proc.kill());
