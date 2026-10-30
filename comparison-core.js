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

  return { compareProperty, getPropertyDirection, isMaterialCost };
});
