const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(projectRoot, 'frontend');
let server;
let closing = false;

const closeServer = async (signal) => {
  if (closing) return;
  closing = true;
  if (signal) console.log(`[client] Received ${signal}; closing Vite.`);
  try {
    await server?.close();
    process.exitCode = 0;
  } catch (error) {
    console.error('[client] Error while closing Vite:', error.message);
    process.exitCode = 1;
  }
};

process.once('SIGINT', () => { void closeServer('SIGINT'); });
process.once('SIGTERM', () => { void closeServer('SIGTERM'); });

(async () => {
  try {
    process.chdir(frontendRoot);
    const { createServer } = await import('vite');
    server = await createServer({
      configFile: path.join(frontendRoot, 'vite.config.js'),
      mode: 'development',
    });
    await server.listen();
    console.log('[client] Frontend ready:');
    server.printUrls();
  } catch (error) {
    const portConflict = error.code === 'EADDRINUSE' || /port 5173.*in use/i.test(error.message);
    if (portConflict) {
      console.error('[client] Required frontend port 5173 is already in use. Run "npm run ports" to identify the listener, then stop it only after confirming it belongs to SkillSwap.');
    } else {
      console.error('[client] Frontend failed to start:', error.message);
    }
    await server?.close().catch(() => {});
    process.exitCode = 1;
  }
})();
