#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CAPABILITY_PATH = 'capabilities/AXM-CAP-HEADLESS-SIMULATOR-V1.json';
const MARKER_PATH = '.axm/discovery-public.json';
const REGISTRY_PATH = 'registry/capabilities.jsonl';
const RECEIPT_PATH = 'registry/capabilities.receipt.json';
const PROVIDER = 'axm-living-city-simulator';
const CAPABILITY_ID = 'axm.living-city.headless-simulator.v1';
const STATUS = 'IMPLEMENTED_REFERENCE';
const EXPECTED_SOURCES = Object.freeze([
  'runtime/headless-simulator.js',
  'runtime/load-simulation.js',
  'runtime/file-save-store.js',
  'runtime/cli.js',
  'package.json'
]);
const EXPECTED_EXPORTS = Object.freeze({
  '.': './runtime/headless-simulator.js',
  './headless': './runtime/headless-simulator.js',
  './save-store': './runtime/file-save-store.js',
  './load-simulation': './runtime/load-simulation.js'
});

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function readRegular(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const absolute = path.resolve(resolvedRoot, relativePath);
  if (absolute !== resolvedRoot && !absolute.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`source path escapes repository root: ${relativePath}`);
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`source must be a regular file: ${relativePath}`);
  }
  const bytes = fs.readFileSync(absolute);
  return { bytes, sha256: sha256(bytes) };
}

function readJson(root, relativePath) {
  const source = readRegular(root, relativePath);
  let value;
  try {
    value = JSON.parse(source.bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`${relativePath} is not valid JSON: ${error.message}`);
  }
  return { ...source, value };
}

function equalJson(left, right) {
  return canonical(left) === canonical(right);
}

function validatePackage(pkg) {
  if (pkg.name !== 'axm-living-city-sim-interior-feedback') throw new Error('package name drifted');
  if (pkg.version !== '0.11.3') throw new Error('package version drifted from runtime contract');
  if (pkg.private !== true) throw new Error('package must remain private to prevent accidental registry publication');
  if (pkg.license !== 'Apache-2.0') throw new Error('package license must remain Apache-2.0');
  if (pkg.main !== 'runtime/headless-simulator.js') throw new Error('package main must expose headless simulator');
  if (!equalJson(pkg.exports, EXPECTED_EXPORTS)) throw new Error('package exports drifted from curated headless seam');
  if (!pkg.bin || pkg.bin['axm-living-city'] !== 'runtime/cli.js') throw new Error('package CLI seam drifted');
  if (!Array.isArray(pkg.files) || !pkg.files.includes('runtime/*.js') || !pkg.files.includes('src/*.js')) {
    throw new Error('package files must include runtime and simulation source');
  }
}

function deriveRegistry(root) {
  const marker = readJson(root, MARKER_PATH);
  if (marker.value.schema !== 'axm.discovery-public/v0.1' || marker.value.public_discovery !== true) {
    throw new Error('public discovery marker must be explicit axm.discovery-public/v0.1 opt-in');
  }

  const capability = readJson(root, CAPABILITY_PATH);
  const value = capability.value;
  if (value.schema !== 'axm.capability-source/v1') throw new Error('unsupported capability source schema');
  if (value.id !== CAPABILITY_ID) throw new Error('capability id drifted');
  if (value.provider !== PROVIDER) throw new Error('capability provider drifted');
  if (value.status !== STATUS) throw new Error('capability status drifted');
  if (value.authority !== 'NONE') throw new Error('capability authority must remain NONE');
  if (!equalJson(value.source_paths, EXPECTED_SOURCES)) throw new Error('capability source_paths drifted');
  if (!value.truth || value.truth.execution_authority !== 'NONE' ||
      value.truth.merge_authority !== false || value.truth.canon_authority !== false ||
      value.truth.package_is_public_registry_release !== false ||
      value.truth.declaration_is_runtime_proof !== false) {
    throw new Error('capability truth boundary drifted');
  }

  const pkg = readJson(root, 'package.json');
  validatePackage(pkg.value);

  const sources = [
    { id: 'public-opt-in', path: MARKER_PATH, sha256: marker.sha256 },
    { id: 'capability-contract', path: CAPABILITY_PATH, sha256: capability.sha256 },
    ...EXPECTED_SOURCES.map((relativePath) => {
      const source = relativePath === 'package.json' ? pkg : readRegular(root, relativePath);
      return { id: `source:${relativePath}`, path: relativePath, sha256: source.sha256 };
    })
  ].sort((a, b) => a.id.localeCompare(b.id));

  const row = {
    schema: 'axm.public-capability/v1',
    id: CAPABILITY_ID,
    providers: [PROVIDER],
    consumers: [],
    provider_statuses: [{ id: PROVIDER, status: STATUS }],
    source_evidence: sources.map((source) => source.id),
    implementations: [{
      id: PROVIDER,
      kinds: ['local-package', 'library-seam', 'cli'],
      interfaces: value.interfaces,
      truth: {
        authority: 'NONE',
        capability_status: STATUS,
        source_id: 'AXM-CAP-HEADLESS-SIMULATOR-V1',
        source_path: CAPABILITY_PATH,
        published_registry_release: false
      }
    }],
    truth: {
      declaration_is_runtime_proof: false,
      generated_from_repo_state: true,
      grants_authority: false
    }
  };
  const registryText = canonical(row) + '\n';
  const receipt = {
    schema: 'axm.living-city.capability-registry-receipt/v1',
    generator: 'tools/generate-capability-registry.cjs',
    inputs: sources,
    output: {
      path: REGISTRY_PATH,
      records: 1,
      sha256: sha256(Buffer.from(registryText, 'utf8'))
    },
    truth: {
      declarations_are_runtime_proof: false,
      package_is_public_registry_release: false,
      grants_execution_authority: false,
      grants_merge_authority: false,
      grants_canon_authority: false
    }
  };
  return {
    row,
    registryText,
    receipt,
    receiptText: JSON.stringify(receipt, null, 2) + '\n'
  };
}

function writeOrCheck(root, check = false) {
  const result = deriveRegistry(root);
  const outputs = [
    [REGISTRY_PATH, result.registryText],
    [RECEIPT_PATH, result.receiptText]
  ];
  const stale = [];
  for (const [relativePath, expected] of outputs) {
    const absolute = path.join(root, relativePath);
    if (check) {
      const actual = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
      if (actual !== expected) stale.push(relativePath);
    } else {
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, expected, 'utf8');
    }
  }
  if (stale.length) throw new Error(`generated capability discovery drift: ${stale.join(', ')}`);
  return result;
}

if (require.main === module) {
  try {
    const check = process.argv.includes('--check');
    const result = writeOrCheck(process.cwd(), check);
    process.stdout.write(`${check ? 'verified' : 'generated'} ${result.receipt.output.records} Living City capability record; registry sha256 ${result.receipt.output.sha256}\n`);
  } catch (error) {
    process.stderr.write(`Living City capability registry refused: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = Object.freeze({ CAPABILITY_ID, deriveRegistry, writeOrCheck });
