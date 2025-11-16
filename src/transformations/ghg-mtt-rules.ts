/**
 * MTT Rules for GHG Report Generation
 *
 * Defines MTT transformation rules for converting manufacturing data to GHG reports
 */

import { MTTProgram, MTTRule } from '../types/common';
import { GHGCalculator } from './ghg-calculator';

/**
 * Create MTT program for GHG report generation
 */
export function createGHGMTTProgram(): MTTProgram {
  const calculator = new GHGCalculator();

  const rules: MTTRule[] = [
    // Initial rule: process graph root
    {
      name: 'init',
      state: 'q0',
      inputPattern: {
        type: 'kind_pattern',
        kind: 'graph',
        childPatterns: [
          {
            type: 'variable_pattern',
            varName: 'nodes',
          },
        ],
      },
      parameters: [],
      outputTemplate: {
        type: 'variable_template',
        varName: 'nodes',
      },
    },

    // Process Facility node
    {
      name: 'process_facility',
      state: 'q0',
      inputPattern: {
        type: 'kind_pattern',
        kind: 'Facility',
      },
      parameters: [],
      outputTemplate: {
        type: 'node_template',
        kind: 'Facility',
        attrs: [
          {
            key: 'processed',
            value: { type: 'literal', value: true },
          },
        ],
      },
    },

    // Process EnergyConsumption node -> create Emission
    {
      name: 'energy_to_emission',
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
            key: 'source',
            value: { type: 'literal', value: 'energy_consumption' },
          },
        ],
      },
      condition: (bindings, params) => {
        const node = bindings.get('self');
        return node && node.kind === 'EnergyConsumption';
      },
    },
  ];

  return {
    rules,
    initialState: 'q0',
  };
}

/**
 * Create simplified MTT program for direct transformation
 */
export function createSimplifiedGHGProgram(): MTTProgram {
  return {
    initialState: 'transform',
    rules: [
      // Transform EnergyConsumption to Emission
      {
        name: 'transform_energy',
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
          type: 'node_template',
          kind: 'unchanged',
        },
      },
    ],
  };
}
