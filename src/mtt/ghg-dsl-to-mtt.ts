/**
 * Enhanced DSL to MTT Compiler for GHG Transformation
 *
 * Compiles GHG-specific DSL operations to MTT rules
 */

import { MTTRule, MTTProgram, TreeNode } from '../types/common';
import { EMISSION_FACTORS, SCOPE_CLASSIFICATION } from '../transformations/ghg-calculator';

/**
 * GHG-specific DSL to MTT Compiler
 */
export class GHGDSLToMTTCompiler {
  private ruleCounter = 0;

  /**
   * Compile GHG transformation DSL to MTT program
   */
  public compile(dslDefinition: any): MTTProgram {
    const rules: MTTRule[] = [];

    // Create rules for energy to emission transformation
    rules.push(...this.createEnergyToEmissionRules(dslDefinition));

    // Create rules for aggregation (if specified)
    if (dslDefinition.transformations) {
      for (const transform of dslDefinition.transformations) {
        if (transform.name === 'aggregate_emissions') {
          rules.push(...this.createAggregationRules(transform));
        }
      }
    }

    return {
      rules,
      initialState: 'q0',
    };
  }

  /**
   * Create MTT rules for energy to emission transformation
   */
  private createEnergyToEmissionRules(dslDef: any): MTTRule[] {
    const rules: MTTRule[] = [];

    // Rule: Transform EnergyConsumption to Emission
    rules.push({
      name: 'transform_energy_to_emission',
      state: 'q0',
      inputPattern: {
        type: 'kind_pattern',
        kind: 'EnergyConsumption',
      },
      parameters: [],
      outputTemplate: {
        type: 'node_template',
        kind: 'Emission',
        attrs: [
          {
            key: 'transformed',
            value: { type: 'literal', value: true },
          },
        ],
      },
      condition: (bindings, params) => {
        const node = bindings.get('self');
        return node && node.kind === 'EnergyConsumption';
      },
    });

    // Rule: Calculate CO2 amount
    rules.push({
      name: 'calculate_co2',
      state: 'calculate',
      inputPattern: {
        type: 'kind_pattern',
        kind: 'EnergyConsumption',
      },
      parameters: [],
      outputTemplate: {
        type: 'node_template',
        kind: 'Emission',
        attrs: [],
      },
    });

    return rules;
  }

  /**
   * Create MTT rules for aggregation
   */
  private createAggregationRules(transform: any): MTTRule[] {
    const rules: MTTRule[] = [];

    // Rule: Aggregate by group
    rules.push({
      name: 'aggregate_by_facility',
      state: 'aggregate',
      inputPattern: {
        type: 'kind_pattern',
        kind: 'Emission',
      },
      parameters: ['accumulator'],
      outputTemplate: {
        type: 'node_template',
        kind: 'GHGReport',
        attrs: [],
      },
    });

    return rules;
  }

  /**
   * Create a simple MTT program that directly applies emission factors
   */
  public createDirectTransformProgram(): MTTProgram {
    const emissionFactors = EMISSION_FACTORS;
    const scopeClassification = SCOPE_CLASSIFICATION;

    return {
      initialState: 'transform',
      rules: [
        // Transform type_group(EnergyConsumption) nodes
        {
          name: 'transform_energy_group',
          state: 'transform',
          inputPattern: {
            type: 'kind_pattern',
            kind: 'type_group',
          },
          parameters: [],
          outputTemplate: {
            type: 'node_template',
            kind: 'emission_group',
            children: [
              {
                type: 'variable_template',
                varName: 'children',
              },
            ],
          },
          condition: (bindings, params) => {
            const node = bindings.get('self') as TreeNode;
            const typeAttr = node.attrs?.find(a => a.key === 'type');
            return typeAttr?.value === 'EnergyConsumption';
          },
        },

        // Transform individual EnergyConsumption nodes
        {
          name: 'transform_energy_node',
          state: 'transform',
          inputPattern: {
            type: 'kind_pattern',
            kind: 'EnergyConsumption',
          },
          parameters: [],
          outputTemplate: {
            type: 'node_template',
            kind: 'Emission',
          },
          condition: (bindings, params) => {
            const node = bindings.get('self') as TreeNode;
            return node.kind === 'EnergyConsumption';
          },
        },

        // Pass through other nodes
        {
          name: 'passthrough',
          state: 'transform',
          inputPattern: {
            type: 'wildcard',
          },
          parameters: [],
          outputTemplate: {
            type: 'variable_template',
            varName: 'self',
          },
        },
      ],
    };
  }
}
