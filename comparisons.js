(async function () {
  const categorySelect = document.getElementById('comparison-category');
  const selectionSection = document.getElementById('comparison-selection');
  const resultsSection = document.getElementById('comparison-results');
  const status = document.getElementById('comparison-status');
  const comparedItems = document.getElementById('compared-items');
  const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
  const { displayItemName, escapeHtml } = FoxholeUI;

  const panels = {
    left: {
      faction: document.getElementById('left-faction'),
      item: document.getElementById('left-item')
    },
    right: {
      faction: document.getElementById('right-faction'),
      item: document.getElementById('right-item')
    }
  };

  const categoryLabels = {
    HeavyAmmo: 'Munición pesada',
    HeavyArms: 'Armas pesadas',
    SmallArms: 'Armas pequeñas',
    Supplies: 'Suministros',
    Utility: 'Utilidad',
    Parts: 'Componentes',
    Uniforms: 'Uniformes',
    Medical: 'Médico',
    Other: 'Otros',
    Vehicles: 'Vehículos',
    Structures: 'Estructuras'
  };

  const propertyLabels = {
    Agility: 'Agilidad',
    AccuracyRadius: 'Radio de dispersión',
    ArmourType: 'Tipo de blindaje',
    ArtilleryAccuracyMaxDist: 'Alcance máximo de artillería',
    ArtilleryAccuracyMinDist: 'Distancia mínima de artillería',
    BaselineApexHalfAngle: 'Ángulo de dispersión base',
    ChassisName: 'Chasis',
    CoverProvided: 'Cobertura',
    CrateProductionTime: 'Tiempo de producción por caja',
    CrateRetrieveTime: 'Tiempo para retirar una caja',
    Damage: 'Daño',
    DamageFalloff: 'Caída de daño',
    DamageInnerRadius: 'Radio interno de daño',
    DamageMultiplier: 'Multiplicador de daño',
    DamageType: 'Tipo de daño',
    DefaultSurfaceMovementRate: 'Velocidad en superficie',
    DepthCuttoffForSwimDamage: 'Profundidad límite para daño por agua',
    Encumbrance: 'Carga',
    EngineForce: 'Fuerza del motor',
    EquipmentSlot: 'Ranura de equipo',
    EnvironmentImpactAmount: 'Impacto ambiental',
    ExplosionRadius: 'Radio de explosión',
    FuelCapacity: 'Capacidad de combustible',
    FuelConsumptionPerSecond: 'Consumo de combustible por segundo',
    FuelTank: 'Tanque de combustible',
    ItemHolderCapacity: 'Capacidad de carga',
    ItemProfileType: 'Tipo de perfil',
    MajorDamagePercent: 'Umbral de daño mayor',
    MaxAmmo: 'Munición máxima',
    MaxApexHalfAngle: 'Ángulo máximo de dispersión',
    MaxHealth: 'Salud máxima',
    MaximumRange: 'Alcance máximo',
    MaximumReachability: 'Alcance efectivo máximo',
    MaxVehicleDeviationAngle: 'Desviación máxima contra vehículos',
    MinorDamagePercent: 'Umbral de daño menor',
    OffroadSnowPenalty: 'Penalización en nieve',
    QuantityPerCrate: 'Unidades por caja',
    RepairCost: 'Coste de reparación',
    ResourcesPerBuildCycle: 'Recursos por ciclo de construcción',
    ReverseSpeedModifier: 'Velocidad marcha atrás',
    RotationRate: 'Velocidad de giro',
    ShippableType: 'Tipo de transporte',
    SingleRetrieveTime: 'Tiempo para retirar una unidad',
    SpeedSqrThreshold: 'Umbral de velocidad',
    StabilityCostPerShot: 'Coste de estabilidad por disparo',
    StabilityFloorFromMovement: 'Estabilidad mínima en movimiento',
    StabilityGainRate: 'Recuperación de estabilidad',
    StoredItemCapacity: 'Capacidad de almacenamiento',
    StructuralIntegrity: 'Integridad estructural',
    Suppression: 'Supresión',
    SuppressionMultiplier: 'Multiplicador de supresión',
    SwimmingFuelConsumptionModifier: 'Consumo de combustible al nadar',
    TankArmour: 'Blindaje de tanque',
    TankArmourMinPenetrationChance: 'Probabilidad mínima de penetración',
    TechID: 'Tecnología',
    VehicleBuildType: 'Tipo de fábrica',
    VehicleMovementProfileType: 'Perfil de movimiento',
    VehicleProfileType: 'Tipo de vehículo',
    VehicleSubsystemDisableChances: 'Probabilidad de deshabilitar subsistemas',
    bCanBeHarvested: 'Se puede recolectar',
    bCanUseStructures: 'Puede usar estructuras',
    bHasTierUpgrades: 'Tiene mejoras de nivel',
    bIsDamagedWhileDrivingOver: 'Recibe daño al pasar por encima',
    bIsVaultable: 'Se puede guardar'
  };

  function categoryLabel(category) {
    return categoryLabels[category] || category;
  }

  function propertyLabel(propertyKey, items) {
    const costMatch = propertyKey.match(/\.(CostPerCrate|ResourceAmounts|AltResourceAmounts)\.([^.]+)$/);
    if (costMatch) {
      const label = costMatch[1] === 'CostPerCrate' ? 'Coste por caja' : 'Coste de construcción';
      return `${label}: ${displayItemName(costMatch[2], items)}`;
    }

    const field = propertyKey.split('.').at(-1);
    return propertyLabels[field] || field
      .replace(/^b(?=[A-Z])/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  }

  function formatPropertyValue(value, propertyKey) {
    if (value === undefined || value === null || value === '') return '—';
    if (typeof value === 'number') return numberFormat.format(value);
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (propertyKey.endsWith('.TechID')) return FoxholeComparison.formatTechId(value);
    return String(value).replace(/^E[^:]+::/, '').replaceAll('_', ' ');
  }

  function renderValue(value, side, outcome, propertyKey) {
    const state = outcome.winner === side ? ' is-winner' : outcome.state === 'tie' ? ' is-tie' : '';
    const badge = outcome.winner === side
      ? '<span class="comparison-badge">Gana</span>'
      : outcome.state === 'tie'
        ? '<span class="comparison-badge comparison-badge-tie">Empate</span>'
        : '';
    return `<div class="comparison-value${state}"><span>${escapeHtml(formatPropertyValue(value, propertyKey))}</span>${badge}</div>`;
  }

  function renderComparisonPanel(item, side, panelLabel, rows) {
    const icon = item.iconFile
      ? `<img src="${escapeHtml(item.iconFile)}" alt="">`
      : '';
    const faction = item.faction || 'Neutral';
    return `
      <article class="comparison-item-panel">
        <header class="comparison-item-header">
          <span class="comparison-panel-label">Ítem ${panelLabel}</span>
          ${icon}
          <div><h3>${escapeHtml(item.displayName)}</h3><p>${escapeHtml(faction)}</p></div>
        </header>
        <div class="comparison-panel-properties">
          ${rows.map(row => `
            <div class="comparison-panel-property">
              <div class="comparison-property-name">
                <span>${escapeHtml(row.label)}</span>
                <small>${escapeHtml(row.outcome.message)}</small>
              </div>
              ${renderValue(row[side], side, row.outcome, row.key)}
            </div>
          `).join('')}
        </div>
      </article>
    `;
  }

  function renderComparison(leftCode, rightCode, data, comparisonData) {
    const leftItem = data.items[leftCode];
    const rightItem = data.items[rightCode];
    if (!leftItem || !rightItem) {
      resultsSection.hidden = true;
      return;
    }

    const leftProperties = comparisonData.items[leftCode]?.properties || {};
    const rightProperties = comparisonData.items[rightCode]?.properties || {};
    const rows = [
      { key: 'category', label: 'Categoría', left: categoryLabel(comparisonData.items[leftCode].category), right: categoryLabel(comparisonData.items[rightCode].category) },
      { key: 'faction', label: 'Facción', left: leftItem.faction || 'Neutral', right: rightItem.faction || 'Neutral' },
      { key: 'tier', label: 'Nivel tecnológico', left: leftItem.tier, right: rightItem.tier }
    ];

    const allPropertyKeys = [...new Set([
      ...Object.keys(leftProperties),
      ...Object.keys(rightProperties)
    ])].sort((a, b) => propertyLabel(a, data.items).localeCompare(propertyLabel(b, data.items)));

    for (const key of allPropertyKeys) {
      rows.push({
        key,
        label: propertyLabel(key, data.items),
        left: leftProperties[key],
        right: rightProperties[key]
      });
    }

    const comparedRows = rows.map(row => ({
      ...row,
      outcome: FoxholeComparison.compareProperty(row.left, row.right, row.key)
    }));
    comparedItems.innerHTML = `
      ${renderComparisonPanel(leftItem, 'left', 'A', comparedRows)}
      ${renderComparisonPanel(rightItem, 'right', 'B', comparedRows)}
    `;
    resultsSection.hidden = false;
  }

  function replaceOptions(select, options, placeholder, disabled = false) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    select.replaceChildren(placeholderOption);

    for (const optionData of options) {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.label;
      select.appendChild(option);
    }

    select.value = '';
    select.disabled = disabled || options.length === 0;
    ThemedDropdown.refresh(select);
  }

  function orderedFactions(factions) {
    const priority = ['Colonials', 'Wardens', 'Neutral'];
    return [...factions].sort((a, b) => {
      const aIndex = priority.indexOf(a);
      const bIndex = priority.indexOf(b);
      if (aIndex >= 0 || bIndex >= 0) {
        return (aIndex < 0 ? priority.length : aIndex) - (bIndex < 0 ? priority.length : bIndex);
      }
      return a.localeCompare(b);
    });
  }

  let data;
  let comparisonData;
  try {
    const [itemsResponse, comparisonResponse] = await Promise.all([
      fetch(`data/foxhole-data.json?v=${Date.now()}`),
      fetch(`data/comparison-data.json?v=${Date.now()}`)
    ]);
    if (!itemsResponse.ok) throw new Error(`Items data HTTP ${itemsResponse.status}`);
    if (!comparisonResponse.ok) throw new Error(`Comparison data HTTP ${comparisonResponse.status}`);
    [data, comparisonData] = await Promise.all([itemsResponse.json(), comparisonResponse.json()]);
  } catch (error) {
    status.textContent = 'No se pudieron cargar las propiedades para comparar.';
    status.classList.add('comparison-status-error');
    console.error(error);
    return;
  }

  const allSelects = [
    categorySelect,
    panels.left.faction,
    panels.left.item,
    panels.right.faction,
    panels.right.item
  ];
  for (const select of allSelects) ThemedDropdown.enhance(select);

  const categoryCounts = new Map();
  for (const comparison of Object.values(comparisonData.items)) {
    categoryCounts.set(comparison.category, (categoryCounts.get(comparison.category) || 0) + 1);
  }
  const categories = [...categoryCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([category]) => category)
    .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  replaceOptions(
    categorySelect,
    categories.map(category => ({ value: category, label: categoryLabel(category) })),
    'Seleccioná una categoría...'
  );
  status.textContent = 'Primero elegí la categoría que querés comparar.';

  function updatePanelItems(panel, category, requiredType = '', preserveSelection = false) {
    const faction = panel.faction.value;
    if (!category || !faction) {
      replaceOptions(panel.item, [], 'Seleccioná un ítem...', true);
      resultsSection.hidden = true;
      return;
    }

    const previousCode = preserveSelection ? panel.item.value : '';
    const candidates = FoxholeComparison.filterComparisonItems(
      comparisonData.items,
      data.items,
      category,
      faction,
      requiredType
    )
      .map(codeName => data.items[codeName])
      .filter(Boolean)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    const duplicateNames = new Map();
    for (const item of candidates) duplicateNames.set(item.displayName, (duplicateNames.get(item.displayName) || 0) + 1);
    replaceOptions(panel.item, candidates.map(item => ({
      value: item.codeName,
      label: duplicateNames.get(item.displayName) > 1
        ? `${item.displayName} — ${item.codeName}`
        : item.displayName
    })), 'Seleccioná un ítem...', candidates.length === 0);
    if (previousCode && candidates.some(item => item.codeName === previousCode)) {
      panel.item.value = previousCode;
      ThemedDropdown.refresh(panel.item);
    }
    resultsSection.hidden = true;
  }

  function renderSelectedComparison() {
    const leftCode = panels.left.item.value;
    const rightCode = panels.right.item.value;
    if (!leftCode || !rightCode) {
      resultsSection.hidden = true;
      status.textContent = leftCode || rightCode
        ? 'El otro panel solo ofrece ítems del mismo tipo.'
        : 'Elegí una facción y un ítem en cada panel para ver la comparación.';
      return;
    }
    status.textContent = `Comparando ${displayItemName(leftCode, data.items)} con ${displayItemName(rightCode, data.items)}.`;
    renderComparison(leftCode, rightCode, data, comparisonData);
  }

  categorySelect.addEventListener('change', () => {
    const category = categorySelect.value;
    selectionSection.hidden = !category;
    resultsSection.hidden = true;
    if (!category) return;

    const factions = orderedFactions(new Set(
      Object.entries(comparisonData.items)
        .filter(([, comparison]) => comparison.category === category)
        .map(([codeName]) => data.items[codeName]?.faction || 'Neutral')
    ));
    for (const panel of Object.values(panels)) {
      replaceOptions(panel.faction, factions.map(faction => ({ value: faction, label: faction })), 'Seleccioná una facción...');
      replaceOptions(panel.item, [], 'Seleccioná un ítem...', true);
    }
    status.textContent = `Categoría: ${categoryLabel(category)}. Elegí una facción y un ítem en cada panel.`;
  });

  for (const panel of Object.values(panels)) {
    panel.faction.addEventListener('change', () => {
      const otherPanel = panel === panels.left ? panels.right : panels.left;
      const otherItem = comparisonData.items[otherPanel.item.value];
      updatePanelItems(panel, categorySelect.value, otherItem?.type || '');
      renderSelectedComparison();
    });
    panel.item.addEventListener('change', () => {
      const otherPanel = panel === panels.left ? panels.right : panels.left;
      const selectedItem = comparisonData.items[panel.item.value];
      updatePanelItems(otherPanel, categorySelect.value, selectedItem?.type || '', true);
      renderSelectedComparison();
    });
  }
})();
