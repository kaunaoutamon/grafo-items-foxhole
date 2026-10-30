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
  const materialLayers = document.getElementById('material-layers');
  const energySection = document.getElementById('energy-section');
  const energyConsumption = document.getElementById('energy-consumption');
  const productionDetails = document.getElementById('production-details');
  const productionSteps = document.getElementById('production-steps');
  const loading = document.getElementById('calculator-loading');

  const projectItems = [];
  const selectedRecipes = {};
  const extractionEnergyItems = new Set(['Petrol', 'FacilityOil1', 'FacilityOil2', 'FacilityCoal1']);
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
  const searchableItems = [...itemLabels.entries()].map(([label, item]) => ({ label, item }));
  let visibleSuggestions = [];
  let activeSuggestionIndex = -1;

  function closeItemOptions() {
    itemOptions.hidden = true;
    itemSearch.setAttribute('aria-expanded', 'false');
    itemSearch.removeAttribute('aria-activedescendant');
    visibleSuggestions = [];
    activeSuggestionIndex = -1;
  }

  function renderItemOptions(query) {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    visibleSuggestions = searchableItems.filter(({ label, item }) =>
      !normalizedQuery || label.toLocaleLowerCase().includes(normalizedQuery) ||
      item.codeName.toLocaleLowerCase().includes(normalizedQuery)
    );
    activeSuggestionIndex = -1;
    itemSearch.removeAttribute('aria-activedescendant');
    itemSearch.setAttribute('aria-expanded', 'true');
    itemOptions.hidden = false;

    if (visibleSuggestions.length === 0) {
      itemOptions.innerHTML = '<div class="item-suggestions-empty">No se encontraron ítems.</div>';
      return;
    }

    itemOptions.innerHTML = visibleSuggestions.map(({ label }, index) => `
      <div id="item-option-${index}" class="item-suggestion" role="option" aria-selected="false" data-item-label="${escapeHtml(label)}">
        <span>${escapeHtml(label)}</span>
      </div>
    `).join('');
  }

  function setActiveSuggestion(index) {
    if (visibleSuggestions.length === 0) return;
    activeSuggestionIndex = Math.max(0, Math.min(index, visibleSuggestions.length - 1));
    const options = itemOptions.querySelectorAll('[role="option"]');
    options.forEach((option, optionIndex) => {
      const active = optionIndex === activeSuggestionIndex;
      option.setAttribute('aria-selected', String(active));
      if (active) {
        itemSearch.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function chooseItemSuggestion(label) {
    itemSearch.value = label;
    itemSearch.setCustomValidity('');
    closeItemOptions();
  }

  itemOptions.addEventListener('pointerdown', event => {
    const option = event.target instanceof Element
      ? event.target.closest('[data-item-label]')
      : null;
    if (!option) return;
    event.preventDefault();
    chooseItemSuggestion(option.dataset.itemLabel);
  });

  itemOptions.addEventListener('click', event => {
    const option = event.target instanceof Element
      ? event.target.closest('[data-item-label]')
      : null;
    if (option) chooseItemSuggestion(option.dataset.itemLabel);
  });

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
    const isResourceMine = /^Facility Resource Mine\b/i.test(recipe.building || '');
    const inputs = recipe.inputs.map(input => {
      const energyTag = isResourceMine && extractionEnergyItems.has(input.codeName) ? ' (energía)' : '';
      return `${formatQuantity(input.quantity)}× ${displayName(input.codeName, data.items)}${energyTag}`;
    }).join(', ') || 'Sin materiales de entrada';
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
          <select class="select-control" data-recipe-output="${escapeHtml(choice.codeName)}" required>
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
      materialLayers.innerHTML = '';
      energySection.hidden = true;
      energyConsumption.innerHTML = '';
      productionDetails.hidden = true;
      return;
    }

    if (result.cycles.length > 0) {
      calculationStatus.className = 'calculation-status error';
      calculationStatus.textContent = `No se pudo completar el desglose porque hay una cadena de recetas circular: ${result.cycles.map(cycle => cycle.map(code => displayName(code, data.items)).join(' → ')).join('; ')}.`;
      materialLayers.innerHTML = '';
      energySection.hidden = true;
      energyConsumption.innerHTML = '';
      productionDetails.hidden = true;
      return;
    }

    calculationStatus.className = 'calculation-status';
    calculationStatus.textContent = result.ready
      ? 'Cada material aparece en una sola capa. Las tandas se redondean y el combustible de extracción se informa aparte.'
      : 'Elegí las recetas pendientes para completar el cálculo. Cada material aparece una sola vez y el combustible de extracción va aparte.';

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

    const ordinalNames = ['primarios', 'secundarios', 'terciarios', 'cuaternarios'];
    function layerTitle(depth) {
      return ordinalNames[depth - 1]
        ? `Materiales ${ordinalNames[depth - 1]}`
        : `Materiales de nivel ${depth}`;
    }

    materialLayers.innerHTML = [...result.materialLayers.entries()]
      .sort(([depthA], [depthB]) => depthA - depthB)
      .map(([depth, materials]) => `
        <section class="material-group">
          <h3>${layerTitle(depth)}</h3>
          <div class="materials-total">${renderMaterialRows(materials, 'No hay materiales en esta capa.')}</div>
        </section>
      `).join('');

    energySection.hidden = result.energyConsumption.size === 0;
    energyConsumption.innerHTML = renderMaterialRows(
      result.energyConsumption,
      'No se requiere combustible para extracción.'
    );

    productionDetails.hidden = result.steps.length === 0;
    productionSteps.innerHTML = `
      <ul class="production-steps">
        ${result.steps.map(step => {
          const itemName = displayName(step.codeName, data.items);
          const inputSummary = step.inputs.map(input =>
            `${formatQuantity(input.quantity)}× ${displayName(input.codeName, data.items)}`
          ).join(', ');
          const energySummary = step.energyInputs.map(input =>
            `${formatQuantity(input.quantity)}× ${displayName(input.codeName, data.items)}`
          ).join(', ');
          const surplus = step.surplus > 0 ? ` · sobran ${formatQuantity(step.surplus)}` : '';
          return `
            <li class="production-step">
              <strong>${escapeHtml(itemName)}:</strong> ${formatQuantity(step.quantity)} solicitados; ${formatQuantity(step.batches)} tanda(s) de ${escapeHtml(step.recipe.building || 'producción')} producen ${formatQuantity(step.produced)}${surplus}.
              <p>Insumos de esta etapa: ${escapeHtml(inputSummary || 'ninguno')}.</p>
              ${energySummary ? `<p>Consumo energético: ${escapeHtml(energySummary)}.</p>` : ''}
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
    closeItemOptions();
    quantityInput.value = '1';
    renderProject();
    recalculate();
  });

  itemSearch.addEventListener('focus', () => renderItemOptions(itemSearch.value));
  itemSearch.addEventListener('input', () => {
    itemSearch.setCustomValidity('');
    renderItemOptions(itemSearch.value);
  });
  itemSearch.addEventListener('blur', closeItemOptions);
  itemSearch.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (itemOptions.hidden) renderItemOptions(itemSearch.value);
      setActiveSuggestion(activeSuggestionIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (itemOptions.hidden) {
        renderItemOptions(itemSearch.value);
        setActiveSuggestion(visibleSuggestions.length - 1);
      } else {
        setActiveSuggestion(activeSuggestionIndex < 0 ? visibleSuggestions.length - 1 : activeSuggestionIndex - 1);
      }
    } else if (event.key === 'Enter' && !itemOptions.hidden && activeSuggestionIndex >= 0) {
      event.preventDefault();
      chooseItemSuggestion(visibleSuggestions[activeSuggestionIndex].label);
    } else if (event.key === 'Escape' && !itemOptions.hidden) {
      event.preventDefault();
      closeItemOptions();
    }
  });

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
