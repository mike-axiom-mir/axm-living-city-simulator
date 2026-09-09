'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_SAVE_BYTES = 64 * 1024 * 1024;

function resolveFile(file, label) {
  const value = String(file || '').trim();
  if (!value) throw new Error(label + ' path is required');
  return path.resolve(value);
}

function readSave(file) {
  const target = resolveFile(file, 'input');
  const stat = fs.statSync(target);
  if (!stat.isFile()) throw new Error('input is not a file: ' + target);
  if (stat.size > MAX_SAVE_BYTES) throw new Error('input exceeds the 64 MiB save limit');
  return { path: target, text: fs.readFileSync(target, 'utf8') };
}

function writeNewSave(file, text) {
  const target = resolveFile(file, 'output');
  const body = String(text);
  if (Buffer.byteLength(body, 'utf8') > MAX_SAVE_BYTES) {
    throw new Error('output exceeds the 64 MiB save limit');
  }

  const directory = path.dirname(target);
  const basename = path.basename(target);
  const payload = body.endsWith('\n') ? body : body + '\n';
  fs.mkdirSync(directory, { recursive: true });

  let temporary = '';
  let descriptor = null;
  let primaryFailure = null;
  let published = false;
  try {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      temporary = path.join(
        directory,
        '.' + basename + '.axm-save-' + process.pid + '-' + crypto.randomBytes(8).toString('hex') + '.tmp'
      );
      try {
        descriptor = fs.openSync(temporary, 'wx');
        break;
      } catch (error) {
        if (!error || error.code !== 'EEXIST') throw error;
      }
    }
    if (descriptor === null) throw new Error('could not reserve a private temporary save file');

    fs.writeFileSync(descriptor, payload, { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;

    // A same-directory hard link atomically publishes the complete temporary
    // inode while retaining create-new semantics if another writer wins.
    fs.linkSync(temporary, target);
    published = true;
    try {
      fs.unlinkSync(temporary);
      temporary = '';
    } catch {
      // The final checkpoint is already complete and visible. The finally
      // block retries cleanup without turning a valid commit into a failure.
    }
    return target;
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    let cleanupFailure = null;
    if (descriptor !== null) {
      try { fs.closeSync(descriptor); } catch (error) { cleanupFailure = error; }
    }
    if (temporary) {
      try { fs.unlinkSync(temporary); } catch (error) {
        if ((!error || error.code !== 'ENOENT') && !cleanupFailure) cleanupFailure = error;
      }
    }
    if (cleanupFailure && !primaryFailure && !published) throw cleanupFailure;
  }
}

module.exports = Object.freeze({ MAX_SAVE_BYTES, readSave, writeNewSave });
