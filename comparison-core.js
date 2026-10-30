(function (root, factory) {
  const comparisonCore = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = comparisonCore;
  if (root) root.FoxholeComparison = comparisonCore;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const higherIsBetter = new Set([
    'Agility', 'ArtilleryAccuracyMaxDist', 'BoostSpeedModifier', 'CoverProvided', 'Damage',
    'DamageMultiplier', 'DefaultSurfaceMovementRate', 'EngineForce', 'ExplosionRadius',
    'FuelCapacity', 'FuelTank', 'ItemHolderCapacity', 'MaxAmmo', 'MaxHealth', 'MaximumRange',
    'MaximumReachability', 'QuantityPerCrate', 'ResourcesPerBuildCycle', 'ReverseSpeedModifier',
    'RotationRate', 'StabilityGainRate', 'StoredItemCapacity', 'StructuralIntegrity',
    'Suppression', 'SuppressionMultiplier', 'TankArmour', 'tier'
  ]);

  const lowerIsBetter = new Set([
    'AccuracyRadius', 'ArtilleryAccuracyMinDist', 'BaselineApexHalfAngle', 'BoostGasUsageModifier',
    'CrateProductionTime', 'CrateRetrieveTime', 'Encumbrance', 'FuelConsumptionPerSecond', 'MaxApexHalfAngle',
    'MaxVehicleDeviationAngle', 'OffroadSnowPenalty', 'RepairCost', 'SingleRetrieveTime',
    'StabilityCostPerShot', 'SwimmingFuelConsumptionModifier', 'TankArmourMinPenetrationChance',
    'VehicleSubsystemDisableChances'
  ]);

  const techIdLabels = {
    ATGrenade: 'Granada antitanque',
    ATRifle: 'Fusil antitanque',
    ATRifleAssault: 'Fusil de asalto antitanque',
    ATRifleAutomatic: 'Fusil automático antitanque',
    Mortar: 'Mortero',
    RifleAutomatic: 'Fusil automático',
    RPG: 'Lanzacohetes RPG'
  };

  const techWordLabels = {
    Aircraft: 'aeronave',
    Ammo: 'munición',
    Assault: 'de asalto',
    Automatic: 'automático',
    Bomber: 'bombardero',
    Destroyer: 'destructor',
    Fighter: 'caza',
    Grenade: 'granada',
    Heavy: 'pesado',
    Light: 'ligero',
    MachineGun: 'ametralladora',
    Mine: 'mina',
    Mortar: 'mortero',
    Pistol: 'pistola',
    Rifle: 'fusil',
    RPG: 'RPG',
    Revolver: 'revólver',
    Scout: 'explorador',
    Ship: 'buque',
    Shotgun: 'escopeta',
    Smoke: 'humo',
    Sniper: 'francotirador',
    Tank: 'tanque',
    Torpedo: 'torpedo',
    Truck: 'camión',
    Uniform: 'uniforme'
  };

  function formatTechId(value) {
    const techCode = String(value ?? '').replace(/^ETechID::/, '').replace(/^Unlock/, '');
    if (!techCode || techCode === 'None') return 'No requiere tecnología';
    if (techIdLabels[techCode]) return `Desbloquea ${techIdLabels[techCode]}`;

    const antiTank = techCode.startsWith('AT') && techCode.length > 2;
    const code = antiTank ? techCode.slice(2) : techCode;
    const words = code
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(/\s+/)
      .map(word => techWordLabels[word] || word);
    if (antiTank) words.push('antitanque');
    const description = words.join(' ');
    return `Desbloquea ${description.charAt(0).toLocaleUpperCase('es-ES')}${description.slice(1)}`;
  }

  function isMaterialCost(propertyKey) {
    return propertyKey.includes('.CostPerCrate.') ||
      propertyKey.includes('.ResourceAmounts.') ||
      propertyKey.includes('.AltResourceAmounts.');
  }

  function getPropertyDirection(propertyKey) {
    if (isMaterialCost(propertyKey)) return 'lower';
    const field = propertyKey.split('.').at(-1);
    if (higherIsBetter.has(field)) return 'higher';
    if (lowerIsBetter.has(field)) return 'lower';
    return null;
  }

  function compareProperty(leftValue, rightValue, propertyKey) {
    const costProperty = isMaterialCost(propertyKey);
    const left = leftValue === undefined && costProperty ? 0 : leftValue;
    const right = rightValue === undefined && costProperty ? 0 : rightValue;

    if (left === undefined || right === undefined || left === null || right === null) {
      return { state: 'unavailable', winner: null, message: 'Sin dato' };
    }
    if (left === right) return { state: 'tie', winner: null, message: 'Empate' };
    if (typeof left !== 'number' || typeof right !== 'number') {
      return { state: 'neutral', winner: null, message: 'Sin ganador' };
    }

    const direction = getPropertyDirection(propertyKey);
    if (!direction) return { state: 'neutral', winner: null, message: 'Sin criterio' };

    const leftWins = direction === 'higher' ? left > right : left < right;
    return {
      state: leftWins ? 'left' : 'right',
      winner: leftWins ? 'left' : 'right',
      message: `Gana ${leftWins ? 'A' : 'B'}`
    };
  }

  function filterComparisonItems(comparisonItems, items, category, faction, type = '') {
    if (!category || !faction) return [];
    return Object.entries(comparisonItems)
      .filter(([codeName, comparison]) =>
        comparison.category === category &&
        (!type || comparison.type === type) &&
        (items[codeName]?.faction || 'Neutral') === faction
      )
      .map(([codeName]) => codeName);
  }

  return { compareProperty, filterComparisonItems, formatTechId, getPropertyDirection, isMaterialCost };
});
