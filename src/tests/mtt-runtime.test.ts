/**
 * MTT Runtime Tests
 */

import { MTTRuntime } from '../mtt/runtime';
import { MTTProgram, TreeNode } from '../types/common';

describe('MTT Runtime', () => {
  test('simple copy transformation', () => {
    // Define a simple copy MTT program
    const program: MTTProgram = {
      initialState: 'q',
      rules: [
        {
          name: 'copy_a',
          state: 'q',
          inputPattern: {
            type: 'kind_pattern',
            kind: 'a',
            childPatterns: [
              { type: 'variable_pattern', varName: 'x1' },
              { type: 'variable_pattern', varName: 'x2' },
            ],
          },
          parameters: [],
          outputTemplate: {
            type: 'node_template',
            kind: 'a',
            children: [
              { type: 'variable_template', varName: 'x1' },
              { type: 'variable_template', varName: 'x2' },
            ],
          },
        },
        {
          name: 'copy_e',
          state: 'q',
          inputPattern: {
            type: 'kind_pattern',
            kind: 'e',
          },
          parameters: [],
          outputTemplate: {
            type: 'node_template',
            kind: 'e',
          },
        },
      ],
    };

    const runtime = new MTTRuntime(program);

    const inputTree: TreeNode = {
      kind: 'a',
      children: [
        {
          kind: 'a',
          children: [
            { kind: 'e' },
            { kind: 'e' },
          ],
        },
        { kind: 'e' },
      ],
    };

    const outputTree = runtime.transform('q', inputTree);

    expect(outputTree.kind).toBe('a');
    expect(outputTree.children).toHaveLength(2);
    expect(outputTree.children![0].kind).toBe('a');
    expect(outputTree.children![1].kind).toBe('e');
  });

  test('parameterized transformation - simplified', () => {
    // Simplified parameterized transformation
    const program: MTTProgram = {
      initialState: 'q',
      rules: [
        {
          name: 'add_wrapper',
          state: 'q',
          inputPattern: {
            type: 'kind_pattern',
            kind: 'e',
          },
          parameters: ['label'],
          outputTemplate: {
            type: 'node_template',
            kind: 'wrapped',
            attrs: [
              {
                key: 'label',
                value: { type: 'variable', name: 'param0' },
              },
            ],
            children: [
              { type: 'node_template', kind: 'e' },
            ],
          },
        },
      ],
    };

    const runtime = new MTTRuntime(program);

    const inputTree: TreeNode = { kind: 'e' };
    const outputTree = runtime.transform('q', inputTree, 'test_label');

    expect(outputTree.kind).toBe('wrapped');
    expect(outputTree.attrs).toBeDefined();
    expect(outputTree.attrs![0].value).toBe('test_label');
    expect(outputTree.children).toHaveLength(1);
    expect(outputTree.children![0].kind).toBe('e');
  });
});
