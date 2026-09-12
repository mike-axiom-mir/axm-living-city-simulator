'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { CAPABILITY_ID, deriveRegistry, writeOrCheck } = require('../tools/generate-capability-registry.cjs');

const repoRoot = path.resolve(__dirname, '..');
const fixturePaths = [
  '.axm/discovery-public.json',
  'capabilities/AXM-CAP-HEADLESS-SIMULATOR-V1.json',
  'package.json',
  'runtime/headless-simulator.js',
  'runtime/load-simulation.js',
  'runtime/file-save-store.js',
  'runtime/cli.js'
];

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-living-capability-'));
  for (const relativePath of fixturePaths) {
    const from = path.join(repoRoot, relativePath);
    const to = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  return root;
}

test('derives one bounded headless capability with no authority', () => {
  const result = deriveRegistry(repoRoot);
  assert.equal(result.row.id, CAPABILITY_ID);
  assert.deepEqual(result.row.providers, ['axm-living-city-simulator']);
  assert.deepEqual(result.row.consumers, []);
  assert.equal(result.row.provider_statuses[0].status, 'IMPLEMENTED_REFERENCE');
  assert.equal(result.row.implementations[0].truth.authority, 'NONE');
  assert.equal(result.row.truth.declaration_is_runtime_proof, false);
  assert.equal(result.receipt.truth.grants_canon_authority, false);
});

test('committed registry and receipt are exact generator outputs', () => {
  assert.doesNotThrow(() => writeOrCheck(repoRoot, true));
});

test('fails closed when package export drifts', () => {
  const root = fixture();
  try {
    const pkgPath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    delete pkg.exports['./save-store'];
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    assert.throws(() => deriveRegistry(root), /exports drifted/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed when capability authority is promoted', () => {
  const root = fixture();
  try {
    const manifestPath = path.join(root, 'capabilities/AXM-CAP-HEADLESS-SIMULATOR-V1.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.authority = 'EXECUTE';
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    assert.throws(() => deriveRegistry(root), /authority must remain NONE/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed on source symlink substitution', () => {
  const root = fixture();
  try {
    const target = path.join(root, 'runtime/headless-simulator.js');
    fs.unlinkSync(target);
    fs.symlinkSync(path.join(repoRoot, 'runtime/headless-simulator.js'), target);
    assert.throws(() => deriveRegistry(root), /regular file/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
