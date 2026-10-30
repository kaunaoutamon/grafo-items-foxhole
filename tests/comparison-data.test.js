const test = require('node:test');
const assert = require('node:assert/strict');
const comparisonData = require('../data/comparison-data.json');

test('comparison categories keep handheld weapons separate from vehicles', () => {
  assert.equal(comparisonData.items.RifleC.category, 'SmallArms');
  assert.equal(comparisonData.items.TruckC.category, 'Vehicles');
  assert.notEqual(comparisonData.items.RifleC.category, comparisonData.items.TruckC.category);
});

test('comparison data includes category-specific dynamic properties', () => {
  assert.equal(comparisonData.items.RifleC.properties['Weapon.MaxAmmo'], 12);
  assert.equal(comparisonData.items.TruckC.properties['Vehicle.MaxHealth'], 900);
  assert.equal(comparisonData.items.LightTankC.properties['Vehicle.TankArmour'], 9100);
});
