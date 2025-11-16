/**
 * Macro Tree Transducer Runtime Engine
 *
 * This module implements a parameterized tree transducer that can:
 * - Match tree patterns
 * - Apply transformation rules
 * - Support parameter passing and accumulation
 * - Handle multiple states
 */

import {
  TreeNode,
  TreePattern,
  TreeTemplate,
  MTTRule,
  MTTProgram,
  Expression,
} from '../types/common';

/**
 * Bindings map for pattern matching
 */
export type Bindings = Map<string, any>;

/**
 * MTT Runtime class
 */
export class MTTRuntime {
  private rules: Map<string, Map<string, MTTRule[]>> = new Map();

  constructor(program: MTTProgram) {
    this.loadProgram(program);
  }

  /**
   * Load MTT program and index rules by state and kind
   */
  private loadProgram(program: MTTProgram): void {
    for (const rule of program.rules) {
      if (!this.rules.has(rule.state)) {
        this.rules.set(rule.state, new Map());
      }
      const stateRules = this.rules.get(rule.state)!;

      // Extract the root kind from the input pattern
      const kind = this.extractKind(rule.inputPattern);
      if (!stateRules.has(kind)) {
        stateRules.set(kind, []);
      }
      stateRules.get(kind)!.push(rule);
    }
  }

  /**
   * Extract kind from pattern
   */
  private extractKind(pattern: TreePattern): string {
    if (pattern.type === 'kind_pattern') {
      return pattern.kind;
    }
    return '*'; // wildcard
  }

  /**
   * Transform a tree using the MTT
   * @param state Current state
   * @param tree Input tree
   * @param params Parameters passed to the transformation
   * @returns Transformed tree
   */
  public transform(state: string, tree: TreeNode, ...params: any[]): TreeNode {
    const stateRules = this.rules.get(state);
    if (!stateRules) {
      throw new Error(`No rules defined for state: ${state}`);
    }

    // Try to find matching rules for this tree's kind
    const candidateRules = [
      ...(stateRules.get(tree.kind) || []),
      ...(stateRules.get('*') || []),
    ];

    for (const rule of candidateRules) {
      const bindings = this.matchPattern(rule.inputPattern, tree);
      if (bindings) {
        // Check condition if present
        if (rule.condition && !rule.condition(bindings, params)) {
          continue;
        }

        // Apply the rule
        return this.applyTemplate(rule.outputTemplate, bindings, params, state);
      }
    }

    // No rule matched - return tree as-is (identity transformation)
    return tree;
  }

  /**
   * Match a pattern against a tree
   * @param pattern Pattern to match
   * @param tree Tree to match against
   * @returns Bindings if match succeeds, null otherwise
   */
  private matchPattern(pattern: TreePattern, tree: TreeNode): Bindings | null {
    const bindings: Bindings = new Map();

    if (this.matchPatternRecursive(pattern, tree, bindings)) {
      return bindings;
    }

    return null;
  }

  /**
   * Recursive pattern matching
   */
  private matchPatternRecursive(
    pattern: TreePattern,
    tree: TreeNode,
    bindings: Bindings
  ): boolean {
    switch (pattern.type) {
      case 'kind_pattern':
        // Match kind
        if (pattern.kind !== tree.kind) {
          return false;
        }

        // Match name if specified
        if (pattern.namePattern && pattern.namePattern !== tree.name) {
          return false;
        }

        // Match attributes if specified
        if (pattern.attrPatterns) {
          const treeAttrs = new Map(
            (tree.attrs || []).map(a => [a.key, a.value])
          );
          for (const [key, value] of Object.entries(pattern.attrPatterns)) {
            if (treeAttrs.get(key) !== value) {
              return false;
            }
          }
        }

        // Match children if specified
        if (pattern.childPatterns) {
          const treeChildren = tree.children || [];
          if (pattern.childPatterns.length !== treeChildren.length) {
            return false;
          }
          for (let i = 0; i < pattern.childPatterns.length; i++) {
            if (!this.matchPatternRecursive(
              pattern.childPatterns[i],
              treeChildren[i],
              bindings
            )) {
              return false;
            }
          }
        }

        return true;

      case 'variable_pattern':
        // Bind the entire tree to this variable
        bindings.set(pattern.varName, tree);
        return true;

      case 'wildcard':
        // Wildcard always matches
        return true;

      default:
        return false;
    }
  }

  /**
   * Apply a template to generate output tree
   */
  private applyTemplate(
    template: TreeTemplate,
    bindings: Bindings,
    params: any[],
    currentState: string
  ): TreeNode {
    switch (template.type) {
      case 'node_template':
        return {
          kind: template.kind,
          name: template.name ? this.evalExpression(template.name, bindings, params) : undefined,
          attrs: template.attrs?.map(a => ({
            key: a.key,
            value: this.evalExpression(a.value, bindings, params),
          })),
          children: template.children?.map(child =>
            this.applyTemplate(child, bindings, params, currentState)
          ),
        };

      case 'variable_template':
        // Return the bound tree
        const boundTree = bindings.get(template.varName);
        if (!boundTree) {
          throw new Error(`Unbound variable: ${template.varName}`);
        }
        // Recursively transform with current state
        return this.transform(currentState, boundTree, ...params);

      case 'recursive_call':
        // Recursive call to different state
        const child = bindings.get(template.childVar);
        if (!child) {
          throw new Error(`Unbound variable in recursive call: ${template.childVar}`);
        }
        const newParams = template.params.map(p => this.evalExpression(p, bindings, params));
        return this.transform(template.state, child, ...newParams);

      case 'list_template':
        // Flatten list of elements into children
        const elements = template.elements.map(elem =>
          this.applyTemplate(elem, bindings, params, currentState)
        );
        // Return a wrapper node
        return {
          kind: 'list',
          children: elements,
        };

      default:
        throw new Error(`Unknown template type: ${(template as any).type}`);
    }
  }

  /**
   * Evaluate an expression in the context of bindings and parameters
   */
  private evalExpression(expr: Expression, bindings: Bindings, params: any[]): any {
    switch (expr.type) {
      case 'literal':
        return expr.value;

      case 'variable':
        if (expr.name.startsWith('param')) {
          const index = parseInt(expr.name.substring(5), 10);
          return params[index];
        }
        const value = bindings.get(expr.name);
        if (value === undefined) {
          throw new Error(`Unbound variable: ${expr.name}`);
        }
        return value;

      case 'property_access':
        const obj = this.evalExpression(expr.object, bindings, params);
        if (typeof obj === 'object' && obj !== null) {
          if ('attrs' in obj) {
            const attr = obj.attrs?.find((a: any) => a.key === expr.property);
            return attr?.value;
          }
          return obj[expr.property];
        }
        return undefined;

      case 'function_call':
        const args = expr.arguments.map(arg => this.evalExpression(arg, bindings, params));
        return this.callFunction(expr.name, args);

      case 'binary':
        const left = this.evalExpression(expr.left, bindings, params);
        const right = this.evalExpression(expr.right, bindings, params);
        return this.evalBinaryOp(expr.operator, left, right);

      default:
        throw new Error(`Unknown expression type: ${(expr as any).type}`);
    }
  }

  /**
   * Call a built-in function
   */
  private callFunction(name: string, args: any[]): any {
    switch (name) {
      case 'concat':
        return args.join('');
      case 'upper':
        return String(args[0]).toUpperCase();
      case 'lower':
        return String(args[0]).toLowerCase();
      case 'sum':
        return args.reduce((a, b) => a + b, 0);
      default:
        throw new Error(`Unknown function: ${name}`);
    }
  }

  /**
   * Evaluate binary operation
   */
  private evalBinaryOp(op: string, left: any, right: any): any {
    switch (op) {
      case '==': return left === right;
      case '!=': return left !== right;
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      case 'and': return left && right;
      case 'or': return left || right;
      default:
        throw new Error(`Unknown operator: ${op}`);
    }
  }
}
