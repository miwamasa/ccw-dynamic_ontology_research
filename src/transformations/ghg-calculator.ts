/**
 * GHG (Greenhouse Gas) Emission Calculator
 *
 * Calculates CO2 emissions based on energy consumption and emission factors
 */

import { TreeNode } from '../types/common';

/**
 * Emission factors (kg-CO2 per unit)
 */
export const EMISSION_FACTORS = {
  electricity: 0.5, // kg-CO2/kWh
  natural_gas: 2.03, // kg-CO2/m³
  fuel_oil: 2.68, // kg-CO2/liter
  diesel: 2.68, // kg-CO2/liter
  gasoline: 2.31, // kg-CO2/liter
  lpg: 1.51, // kg-CO2/kg
  coal: 2.42, // kg-CO2/kg
};

/**
 * Scope classification
 */
export const SCOPE_CLASSIFICATION = {
  scope1: ['natural_gas', 'fuel_oil', 'diesel', 'gasoline', 'lpg', 'coal'],
  scope2: ['electricity'],
};

/**
 * GHG Calculator
 */
export class GHGCalculator {
  /**
   * Calculate CO2 emission from energy consumption
   */
  public calculateEmission(energyType: string, amount: number): number {
    const normalizedType = this.normalizeEnergyType(energyType);
    const factor = EMISSION_FACTORS[normalizedType as keyof typeof EMISSION_FACTORS] || 0;
    return amount * factor;
  }

  /**
   * Determine emission scope
   */
  public determineScope(energyType: string): number {
    const normalizedType = this.normalizeEnergyType(energyType);

    if (SCOPE_CLASSIFICATION.scope1.includes(normalizedType)) {
      return 1;
    } else if (SCOPE_CLASSIFICATION.scope2.includes(normalizedType)) {
      return 2;
    }

    return 1; // Default to Scope 1
  }

  /**
   * Normalize energy type name
   */
  private normalizeEnergyType(energyType: string): string {
    return energyType
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
  }

  /**
   * Get emission factor for energy type
   */
  public getEmissionFactor(energyType: string): number {
    const normalizedType = this.normalizeEnergyType(energyType);
    return EMISSION_FACTORS[normalizedType as keyof typeof EMISSION_FACTORS] || 0;
  }

  /**
   * Create emission tree node from energy consumption
   */
  public createEmissionNode(
    facilityId: string,
    energyType: string,
    amount: number,
    unit: string
  ): TreeNode {
    const emission = this.calculateEmission(energyType, amount);
    const scope = this.determineScope(energyType);
    const factor = this.getEmissionFactor(energyType);

    return {
      kind: 'Emission',
      attrs: [
        { key: 'facility_id', value: facilityId },
        { key: 'energy_type', value: energyType },
        { key: 'scope', value: scope },
        { key: 'co2_amount', value: Math.round(emission * 100) / 100 },
        { key: 'unit', value: 'kg-CO2' },
        { key: 'source_amount', value: amount },
        { key: 'source_unit', value: unit },
        { key: 'emission_factor', value: factor },
      ],
    };
  }

  /**
   * Aggregate emissions by scope
   */
  public aggregateByScope(emissionNodes: TreeNode[]): { [scope: number]: number } {
    const totals: { [scope: number]: number } = {};

    for (const node of emissionNodes) {
      if (node.kind === 'Emission') {
        const scope = node.attrs?.find(a => a.key === 'scope')?.value as number;
        const amount = node.attrs?.find(a => a.key === 'co2_amount')?.value as number;

        if (scope !== undefined && amount !== undefined) {
          totals[scope] = (totals[scope] || 0) + amount;
        }
      }
    }

    return totals;
  }

  /**
   * Create GHG report summary
   */
  public createReport(
    facilityId: string,
    emissionNodes: TreeNode[],
    year: number,
    month: number
  ): TreeNode {
    const byScope = this.aggregateByScope(emissionNodes);
    const totalEmissions = Object.values(byScope).reduce((sum, val) => sum + val, 0);

    return {
      kind: 'GHGReport',
      attrs: [
        { key: 'facility_id', value: facilityId },
        { key: 'year', value: year },
        { key: 'month', value: month },
        { key: 'total_scope1', value: Math.round((byScope[1] || 0) * 100) / 100 },
        { key: 'total_scope2', value: Math.round((byScope[2] || 0) * 100) / 100 },
        { key: 'total_emissions', value: Math.round(totalEmissions * 100) / 100 },
        { key: 'unit', value: 'kg-CO2' },
      ],
      children: emissionNodes,
    };
  }
}
