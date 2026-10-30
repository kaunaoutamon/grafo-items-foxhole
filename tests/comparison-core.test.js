const test = require('node:test');
const assert = require('node:assert/strict');
const { compareProperty, getPropertyDirection } = require('../comparison-core.js');

test('uses higher values as winners for higher-is-better properties', () => {
  const result = compareProperty(1950, 900, 'Vehicle.MaxHealth');

  assert.equal(getPropertyDirection('Vehicle.MaxHealth'), 'higher');
  assert.equal(result.winner, 'left');
  assert.equal(result.message, 'Gana A');
});

test('uses lower values as winners for costs and encumbrance', () => {
  assert.equal(compareProperty(25, 60, 'General.Encumbrance').winner, 'left');
  assert.equal(compareProperty(100, 60, 'Item.CostPerCrate.Cloth').winner, 'right');
});

test('does not claim winners for unranked descriptive properties', () => {
  const result = compareProperty('Colonials', 'Wardens', 'faction');

  assert.equal(result.winner, null);
  assert.equal(result.message, 'Sin ganador');
});

test('treats a missing resource cost as zero and identifies ties', () => {
  assert.equal(compareProperty(undefined, 10, 'Vehicle.ResourceAmounts.Cloth').winner, 'left');
  assert.equal(compareProperty(5, 5, 'Weapon.MaxAmmo').message, 'Empate');
});
