// pm2 process config for the Azure VM. pm2 keeps the server alive across crashes
// and reboots (see `pm2 startup`), and `pm2 startOrReload` gives a near-zero-
// downtime restart on each deploy.
module.exports = {
  apps: [
    {
      name: 'kitum-backend',
      script: 'src/index.js',
      cwd: __dirname, // so dotenv resolves ./.env sitting next to this file
      // CRITICAL: keep instances at 1. Dispatch timers, offer state and Socket.IO
      // rooms live in-process (see BEFORE_LIVE.md B3). 2+ instances breaks dispatch
      // until the Redis adapter is added.
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M', // B1s has ~1 GB RAM; bounce if the process balloons
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
