/**
 * DSL to MTT Compiler
 *
 * Compiles DSL operations to MTT rules
 */

import {
  DSLOperation,
  MTTRule,
  MTTProgram,
  TreePattern,
  TreeTemplate,
  Expression,
  CreateNodeOperation,
  AggregateOperation,
  MatchOperation,
} from '../types/common';
import { DSLProgram } from '../dsl/parser';

/**
 * Compiler from DSL to MTT
 */
export class DSLToMTTCompiler {
  private ruleCounter = 0;
  private stateCounter = 0;

  /**
   * Compile DSL program to MTT program
   */
  public compile(dslProgram: DSLProgram): MTTProgram {
    const rules: MTTRule[] = [];

    // Create initial state rule
    rules.push(this.createInitialRule());

    // Compile each operation
    for (const operation of dslProgram.operations) {
      rules.push(...this.compileOperation(operation));
    }

    return {
      rules,
      initialState: 'q0',
    };
  }

  /**
   * Create initial state rule
   */
  private createInitialRule(): MTTRule {
    return {
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
        type: 'recursive_call',
        state: 'q',
        childVar: 'nodes',
        params: [],
      },
    };
  }

  /**
   * Compile a single DSL operation to MTT rules
   */
  private compileOperation(operation: DSLOperation): MTTRule[] {
    switch (operation.type) {
      case 'match':
        return this.compileMatch(operation);
      case 'create_node':
        return this.compileCreateNode(operation);
      case 'aggregate':
        return this.compileAggregate(operation);
      default:
        // For other operations, return empty array
        console.warn(`Unsupported operation type: ${operation.type}`);
        return [];
    }
  }

  /**
   * Compile match operation
   */
  private compileMatch(operation: MatchOperation): MTTRule[] {
    const rules: MTTRule[] = [];
    const state = this.newState();

    // Create pattern from DSL pattern
    const inputPattern = this.compileDSLPattern(operation.pattern);

    // Compile body operations
    const bodyRules: MTTRule[] = [];
    for (const bodyOp of operation.body) {
      bodyRules.push(...this.compileOperation(bodyOp));
    }

    // Create main match rule
    const rule: MTTRule = {
      name: `match_${operation.variable}`,
      state: 'q',
      inputPattern,
      parameters: [],
      outputTemplate: {
        type: 'node_template',
        kind: 'matched',
        children: bodyRules.map(r => ({
          type: 'recursive_call',
          state: r.state,
          childVar: operation.variable,
          params: [],
        })),
      },
    };

    rules.push(rule);
    rules.push(...bodyRules);

    return rules;
  }

  /**
   * Compile DSL pattern to tree pattern
   */
  private compileDSLPattern(pattern: any): TreePattern {
    if (pattern.type === 'node_pattern') {
      return {
        type: 'kind_pattern',
        kind: pattern.nodeType || 'node',
        namePattern: pattern.variable,
      };
    }

    return {
      type: 'wildcard',
    };
  }

  /**
   * Compile create node operation
   */
  private compileCreateNode(operation: CreateNodeOperation): MTTRule[] {
    const ruleName = `create_${operation.nodeType}_${this.ruleCounter++}`;
    const state = 'q';

    // Build property attributes from operation.properties
    const attrs: Array<{ key: string; value: Expression }> = [];
    for (const [key, valueExpr] of Object.entries(operation.properties)) {
      attrs.push({ key, value: valueExpr });
    }

    const rule: MTTRule = {
      name: ruleName,
      state,
      inputPattern: {
        type: 'wildcard',
      },
      parameters: [],
      outputTemplate: {
        type: 'node_template',
        kind: operation.nodeType,
        name: operation.id,
        attrs,
      },
    };

    return [rule];
  }

  /**
   * Compile aggregate operation to MTT rules
   *
   * Aggregation in MTT is implemented as a fold operation using parameters
   */
  private compileAggregate(operation: AggregateOperation): MTTRule[] {
    const rules: MTTRule[] = [];
    const state = this.newState();

    // Create aggregation rule with accumulator parameter
    const aggFunc = operation.function;

    // Rule for processing list
    const listRule: MTTRule = {
      name: `aggregate_${aggFunc.kind}_list`,
      state,
      inputPattern: {
        type: 'kind_pattern',
        kind: 'list',
        childPatterns: [
          {
            type: 'variable_pattern',
            varName: 'head',
          },
          {
            type: 'variable_pattern',
            varName: 'tail',
          },
        ],
      },
      parameters: ['accumulator'],
      outputTemplate: {
        type: 'recursive_call',
        state,
        childVar: 'tail',
        params: [this.createAggregateExpression(aggFunc, 'head', 'accumulator')],
      },
    };

    // Rule for empty list (base case)
    const emptyRule: MTTRule = {
      name: `aggregate_${aggFunc.kind}_empty`,
      state,
      inputPattern: {
        type: 'kind_pattern',
        kind: 'nil',
      },
      parameters: ['accumulator'],
      outputTemplate: {
        type: 'node_template',
        kind: 'result',
        attrs: [
          {
            key: 'value',
            value: { type: 'variable', name: 'param0' },
          },
        ],
      },
    };

    rules.push(listRule, emptyRule);
    return rules;
  }

  /**
   * Create aggregate expression based on function type
   */
  private createAggregateExpression(
    func: any,
    itemVar: string,
    accumulatorVar: string
  ): Expression {
    switch (func.kind) {
      case 'sum':
        return {
          type: 'binary',
          operator: '+',
          left: { type: 'variable', name: accumulatorVar },
          right: {
            type: 'property_access',
            object: { type: 'variable', name: itemVar },
            property: func.field,
          },
        };

      case 'count':
        return {
          type: 'binary',
          operator: '+',
          left: { type: 'variable', name: accumulatorVar },
          right: { type: 'literal', value: 1 },
        };

      default:
        return { type: 'variable', name: accumulatorVar };
    }
  }

  /**
   * Generate new state name
   */
  private newState(): string {
    return `q${this.stateCounter++}`;
  }
}
