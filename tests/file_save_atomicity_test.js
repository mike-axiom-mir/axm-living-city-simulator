'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const SaveStore = require('../runtime/file-save-store');

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-living-city-save-atomicity-'));
const originalWriteFileSync = fs.writeFileSync;

try {
  const target = path.join(tempRoot, 'checkpoint.json');

  const crashScript = [
    "const fs = require('node:fs');",
    "const target = process.env.AXM_TEST_TARGET;",
    "const storePath = process.env.AXM_TEST_STORE;",
    "const original = fs.writeFileSync;",
    "fs.writeFileSync = function(file, data, options) {",
    "  const partial = String(data).slice(0, 19);",
    "  if (typeof file === 'number') fs.writeSync(file, partial);",
    "  else original.call(fs, file, partial, options);",
    "  process.kill(process.pid, 'SIGKILL');",
    "};",
    "require(storePath).writeNewSave(target, '{\"checkpoint\":\"complete\",\"value\":42}');"
  ].join('\n');
  const crashed = spawnSync(process.execPath, ['-e', crashScript], {
    env: {
      ...process.env,
      AXM_TEST_TARGET: target,
      AXM_TEST_STORE: path.join(__dirname, '..', 'runtime', 'file-save-store.js')
    }
  });
  check(crashed.signal === 'SIGKILL', 'fixture process exits during the physical save write');
  check(!fs.existsSync(target), 'abrupt process exit does not publish a partial checkpoint');
  for (const entry of fs.readdirSync(tempRoot)) fs.unlinkSync(path.join(tempRoot, entry));

  let injected = false;

  fs.writeFileSync = function failAfterPartialWrite(file, data, options) {
    if (!injected) {
      injected = true;
      originalWriteFileSync.call(fs, file, String(data).slice(0, 19), options);
      throw new Error('injected interrupted write');
    }
    return originalWriteFileSync.apply(fs, arguments);
  };

  assert.throws(
    () => SaveStore.writeNewSave(target, '{"checkpoint":"complete","value":42}'),
    /injected interrupted write/
  );
  fs.writeFileSync = originalWriteFileSync;

  check(!fs.existsSync(target), 'interrupted write does not publish a partial checkpoint');
  check(fs.readdirSync(tempRoot).length === 0, 'interrupted write removes its private temporary file');

  const expected = '{"checkpoint":"complete","value":42}\n';
  SaveStore.writeNewSave(target, expected);
  check(fs.readFileSync(target, 'utf8') === expected, 'successful write publishes exact checkpoint bytes');

  assert.throws(
    () => SaveStore.writeNewSave(target, '{"checkpoint":"replacement"}'),
    /EEXIST|exist/i
  );
  check(fs.readFileSync(target, 'utf8') === expected, 'create-new collision preserves the existing checkpoint');
  check(fs.readdirSync(tempRoot).length === 1, 'create-new collision leaves no temporary artifact');

  process.stdout.write('Living City atomic file-save test passed: ' + checks + ' checks.\n');
} finally {
  fs.writeFileSync = originalWriteFileSync;
  const resolvedTemp = path.resolve(tempRoot);
  const systemTemp = path.resolve(os.tmpdir()) + path.sep;
  if (!resolvedTemp.startsWith(systemTemp)) {
    throw new Error('refusing to clean a test path outside the system temp directory');
  }
  fs.rmSync(resolvedTemp, { recursive: true, force: true });
}
