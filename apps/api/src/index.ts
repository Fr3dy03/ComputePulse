import { start } from './server.js';

start().catch((error) => {
  console.error('ComputePulse API failed to start', error);
  process.exit(1);
});
