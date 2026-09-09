'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-living-package-'));
let checks = 0;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
    env: { ...process.env, npm_config_update_notifier: 'false' }
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

try {
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', tempRoot]).stdout)[0];
  const tarball = path.join(tempRoot, packed.filename);
  check(fs.existsSync(tarball), 'npm pack creates a local tarball without publishing');

  const paths = new Set(packed.files.map((entry) => entry.path));
  check(paths.has('runtime/headless-simulator.js') && paths.has('src/core.js'), 'tarball carries headless runtime and simulation source');
  check(![...paths].some((entry) => entry.startsWith('tests/') || entry.startsWith('examples/') || entry.startsWith('standalone/')), 'tarball excludes tests, examples, and browser standalone bulk');

  const consumer = path.join(tempRoot, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ name: 'axm-living-consumer-smoke', version: '1.0.0', private: true }) + '\n');
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', tarball], { cwd: consumer });
  check(true, 'fresh local consumer installs the packed artifact with no registry publication');

  const packageName = 'axm-living-city-sim-interior-feedback';
  const librarySmoke = run(process.execPath, ['-e', `
    const root = require(${JSON.stringify(packageName)});
    const headless = require(${JSON.stringify(packageName + '/headless')});
    const saves = require(${JSON.stringify(packageName + '/save-store')});
    if (root.HeadlessSimulator !== headless.HeadlessSimulator) throw new Error('root/headless export mismatch');
    if (typeof saves.writeNewSave !== 'function') throw new Error('save-store export missing');
    const a = headless.HeadlessSimulator.create({seed:'AXM-PACK-CONSUMER'});
    const b = headless.HeadlessSimulator.create({seed:'AXM-PACK-CONSUMER'});
    if (!a.validate().ok || a.serialize() !== b.serialize()) throw new Error('installed package is not deterministic/valid');
    process.stdout.write(JSON.stringify(a.summary()));
  `], { cwd: consumer });
  const summary = JSON.parse(librarySmoke.stdout);
  check(summary.valid === true && summary.seed === 'AXM-PACK-CONSUMER', 'fresh consumer executes deterministic headless library seam');

  const bin = path.join(consumer, 'node_modules', '.bin', process.platform === 'win32' ? 'axm-living-city.cmd' : 'axm-living-city');
  check(fs.existsSync(bin), 'npm install exposes the axm-living-city CLI bin');

  const firstSave = path.join(consumer, 'saves', 'first.json');
  const steppedSave = path.join(consumer, 'saves', 'stepped.json');
  const created = run(bin, ['new', '--seed', 'AXM-PACK-CLI', '--out', firstSave], { cwd: consumer });
  const stepped = run(bin, ['step', '--in', firstSave, '--minutes', '60', '--out', steppedSave], { cwd: consumer });
  const createdReceipt = JSON.parse(created.stdout);
  const steppedReceipt = JSON.parse(stepped.stdout);
  check(createdReceipt.summary.valid === true && steppedReceipt.summary.valid === true, 'installed CLI creates and advances validated checkpoints');
  check(fs.existsSync(firstSave) && fs.existsSync(steppedSave), 'installed CLI preserves separate checkpoint files');

  const refused = spawnSync(bin, ['new', '--seed', 'AXM-PACK-CLI', '--out', firstSave], { cwd: consumer, encoding: 'utf8' });
  check(refused.status !== 0 && /exist|EEXIST/i.test(refused.stderr), 'installed CLI refuses silent checkpoint overwrite');

  process.stdout.write('Living City package consumer test passed: ' + checks + ' checks.\n');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
