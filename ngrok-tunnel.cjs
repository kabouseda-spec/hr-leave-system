const { spawn } = require('child_process');
const proc = spawn('C:\Users\karim.a\ngrok-bin\ngrok.exe', ['http', '4000', '--log=stdout'], { stdio: ['ignore','pipe','pipe'] });
proc.stdout.on('data', d => {
  const s = d.toString();
  process.stdout.write(s);
  const m = s.match(/url=https:\/\/\S+/);
  if (m) console.log('\n=== PUBLIC URL: ' + m[0].replace('url=','') + ' ===\n');
});
proc.stderr.on('data', d => process.stderr.write(d));
proc.on('exit', code => process.exit(code || 1));
process.on('SIGTERM', () => proc.kill());
