// Starts a localtunnel and prints the public URL
const localtunnel = require('localtunnel');

(async () => {
  const tunnel = await localtunnel({ port: 5173, subdomain: 'hr-leave-system' });
  console.log('');
  console.log('========================================');
  console.log('  PUBLIC URL: ' + tunnel.url);
  console.log('========================================');
  console.log('');
  console.log('Share this link with anyone on any device.');
  console.log('Keep this process running to stay accessible.');

  tunnel.on('close', () => {
    console.log('Tunnel closed — restarting...');
    process.exit(1); // PM2 will restart it
  });

  tunnel.on('error', err => {
    console.error('Tunnel error:', err.message);
    process.exit(1);
  });
})();
