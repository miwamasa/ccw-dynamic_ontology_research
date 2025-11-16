/**
 * Simple transformation example demonstrating DSL → MTT compilation
 */

import { DSLParser } from '../src/dsl/parser';
import { DSLToMTTCompiler } from '../src/mtt/dsl-to-mtt-compiler';
import { MTTRuntime } from '../src/mtt/runtime';
import { GraphToTreeEncoder } from '../src/mtt/graph-to-tree';
import { Graph, TreeNode } from '../src/types/common';

/**
 * Example: Transform facility energy data to emissions
 */
function example() {
  console.log('=== Simple Transformation Example ===\n');

  // Step 1: Create sample graph data
  const sampleGraph: Graph = {
    nodes: [
      {
        id: 'F001',
        type: 'Facility',
        properties: {
          name: '東京工場',
          location: '東京都',
        },
      },
      {
        id: 'E001',
        type: 'EnergyConsumption',
        properties: {
          facility_id: 'F001',
          energy_type: 'electricity',
          amount: 85000,
          unit: 'kWh',
        },
      },
      {
        id: 'E002',
        type: 'EnergyConsumption',
        properties: {
          facility_id: 'F001',
          energy_type: 'natural_gas',
          amount: 3000,
          unit: 'm3',
        },
      },
    ],
    edges: [
      {
        id: 'edge1',
        label: 'has_energy_consumption',
        sourceId: 'F001',
        targetId: 'E001',
        properties: {},
      },
      {
        id: 'edge2',
        label: 'has_energy_consumption',
        sourceId: 'F001',
        targetId: 'E002',
        properties: {},
      },
    ],
  };

  console.log('Sample Graph:');
  console.log(JSON.stringify(sampleGraph, null, 2));
  console.log('');

  // Step 2: Encode graph as tree
  const encoder = new GraphToTreeEncoder();
  const tree = encoder.encode(sampleGraph, 'canonical-root', 'F001');

  console.log('Encoded Tree:');
  console.log(JSON.stringify(tree, null, 2));
  console.log('');

  // Step 3: Parse transformation rules (simplified)
  const simpleDSL = `
metadata:
  name: "Simple Energy to Emission Transform"
  version: "1.0"

transformation_steps:
  - name: "transform_energy_to_emission"
    source: "energy_consumptions"
    substeps:
      - name: "create_emission"
        mapping:
          - target: "emission_type"
            source: "energy_type"
          - target: "co2_amount"
            calculation: "calculate_co2_emission"
`;

  // For now, create a simple MTT program manually
  const mttProgram = {
    initialState: 'q0',
    rules: [
      {
        name: 'process_facility',
        state: 'q0',
        inputPattern: {
          type: 'kind_pattern' as const,
          kind: 'Facility',
          childPatterns: [
            { type: 'variable_pattern' as const, varName: 'edges' },
          ],
        },
        parameters: [],
        outputTemplate: {
          type: 'node_template' as const,
          kind: 'EmissionReport',
          attrs: [
            {
              key: 'facility_id',
              value: { type: 'property_access' as const, object: { type: 'variable' as const, name: 'self' }, property: 'id' },
            },
          ],
          children: [
            { type: 'variable_template' as const, varName: 'edges' },
          ],
        },
      },
      {
        name: 'process_edge',
        state: 'q0',
        inputPattern: {
          type: 'kind_pattern' as const,
          kind: 'edge',
        },
        parameters: [],
        outputTemplate: {
          type: 'node_template' as const,
          kind: 'edge_processed',
        },
      },
    ],
  };

  // Step 4: Run MTT transformation
  const runtime = new MTTRuntime(mttProgram);
  const resultTree = runtime.transform('q0', tree);

  console.log('Transformed Tree:');
  console.log(JSON.stringify(resultTree, null, 2));
  console.log('');

  // Step 5: Decode back to graph if needed
  const resultGraph = encoder.decode(resultTree, 'canonical-root');

  console.log('Result Graph:');
  console.log(JSON.stringify(resultGraph, null, 2));
}

// Run example
if (require.main === module) {
  example();
}

export { example };
