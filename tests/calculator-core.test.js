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
  assert.equal(result.primaryMaterials.get('Part'), 2);
  assert.equal(result.secondaryMaterials.get('Metal'), 5);
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
  assert.equal(result.primaryMaterials.get('BasicMaterials'), 12);
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
  assert.equal(result.primaryMaterials.get('Excavation'), 150);
  assert.equal(result.secondaryMaterials.size, 0);
  assert.equal(result.materials.get('Excavation'), 150);
  assert.equal(result.materials.has('Cloth'), false);
  assert.equal(result.materials.has('Metal'), false);
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
