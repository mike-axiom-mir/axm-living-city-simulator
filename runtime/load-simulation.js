'use strict';

const path = require('node:path');

const MODULE_ORDER = Object.freeze([
  'core',
  'content',
  'content_expansion',
  'world',
  'systems',
  'item_interactions',
  'households',
  'habitats',
  'object_use',
  'object_use_item_expansion',
  'object_use_audit',
  'stewardship',
  'family',
  'community',
  'directions',
  'economy',
  'exteriors',
  'shells',
  'presence',
  'housing_pressure',
  'historical_era'
]);

const REQUIRED_NAMESPACES = Object.freeze([
  'Core',
  'Content',
  'ContentExpansion',
  'World',
  'Systems',
  'ItemInteractions',
  'Households',
  'Habitats',
  'ObjectUse',
  'ObjectUseItemExpansion',
  'ObjectUseAudit',
  'Stewardship',
  'Family',
  'Community',
  'Directions',
  'Economy',
  'Exteriors',
  'Shells',
  'Presence',
  'HousingPressure',
  'HistoricalEra'
]);

function loadSimulation(options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot || path.join(__dirname, '..'));
  MODULE_ORDER.forEach((name) => {
    require(path.join(sourceRoot, 'src', name + '.js'));
  });

  const axm = globalThis.AXM;
  if (!axm || typeof axm !== 'object') {
    throw new Error('Living City modules did not expose globalThis.AXM');
  }
  const missing = REQUIRED_NAMESPACES.filter((name) => !axm[name]);
  if (missing.length) {
    throw new Error('Living City module load is incomplete: ' + missing.join(', '));
  }
  if (axm.Core.VERSION !== '0.11.3') {
    throw new Error('Living City source version mismatch: ' + String(axm.Core.VERSION));
  }
  return axm;
}

module.exports = Object.freeze({ MODULE_ORDER, REQUIRED_NAMESPACES, loadSimulation });
