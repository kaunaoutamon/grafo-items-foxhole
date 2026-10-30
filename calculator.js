(async function () {
  const itemSearch = document.getElementById('item-search');
  const itemOptions = document.getElementById('item-options');
  const quantityInput = document.getElementById('item-quantity');
  const addForm = document.getElementById('add-project-item');
  const projectList = document.getElementById('project-list');
  const recipeSection = document.getElementById('recipe-section');
  const recipeChoices = document.getElementById('recipe-choices');
  const resultsSection = document.getElementById('results-section');
  const calculationStatus = document.getElementById('calculation-status');
  const directMaterialsSection = document.getElementById('direct-materials-section');
  const directMaterials = document.getElementById('direct-materials');
  const materialsTotal = document.getElementById('materials-total');
  const productionDetails = document.getElementById('production-details');
  const productionSteps = document.getElementById('production-steps');
  const loading = document.getElementById('calculator-loading');

  const projectItems = [];
  const selectedRecipes = {};
  const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function displayName(codeName, items) {
    return items[codeName]?.displayName || codeName;
  }

  function formatQuantity(quantity) {
    return numberFormat.format(quantity);
  }

  function makeItemLabels(items, recipeIndex) {
    const buildableItems = [...recipeIndex.keys()]
      .map(codeName => items[codeName])
      .filter(Boolean)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    const nameCounts = new Map();
    for (const item of buildableItems) {
      nameCounts.set(item.displayName, (nameCounts.get(item.displayName) || 0) + 1);
    }

    const labels = new Map();
    const used = new Set();
    for (const item of buildableItems) {
      const label = nameCounts.get(item.displayName) > 1
        ? `${item.displayName} — ${item.faction && item.faction !== 'Neutral' ? item.faction : item.codeName}`
        : item.displayName;
      const uniqueLabel = used.has(label) ? `${label} [${item.codeName}]` : label;
      used.add(uniqueLabel);
      labels.set(uniqueLabel, item);
    }
    return labels;
  }

  let data;
  try {
    const response = await fetch(`data/foxhole-data.json?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (error) {
    loading.textContent = 'No se pudieron cargar los datos. Verificá la conexión e intentá nuevamente.';
    console.error(error);
    return;
  }

  const recipeIndex = FoxholeCalculator.createRecipeIndex(data.recipes);
  const itemLabels = makeItemLabels(data.items, recipeIndex);
  const itemByLabel = new Map([...itemLabels.entries()].map(([label, item]) => [label, item]));

  for (const label of itemLabels.keys()) {
    const option = document.createElement('option');
    option.value = label;
    itemOptions.appendChild(option);
  }

  function renderProject() {
    if (projectItems.length === 0) {
      projectList.innerHTML = '<p class="project-empty">Todavía no agregaste ítems al proyecto.</p>';
      return;
    }

    projectList.innerHTML = projectItems.map(entry => {
      const item = data.items[entry.codeName] || {};
      return `
        <div class="project-row" data-project-id="${entry.id}">
          <div class="project-item-name">
            ${item.iconFile ? `<img src="${escapeHtml(item.iconFile)}" alt="">` : ''}
            <span>${escapeHtml(displayName(entry.codeName, data.items))}</span>
          </div>
          <label class="visually-hidden" for="project-quantity-${entry.id}">Cantidad de ${escapeHtml(displayName(entry.codeName, data.items))}</label>
          <input id="project-quantity-${entry.id}" class="project-quantity" data-action="quantity" type="number" min="1" step="1" value="${entry.quantity}">
          <button class="remove-project-item" data-action="remove" type="button" aria-label="Quitar ${escapeHtml(displayName(entry.codeName, data.items))}">Quitar</button>
        </div>
      `;
    }).join('');
  }

  function recipeLabel(recipe) {
    const inputs = recipe.inputs.map(input =>
      `${formatQuantity(input.quantity)}× ${displayName(input.codeName, data.items)}`
    ).join(', ') || 'Sin materiales de entrada';
    return `${recipe.building || 'Receta'} · ${inputs} → ${formatQuantity(recipe.outputQty)}× ${displayName(recipe.output, data.items)}`;
  }

  function renderChoices(choices) {
    recipeSection.hidden = choices.length === 0;
    if (choices.length === 0) {
      recipeChoices.innerHTML = '';
      return;
    }

    recipeChoices.innerHTML = choices.map(choice => `
      <div class="recipe-choice">
        <span class="recipe-choice-name">${escapeHtml(displayName(choice.codeName, data.items))}</span>
        <label>
          Elegí una receta
          <select data-recipe-output="${escapeHtml(choice.codeName)}" required>
            <option value="">Seleccioná una receta...</option>
            ${choice.recipes.map(recipe => `
              <option value="${escapeHtml(recipe.id)}" ${recipe.id === choice.selectedId ? 'selected' : ''}>
                ${escapeHtml(recipeLabel(recipe))}
              </option>
            `).join('')}
          </select>
        </label>
      </div>
    `).join('');
  }

  function renderResults(result) {
    resultsSection.hidden = projectItems.length === 0;
    if (projectItems.length === 0) {
      calculationStatus.textContent = '';
      directMaterialsSection.hidden = true;
      directMaterials.innerHTML = '';
      materialsTotal.innerHTML = '';
      productionDetails.hidden = true;
      return;
    }

    if (result.cycles.length > 0) {
      calculationStatus.className = 'calculation-status error';
      calculationStatus.textContent = `No se pudo completar el desglose porque hay una cadena de recetas circular: ${result.cycles.map(cycle => cycle.map(code => displayName(code, data.items)).join(' → ')).join('; ')}.`;
      directMaterialsSection.hidden = true;
      directMaterials.innerHTML = '';
      materialsTotal.innerHTML = '';
      productionDetails.hidden = true;
      return;
    }

    calculationStatus.className = 'calculation-status';
    calculationStatus.textContent = result.ready
      ? 'Los materiales compartidos se agrupan y las tandas se redondean para cubrir las cantidades solicitadas.'
      : 'Elegí las recetas pendientes para completar el cálculo. Mientras tanto, se muestran los insumos ya conocidos.';

    function renderMaterialRows(materialMap, emptyMessage) {
      const sortedMaterials = [...materialMap.entries()].sort((a, b) =>
        displayName(a[0], data.items).localeCompare(displayName(b[0], data.items))
      );

      return sortedMaterials.map(([codeName, quantity]) => {
        const item = data.items[codeName] || {};
        return `
          <div class="material-total-row">
            <div class="material-name">
              ${item.iconFile ? `<img src="${escapeHtml(item.iconFile)}" alt="">` : ''}
              <span>${escapeHtml(displayName(codeName, data.items))}</span>
            </div>
            <span class="material-quantity">${formatQuantity(quantity)}</span>
          </div>
        `;
      }).join('') || `<p class="project-empty">${escapeHtml(emptyMessage)}</p>`;
    }

    directMaterialsSection.hidden = result.directMaterials.size === 0;
    directMaterials.innerHTML = renderMaterialRows(result.directMaterials, 'No hay insumos directos para mostrar.');
    materialsTotal.innerHTML = renderMaterialRows(
      result.materials,
      result.ready ? 'No hay materiales base para mostrar.' : 'Todavía no se puede completar este nivel; elegí las recetas pendientes.'
    );

    productionDetails.hidden = result.steps.length === 0;
    productionSteps.innerHTML = `
      <ul class="production-steps">
        ${result.steps.map(step => {
          const itemName = displayName(step.codeName, data.items);
          const inputSummary = step.inputs.map(input =>
            `${formatQuantity(input.quantity)}× ${displayName(input.codeName, data.items)}`
          ).join(', ');
          const surplus = step.surplus > 0 ? ` · sobran ${formatQuantity(step.surplus)}` : '';
          return `
            <li class="production-step">
              <strong>${escapeHtml(itemName)}:</strong> ${formatQuantity(step.quantity)} solicitados; ${formatQuantity(step.batches)} tanda(s) de ${escapeHtml(step.recipe.building || 'producción')} producen ${formatQuantity(step.produced)}${surplus}.
              <p>Insumos de esta etapa: ${escapeHtml(inputSummary || 'ninguno')}.</p>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  }

  function recalculate() {
    const result = FoxholeCalculator.calculateProject(projectItems, data, selectedRecipes);
    renderChoices(result.choices);
    renderResults(result);
  }

  addForm.addEventListener('submit', event => {
    event.preventDefault();
    const item = itemByLabel.get(itemSearch.value.trim());
    const quantity = Number(quantityInput.value);
    if (!item || !Number.isInteger(quantity) || quantity < 1) {
      itemSearch.setCustomValidity(item ? 'Ingresá una cantidad entera mayor que cero.' : 'Elegí un ítem de la lista.');
      itemSearch.reportValidity();
      return;
    }

    itemSearch.setCustomValidity('');
    projectItems.push({ id: Date.now() + Math.random(), codeName: item.codeName, quantity });
    itemSearch.value = '';
    quantityInput.value = '1';
    renderProject();
    recalculate();
    itemSearch.focus();
  });

  itemSearch.addEventListener('input', () => itemSearch.setCustomValidity(''));

  projectList.addEventListener('change', event => {
    if (event.target.dataset.action !== 'quantity') return;
    const row = event.target.closest('[data-project-id]');
    const entry = projectItems.find(item => String(item.id) === row?.dataset.projectId);
    const quantity = Number(event.target.value);
    if (!entry) return;
    if (!Number.isInteger(quantity) || quantity < 1) {
      event.target.value = entry.quantity;
      return;
    }
    entry.quantity = quantity;
    recalculate();
  });

  projectList.addEventListener('click', event => {
    if (event.target.dataset.action !== 'remove') return;
    const row = event.target.closest('[data-project-id]');
    const index = projectItems.findIndex(item => String(item.id) === row?.dataset.projectId);
    if (index === -1) return;
    projectItems.splice(index, 1);
    renderProject();
    recalculate();
  });

  recipeChoices.addEventListener('change', event => {
    const codeName = event.target.dataset.recipeOutput;
    if (!codeName) return;
    if (event.target.value) selectedRecipes[codeName] = event.target.value;
    else delete selectedRecipes[codeName];
    recalculate();
    const focusedChoice = [...recipeChoices.querySelectorAll('[data-recipe-output]')]
      .find(select => select.dataset.recipeOutput === codeName);
    focusedChoice?.focus();
  });

  loading.remove();
  renderProject();
})();
