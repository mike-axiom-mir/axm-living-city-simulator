#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CHECKSUM_INDEX = 'CHECKSUMS_SHA256.txt';
const LOCAL_PATCH_MANIFEST = '.axm-intake/LOCAL_PATCHES.json';

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, ''));
}

function main() {
  const checksumPath = path.join(ROOT, CHECKSUM_INDEX);
  const checksumText = fs.readFileSync(checksumPath, 'utf8');
  const entries = checksumText.split(/\r?\n/).filter(Boolean).map((line) => {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/i);
    assert.ok(match, 'invalid checksum row: ' + line);
    return { expected: match[1].toLowerCase(), relative: match[2].trim() };
  });
  assert.equal(entries.length, 625, 'sealed checksum row count');

  const issues = [];
  const patchManifest = readJson(LOCAL_PATCH_MANIFEST);
  assert.equal(patchManifest.schema, 'axm.living-city-local-patches/v1');
  assert.equal(patchManifest.archiveChecksumIndexModified, false);
  assert.equal(patchManifest.checksumIndex.path, CHECKSUM_INDEX);
  assert.equal(patchManifest.checksumIndex.sha256, sha256(checksumPath), 'sealed checksum index digest');
  assert.ok(Array.isArray(patchManifest.patches), 'local patches must be an array');
  const patches = new Map();
  patchManifest.patches.forEach((patch) => {
    assert.equal(patch.index, CHECKSUM_INDEX, 'local patch checksum index');
    assert.equal(typeof patch.path, 'string', 'local patch path');
    assert.match(patch.originalSha256, /^[a-f0-9]{64}$/i, 'local patch original digest');
    assert.match(patch.currentSha256, /^[a-f0-9]{64}$/i, 'local patch current digest');
    assert.ok(typeof patch.reason === 'string' && patch.reason.trim(), 'local patch reason');
    assert.ok(!patches.has(patch.path), 'duplicate local patch path: ' + patch.path);
    patches.set(patch.path, patch);
  });
  const verifiedPatches = new Set();
  for (const entry of entries) {
    const target = path.resolve(ROOT, entry.relative.replaceAll('/', path.sep));
    if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
      issues.push('path escapes repository: ' + entry.relative);
      continue;
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      issues.push('missing: ' + entry.relative);
      continue;
    }
    const actual = sha256(target);
    if (actual !== entry.expected) {
      const patch = patches.get(entry.relative);
      if (patch && patch.originalSha256 === entry.expected && patch.currentSha256 === actual) {
        verifiedPatches.add(entry.relative);
      } else {
        issues.push('digest mismatch: ' + entry.relative);
      }
    }
  }
  patchManifest.patches.forEach((patch) => {
    if (!verifiedPatches.has(patch.path)) issues.push('local patch does not match an indexed changed file: ' + patch.path);
  });

  const inventory = readJson('FILE_INVENTORY.json');
  assert.equal(inventory.schema, 'axm.package-file-inventory/v1');
  assert.equal(inventory.packageId, 'AXM_LIVING_CITY_SIM_INTERIOR_FEEDBACK_v0_11_3');
  assert.equal(inventory.fileCount, 624);
  assert.equal(inventory.files.length, 624);

  const receipt = readJson('.axm-intake/INTAKE_RECEIPT.json');
  assert.equal(receipt.status, 'EXPERIMENTAL');
  assert.equal(receipt.repository.kind, 'STANDALONE_SIBLING_SIMULATOR');
  assert.equal(receipt.repository.workshopWorld, false);
  assert.equal(receipt.source.suppliedSourceFilesChanged, false);
  assert.equal(receipt.runtimeBoundary.browserRole, 'OPTIONAL_CLIENT');

  const requiredBranchFiles = [
    'AGENTS.md',
    'SIMULATOR_BRANCH.md',
    'runtime/load-simulation.js',
    'runtime/headless-simulator.js',
    'runtime/file-save-store.js',
    'runtime/cli.js',
    'tests/headless_runtime_intake_test.js'
  ];
  requiredBranchFiles.forEach((relative) => {
    const target = path.join(ROOT, relative);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      issues.push('missing branch file: ' + relative);
    }
  });

  const result = {
    schema: 'axm.living-city-local-intake-verification/v1',
    pass: issues.length === 0,
    source: {
      packageId: inventory.packageId,
      version: inventory.version,
      inventoryFiles: inventory.fileCount,
      checksumRows: entries.length,
      checksumsPass: issues.every((issue) => !/missing:|digest mismatch:|path escapes/.test(issue))
    },
    localPatches: {
      manifest: true,
      declared: patchManifest.patches.length,
      verified: verifiedPatches.size,
      archiveChecksumIndexModified: patchManifest.archiveChecksumIndexModified
    },
    boundary: {
      standaloneSiblingSimulator: true,
      workshopWorld: false,
      browserRole: 'OPTIONAL_CLIENT',
      canon: false
    },
    issues
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.pass) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write('Living City intake verification failed: ' + error.message + '\n');
  process.exitCode = 1;
}
