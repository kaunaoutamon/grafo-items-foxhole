const test = require('node:test');
const assert = require('node:assert/strict');
const { displayItemName, escapeHtml } = require('../ui-utils.js');

test('escapeHtml safely escapes text and attribute delimiters', () => {
  assert.equal(escapeHtml(`<item name="A & B">'`), '&lt;item name=&quot;A &amp; B&quot;&gt;&#39;');
});

test('displayItemName falls back to the code name for unknown items', () => {
  assert.equal(displayItemName('Known', { Known: { displayName: 'Known item' } }), 'Known item');
  assert.equal(displayItemName('Unknown', {}), 'Unknown');
});
