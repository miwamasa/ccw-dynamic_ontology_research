# DSL ↔ MTT Research Pack

**Contents**
- A. DSL minimum specification (operations, semantics, pre/postconditions)
- B. DSL → MTT sample compiler (pseudocode) + example mappings
- C. Differential test suite: input CSV samples and expected outputs (JSON) for GHG scenario
- D. Paper / report outline + experiment plan and evaluation metrics

---

# A. DSL minimum specification

This section defines a compact DSL for Dynamic Ontology operations on an LPG, intended to be the single authoring surface that can compile to Cypher (graph execution) and to MTT rules (tree transformation).

## Design goals
- Small set of orthogonal primitives
- Clear pre/post-conditions to enable automated verification
- Captures both structural edits (nodes/edges/types) and data transforms (property mapping, aggregation)
- Track provenance (rule id, timestamp)

## Core types
- `NodeType` — ontology concept name (string)
- `NodeId` — unique identifier (string)
- `EdgeLabel` — relation name (string)
- `PropKey` / `PropValue` — property key/value
- `Pattern` — pattern to match nodes/edges (simple named-variable pattern)

## Primitives (syntax sketches)

1. `match pat as P where <cond> ->`  (pattern binding)
   - Semantic: bind a set of graph elements matching `pat` to variable `P` for use in subsequent ops.
   - Pre: graph exists; pattern valid
   - Post: variable binding available

2. `create_node id=ID type=T props={k:v,...}`
   - Create a node with ID and type
   - Post: node exists with given props

3. `create_edge src=SRC dst=DST label=L props={...}`
   - Create relationship

4. `set_prop target=VAR key=K value=EXPR` / `copy_prop src=VAR1.key -> dst=VAR2.key`
   - Assign or map properties; `EXPR` can refer to functions or literal transforms

5. `map_node_type from=T1 to=T2 using {prop_mappings...}`
   - High-level semantic remapping (e.g., map source concept to target concept)

6. `aggregate group_by=(expr) into var=V do fn`
   - Aggregation primitive returning a temporary value usable in later ops

7. `remove_node id=ID` / `remove_edge id=ID`

8. `attach_prov target=VAR rule=RULE_ID` — attach provenance metadata

9. `if <cond> then <ops> else <ops>` — control flow for conditional transforms

10. `emit format=json|tree as TARGET` — final output instruction

## Example DSL fragment (GHG scenario)

```
match csvRow as R where R.scope != null ->
  create_node id=R.id type=EmissionRecord props={scope:R.scope, value:R.value, source:R.source}
  attach_prov target=R rule=ghg.create_record_v1

match nodes(type=EmissionRecord) as E where E.scope='scope1' ->
  aggregate group_by=(E.source) into var=Agg do sum(E.value)
  create_node id=agg_{E.source} type=EmissionAggregate props={source:E.source, total:Agg}
  create_edge src=agg_{E.source} dst=E label=represents
```

## Semantics notes
- All ops operate on an abstract LPG model; compilation targets must map these primitives to the target execution environment (e.g., Cypher statements or MTT rules).
- `match` is local in scope; variables do not leak outside the rule block unless explicitly returned.
- `aggregate` is a higher-level op that may compile to iterative MTT rules or to grouped Cypher `WITH` aggregates.

---

# B. DSL → MTT sample compiler (pseudocode)

Goal: show a straightforward pipeline that converts a DSL script into a set of MTT rules. This pseudocode is intentionally concrete so it can be implemented quickly (Python recommended).

## High-level approach
1. Parse DSL into AST (DSL-AST)
2. Normalize DSL-AST to a canonical operation set
3. Generate an intermediate tree representation (ITR) for each `match` binding: convert graph pattern to tree encoding policy
4. From ITR produce MTT rules: for each create_node/create_edge produce rule templates
5. Attach provenance and emit

## Key helper: graph→tree encoding policy
- Policy 1 (star-encoding): represent a graph node as a tree node `{_id:ID, _type:T, props:{...}, neighbors:[ {label:L, node: <neighbor-subtree>} ... ] }`
- Policy 2 (canonicalized-root): choose an entry node per CSV row; represent entire record as subtree rooted at that node.

## Pseudocode (Python-like)

```python
# assume we have parsed DSL into list of Rule objects

def compile_dsl_to_mtt(rules):
    mtt_rules = []
    for rule in rules:
        matches = rule.match_patterns
        # For each match, create an input-template (tree pattern)
        for m in matches:
            input_tree_pattern = graph_pattern_to_tree_pattern(m.pattern)
            # translate each operation in the rule body
            for op in rule.body:
                if op.type == 'create_node':
                    # create MTT rule that emits a subtree representing the new node
                    mtt_rule = create_mtt_for_create_node(op, input_tree_pattern)
                    mtt_rules.append(mtt_rule)
                elif op.type == 'create_edge':
                    mtt_rule = create_mtt_for_create_edge(op, input_tree_pattern)
                    mtt_rules.append(mtt_rule)
                elif op.type == 'aggregate':
                    # aggregates become parameterized MTT rules that fold over child lists
                    mtt_rules += create_mtt_for_aggregate(op, input_tree_pattern)
                elif op.type == 'map_node_type':
                    mtt_rules.append(create_mtt_for_map_node_type(op, input_tree_pattern))
                elif op.type == 'set_prop' or op.type == 'copy_prop':
                    mtt_rules.append(create_mtt_for_propmap(op, input_tree_pattern))
                # other ops...
    return MTTProgram(mtt_rules)

# Example: create_mtt_for_create_node

def create_mtt_for_create_node(op, input_pat):
    # MTT rule schema:
    # rule <name>(params) : input_pattern -> output_subtree
    rule_name = f"mk_node_{op.type}_{op.id}"
    input_pat = input_pat # pattern where to bind params
    # Construct output subtree template using op.props (expressions may refer to input bindings)
    out_template = TreeNode(type=op.type, props=op.props)
    return MTTRule(name=rule_name, input=input_pat, output=out_template)
```

## Example transformation mapping (DSL → MTT concrete snippet)
- DSL `create_node id=R.id type=EmissionRecord props={scope:R.scope,value:R.value}`
  → MTT rule `mk_record(R) : CSVRow(R,... ) -> EmissionRecord({scope: R.scope, value: R.value})`

- DSL `aggregate group_by=(E.source) into var=Agg do sum(E.value)`
  → MTT implements a fold: a rule `fold_by_source(listOfE) -> Agg` using recursive accumulation

## Implementation notes
- Choose a simple MTT runtime (your vibe-coded MTT or an existing lib). The MTT program must support parameters and recursive rules for aggregation.
- Best to target a JSON-like tree representation for MTT outputs (easy to compare with graph exports).

---

# C. Differential test suite (GHG example)

This section lists small CSV inputs and the expected JSON output for the canonical DSL transformation. Use these for automated unit tests: run DSL→Cypher→neo4j→export JSON and DSL→MTT→export JSON, then compare.

## Testcase 1: Minimal single row

**File: ghg_single.csv**
```
row_id,source,scope,value
r1,facility_A,scope1,100
```

**Expected JSON (canonical tree for compare):**

```json
{
  "EmissionRecords": [
    {
      "id": "r1",
      "source": "facility_A",
      "scope": "scope1",
      "value": 100
    }
  ]
}
```

## Testcase 2: Aggregation

**File: ghg_multi.csv**
```
row_id,source,scope,value
r1,facility_A,scope1,100
r2,facility_A,scope1,150
r3,facility_B,scope2,200
```

**Expected JSON**

```json
{
  "EmissionAggregates": [
    {"source":"facility_A","scope":"scope1","total":250},
    {"source":"facility_B","scope":"scope2","total":200}
  ],
  "EmissionRecordsCount": 3
}
```

## Testcase 3: Missing property and conditional logic

**File: ghg_missing.csv**
```
row_id,source,scope,value
r1,facility_A,,100
r2,facility_B,scope2,50
```

**Expected behavior**
- Row r1 has no scope → rule should either assign default scope `unknown` or attach `invalid` provenance flag. Test asserts one of the expected handling choices.

**Canonical JSON (defaulting to 'unknown')**

```json
{
  "EmissionRecords": [
    {"id":"r1","source":"facility_A","scope":"unknown","value":100},
    {"id":"r2","source":"facility_B","scope":"scope2","value":50}
  ]
}
```

## Test runner
- Steps:
  1. Run DSL compiler to generate Cypher and MTT program
  2. Execute Cypher in neo4j over CSV-imported data → export JSON via APOC or custom query
  3. Execute MTT program over tree-encoded CSV JSON → export JSON
  4. Normalize both JSONs (sort lists by key, canonicalize numeric types) and compare
- Provide tolerant comparator for provenance differences (allow differing provenance entries but assert structure/values match)

---

# D. Paper / Report Outline + Experiment Plan

## Title (candidate)
Bridging Labeled Property Graph Dynamic Ontologies and Macro Tree Transducers: A DSL-based Approach for Verified Model-driven Transformations

## Abstract (short)
We present a DSL and compiler approach that enables the same semantic transformation to be expressed once and executed either as graph operations (Cypher/neo4j) or as tree transformations (Macro Tree Transducer). We formalize the mapping between LPG operations and MTT rules, implement a prototype compiler, and evaluate semantic equivalence across a GHG reporting case study.

## Sections
1. **Introduction** — problem, motivation (dynamic ontology, MDA), contributions
2. **Background** — LPG, neo4j, MTT basics, related work (XSLT, Tree transducers, ontology evolution)
3. **DSL design** — primitives, formal semantics, examples
4. **Graph-to-tree encoding** — policies, tradeoffs (lossy vs lossless), canonicalization
5. **Compiler architecture** — parsing, normalization, codegen (Cypher, MTT), toolchain
6. **Implementation** — prototype details, runtime choices, LLM-assisted rule generation workflow
7. **Evaluation** — datasets (GHG + synthetic), metrics (semantic consistency, expressiveness, performance), experiments and results
8. **Discussion** — limitations, failure modes, scalability, LLM hallucination handling
9. **Conclusion and future work** — including further formal proofs, bidirectional transformations, richer provenance semantics

## Experiments (detailed)
- **E1 (Functional equivalence)**: run the three testcases above; report meaning-equivalence rates. Repeat with randomized input generator for N=100.
- **E2 (Expressiveness frontier)**: create a catalog of transformation patterns (simple mapping, aggregation, restructure, join, cycle handling). For each pattern, classify whether DSL→MTT mapping exists and if manual intervention needed.
- **E3 (LLM-assisted rule generation)**: produce rules via Claude/ChatGPT and measure acceptance rate (after human vetting) and number of iterations until correct.
- **E4 (Scalability)**: measure runtime & memory for CSV sizes [1k, 10k, 100k] rows for both Cypher and MTT execution. Measure chunking effects.

## Metrics
- Semantic Consistency (% matched fields and structural similarity)
- Rule Coverage (fraction of transformation patterns expressible automatically)
- Vetting Effort (human checks per auto-generated rule)
- Execution Performance (time, peak memory)

## Expected contributions
- A small, practical DSL and a proof-of-concept compiler
- A formal mapping (sketch / lemmas) between DSL primitives and MTT constructs
- A test-suite and benchmark for LPG↔MTT equivalence in the GHG domain

---

# Quick roadmap and milestones (12 weeks)
1. Week 1–2: Draft DSL spec + unit tests (Testcases 1–3)
2. Week 3–4: Implement DSL parser & Cypher generator (if not present) and MTT codegen prototype
3. Week 5–6: Run equivalence tests, iterate compiler mappings for edge cases
4. Week 7–8: Implement LLM-assisted rule suggestion loop + vetting template
5. Week 9–10: Scalability experiments, prepare artifacts
6. Week 11–12: Paper/write-up + repository release

---

# Appendix: Implementation hints and code pointers
- Parser: use a small PEG (e.g., Parsimonious or Lark for Python) with clear AST nodes for `match`, `create_node`, etc.
- MTT runtime: reuse your existing vibe-coded MTT if it's parameterized; otherwise implement a small interpreter: match input tree patterns, apply rule RHS templates, support parameter passing and recursion for aggregation
- Test harness: pytest-based runner that shells out to neo4j/MTT and compares canonical JSON
- Provenance: adopt simple PROV-lite JSON structure: `{"rule":"ghg.create_record_v1","time":"2025-11-16T...","agent":"dsl-compiler-v1"}`

---

# Deliverables included here
- DSL minimal spec (this doc)
- Pseudocode compiler for DSL→MTT (section B)
- 3 testcases (section C) with files & expected JSON
- Paper/report outline + experiments (section D)



*End of document.*

