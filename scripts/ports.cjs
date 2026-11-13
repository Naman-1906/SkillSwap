const { execFileSync, spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const ports = [5000, 5173];

const printRows = (rows) => {
  if (!rows.length) {
    for (const port of ports) console.log(`Port ${port}: free`);
    return;
  }
  const occupied = new Set();
  for (const row of rows) {
    occupied.add(Number(row.Port));
    console.log(`Port ${row.Port}: PID ${row.PID}, ${row.ProcessName || 'unknown process'}, SkillSwap path match: ${row.SkillSwapPathMatch ? 'yes' : 'no'}`);
  }
  for (const port of ports) {
    if (!occupied.has(port)) console.log(`Port ${port}: free`);
  }
  console.log('This command only inspects listeners. Verify the process before stopping it; it never terminates applications.');
};

if (process.platform === 'win32') {
  const escapedRoot = projectRoot.replaceAll("'", "''");
  const powershell = [
    `$root='${escapedRoot}'`,
    '$wanted=@(5000,5173)',
    '$listeners=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $wanted -contains $_.LocalPort })',
    '$all=@(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)',
    '$byId=@{}; foreach($p in $all){$byId[[int]$p.ProcessId]=$p}',
    '$rows=@(foreach($l in $listeners){$owner=$byId[[int]$l.OwningProcess];$match=$false;$hint="";$cursor=$owner;$depth=0;while($cursor -and $depth -lt 12){$line=[string]$cursor.CommandLine;if($line.IndexOf($root,[StringComparison]::OrdinalIgnoreCase)-ge 0){$match=$true};if($line -match "(?i)backend[/\\]server\.js|scripts[/\\](server|client|dev)\.cjs"){if(!$hint){$hint="SkillSwap server script"}}elseif($line -match "(?i)vite[/\\]bin[/\\]vite\.js"){if(!$hint){$hint="Vite"}};$cursor=$byId[[int]$cursor.ParentProcessId];$depth++};[pscustomobject]@{Port=$l.LocalPort;PID=$l.OwningProcess;ProcessName=$owner.Name;SkillSwapPathMatch=$match;ScriptHint=$hint}})',
    '$rows | ConvertTo-Json -Compress',
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', powershell], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    console.error('Could not inspect port owners with PowerShell. Run: Get-NetTCPConnection -State Listen -LocalPort 5000,5173 | Select-Object LocalPort,OwningProcess');
    process.exitCode = 1;
  } else {
    const output = result.stdout.trim();
    printRows(output ? [].concat(JSON.parse(output)) : []);
  }
  process.exit();
}

const lsof = spawnSync('lsof', ['-nP', '-iTCP:5000', '-iTCP:5173', '-sTCP:LISTEN'], { encoding: 'utf8' });
if (lsof.error || lsof.status > 1) {
  console.error('Could not inspect port owners. Install lsof or inspect ports 5000 and 5173 manually.');
  process.exit(1);
}
const lines = lsof.stdout.trim().split(/\r?\n/).slice(1).filter(Boolean);
const rows = lines.map((line) => {
  const columns = line.trim().split(/\s+/);
  const name = columns[0];
  const pid = Number(columns[1]);
  const address = columns.at(-1);
  const port = Number(address.match(/:(\d+)$/)?.[1]);
  const command = spawnSync('ps', ['-p', String(pid), '-o', 'args='], { encoding: 'utf8' }).stdout || '';
  return { Port: port, PID: pid, ProcessName: name, SkillSwapPathMatch: command.includes(projectRoot), ScriptHint: '' };
});
printRows(rows);
