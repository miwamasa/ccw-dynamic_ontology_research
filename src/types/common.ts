/**
 * Common type definitions for the Dynamic Ontology Research project
 */

// ============================================================================
// Graph Types (LPG - Labeled Property Graph)
// ============================================================================

export type PropertyValue = string | number | boolean | null;

export interface Properties {
  [key: string]: PropertyValue;
}

export interface GraphNode {
  id: string;
  type: string;
  properties: Properties;
}

export interface GraphEdge {
  id: string;
  label: string;
  sourceId: string;
  targetId: string;
  properties: Properties;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ============================================================================
// Tree Types (for MTT)
// ============================================================================

export interface TreeNode {
  kind: string;
  name?: string;
  attrs?: Array<{ key: string; value: any }>;
  children?: TreeNode[];
}

export type TreeElement = TreeNode;

// ============================================================================
// DSL AST Types
// ============================================================================

export type DSLOperation =
  | MatchOperation
  | CreateNodeOperation
  | CreateEdgeOperation
  | SetPropertyOperation
  | CopyPropertyOperation
  | MapNodeTypeOperation
  | AggregateOperation
  | RemoveNodeOperation
  | RemoveEdgeOperation
  | AttachProvenanceOperation
  | ConditionalOperation
  | EmitOperation;

export interface MatchOperation {
  type: 'match';
  pattern: Pattern;
  variable: string;
  condition?: Expression;
  body: DSLOperation[];
}

export interface CreateNodeOperation {
  type: 'create_node';
  id: Expression;
  nodeType: string;
  properties: { [key: string]: Expression };
}

export interface CreateEdgeOperation {
  type: 'create_edge';
  source: Expression;
  target: Expression;
  label: string;
  properties?: { [key: string]: Expression };
}

export interface SetPropertyOperation {
  type: 'set_property';
  target: string;
  key: string;
  value: Expression;
}

export interface CopyPropertyOperation {
  type: 'copy_property';
  sourceVar: string;
  sourceKey: string;
  targetVar: string;
  targetKey: string;
}

export interface MapNodeTypeOperation {
  type: 'map_node_type';
  fromType: string;
  toType: string;
  propertyMappings: { [sourceKey: string]: string };
}

export interface AggregateOperation {
  type: 'aggregate';
  groupBy: Expression[];
  variable: string;
  function: AggregateFunction;
}

export interface RemoveNodeOperation {
  type: 'remove_node';
  id: Expression;
}

export interface RemoveEdgeOperation {
  type: 'remove_edge';
  id: Expression;
}

export interface AttachProvenanceOperation {
  type: 'attach_provenance';
  target: string;
  ruleId: string;
}

export interface ConditionalOperation {
  type: 'conditional';
  condition: Expression;
  thenOps: DSLOperation[];
  elseOps?: DSLOperation[];
}

export interface EmitOperation {
  type: 'emit';
  format: 'json' | 'tree';
  target: string;
}

// ============================================================================
// Pattern and Expression Types
// ============================================================================

export type Pattern =
  | NodePattern
  | EdgePattern
  | PathPattern
  | VariablePattern;

export interface NodePattern {
  type: 'node_pattern';
  variable?: string;
  nodeType?: string;
  properties?: { [key: string]: any };
}

export interface EdgePattern {
  type: 'edge_pattern';
  variable?: string;
  label?: string;
  source: Pattern;
  target: Pattern;
}

export interface PathPattern {
  type: 'path_pattern';
  elements: Pattern[];
}

export interface VariablePattern {
  type: 'variable_pattern';
  name: string;
}

export type Expression =
  | LiteralExpression
  | VariableExpression
  | PropertyAccessExpression
  | FunctionCallExpression
  | BinaryExpression;

export interface LiteralExpression {
  type: 'literal';
  value: PropertyValue;
}

export interface VariableExpression {
  type: 'variable';
  name: string;
}

export interface PropertyAccessExpression {
  type: 'property_access';
  object: Expression;
  property: string;
}

export interface FunctionCallExpression {
  type: 'function_call';
  name: string;
  arguments: Expression[];
}

export interface BinaryExpression {
  type: 'binary';
  operator: '==' | '!=' | '<' | '>' | '<=' | '>=' | '+' | '-' | '*' | '/' | 'and' | 'or';
  left: Expression;
  right: Expression;
}

export type AggregateFunction =
  | { kind: 'sum'; field: string }
  | { kind: 'count'; field?: string }
  | { kind: 'avg'; field: string }
  | { kind: 'min'; field: string }
  | { kind: 'max'; field: string };

// ============================================================================
// MTT Types
// ============================================================================

export interface MTTRule {
  name: string;
  state: string;
  inputPattern: TreePattern;
  parameters: string[];
  outputTemplate: TreeTemplate;
  condition?: (bindings: Map<string, any>, params: any[]) => boolean;
}

export type TreePattern =
  | KindPattern
  | VariableTreePattern
  | WildcardPattern;

export interface KindPattern {
  type: 'kind_pattern';
  kind: string;
  childPatterns?: TreePattern[];
  namePattern?: string;
  attrPatterns?: { [key: string]: any };
}

export interface VariableTreePattern {
  type: 'variable_pattern';
  varName: string;
}

export interface WildcardPattern {
  type: 'wildcard';
}

export type TreeTemplate =
  | NodeTemplate
  | VariableTemplate
  | RecursiveCallTemplate
  | ListTemplate;

export interface NodeTemplate {
  type: 'node_template';
  kind: string;
  name?: Expression;
  attrs?: Array<{ key: string; value: Expression }>;
  children?: TreeTemplate[];
}

export interface VariableTemplate {
  type: 'variable_template';
  varName: string;
}

export interface RecursiveCallTemplate {
  type: 'recursive_call';
  state: string;
  childVar: string;
  params: Expression[];
}

export interface ListTemplate {
  type: 'list_template';
  elements: TreeTemplate[];
}

export interface MTTProgram {
  rules: MTTRule[];
  initialState: string;
}

// ============================================================================
// Transformation Context
// ============================================================================

export interface TransformationContext {
  sourceGraph?: Graph;
  sourceTree?: TreeNode;
  metadata: {
    timestamp: string;
    ruleVersion: string;
    [key: string]: any;
  };
  provenance: ProvenanceEntry[];
}

export interface ProvenanceEntry {
  ruleId: string;
  timestamp: string;
  input: any;
  output: any;
  agent: string;
}
