/**
 * CSV to Graph Converter
 *
 * Converts CSV data to LPG (Labeled Property Graph)
 */

import { Graph, GraphNode, GraphEdge } from '../types/common';
import { CSVRow } from './csv-loader';

export interface ConversionSchema {
  nodeType: string;
  idField: string;
  propertyFields: string[];
  edges?: EdgeSchema[];
}

export interface EdgeSchema {
  label: string;
  sourceField: string;
  targetNodeType: string;
  targetField: string;
}

/**
 * CSV to Graph Converter
 */
export class CSVToGraphConverter {
  private nodeCounter = 0;
  private edgeCounter = 0;

  /**
   * Convert CSV rows to graph nodes
   */
  public convertToNodes(
    rows: CSVRow[],
    schema: ConversionSchema
  ): GraphNode[] {
    const nodes: GraphNode[] = [];

    for (const row of rows) {
      const id = String(row[schema.idField] || `${schema.nodeType}_${this.nodeCounter++}`);
      const properties: { [key: string]: any } = {};

      for (const field of schema.propertyFields) {
        if (row[field] !== undefined) {
          properties[field] = row[field];
        }
      }

      nodes.push({
        id,
        type: schema.nodeType,
        properties,
      });
    }

    return nodes;
  }

  /**
   * Create edges based on schema
   */
  public createEdges(
    sourceNodes: GraphNode[],
    targetNodes: GraphNode[],
    edgeSchema: EdgeSchema
  ): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const targetMap = new Map(targetNodes.map(n => [n.properties[edgeSchema.targetField], n.id]));

    for (const sourceNode of sourceNodes) {
      const sourceFieldValue = sourceNode.properties[edgeSchema.sourceField];
      if (sourceFieldValue !== undefined) {
        const targetId = targetMap.get(sourceFieldValue);
        if (targetId) {
          edges.push({
            id: `edge_${this.edgeCounter++}`,
            label: edgeSchema.label,
            sourceId: sourceNode.id,
            targetId,
            properties: {},
          });
        }
      }
    }

    return edges;
  }

  /**
   * Convert multiple CSV datasets to a unified graph
   */
  public convertMultipleToGraph(
    datasets: { [name: string]: CSVRow[] },
    schemas: { [name: string]: ConversionSchema }
  ): Graph {
    const allNodes: GraphNode[] = [];
    const allEdges: GraphEdge[] = [];
    const nodesByType = new Map<string, GraphNode[]>();

    // First pass: create all nodes
    for (const [datasetName, rows] of Object.entries(datasets)) {
      const schema = schemas[datasetName];
      if (schema) {
        const nodes = this.convertToNodes(rows, schema);
        allNodes.push(...nodes);
        nodesByType.set(schema.nodeType, nodes);
      }
    }

    // Second pass: create edges
    for (const [datasetName, rows] of Object.entries(datasets)) {
      const schema = schemas[datasetName];
      if (schema && schema.edges) {
        const sourceNodes = nodesByType.get(schema.nodeType) || [];

        for (const edgeSchema of schema.edges) {
          const targetNodes = nodesByType.get(edgeSchema.targetNodeType) || [];
          const edges = this.createEdges(sourceNodes, targetNodes, edgeSchema);
          allEdges.push(...edges);
        }
      }
    }

    return {
      nodes: allNodes,
      edges: allEdges,
    };
  }
}
