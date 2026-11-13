const { spawn } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const services = [
  { name: 'server', entry: path.join(__dirname, 'server.cjs') },
  { name: 'client', entry: path.join(__dirname, 'client.cjs') },
];
const children = [];
let stopping = false;
let shutdownPromise;

const writeOutput = (name, stream, target) => {
  let remainder = '';
  stream.on('data', (chunk) => {
    remainder += chunk.toString();
    const lines = remainder.split(/\r?\n/);
    remainder = lines.pop() || '';
    for (const line of lines) target.write(`[${name}] ${line}\n`);
  });
  stream.on('end', () => {
    if (remainder) target.write(`[${name}] ${remainder}\n`);
  });
};

const waitForClose = (child, timeoutMs = 8000) => new Promise((resolve) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    resolve();
    return;
  }
  const timer = setTimeout(resolve, timeoutMs);
  child.once('close', () => {
    clearTimeout(timer);
    resolve();
  });
});

const terminateTree = (child) => new Promise((resolve) => {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    resolve();
    return;
  }

  if (isWindows) {
    const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch {}
      resolve();
    }, 5000);
    killer.once('error', () => {
      clearTimeout(timer);
      try { child.kill('SIGTERM'); } catch {}
      resolve();
    });
    killer.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
    return;
  }

  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  resolve();
});

const shutdown = (code, reason = '') => {
  if (shutdownPromise) return shutdownPromise;
  stopping = true;
  shutdownPromise = (async () => {
    if (reason) {
      console.error(`[dev] ${reason}`);
      console.error('[dev] Stopping the other SkillSwap service.');
    } else {
      console.log('[dev] Stopping both SkillSwap services.');
    }

    await Promise.all(children.map(terminateTree));
    await Promise.all(children.map((child) => waitForClose(child)));
    process.exitCode = code;
  })();
  return shutdownPromise;
};

for (const service of services) {
  const child = spawn(process.execPath, [service.entry], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: 'development', PORT: '5000' },
    stdio: ['inherit', 'pipe', 'pipe'],
    // Keep Windows children out of npm.cmd's Ctrl+C console group. The
    // orchestrator owns their lifecycle and will terminate their full trees.
    detached: true,
  });
  child.serviceName = service.name;
  children.push(child);
  writeOutput(service.name, child.stdout, process.stdout);
  writeOutput(service.name, child.stderr, process.stderr);

  child.once('error', (error) => {
    void shutdown(1, `${service.name} could not start: ${error.message}`);
  });
  child.once('close', (code, signal) => {
    if (stopping) return;
    const exitCode = Number.isInteger(code) && code !== 0 ? code : 1;
    const hint = service.name === 'client'
      ? 'Frontend stopped unexpectedly. If port 5173 is occupied, run "npm run ports" and verify the listener before stopping it.'
      : 'Backend stopped unexpectedly. Check its startup message and run "npm run ports" to inspect port 5000.';
    void shutdown(exitCode, `${service.name} exited${signal ? ` from ${signal}` : ` with code ${code}`}. ${hint}`);
  });
}

console.log('[dev] Starting one backend on 5000 and one frontend on 5173. Press Ctrl+C to stop both.');
process.once('SIGINT', () => { void shutdown(0); });
process.once('SIGTERM', () => { void shutdown(0); });
