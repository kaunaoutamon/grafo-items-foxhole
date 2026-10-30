(async function () {
  const { displayItemName, escapeHtml } = FoxholeUI;
  const matrixEl = document.getElementById('matrix');
  const matrixContainer = document.getElementById('matrix-container');
  const itemInfoEl = document.getElementById('item-info');
  const searchInput = document.getElementById('search');
  const categorySelect = document.getElementById('category-filter');
  const factionSelect = document.getElementById('faction-filter');
  const clearBtn = document.getElementById('clear-selection');

  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = 'Cargando datos de Foxhole...';
  matrixContainer.appendChild(loading);

  let data;
  try {
    const res = await fetch(`data/foxhole-data.json?v=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    loading.textContent = 'Error al cargar los datos. Verifica la conexión e intenta nuevamente.';
    console.error(err);
    return;
  }

  const items = data.items;
  const recipes = data.recipes;

  const relations = Object.create(null);
  const outputs = new Set();
  const recipesByOutput = new Map();
  const recipesByInput = new Map();

  // Indexar recetas una vez para renderizar relaciones y detalles sin volver a recorrerlas.
  for (const recipe of recipes) {
    outputs.add(recipe.output);
    if (!recipesByOutput.has(recipe.output)) recipesByOutput.set(recipe.output, []);
    recipesByOutput.get(recipe.output).push(recipe);

    if (!relations[recipe.output]) relations[recipe.output] = Object.create(null);
    const indexedInputs = new Set();
    for (const input of recipe.inputs) {
      const existing = relations[recipe.output][input.codeName];
      if (!existing || input.quantity < existing.quantity) {
        relations[recipe.output][input.codeName] = {
          quantity: input.quantity,
          building: recipe.building
        };
      }

      if (indexedInputs.has(input.codeName)) continue;
      indexedInputs.add(input.codeName);
      if (!recipesByInput.has(input.codeName)) recipesByInput.set(input.codeName, []);
      recipesByInput.get(input.codeName).push(recipe);
    }
  }

  const allItems = Object.values(items);
  const categories = [...new Set(allItems.map(i => i.category))].sort();

  // Llenar filtro de categorías
  for (const cat of categories) {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    categorySelect.appendChild(option);
  }

  ThemedDropdown.enhance(categorySelect);
  ThemedDropdown.enhance(factionSelect);

  function sortItems(itemList) {
    return itemList.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.displayName.localeCompare(b.displayName);
    });
  }

  function matchesFaction(item, faction) {
    if (!faction) return true;
    return !item.faction || item.faction === 'Neutral' || item.faction === faction;
  }

  function getRowItems(filterCategory = '', searchTerm = '', filterFaction = '') {
    let list = allItems.filter(i => outputs.has(i.codeName));
    if (filterCategory) list = list.filter(i => i.category === filterCategory);
    if (filterFaction) list = list.filter(i => matchesFaction(i, filterFaction));
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(i =>
        i.displayName.toLowerCase().includes(term) ||
        i.codeName.toLowerCase().includes(term)
      );
    }
    return sortItems(list);
  }

  function getColItems(rowItems, filterFaction = '') {
    const usedInputs = new Set();
    for (const row of rowItems) {
      const rels = relations[row.codeName] || {};
      for (const inputCode in rels) usedInputs.add(inputCode);
    }
    return sortItems(allItems.filter(i => usedInputs.has(i.codeName) && matchesFaction(i, filterFaction)));
  }

  function renderMatrix() {
    const filterCategory = categorySelect.value;
    const searchTerm = searchInput.value.trim();
    const filterFaction = factionSelect.value;
    const rowItems = getRowItems(filterCategory, searchTerm, filterFaction);
    const colItems = getColItems(rowItems, filterFaction);

    if (rowItems.length === 0) {
      matrixEl.innerHTML = '<div class="empty-state">Ningún ítem coincide con los filtros.</div>';
      return;
    }

    const table = document.createElement('table');

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'row-header';
    corner.textContent = `${rowItems.length} ítems`;
    headerRow.appendChild(corner);

    for (const col of colItems) {
      const th = document.createElement('th');
      th.className = 'col-header';
      th.dataset.code = col.codeName;
      th.innerHTML = `
        ${col.iconFile ? `<img class="col-icon" src="${col.iconFile}" alt="" title="${escapeHtml(col.displayName)}">` : `<span class="col-icon" title="${escapeHtml(col.displayName)}">?</span>`}
      `;
      th.addEventListener('click', () => highlightColumn(col.codeName));
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    let lastTier = null;

    for (const row of rowItems) {
      if (lastTier !== null && row.tier !== lastTier) {
        const sep = document.createElement('tr');
        sep.className = 'tier-separator';
        const sepCell = document.createElement('td');
        sepCell.colSpan = colItems.length + 1;
        sep.appendChild(sepCell);
        tbody.appendChild(sep);
      }
      lastTier = row.tier;

      const tr = document.createElement('tr');
      tr.dataset.code = row.codeName;

      const th = document.createElement('td');
      th.className = 'row-header';
      th.innerHTML = `
        ${row.iconFile ? `<img class="row-icon" src="${row.iconFile}" alt="">` : ''}
        <span title="${escapeHtml(row.description)}">${escapeHtml(row.displayName)}</span>
        <span class="muted-text tier-label" title="Nivel ${row.tier}">T${row.tier}</span>
      `;
      th.addEventListener('click', () => showItemDetails(row.codeName));
      tr.appendChild(th);

      const rowRelations = relations[row.codeName] || {};
      for (const col of colItems) {
        const td = document.createElement('td');
        td.dataset.row = row.codeName;
        td.dataset.col = col.codeName;
        const rel = rowRelations[col.codeName];
        if (rel) {
          td.className = 'has-relation';
          td.innerHTML = '<span class="cell-dot"></span>';
          td.title = `${escapeHtml(row.displayName)} necesita ${rel.quantity}× ${escapeHtml(col.displayName)} (${rel.building})`;
          td.addEventListener('click', () => showRelationDetails(row.codeName, col.codeName));
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    matrixEl.innerHTML = '';
    matrixEl.appendChild(table);
  }

  function highlightColumn(colCode) {
    matrixEl.querySelectorAll('td').forEach(td => td.classList.remove('highlighted-col'));
    matrixEl.querySelectorAll(`td[data-col="${colCode}"]`).forEach(td => td.classList.add('highlighted-col'));
    showInputDetails(colCode);
  }

  function renderItemHeader(item, subtitle) {
    return `
      <div class="item-header">
        ${item.iconFile ? `<img src="${escapeHtml(item.iconFile)}" alt="">` : ''}
        <div>
          <h2>${escapeHtml(item.displayName)}</h2>
          <div class="item-meta">${escapeHtml(subtitle)}</div>
        </div>
      </div>
    `;
  }

  function getRecipesUsing(codeName) {
    return recipesByInput.get(codeName) || [];
  }

  function showItemDetails(codeName) {
    const item = items[codeName];
    if (!item) return;

    const outputRecipes = recipesByOutput.get(codeName) || [];
    const inputRecipes = getRecipesUsing(codeName);

    let html = `
      ${renderItemHeader(item, `${item.category} · Nivel ${item.tier}`)}
      <p>${escapeHtml(item.description)}</p>
    `;

    if (outputRecipes.length > 0) {
      html += '<h3>Se produce en</h3>';
      for (const r of outputRecipes.slice(0, 20)) {
        html += `
          <div class="recipe">
            <h4>${escapeHtml(r.building)}</h4>
            <ul>
              ${r.inputs.map(i => `<li>${i.quantity}× ${escapeHtml(displayItemName(i.codeName, items))}</li>`).join('')}
            </ul>
          </div>
        `;
      }
      if (outputRecipes.length > 20) {
        html += `<p class="muted-small">...y ${outputRecipes.length - 20} recetas más.</p>`;
      }
    }

    if (inputRecipes.length > 0) {
      html += '<h3>Se usa en</h3><ul>';
      for (const r of inputRecipes.slice(0, 40)) {
        html += `<li>${escapeHtml(displayItemName(r.output, items))} <span class="muted-text">(${escapeHtml(r.building)})</span></li>`;
      }
      if (inputRecipes.length > 40) {
        html += `<li class="muted-text">...y ${inputRecipes.length - 40} más.</li>`;
      }
      html += '</ul>';
    }

    itemInfoEl.innerHTML = html;
  }

  function showInputDetails(codeName) {
    const item = items[codeName];
    if (!item) return;
    const usedBy = getRecipesUsing(codeName);

    let html = `
      ${renderItemHeader(item, `${item.category} · Material de entrada`)}
      <p>${escapeHtml(item.description)}</p>
      <h3>Se usa en ${usedBy.length} recetas</h3>
      <ul>
        ${usedBy.slice(0, 50).map(r => {
          const input = r.inputs.find(i => i.codeName === codeName);
          return `<li>${input?.quantity || ''}× ${escapeHtml(displayItemName(r.output, items))} <span class="muted-text">(${escapeHtml(r.building)})</span></li>`;
        }).join('')}
      </ul>
    `;
    if (usedBy.length > 50) {
      html += `<p class="muted-small">...y ${usedBy.length - 50} más.</p>`;
    }
    itemInfoEl.innerHTML = html;
  }

  function showRelationDetails(outputCode, inputCode) {
    const outputItem = items[outputCode];
    const inputItem = items[inputCode];
    const relevant = (recipesByOutput.get(outputCode) || [])
      .filter(recipe => recipe.inputs.some(input => input.codeName === inputCode));

    let html = `
      ${renderItemHeader(outputItem, `${outputItem.category} · Nivel ${outputItem.tier}`)}
      <h3>Necesita ${escapeHtml(inputItem.displayName)}</h3>
    `;

    for (const r of relevant) {
      const inp = r.inputs.find(i => i.codeName === inputCode);
      html += `
        <div class="recipe">
          <h4>${escapeHtml(r.building)}</h4>
          <p>${inp.quantity}× ${escapeHtml(inputItem.displayName)}</p>
        </div>
      `;
    }

    itemInfoEl.innerHTML = html;
  }

  function clearSelection() {
    matrixEl.querySelectorAll('.highlighted-col').forEach(td => td.classList.remove('highlighted-col'));
    itemInfoEl.innerHTML = '<p>Haz clic en una fila o celda para ver los detalles.</p>';
    searchInput.value = '';
    categorySelect.value = '';
    factionSelect.value = '';
    ThemedDropdown.refresh(categorySelect);
    ThemedDropdown.refresh(factionSelect);
    renderMatrix();
  }

  searchInput.addEventListener('input', () => renderMatrix());
  categorySelect.addEventListener('change', () => renderMatrix());
  factionSelect.addEventListener('change', () => renderMatrix());
  clearBtn.addEventListener('click', clearSelection);

  loading.remove();
  renderMatrix();
})();
