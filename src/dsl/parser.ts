/**
 * DSL Parser
 *
 * Parses YAML-based transformation rules into DSL AST
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import {
  DSLOperation,
  Expression,
  Pattern,
  AggregateFunction,
  MatchOperation,
  CreateNodeOperation,
  CreateEdgeOperation,
  AggregateOperation,
  SetPropertyOperation,
} from '../types/common';

export interface DSLProgram {
  metadata: {
    name: string;
    version: string;
    sourceOntology: string;
    targetOntology: string;
    description: string;
  };
  constants: {
    [key: string]: any;
  };
  operations: DSLOperation[];
}

/**
 * Parse YAML transformation rules into DSL AST
 */
export class DSLParser {
  /**
   * Parse transformation rules from YAML file
   */
  public parseFile(filePath: string): DSLProgram {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parseYAML(content);
  }

  /**
   * Parse transformation rules from YAML string
   */
  public parseYAML(yamlContent: string): DSLProgram {
    const doc = yaml.load(yamlContent) as any;

    return {
      metadata: this.parseMetadata(doc.metadata || {}),
      constants: doc.constants || {},
      operations: this.parseTransformationSteps(
        doc.transformation_steps || [],
        doc.constants || {}
      ),
    };
  }

  /**
   * Parse metadata section
   */
  private parseMetadata(metadata: any): DSLProgram['metadata'] {
    return {
      name: metadata.name || 'Unnamed',
      version: metadata.version || '1.0',
      sourceOntology: metadata.source_ontology || '',
      targetOntology: metadata.target_ontology || '',
      description: metadata.description || '',
    };
  }

  /**
   * Parse transformation steps
   */
  private parseTransformationSteps(
    steps: any[],
    constants: any
  ): DSLOperation[] {
    const operations: DSLOperation[] = [];

    for (const step of steps) {
      operations.push(...this.parseTransformationStep(step, constants));
    }

    return operations;
  }

  /**
   * Parse a single transformation step
   */
  private parseTransformationStep(
    step: any,
    constants: any
  ): DSLOperation[] {
    const operations: DSLOperation[] = [];

    switch (step.name) {
      case 'transform_activities_to_emissions':
        operations.push(...this.parseActivityToEmissionTransform(step, constants));
        break;

      case 'calculate_aggregations':
        operations.push(...this.parseAggregations(step, constants));
        break;

      case 'generate_report_metadata':
        operations.push(...this.parseReportMetadata(step, constants));
        break;

      default:
        // Generic step parsing
        if (step.substeps) {
          for (const substep of step.substeps) {
            operations.push(...this.parseTransformationStep(substep, constants));
          }
        }
    }

    return operations;
  }

  /**
   * Parse activity to emission transformation
   */
  private parseActivityToEmissionTransform(
    step: any,
    constants: any
  ): DSLOperation[] {
    const operations: DSLOperation[] = [];

    // Create a match operation for manufacturing activities
    const matchOp: MatchOperation = {
      type: 'match',
      pattern: {
        type: 'node_pattern',
        variable: 'activity',
        nodeType: 'ManufacturingActivity',
      },
      variable: 'activity',
      body: [],
    };

    // For each energy consumption, create emission node
    if (step.substeps) {
      for (const substep of step.substeps) {
        if (substep.name === 'transform_energy_to_emission' && substep.mapping) {
          matchOp.body.push(...this.parseMappings(substep.mapping, constants));
        }
      }
    }

    operations.push(matchOp);
    return operations;
  }

  /**
   * Parse mapping rules into operations
   */
  private parseMappings(
    mappings: any[],
    constants: any
  ): DSLOperation[] {
    const operations: DSLOperation[] = [];

    for (const mapping of mappings) {
      if (mapping.target === '@type') {
        // Type determination - create node operation
        const createOp: CreateNodeOperation = {
          type: 'create_node',
          id: { type: 'variable', name: 'emission_id' },
          nodeType: 'Emission',
          properties: {},
        };
        operations.push(createOp);
      } else if (mapping.calculation) {
        // Calculation rule - create property with calculation
        const setOp: SetPropertyOperation = {
          type: 'set_property',
          target: 'emission',
          key: mapping.target,
          value: this.parseCalculation(mapping.calculation, constants),
        };
        operations.push(setOp);
      } else if (mapping.source) {
        // Direct mapping
        const setOp: SetPropertyOperation = {
          type: 'set_property',
          target: 'emission',
          key: mapping.target,
          value: this.parseExpression(mapping.source),
        };
        operations.push(setOp);
      }
    }

    return operations;
  }

  /**
   * Parse calculation expression
   */
  private parseCalculation(calculation: string, constants: any): Expression {
    // Look up calculation rule in constants or inline
    if (calculation === 'calculate_co2_emission') {
      return {
        type: 'binary',
        operator: '*',
        left: { type: 'property_access', object: { type: 'variable', name: 'energy' }, property: 'amount' },
        right: { type: 'variable', name: 'emission_factor' },
      };
    } else if (calculation === 'determine_scope') {
      // Return scope determination logic
      return { type: 'literal', value: 1 }; // Simplified
    }

    return { type: 'literal', value: null };
  }

  /**
   * Parse aggregation operations
   */
  private parseAggregations(
    step: any,
    constants: any
  ): DSLOperation[] {
    const operations: DSLOperation[] = [];

    if (step.aggregations) {
      for (const agg of step.aggregations) {
        const aggOp: AggregateOperation = {
          type: 'aggregate',
          groupBy: [],
          variable: agg.target,
          function: this.parseAggregateFunction(agg),
        };
        operations.push(aggOp);
      }
    }

    return operations;
  }

  /**
   * Parse aggregate function
   */
  private parseAggregateFunction(agg: any): AggregateFunction {
    const funcName = agg.aggregate?.function || 'sum';
    const field = agg.aggregate?.field || 'value';

    switch (funcName) {
      case 'sum':
        return { kind: 'sum', field };
      case 'count':
        return { kind: 'count', field };
      case 'avg':
        return { kind: 'avg', field };
      case 'min':
        return { kind: 'min', field };
      case 'max':
        return { kind: 'max', field };
      default:
        return { kind: 'sum', field };
    }
  }

  /**
   * Parse report metadata generation
   */
  private parseReportMetadata(
    step: any,
    constants: any
  ): DSLOperation[] {
    const operations: DSLOperation[] = [];

    // Generate report metadata operations
    if (step.mappings) {
      for (const mapping of step.mappings) {
        const setOp: SetPropertyOperation = {
          type: 'set_property',
          target: 'report',
          key: mapping.target,
          value: this.parseExpression(mapping.calculation || mapping.function),
        };
        operations.push(setOp);
      }
    }

    return operations;
  }

  /**
   * Parse expression from string or object
   */
  private parseExpression(expr: any): Expression {
    if (typeof expr === 'string') {
      // Simple string expression - could be variable or path
      if (expr.startsWith('$.')) {
        // JSON path notation
        const parts = expr.substring(2).split('.');
        let current: Expression = { type: 'variable', name: parts[0] };
        for (let i = 1; i < parts.length; i++) {
          current = {
            type: 'property_access',
            object: current,
            property: parts[i],
          };
        }
        return current;
      } else if (expr === 'current_date') {
        return {
          type: 'function_call',
          name: 'current_date',
          arguments: [],
        };
      } else {
        return { type: 'variable', name: expr };
      }
    } else if (typeof expr === 'number') {
      return { type: 'literal', value: expr };
    } else if (typeof expr === 'boolean') {
      return { type: 'literal', value: expr };
    }

    return { type: 'literal', value: null };
  }
}
