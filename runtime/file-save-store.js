'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body.endsWith('\n') ? body : body + '\n', {
    encoding: 'utf8',
    flag: 'wx'
  });
  return target;
}

module.exports = Object.freeze({ MAX_SAVE_BYTES, readSave, writeNewSave });
