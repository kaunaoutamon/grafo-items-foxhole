const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateProject, createRecipeIndex } = require('../calculator-core.js');

function makeData(recipes) {
  const items = {};
  for (const recipe of recipes) {
    items[recipe.output] = { codeName: recipe.output, displayName: recipe.output };
    for (const input of recipe.inputs) {
      items[input.codeName] ||= { codeName: input.codeName, displayName: input.codeName };
    }
  }
  return { items, recipes };
}

test('combines shared intermediate demand before rounding production batches', () => {
  const data = makeData([
    { output: 'VehicleA', outputQty: 1, building: 'Factory', inputs: [{ codeName: 'Part', quantity: 1 }] },
    { output: 'VehicleB', outputQty: 1, building: 'Factory', inputs: [{ codeName: 'Part', quantity: 1 }] },
    { output: 'Part', outputQty: 4, building: 'Workshop', inputs: [{ codeName: 'Metal', quantity: 5 }] }
  ]);

  const result = calculateProject([
    { codeName: 'VehicleA', quantity: 1 },
    { codeName: 'VehicleB', quantity: 1 }
  ], data);

  assert.equal(result.ready, true);
  assert.equal(result.materials.get('Metal'), 5);
  assert.equal(result.materialLayers.get(1).get('Part'), 2);
  assert.equal(result.materialLayers.get(2).get('Metal'), 5);
  assert.equal(result.steps.find(step => step.codeName === 'Part').quantity, 2);
  assert.equal(result.steps.find(step => step.codeName === 'Part').batches, 1);
});

test('rounds output batches up and scales each input by the batch count', () => {
  const data = makeData([
    { output: 'Vehicle', outputQty: 2, building: 'Factory', inputs: [{ codeName: 'Metal', quantity: 3 }] }
  ]);

  const result = calculateProject([{ codeName: 'Vehicle', quantity: 3 }], data);

  assert.equal(result.ready, true);
  assert.equal(result.materials.get('Metal'), 6);
  assert.equal(result.steps[0].batches, 2);
  assert.equal(result.steps[0].surplus, 1);
});

test('requires a user choice when an item has distinct recipes', () => {
  const data = makeData([
    { output: 'Tank', outputQty: 1, building: 'Factory', inputs: [{ codeName: 'Metal', quantity: 10 }] },
    { output: 'Tank', outputQty: 1, building: 'Facility', inputs: [{ codeName: 'Components', quantity: 5 }] }
  ]);
  const initial = calculateProject([{ codeName: 'Tank', quantity: 1 }], data);

  assert.equal(initial.ready, false);
  assert.equal(initial.missingChoices.length, 1);

  const facilityRecipe = initial.choices[0].recipes.find(recipe => recipe.building === 'Facility');
  const chosen = calculateProject(
    [{ codeName: 'Tank', quantity: 1 }],
    data,
    { Tank: facilityRecipe.id }
  );

  assert.equal(chosen.ready, true);
  assert.equal(chosen.materials.get('Components'), 5);
  assert.equal(chosen.materials.has('Metal'), false);
});

test('shows known first-level materials while a downstream recipe is unselected', () => {
  const data = makeData([
    { output: 'Vehicle', outputQty: 1, building: 'Factory', inputs: [{ codeName: 'BasicMaterials', quantity: 12 }] },
    { output: 'BasicMaterials', outputQty: 1, building: 'Refinery A', inputs: [{ codeName: 'Metal', quantity: 2 }] },
    { output: 'BasicMaterials', outputQty: 1, building: 'Refinery B', inputs: [{ codeName: 'Components', quantity: 3 }] }
  ]);

  const result = calculateProject([{ codeName: 'Vehicle', quantity: 1 }], data);

  assert.equal(result.ready, false);
  assert.equal(result.materialLayers.get(1).get('BasicMaterials'), 12);
  assert.equal(result.missingChoices[0].codeName, 'BasicMaterials');
});

test('counts bunker excavations without expanding them into factory materials', () => {
  const data = makeData([
    { output: 'FortT1', outputQty: 1, building: 'Construction', inputs: [{ codeName: 'Excavation', quantity: 75 }] },
    { output: 'Excavation', outputQty: 10, building: 'Factory / MPF', inputs: [{ codeName: 'Cloth', quantity: 200 }] },
    { output: 'Cloth', outputQty: 1, building: 'Refinery', inputs: [{ codeName: 'Metal', quantity: 2 }] }
  ]);

  const result = calculateProject([{ codeName: 'FortT1', quantity: 2 }], data);

  assert.equal(result.ready, true);
  assert.equal(result.materialLayers.get(1).get('Excavation'), 150);
  assert.equal(result.materialLayers.size, 1);
  assert.equal(result.materials.get('Excavation'), 150);
  assert.equal(result.energyConsumption.size, 0);
  assert.equal(result.materials.has('Cloth'), false);
  assert.equal(result.materials.has('Metal'), false);

  const excavationProject = calculateProject([{ codeName: 'Excavation', quantity: 20 }], data);
  assert.equal(excavationProject.materialLayers.get(1).get('Excavation'), 20);
});

test('places a material in its earliest layer only and sums its deeper demand there', () => {
  const data = makeData([
    { output: 'Vehicle', outputQty: 1, building: 'Factory', inputs: [
      { codeName: 'PartA', quantity: 2 },
      { codeName: 'Metal', quantity: 1 }
    ] },
    { output: 'PartA', outputQty: 1, building: 'Workshop', inputs: [{ codeName: 'PartB', quantity: 3 }] },
    { output: 'PartB', outputQty: 1, building: 'Workshop', inputs: [
      { codeName: 'Metal', quantity: 4 },
      { codeName: 'Ore', quantity: 1 }
    ] }
  ]);

  const result = calculateProject([{ codeName: 'Vehicle', quantity: 1 }], data);

  assert.equal(result.materialLayers.get(1).get('Metal'), 25);
  assert.equal(result.materialLayers.get(1).get('PartA'), 2);
  assert.equal(result.materialLayers.get(2).get('PartB'), 6);
  assert.equal(result.materialLayers.get(3).get('Ore'), 6);
  assert.equal(result.materialLayers.get(3).has('Metal'), false);
});

test('reports resource-mine fuel as energy rather than as a material layer', () => {
  const data = makeData([
    { output: 'Vehicle', outputQty: 1, building: 'Factory', inputs: [{ codeName: 'Metal', quantity: 100 }] },
    { output: 'Metal', outputQty: 50, building: 'Facility Resource Mine (Salvage)', inputs: [{ codeName: 'Petrol', quantity: 4 }] }
  ]);

  const result = calculateProject([{ codeName: 'Vehicle', quantity: 1 }], data);

  assert.equal(result.materialLayers.get(1).get('Metal'), 100);
  assert.equal(result.materialLayers.has(2), false);
  assert.equal(result.energyConsumption.get('Petrol'), 8);
  assert.equal(result.materials.has('Petrol'), false);
});

test('deduplicates identical recipes but retains different production methods', () => {
  const recipes = [
    { output: 'Item', outputQty: 1, building: 'Factory', inputs: [{ codeName: 'Metal', quantity: 2 }] },
    { output: 'Item', outputQty: 1, building: 'Factory', inputs: [{ codeName: 'Metal', quantity: 2 }] },
    { output: 'Item', outputQty: 1, building: 'Facility', inputs: [{ codeName: 'Metal', quantity: 2 }] }
  ];

  assert.equal(createRecipeIndex(recipes).get('Item').length, 2);
});

test('reports cyclic recipe chains instead of recursing indefinitely', () => {
  const data = makeData([
    { output: 'A', outputQty: 1, building: 'Factory', inputs: [{ codeName: 'B', quantity: 1 }] },
    { output: 'B', outputQty: 1, building: 'Factory', inputs: [{ codeName: 'A', quantity: 1 }] }
  ]);

  const result = calculateProject([{ codeName: 'A', quantity: 1 }], data);

  assert.equal(result.ready, false);
  assert.equal(result.cycles.length, 1);
});
