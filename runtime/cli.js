#!/usr/bin/env node
'use strict';

const { HeadlessSimulator } = require('./headless-simulator');
const { readSave, writeNewSave } = require('./file-save-store');

function usage() {
  return [
    'AXM Living City headless simulator',
    '',
    'Create a world:',
    '  node runtime/cli.js new --seed AXM-LIVING-CITY-001 --out headless-saves/day-1.json',
    '',
    'Inspect a world:',
    '  node runtime/cli.js inspect --in headless-saves/day-1.json',
    '',
    'Advance deterministic time into a new checkpoint:',
    '  node runtime/cli.js step --in headless-saves/day-1.json --minutes 60 --out headless-saves/hour-1.json',
    '',
    'Run autonomous observer days into a new checkpoint:',
    '  node runtime/cli.js observe --in headless-saves/hour-1.json --days 7 --out headless-saves/week-1.json',
    '',
    'Outputs use create-new semantics and never overwrite an existing save.'
  ].join('\n');
}

function parseArgs(argv) {
  const result = { command: argv[0] || '' };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error('unexpected argument: ' + token);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error('missing value for --' + key);
    result[key] = value;
    index += 1;
  }
  return result;
}

function emit(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function load(file) {
  const input = readSave(file);
  return { input, simulator: HeadlessSimulator.fromText(input.text) };
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args.command || args.command === 'help') {
    process.stdout.write(usage() + '\n');
    return;
  }

  if (args.command === 'new') {
    if (!args.out) throw new Error('--out is required');
    const simulator = HeadlessSimulator.create({ seed: args.seed });
    const output = writeNewSave(args.out, simulator.serialize());
    emit({ command: 'new', output, summary: simulator.summary() });
    return;
  }

  if (args.command === 'inspect') {
    if (!args.in) throw new Error('--in is required');
    const loaded = load(args.in);
    emit({ command: 'inspect', input: loaded.input.path, summary: loaded.simulator.summary() });
    return;
  }

  if (args.command === 'step') {
    if (!args.in || !args.out || !args.minutes) {
      throw new Error('--in, --minutes, and --out are required');
    }
    const loaded = load(args.in);
    loaded.simulator.advanceMinutes(args.minutes);
    const output = writeNewSave(args.out, loaded.simulator.serialize());
    emit({ command: 'step', input: loaded.input.path, output, summary: loaded.simulator.summary() });
    return;
  }

  if (args.command === 'observe') {
    if (!args.in || !args.out || !args.days) {
      throw new Error('--in, --days, and --out are required');
    }
    const loaded = load(args.in);
    const observation = loaded.simulator.observeDays(args.days);
    const output = writeNewSave(args.out, loaded.simulator.serialize());
    emit({
      command: 'observe',
      input: loaded.input.path,
      output,
      observation: observation.result,
      summary: observation.summary
    });
    return;
  }

  throw new Error('unknown command: ' + args.command + '\n\n' + usage());
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write('Living City headless runtime refused: ' + error.message + '\n');
  process.exitCode = 1;
}
