'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
globalThis.document = {
  body: {},
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; }
};
for (const file of ['core', 'content', 'world', 'systems', 'households', 'habitats', 'stewardship', 'family', 'community', 'directions', 'economy', 'exteriors', 'shells', 'presence', 'visuals', 'game', 'ui']) {
  require(path.join(ROOT, 'src', `${file}.js`));
}

const { UI, World } = globalThis.AXM;
const world = World.createWorld('AXM-NAVIGATION-CONTINUITY');

assert.equal(UI.navigationTarget('town', 'ArrowRight'), 'street');
assert.equal(UI.navigationTarget('town', 'ArrowLeft'), 'lab');
assert.equal(UI.navigationTarget('visuals', 'Home'), 'town');
assert.equal(UI.navigationTarget('visuals', 'End'), 'lab');
assert.equal(UI.navigationTarget('visuals', 'Tab'), null);

world.ui.activeTab = 'visuals';
const markup = UI.renderTabs(world);
assert.match(markup, /role="tablist"/);
assert.match(markup, /id="tab-visuals" role="tab" aria-selected="true" aria-controls="active-view" tabindex="0"/);
assert.match(markup, /id="tab-town" role="tab" aria-selected="false" aria-controls="active-view" tabindex="-1"/);
assert.match(markup, /aria-label="Section 5 of 18"/);
assert.match(markup, /data-action="tab-relative" data-direction="-1"/);
assert.match(markup, /data-action="tab-relative" data-direction="1"/);

assert.equal(UI.interactionKey({ classList: { contains: (name) => name === 'tab-button' }, dataset: { id: 'visuals' } }), 'tab:visuals');
assert.equal(UI.interactionKey({ classList: { contains: () => false }, id: 'seedInput', dataset: {} }), 'id:seedInput');

console.log('PASS navigation continuity: 18-view semantics, bounded arrow/Home/End routing, position receipt, and stable interaction keys');
