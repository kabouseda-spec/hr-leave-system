const { spawn } = require('child_process');

const cf = spawn('C:\\Users\\karim.a\\cloudflared.exe', ['tunnel', '--url', 'http://localhost:4000'], {
  stdio: ['ignore', 'pipe', 'pipe']
});

cf.stdout.on('data', d => {
  const s = d.toString();
  process.stdout.write(s);
  if (s.includes('trycloudflare.com')) {
    const match = s.match(/https:\/\/\S+\.trycloudflare\.com/);
    if (match) console.log('\n==========================\nPUBLIC URL: ' + match[0] + '\n==========================\n');
  }
});

cf.stderr.on('data', d => {
  const s = d.toString();
  process.stderr.write(s);
  if (s.includes('trycloudflare.com')) {
    const match = s.match(/https:\/\/\S+\.trycloudflare\.com/);
    if (match) console.log('\n==========================\nPUBLIC URL: ' + match[0] + '\n==========================\n');
  }
});

cf.on('exit', code => process.exit(code || 1));
process.on('SIGINT',  () => cf.kill());
process.on('SIGTERM', () => cf.kill());
