/**
 * Graph to Tree Encoding
 *
 * Converts LPG (Labeled Property Graph) to tree representation for MTT processing
 */

import { Graph, GraphNode, GraphEdge, TreeNode } from '../types/common';

/**
 * Encoding policy for converting graphs to trees
 */
export type EncodingPolicy = 'star' | 'canonical-root' | 'nested';

/**
 * Graph to Tree encoder
 */
export class GraphToTreeEncoder {
  /**
   * Encode a graph as a tree
   * @param graph Input graph
   * @param policy Encoding policy
   * @param rootNodeId Optional root node ID (for canonical-root policy)
   * @returns Encoded tree
   */
  public encode(
    graph: Graph,
    policy: EncodingPolicy = 'star',
    rootNodeId?: string
  ): TreeNode {
    switch (policy) {
      case 'star':
        return this.encodeAsStar(graph);
      case 'canonical-root':
        return this.encodeAsCanonicalRoot(graph, rootNodeId);
      case 'nested':
        return this.encodeAsNested(graph, rootNodeId);
      default:
        throw new Error(`Unknown encoding policy: ${policy}`);
    }
  }

  /**
   * Star encoding: Each node becomes a tree node with its neighbors as children
   * The graph is represented as a forest of stars
   */
  private encodeAsStar(graph: Graph): TreeNode {
    const children: TreeNode[] = [];

    for (const node of graph.nodes) {
      const neighbors: TreeNode[] = [];

      // Find outgoing edges
      const outEdges = graph.edges.filter(e => e.sourceId === node.id);
      for (const edge of outEdges) {
        const targetNode = graph.nodes.find(n => n.id === edge.targetId);
        if (targetNode) {
          neighbors.push({
            kind: 'neighbor',
            attrs: [
              { key: 'label', value: edge.label },
              { key: 'target_id', value: targetNode.id },
              { key: 'target_type', value: targetNode.type },
            ],
            children: [this.encodeNode(targetNode)],
          });
        }
      }

      children.push({
        kind: node.type,
        name: node.id,
        attrs: Object.entries(node.properties).map(([key, value]) => ({
          key,
          value,
        })),
        children: neighbors.length > 0 ? neighbors : undefined,
      });
    }

    return {
      kind: 'graph',
      children,
    };
  }

  /**
   * Canonical root encoding: Choose a root node and encode from there
   */
  private encodeAsCanonicalRoot(graph: Graph, rootNodeId?: string): TreeNode {
    const visited = new Set<string>();
    let root: GraphNode | undefined;

    if (rootNodeId) {
      root = graph.nodes.find(n => n.id === rootNodeId);
    } else {
      // Choose a node with no incoming edges as root
      const nodeIds = new Set(graph.nodes.map(n => n.id));
      const targetIds = new Set(graph.edges.map(e => e.targetId));
      const rootCandidates = Array.from(nodeIds).filter(id => !targetIds.has(id));
      if (rootCandidates.length > 0) {
        root = graph.nodes.find(n => n.id === rootCandidates[0]);
      } else {
        // Fallback: use first node
        root = graph.nodes[0];
      }
    }

    if (!root) {
      throw new Error('Cannot find root node');
    }

    return this.encodeSubtree(root, graph, visited);
  }

  /**
   * Encode a subtree starting from a node
   */
  private encodeSubtree(
    node: GraphNode,
    graph: Graph,
    visited: Set<string>
  ): TreeNode {
    if (visited.has(node.id)) {
      // Circular reference - return a reference node
      return {
        kind: 'ref',
        attrs: [{ key: 'id', value: node.id }],
      };
    }

    visited.add(node.id);

    const children: TreeNode[] = [];

    // Find outgoing edges
    const outEdges = graph.edges.filter(e => e.sourceId === node.id);
    for (const edge of outEdges) {
      const targetNode = graph.nodes.find(n => n.id === edge.targetId);
      if (targetNode) {
        children.push({
          kind: 'edge',
          attrs: [{ key: 'label', value: edge.label }],
          children: [this.encodeSubtree(targetNode, graph, visited)],
        });
      }
    }

    return {
      kind: node.type,
      name: node.id,
      attrs: Object.entries(node.properties).map(([key, value]) => ({
        key,
        value,
      })),
      children: children.length > 0 ? children : undefined,
    };
  }

  /**
   * Nested encoding: Group by node types
   */
  private encodeAsNested(graph: Graph, rootNodeId?: string): TreeNode {
    const typeGroups = new Map<string, GraphNode[]>();

    for (const node of graph.nodes) {
      if (!typeGroups.has(node.type)) {
        typeGroups.set(node.type, []);
      }
      typeGroups.get(node.type)!.push(node);
    }

    const children: TreeNode[] = [];

    for (const [type, nodes] of typeGroups) {
      children.push({
        kind: 'type_group',
        attrs: [{ key: 'type', value: type }],
        children: nodes.map(n => this.encodeNode(n)),
      });
    }

    return {
      kind: 'graph',
      children,
    };
  }

  /**
   * Encode a single node
   */
  private encodeNode(node: GraphNode): TreeNode {
    return {
      kind: node.type,
      name: node.id,
      attrs: Object.entries(node.properties).map(([key, value]) => ({
        key,
        value,
      })),
    };
  }

  /**
   * Decode tree back to graph
   */
  public decode(tree: TreeNode, policy: EncodingPolicy = 'star'): Graph {
    switch (policy) {
      case 'star':
        return this.decodeFromStar(tree);
      case 'canonical-root':
        return this.decodeFromCanonicalRoot(tree);
      case 'nested':
        return this.decodeFromNested(tree);
      default:
        throw new Error(`Unknown decoding policy: ${policy}`);
    }
  }

  /**
   * Decode from star encoding
   */
  private decodeFromStar(tree: TreeNode): Graph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    if (tree.kind === 'graph' && tree.children) {
      for (const child of tree.children) {
        const nodeId = child.name || `node_${nodes.length}`;
        const properties: any = {};
        for (const attr of child.attrs || []) {
          properties[attr.key] = attr.value;
        }

        nodes.push({
          id: nodeId,
          type: child.kind,
          properties,
        });

        // Process neighbors
        if (child.children) {
          for (const neighbor of child.children) {
            if (neighbor.kind === 'neighbor') {
              const label = neighbor.attrs?.find(a => a.key === 'label')?.value as string;
              const targetId = neighbor.attrs?.find(a => a.key === 'target_id')?.value as string;

              edges.push({
                id: `edge_${edges.length}`,
                label: label || 'related',
                sourceId: nodeId,
                targetId,
                properties: {},
              });
            }
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Decode from canonical root encoding
   */
  private decodeFromCanonicalRoot(tree: TreeNode): Graph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();

    this.decodeSubtree(tree, nodes, edges, visited);

    return { nodes, edges };
  }

  /**
   * Decode a subtree
   */
  private decodeSubtree(
    tree: TreeNode,
    nodes: GraphNode[],
    edges: GraphEdge[],
    visited: Set<string>
  ): void {
    if (tree.kind === 'ref') {
      return; // Skip references
    }

    const nodeId = tree.name || `node_${nodes.length}`;

    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);

    const properties: any = {};
    for (const attr of tree.attrs || []) {
      properties[attr.key] = attr.value;
    }

    nodes.push({
      id: nodeId,
      type: tree.kind,
      properties,
    });

    // Process children (edges)
    if (tree.children) {
      for (const child of tree.children) {
        if (child.kind === 'edge') {
          const label = child.attrs?.find(a => a.key === 'label')?.value as string;
          const targetTree = child.children?.[0];

          if (targetTree) {
            const targetId = targetTree.name || `node_${nodes.length}`;

            edges.push({
              id: `edge_${edges.length}`,
              label: label || 'related',
              sourceId: nodeId,
              targetId,
              properties: {},
            });

            this.decodeSubtree(targetTree, nodes, edges, visited);
          }
        }
      }
    }
  }

  /**
   * Decode from nested encoding
   */
  private decodeFromNested(tree: TreeNode): Graph {
    const nodes: GraphNode[] = [];

    if (tree.kind === 'graph' && tree.children) {
      for (const typeGroup of tree.children) {
        if (typeGroup.kind === 'type_group' && typeGroup.children) {
          for (const nodeTree of typeGroup.children) {
            const nodeId = nodeTree.name || `node_${nodes.length}`;
            const properties: any = {};
            for (const attr of nodeTree.attrs || []) {
              properties[attr.key] = attr.value;
            }

            nodes.push({
              id: nodeId,
              type: nodeTree.kind,
              properties,
            });
          }
        }
      }
    }

    return { nodes, edges: [] };
  }
}
