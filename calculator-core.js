(function (root, factory) {
  const calculator = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = calculator;
  if (root) root.FoxholeCalculator = calculator;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Construction sites consume Excavation directly; the data also has an unrelated
  // factory recipe for it, which should not replace the construction requirement.
  const terminalItems = new Set(['Excavation']);

  function normalizeInputs(inputs) {
    const totals = new Map();
    for (const input of inputs || []) {
      if (!input.codeName || !Number.isFinite(Number(input.quantity))) continue;
      totals.set(input.codeName, (totals.get(input.codeName) || 0) + Number(input.quantity));
    }
    return [...totals.entries()]
      .map(([codeName, quantity]) => ({ codeName, quantity }))
      .sort((a, b) => a.codeName.localeCompare(b.codeName));
  }

  function makeRecipeId(output, recipe) {
    return `${output}:${JSON.stringify([
      recipe.building || '',
      Number(recipe.outputQty) || 1,
      normalizeInputs(recipe.inputs)
    ])}`;
  }

  function createRecipeIndex(recipes) {
    const recipeIndex = new Map();

    for (const recipe of recipes || []) {
      if (!recipe.output) continue;
      const normalized = {
        ...recipe,
        outputQty: Number(recipe.outputQty) > 0 ? Number(recipe.outputQty) : 1,
        inputs: normalizeInputs(recipe.inputs)
      };
      const id = makeRecipeId(recipe.output, normalized);
      if (!recipeIndex.has(recipe.output)) recipeIndex.set(recipe.output, new Map());
      recipeIndex.get(recipe.output).set(id, { ...normalized, id });
    }

    return new Map([...recipeIndex.entries()].map(([output, uniqueRecipes]) => [
      output,
      [...uniqueRecipes.values()]
    ]));
  }

  function calculateProject(projectItems, data, selectedRecipes = {}) {
    const recipeIndex = createRecipeIndex(data.recipes);
    const project = (projectItems || []).filter(entry =>
      entry && entry.codeName && Number.isFinite(Number(entry.quantity)) && Number(entry.quantity) > 0
    );
    const graph = new Map();
    const chosenRecipes = new Map();
    const choices = new Map();
    const missingChoices = new Map();
    const visiting = [];
    const visited = new Set();
    const cycles = [];

    function visit(codeName) {
      if (visiting.includes(codeName)) {
        cycles.push([...visiting.slice(visiting.indexOf(codeName)), codeName]);
        return;
      }
      if (visited.has(codeName)) return;

      visiting.push(codeName);
      const available = terminalItems.has(codeName) ? [] : (recipeIndex.get(codeName) || []);
      let chosen = null;

      if (available.length === 1) {
        chosen = available[0];
      } else if (available.length > 1) {
        const choice = {
          codeName,
          recipes: available,
          selectedId: selectedRecipes[codeName] || ''
        };
        choices.set(codeName, choice);
        chosen = available.find(recipe => recipe.id === choice.selectedId) || null;
        if (!chosen) missingChoices.set(codeName, choice);
      }

      graph.set(codeName, new Set());
      if (chosen) {
        chosenRecipes.set(codeName, chosen);
        for (const input of chosen.inputs) {
          graph.get(codeName).add(input.codeName);
          visit(input.codeName);
        }
      }

      visiting.pop();
      visited.add(codeName);
    }

    for (const entry of project) visit(entry.codeName);

    const choiceList = [...choices.values()].sort((a, b) =>
      (data.items[a.codeName]?.displayName || a.codeName)
        .localeCompare(data.items[b.codeName]?.displayName || b.codeName)
    );

    if (project.length === 0 || cycles.length > 0) {
      return {
        ready: project.length > 0 && missingChoices.size === 0 && cycles.length === 0,
        choices: choiceList,
        missingChoices: [...missingChoices.values()],
        cycles,
        materials: new Map(),
        steps: []
      };
    }

    const indegrees = new Map([...graph.keys()].map(codeName => [codeName, 0]));
    for (const children of graph.values()) {
      for (const child of children) indegrees.set(child, (indegrees.get(child) || 0) + 1);
    }

    const readyQueue = [...indegrees.entries()]
      .filter(([, degree]) => degree === 0)
      .map(([codeName]) => codeName);
    const orderedItems = [];

    while (readyQueue.length > 0) {
      const codeName = readyQueue.shift();
      orderedItems.push(codeName);
      for (const child of graph.get(codeName) || []) {
        const nextDegree = indegrees.get(child) - 1;
        indegrees.set(child, nextDegree);
        if (nextDegree === 0) readyQueue.push(child);
      }
    }

    if (orderedItems.length !== graph.size) {
      return {
        ready: false,
        choices: choiceList,
        missingChoices: [],
        cycles: [['No se pudo ordenar la cadena de recetas.']],
        materials: new Map(),
        steps: []
      };
    }

    const demand = new Map();
    for (const entry of project) {
      demand.set(entry.codeName, (demand.get(entry.codeName) || 0) + Number(entry.quantity));
    }

    const materials = new Map();
    const steps = [];
    const projectOutputs = new Set(project.map(entry => entry.codeName));
    const directMaterials = new Map();

    for (const codeName of orderedItems) {
      const quantity = demand.get(codeName) || 0;
      if (quantity <= 0) continue;

      const recipe = chosenRecipes.get(codeName);
      if (!recipe) {
        if (!missingChoices.has(codeName)) {
          materials.set(codeName, (materials.get(codeName) || 0) + quantity);
        }
        continue;
      }

      const batches = Math.ceil(quantity / recipe.outputQty);
      const inputs = recipe.inputs.map(input => ({
        codeName: input.codeName,
        quantity: input.quantity * batches
      }));

      for (const input of inputs) {
        demand.set(input.codeName, (demand.get(input.codeName) || 0) + input.quantity);
      }

      steps.push({
        codeName,
        quantity,
        recipe,
        batches,
        produced: batches * recipe.outputQty,
        surplus: batches * recipe.outputQty - quantity,
        inputs
      });

      if (projectOutputs.has(codeName)) {
        for (const input of inputs) {
          directMaterials.set(input.codeName, (directMaterials.get(input.codeName) || 0) + input.quantity);
        }
      }
    }

    return {
      ready: missingChoices.size === 0,
      choices: choiceList,
      missingChoices: [...missingChoices.values()],
      cycles: [],
      materials,
      directMaterials,
      steps
    };
  }

  return { calculateProject, createRecipeIndex };
});
