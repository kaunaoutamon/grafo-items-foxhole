const test = require('node:test');
const assert = require('node:assert/strict');
const { compareProperty, filterComparisonItems, formatTechId, getPropertyDirection } = require('../comparison-core.js');

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

test('formats technology identifiers as readable Spanish unlocks', () => {
  assert.equal(formatTechId('ETechID::UnlockRPG'), 'Desbloquea Lanzacohetes RPG');
  assert.equal(formatTechId('ETechID::UnlockATRifleAutomatic'), 'Desbloquea Fusil automático antitanque');
  assert.equal(formatTechId('ETechID::None'), 'No requiere tecnología');
});

test('filters candidates by category, faction, and selected item type', () => {
  const comparisonItems = {
    RifleC: { category: 'SmallArms', type: 'Rifle' },
    RifleW: { category: 'SmallArms', type: 'Rifle' },
    PistolC: { category: 'SmallArms', type: 'Pistol' },
    MortarW: { category: 'HeavyArms', type: 'Mortar' },
    TruckC: { category: 'Vehicles', type: 'WheeledTransport' }
  };
  const items = {
    RifleC: { faction: 'Colonials' },
    RifleW: { faction: 'Wardens' },
    PistolC: { faction: 'Colonials' },
    MortarW: { faction: 'Wardens' },
    TruckC: { faction: 'Colonials' }
  };

  assert.deepEqual(
    filterComparisonItems(comparisonItems, items, 'SmallArms', 'Colonials', 'Rifle'),
    ['RifleC']
  );
  assert.deepEqual(
    filterComparisonItems(comparisonItems, items, 'SmallArms', 'Colonials'),
    ['RifleC', 'PistolC']
  );
  assert.deepEqual(filterComparisonItems(comparisonItems, items, 'Vehicles', 'Colonials', 'Tank'), []);
});
