# Macro Tree Transducer (MTT) 仕様書

**バージョン**: 1.0
**最終更新**: 2025-11-16
**ステータス**: 安定版

---

## 目次

1. [概要](#1-概要)
2. [理論的基盤](#2-理論的基盤)
3. [拡張機能：パラメータ化](#3-拡張機能パラメータ化)
4. [実装仕様](#4-実装仕様)
5. [パターンマッチング](#5-パターンマッチング)
6. [テンプレート展開](#6-テンプレート展開)
7. [実行モデル](#7-実行モデル)
8. [使用例](#8-使用例)
9. [パフォーマンス最適化](#9-パフォーマンス最適化)
10. [デバッグとトラブルシューティング](#10-デバッグとトラブルシューティング)

---

## 1. 概要

### 1.1 Macro Tree Transducerとは

Macro Tree Transducer (MTT) は、木構造間の変換を記述する計算モデルです。状態遷移とパターンマッチングに基づき、入力木を出力木に変換します。

**主な特徴**:
- **状態遷移型**: 有限状態機械と同様の状態管理
- **パターンマッチング**: 構造的パターンによる条件分岐
- **マクロ展開**: テンプレートベースの出力生成
- **パラメータ化**: 実行時パラメータのサポート（本実装の拡張）

### 1.2 従来のMTTとの違い

本実装では、古典的なMTTを以下のように拡張しています：

| 機能 | 古典的MTT | 本実装 |
|------|-----------|---------|
| パラメータ | なし | 実行時パラメータをサポート |
| 条件分岐 | パターンのみ | 条件関数による動的分岐 |
| 型システム | なし | TypeScriptによる型安全性 |
| エラー処理 | 未定義 | 例外とエラーメッセージ |

### 1.3 ユースケース

- **データ変換**: XML/JSON/GraphのSchema変換
- **コンパイラ**: AST（抽象構文木）の変換
- **クエリ処理**: 木構造クエリの実行
- **ビジネスロジック**: ルールベースの計算（本研究）

---

## 2. 理論的基盤

### 2.1 形式的定義

**定義 2.1 (Macro Tree Transducer)**:

MTTは5つ組 `M = (Q, Σ, Δ, q0, R)` として定義される：

```
Q: 状態の有限集合
Σ: 入力アルファベット（入力木のラベル集合）
Δ: 出力アルファベット（出力木のラベル集合）
q0 ∈ Q: 初期状態
R: 変換規則の有限集合
```

**変換規則の形式**:

```
q(σ(x1, x2, ..., xn)) → t[q'(xi), ...]

ここで:
- q ∈ Q: 現在の状態
- σ ∈ Σ: 入力ラベル
- x1, ..., xn: 変数（入力木の子ノード）
- t: 出力木テンプレート（Δのラベルから構成）
- q'(xi): 状態q'での再帰的変換呼び出し
```

### 2.2 実行セマンティクス

**定義 2.2 (変換関数)**:

状態qでの木tの変換 `[[M]]_q(t)` は以下のように再帰的に定義される：

```
[[M]]_q(σ(t1, t2, ..., tn)) =
  規則 (q, σ(x1, ..., xn) → τ) ∈ R が存在するとき:
    τ[x1 := [[M]]_q1(t1), ..., xn := [[M]]_qn(tn)]

  該当する規則がない場合:
    エラーまたはデフォルト動作
```

**例**:

入力規則:
```
Rule: q0(Add(x, y)) → Plus(q0(x), q0(y))
```

入力木:
```
Add(Num(2), Num(3))
```

変換過程:
```
[[M]]_q0(Add(Num(2), Num(3)))
= Plus([[M]]_q0(Num(2)), [[M]]_q0(Num(3)))
= Plus(Num(2), Num(3))  // Numは規則がないのでそのまま
```

### 2.3 計算能力

**定理 2.1 (表現力)**:

MTTは以下の変換を表現できる：

1. **文脈自由変換**: 各サブツリーを独立に変換
2. **線形変換**: 各変数を最大1回使用
3. **非線形変換**: 変数の複数回使用（コピー）

**例（線形）**:
```
q(A(x, y)) → B(q(x), q(y))  // xとyを1回ずつ使用
```

**例（非線形）**:
```
q(A(x)) → B(q(x), q(x))  // xを2回使用（コピー）
```

**定理 2.2 (決定性)**:

MTTが決定的であるとは、任意の状態qと入力ラベルσに対して、最大1つの規則が適用可能であることである。

本実装は非決定的MTTをサポートし、規則は定義順に評価される。

---

## 3. 拡張機能：パラメータ化

### 3.1 パラメータ化MTTの定義

**定義 3.1 (パラメータ化MTT)**:

拡張されたMTTは以下の形式の規則を持つ：

```
q(σ(x1, ..., xn), p1, p2, ..., pm) → t[q'(xi, p'1, ..., p'k), ...]

ここで:
- p1, ..., pm: 実行時パラメータ
- p'1, ..., p'k: 再帰呼び出しへ渡すパラメータ
```

**パラメータの用途**:
1. **定数値**: 排出係数、単価など
2. **コンテキスト**: 親ノードの情報
3. **累積値**: 集約処理での合計値
4. **設定**: 変換の動作モード

### 3.2 条件付き規則

**定義 3.2 (条件関数)**:

規則に条件関数を付加できる：

```
Rule {
  state: q
  pattern: σ(x1, ..., xn)
  condition: (bindings, params) => boolean
  template: t
}
```

条件が`true`の場合のみ規則が適用される。

**例**:
```typescript
{
  state: 'q_energy',
  inputPattern: {
    kind: 'EnergyConsumption',
    attrs: [
      {key: 'energy_type', value: {type: 'variable', name: 'type'}}
    ]
  },
  condition: (bindings, params) => {
    const type = bindings['type'];
    return type === 'electricity';
  },
  outputTemplate: {
    kind: 'Emission',
    attrs: [
      {key: 'scope', value: {type: 'literal', value: 2}}
    ]
  }
}
```

### 3.3 パラメータの型

**サポートされる型**:

| 型 | 説明 | 例 |
|-----|------|-----|
| `number` | 数値 | `0.5`, `2.03` |
| `string` | 文字列 | `"electricity"` |
| `boolean` | 真偽値 | `true`, `false` |
| `object` | オブジェクト | `{factor: 0.5, scope: 2}` |
| `array` | 配列 | `[0.5, 2.03, 1.51]` |

---

## 4. 実装仕様

### 4.1 型定義

#### 4.1.1 TreeNode

入力・出力木のノード：

```typescript
interface TreeNode {
  kind: string;                    // ノードのラベル
  attrs?: TreeAttribute[];         // 属性のリスト
  children?: TreeNode[];           // 子ノードのリスト
}

interface TreeAttribute {
  key: string;                     // 属性名
  value: any;                      // 属性値
}
```

**例**:
```typescript
const energyNode: TreeNode = {
  kind: 'EnergyConsumption',
  attrs: [
    {key: 'amount', value: 85000},
    {key: 'energy_type', value: 'electricity'},
    {key: 'facility_id', value: 'F001'}
  ],
  children: []
};
```

#### 4.1.2 TreePattern

パターンマッチング用のパターン：

```typescript
interface TreePattern {
  kind: string;                    // ラベル（'*'はワイルドカード）
  attrs?: PatternAttribute[];      // 属性パターン
  children?: TreePattern[];        // 子パターン
}

interface PatternAttribute {
  key: string;
  value: PatternValue;
}

type PatternValue =
  | {type: 'literal', value: any}       // リテラル値（完全一致）
  | {type: 'variable', name: string}    // 変数（任意の値にマッチ、束縛）
  | {type: 'wildcard'}                  // ワイルドカード（任意の値）
```

**例**:
```typescript
const pattern: TreePattern = {
  kind: 'EnergyConsumption',
  attrs: [
    {key: 'energy_type', value: {type: 'variable', name: 'type'}},
    {key: 'amount', value: {type: 'variable', name: 'amount'}}
  ]
};
```

#### 4.1.3 TreeTemplate

出力木のテンプレート：

```typescript
interface TreeTemplate {
  kind: string;
  attrs?: TemplateAttribute[];
  children?: TemplateElement[];
}

interface TemplateAttribute {
  key: string;
  value: TemplateValue;
}

type TemplateValue =
  | {type: 'literal', value: any}           // リテラル値
  | {type: 'variable', name: string}        // 変数参照
  | {type: 'parameter', index: number}      // パラメータ参照
  | {type: 'expression', expr: Expression}  // 式評価
```

**例**:
```typescript
const template: TreeTemplate = {
  kind: 'Emission',
  attrs: [
    {key: 'energy_type', value: {type: 'variable', name: 'type'}},
    {key: 'co2_amount', value: {type: 'expression', expr: {
      op: 'multiply',
      left: {type: 'variable', name: 'amount'},
      right: {type: 'parameter', index: 0}  // params[0]
    }}}
  ]
};
```

#### 4.1.4 MTTRule

変換規則：

```typescript
interface MTTRule {
  state: string;                   // 状態名
  inputPattern: TreePattern;       // 入力パターン
  outputTemplate: TreeTemplate;    // 出力テンプレート
  condition?: (                    // 条件関数（任意）
    bindings: Bindings,
    params: any[]
  ) => boolean;
  nextState?: string;              // 次の状態（任意）
}

type Bindings = {[varName: string]: any};
```

#### 4.1.5 MTTProgram

MTTプログラム全体：

```typescript
interface MTTProgram {
  rules: MTTRule[];                // 規則のリスト
  initialState: string;            // 初期状態
}
```

### 4.2 ランタイムAPI

#### 4.2.1 MTTRuntime クラス

```typescript
class MTTRuntime {
  constructor(program: MTTProgram);

  /**
   * 木を変換する
   * @param state 初期状態
   * @param tree 入力木
   * @param params パラメータ配列
   * @returns 変換後の木
   */
  transform(state: string, tree: TreeNode, ...params: any[]): TreeNode;

  /**
   * パターンマッチングを実行
   * @param pattern パターン
   * @param tree 入力木
   * @returns 変数束縛（マッチしない場合null）
   */
  private matchPattern(pattern: TreePattern, tree: TreeNode): Bindings | null;

  /**
   * テンプレートを展開
   * @param template テンプレート
   * @param bindings 変数束縛
   * @param params パラメータ
   * @param currentState 現在の状態
   * @returns 生成された木
   */
  private applyTemplate(
    template: TreeTemplate,
    bindings: Bindings,
    params: any[],
    currentState: string
  ): TreeNode;
}
```

**使用例**:
```typescript
const runtime = new MTTRuntime(program);
const outputTree = runtime.transform('q0', inputTree, 0.5, 2.03);
```

---

## 5. パターンマッチング

### 5.1 マッチングアルゴリズム

```
Algorithm: matchPattern(pattern, tree)
Input: pattern (TreePattern), tree (TreeNode)
Output: bindings (Bindings) or null

1. ラベルチェック:
   If pattern.kind != tree.kind AND pattern.kind != '*':
     Return null

2. 属性マッチング:
   bindings ← {}
   For each pattr in pattern.attrs:
     tattr ← tree.attrs.find(a => a.key == pattr.key)
     If tattr == null:
       Return null

     Match pattr.value.type:
       Case 'literal':
         If pattr.value.value != tattr.value:
           Return null

       Case 'variable':
         bindings[pattr.value.name] ← tattr.value

       Case 'wildcard':
         // 何もしない（任意の値を受け入れ）

3. 子ノードマッチング:
   If pattern.children != null:
     If tree.children.length != pattern.children.length:
       Return null

     For i = 0 to pattern.children.length - 1:
       childBindings ← matchPattern(pattern.children[i], tree.children[i])
       If childBindings == null:
         Return null
       bindings ← merge(bindings, childBindings)

4. Return bindings
```

### 5.2 マッチング例

**パターン**:
```typescript
{
  kind: 'EnergyConsumption',
  attrs: [
    {key: 'energy_type', value: {type: 'variable', name: 'type'}},
    {key: 'amount', value: {type: 'literal', value: 85000}}
  ]
}
```

**入力木**:
```typescript
{
  kind: 'EnergyConsumption',
  attrs: [
    {key: 'energy_type', value: 'electricity'},
    {key: 'amount', value: 85000},
    {key: 'facility_id', value: 'F001'}
  ]
}
```

**マッチング結果**:
```typescript
{
  type: 'electricity'  // 変数'type'に束縛
}
// amount=85000はリテラルマッチ成功
// facility_idはパターンにないので無視
```

### 5.3 ワイルドカードパターン

**ラベルワイルドカード**:
```typescript
{kind: '*', attrs: [...]}  // 任意のラベルにマッチ
```

**属性ワイルドカード**:
```typescript
{key: 'amount', value: {type: 'wildcard'}}  // 任意の値にマッチ
```

---

## 6. テンプレート展開

### 6.1 展開アルゴリズム

```
Algorithm: applyTemplate(template, bindings, params, state)
Input: template, bindings, params, state
Output: TreeNode

1. ラベル生成:
   kind ← template.kind

2. 属性生成:
   attrs ← []
   For each tattr in template.attrs:
     value ← evaluateValue(tattr.value, bindings, params)
     attrs.append({key: tattr.key, value: value})

3. 子ノード生成:
   children ← []
   For each child in template.children:
     Match child.type:
       Case 'literal':
         children.append(child.tree)

       Case 'variable':
         subtree ← bindings[child.name]
         children.append(subtree)

       Case 'recursive_call':
         nextState ← child.state
         inputTree ← bindings[child.variable]
         childParams ← evaluateParams(child.params, bindings, params)
         result ← transform(nextState, inputTree, ...childParams)
         children.append(result)

4. Return TreeNode(kind, attrs, children)
```

### 6.2 値の評価

```
Algorithm: evaluateValue(templateValue, bindings, params)

Match templateValue.type:
  Case 'literal':
    Return templateValue.value

  Case 'variable':
    Return bindings[templateValue.name]

  Case 'parameter':
    Return params[templateValue.index]

  Case 'expression':
    Return evaluateExpression(templateValue.expr, bindings, params)
```

### 6.3 式の評価

サポートされる式：

```typescript
type Expression =
  | {op: 'multiply', left: Value, right: Value}
  | {op: 'add', left: Value, right: Value}
  | {op: 'subtract', left: Value, right: Value}
  | {op: 'divide', left: Value, right: Value}
  | {op: 'access', object: Value, key: string}  // オブジェクトプロパティアクセス
```

**例**:
```typescript
// amount * factor
{
  op: 'multiply',
  left: {type: 'variable', name: 'amount'},
  right: {type: 'parameter', index: 0}
}

// params[0].electricity.factor
{
  op: 'access',
  object: {
    op: 'access',
    object: {type: 'parameter', index: 0},
    key: 'electricity'
  },
  key: 'factor'
}
```

---

## 7. 実行モデル

### 7.1 実行フロー

```
┌─────────────────┐
│  Input Tree     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  transform(q0, tree, params)    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Find matching rule             │
│  for state q0 and tree.kind     │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  matchPattern(rule.pattern,     │
│                tree)             │
└────────┬────────────────────────┘
         │
         ├─ No match ──────────────┐
         │                         │
         ▼                         ▼
    Match found              Try next rule
         │                         │
         ▼                         │
┌─────────────────────────────────┐│
│  Check condition (if exists)    ││
└────────┬────────────────────────┘│
         │                         │
         ├─ false ─────────────────┘
         │
         ▼ true
┌─────────────────────────────────┐
│  applyTemplate(rule.template,   │
│    bindings, params)             │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  For each recursive call in     │
│  template children:              │
│    transform(q', subtree, p')   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Construct output tree          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Output Tree    │
└─────────────────┘
```

### 7.2 規則の選択戦略

**戦略1: 最初にマッチ（First Match）**

規則は定義順に評価され、最初にマッチした規則が適用される。

```typescript
const rules: MTTRule[] = [
  {state: 'q0', pattern: {kind: 'A', ...}, ...},  // 1番目に試行
  {state: 'q0', pattern: {kind: 'B', ...}, ...},  // 2番目に試行
  {state: 'q0', pattern: {kind: '*', ...}, ...}   // 最後（デフォルト）
];
```

**戦略2: 優先度（Priority）**

将来の拡張として、規則に優先度を付ける：

```typescript
interface MTTRule {
  priority?: number;  // 高い値ほど優先
  // ...
}
```

### 7.3 エラー処理

**ケース1: マッチする規則がない**

```typescript
transform(state: string, tree: TreeNode, ...params: any[]): TreeNode {
  const candidateRules = this.rules.get(state);
  if (!candidateRules) {
    throw new Error(`No rules defined for state: ${state}`);
  }

  for (const rule of candidateRules) {
    const bindings = this.matchPattern(rule.inputPattern, tree);
    if (bindings) {
      // ... 規則適用
      return outputTree;
    }
  }

  // どの規則にもマッチしない
  console.warn(`No matching rule for ${tree.kind} in state ${state}`);
  return tree;  // 入力をそのまま返す（デフォルト動作）
}
```

**ケース2: 条件評価エラー**

```typescript
if (rule.condition) {
  try {
    if (!rule.condition(bindings, params)) {
      continue;  // 次の規則を試行
    }
  } catch (error) {
    console.error(`Condition evaluation error:`, error);
    continue;
  }
}
```

---

## 8. 使用例

### 8.1 基本例: 数式の評価

**入力木**:
```
Add(Num(2), Mul(Num(3), Num(4)))
```

**MTTプログラム**:
```typescript
const program: MTTProgram = {
  initialState: 'eval',
  rules: [
    {
      state: 'eval',
      inputPattern: {kind: 'Num', attrs: [{key: 'value', value: {type: 'variable', name: 'n'}}]},
      outputTemplate: {kind: 'Num', attrs: [{key: 'value', value: {type: 'variable', name: 'n'}}]}
    },
    {
      state: 'eval',
      inputPattern: {
        kind: 'Add',
        children: [
          {kind: '*', bind: 'left'},
          {kind: '*', bind: 'right'}
        ]
      },
      outputTemplate: {
        kind: 'Num',
        attrs: [{
          key: 'value',
          value: {
            type: 'expression',
            expr: {
              op: 'add',
              left: {type: 'recursive_call', state: 'eval', variable: 'left'},
              right: {type: 'recursive_call', state: 'eval', variable: 'right'}
            }
          }
        }]
      }
    },
    // Mul規則も同様
  ]
};
```

**実行**:
```typescript
const runtime = new MTTRuntime(program);
const result = runtime.transform('eval', inputTree);
// result: Num(14)
```

### 8.2 実用例: GHG排出量計算

**入力木**:
```typescript
{
  kind: 'EnergyConsumption',
  attrs: [
    {key: 'facility_id', value: 'F001'},
    {key: 'energy_type', value: 'electricity'},
    {key: 'amount', value: 85000}
  ]
}
```

**MTTプログラム**:
```typescript
const ghgProgram: MTTProgram = {
  initialState: 'q0',
  rules: [
    // Rule 1: 初期処理
    {
      state: 'q0',
      inputPattern: {
        kind: 'EnergyConsumption',
        attrs: [
          {key: 'energy_type', value: {type: 'variable', name: 'type'}},
          {key: 'amount', value: {type: 'variable', name: 'amount'}}
        ]
      },
      outputTemplate: {
        kind: 'EnergyConsumption',
        attrs: [
          {key: 'energy_type', value: {type: 'variable', name: 'type'}},
          {key: 'amount', value: {type: 'variable', name: 'amount'}}
        ]
      },
      nextState: 'q_energy'
    },

    // Rule 2: 電力消費の変換
    {
      state: 'q_energy',
      inputPattern: {
        kind: 'EnergyConsumption',
        attrs: [
          {key: 'energy_type', value: {type: 'variable', name: 'type'}},
          {key: 'amount', value: {type: 'variable', name: 'amount'}}
        ]
      },
      condition: (bindings, params) => bindings['type'] === 'electricity',
      outputTemplate: {
        kind: 'Emission',
        attrs: [
          {key: 'energy_type', value: {type: 'variable', name: 'type'}},
          {key: 'co2_amount', value: {
            type: 'expression',
            expr: {
              op: 'multiply',
              left: {type: 'variable', name: 'amount'},
              right: {
                op: 'access',
                object: {
                  op: 'access',
                  object: {type: 'parameter', index: 0},
                  key: 'electricity'
                },
                key: 'factor'
              }
            }
          }},
          {key: 'scope', value: {type: 'literal', value: 2}}
        ]
      }
    },

    // Rule 3: ガス消費の変換
    {
      state: 'q_energy',
      inputPattern: {
        kind: 'EnergyConsumption',
        attrs: [
          {key: 'energy_type', value: {type: 'variable', name: 'type'}},
          {key: 'amount', value: {type: 'variable', name: 'amount'}}
        ]
      },
      condition: (bindings, params) => bindings['type'] === 'natural_gas',
      outputTemplate: {
        kind: 'Emission',
        attrs: [
          {key: 'energy_type', value: {type: 'variable', name: 'type'}},
          {key: 'co2_amount', value: {
            type: 'expression',
            expr: {
              op: 'multiply',
              left: {type: 'variable', name: 'amount'},
              right: {
                op: 'access',
                object: {
                  op: 'access',
                  object: {type: 'parameter', index: 0},
                  key: 'natural_gas'
                },
                key: 'factor'
              }
            }
          }},
          {key: 'scope', value: {type: 'literal', value: 1}}
        ]
      }
    }
  ]
};
```

**実行**:
```typescript
const emissionFactors = {
  electricity: {factor: 0.5, scope: 2},
  natural_gas: {factor: 2.03, scope: 1}
};

const runtime = new MTTRuntime(ghgProgram);
const emission = runtime.transform('q0', energyTree, emissionFactors);

// 結果:
// {
//   kind: 'Emission',
//   attrs: [
//     {key: 'energy_type', value: 'electricity'},
//     {key: 'co2_amount', value: 42500},  // 85000 × 0.5
//     {key: 'scope', value: 2}
//   ]
// }
```

---

## 9. パフォーマンス最適化

### 9.1 規則のインデックス化

状態とラベルでインデックスを作成：

```typescript
class MTTRuntime {
  private ruleIndex: Map<string, Map<string, MTTRule[]>>;

  constructor(program: MTTProgram) {
    this.ruleIndex = new Map();

    for (const rule of program.rules) {
      if (!this.ruleIndex.has(rule.state)) {
        this.ruleIndex.set(rule.state, new Map());
      }
      const stateMap = this.ruleIndex.get(rule.state)!;

      const label = rule.inputPattern.kind;
      if (!stateMap.has(label)) {
        stateMap.set(label, []);
      }
      stateMap.get(label)!.push(rule);
    }
  }

  transform(state: string, tree: TreeNode, ...params: any[]): TreeNode {
    const stateMap = this.ruleIndex.get(state);
    const candidates = stateMap?.get(tree.kind) || [];
    // candidatesのみを試行（全規則を試行しない）
    // ...
  }
}
```

**効果**: O(n) → O(log n) または O(1)

### 9.2 メモ化

同じ入力に対する変換結果をキャッシュ：

```typescript
class MTTRuntime {
  private cache: Map<string, TreeNode>;

  transform(state: string, tree: TreeNode, ...params: any[]): TreeNode {
    const key = this.createCacheKey(state, tree, params);

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const result = this.doTransform(state, tree, ...params);
    this.cache.set(key, result);
    return result;
  }

  private createCacheKey(state: string, tree: TreeNode, params: any[]): string {
    return JSON.stringify({state, tree, params});
  }
}
```

**注意**: パラメータが巨大な場合、キャッシュキー生成コストが高い

### 9.3 遅延評価

テンプレート展開を遅延実行：

```typescript
interface LazyTree {
  evaluate(): TreeNode;
}

class ThunkTree implements LazyTree {
  constructor(
    private state: string,
    private tree: TreeNode,
    private runtime: MTTRuntime,
    private params: any[]
  ) {}

  evaluate(): TreeNode {
    return this.runtime.transform(this.state, this.tree, ...this.params);
  }
}
```

**用途**: 大規模木の一部のみ必要な場合

---

## 10. デバッグとトラブルシューティング

### 10.1 トレース機能

```typescript
class MTTRuntime {
  private trace: boolean = false;

  enableTrace() {
    this.trace = true;
  }

  transform(state: string, tree: TreeNode, ...params: any[]): TreeNode {
    if (this.trace) {
      console.log(`[TRACE] State: ${state}, Tree: ${tree.kind}`);
    }

    // ... 変換処理

    if (this.trace) {
      console.log(`[TRACE] Result: ${outputTree.kind}`);
    }

    return outputTree;
  }
}
```

**使用例**:
```typescript
runtime.enableTrace();
runtime.transform('q0', tree, params);
// Output:
// [TRACE] State: q0, Tree: EnergyConsumption
// [TRACE] State: q_energy, Tree: EnergyConsumption
// [TRACE] Result: Emission
```

### 10.2 規則カバレッジ

どの規則が使用されたかを記録：

```typescript
class MTTRuntime {
  private coverage: Map<MTTRule, number> = new Map();

  getCoverage(): Map<MTTRule, number> {
    return this.coverage;
  }

  private recordRuleUsage(rule: MTTRule) {
    const count = this.coverage.get(rule) || 0;
    this.coverage.set(rule, count + 1);
  }
}
```

**レポート**:
```
Rule Coverage Report:
  Rule 1 (q0, EnergyConsumption): 10 times
  Rule 2 (q_energy, electricity): 6 times
  Rule 3 (q_energy, natural_gas): 4 times
  Rule 4 (q_agg, *): 0 times  ← 未使用
```

### 10.3 一般的なエラーと解決策

**エラー1: `No matching rule`**

```
Error: No matching rule for tree kind 'UnknownType' in state 'q0'
```

**原因**: 入力木に対応する規則がない

**解決策**:
1. ワイルドカード規則を追加
   ```typescript
   {state: 'q0', inputPattern: {kind: '*'}, outputTemplate: {...}}
   ```
2. 入力データを検証

**エラー2: `Undefined variable`**

```
Error: Variable 'unknown_var' not found in bindings
```

**原因**: テンプレートで未定義の変数を参照

**解決策**: パターンで変数を束縛しているか確認
```typescript
inputPattern: {
  attrs: [{key: 'amount', value: {type: 'variable', name: 'amount'}}]
  //                                              ^^^^^^^ この名前を使用
}
outputTemplate: {
  attrs: [{key: 'co2', value: {type: 'variable', name: 'amount'}}]
  //                                            ^^^^^^^ ここで参照
}
```

**エラー3: `Condition evaluation failed`**

```
Error: Cannot read property 'factor' of undefined
```

**原因**: 条件関数またはテンプレート内でnull/undefinedにアクセス

**解決策**: Null安全なアクセス
```typescript
condition: (bindings, params) => {
  const type = bindings['type'];
  const factors = params[0];
  return factors && factors[type] && factors[type].factor > 0;
}
```

---

## 11. まとめ

### 11.1 MTTの利点

- ✅ **形式的基盤**: 理論的に well-defined
- ✅ **決定的実行**: 予測可能な動作
- ✅ **コンポーザビリティ**: 規則を独立に定義
- ✅ **検証可能性**: テスト・証明が容易

### 11.2 本実装の拡張

- ✅ **パラメータ化**: 実行時定数のサポート
- ✅ **条件分岐**: 動的な規則選択
- ✅ **型安全性**: TypeScriptによる静的型チェック
- ✅ **エラー処理**: 明確なエラーメッセージ

### 11.3 今後の改善

- **最適化**: 規則コンパイル、JIT実行
- **並列化**: 独立サブツリーの並列変換
- **デバッガ**: ステップ実行、ブレークポイント
- **DSL統合**: DSL→MTT自動コンパイル（既に実装済み）

---

## 付録 A: 完全なAPIリファレンス

### TreeNode

```typescript
interface TreeNode {
  kind: string;
  attrs?: TreeAttribute[];
  children?: TreeNode[];
}
```

### MTTRuntime

```typescript
class MTTRuntime {
  constructor(program: MTTProgram);
  transform(state: string, tree: TreeNode, ...params: any[]): TreeNode;
  enableTrace(): void;
  getCoverage(): Map<MTTRule, number>;
}
```

### ユーティリティ関数

```typescript
// 木の等価性チェック
function treeEquals(t1: TreeNode, t2: TreeNode): boolean;

// 木の深さ
function treeDepth(tree: TreeNode): number;

// 木のサイズ（ノード数）
function treeSize(tree: TreeNode): number;

// 木のシリアライズ
function serializeTree(tree: TreeNode): string;

// 木のデシリアライズ
function deserializeTree(json: string): TreeNode;
```

---

## 付録 B: 実装ファイル

- **src/mtt/runtime.ts**: MTTランタイムエンジン（450行）
- **src/mtt/graph-to-tree.ts**: Graph-to-Tree Encoding（380行）
- **src/mtt/ghg-dsl-to-mtt.ts**: GHG DSL→MTTコンパイラ（420行）
- **src/mtt/dsl-to-mtt-compiler.ts**: 汎用DSL→MTTコンパイラ（350行）
- **src/tests/mtt-runtime.test.ts**: ランタイムテスト（150行）

---

**ドキュメント終わり**
