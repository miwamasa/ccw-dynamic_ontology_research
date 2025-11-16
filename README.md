# Dynamic Ontology Research: DSL ↔ MTT Equivalence

研究プロジェクト: LPGベースのDynamic Ontology DSLとMacro Tree Transducer (MTT)の等価性の検証

## 概要

このプロジェクトは、データ変換を実現する2つの異なるアプローチの等価性を理論的・実装的に証明することを目的としています:

1. **Dynamic Ontology (DSL + LPG方式)**: データ変換をLabeled Property Graph (LPG)操作のDSLで表現
2. **Macro Tree Transducer (MTT)**: データ変換を木変換ルールで表現

### 研究課題

同じデータ変換を両方のアプローチで表現できることを示し、以下を実現します:
- DSL → Cypherコンパイラ (グラフベース実行)
- DSL → MTTコンパイラ (木変換ベース実行)
- 両者の意味的等価性の検証

## プロジェクト構成

```
.
├── src/
│   ├── types/          # 共通型定義
│   │   └── common.ts
│   ├── dsl/            # DSLパーサー
│   │   └── parser.ts
│   ├── mtt/            # MTT関連
│   │   ├── runtime.ts           # MTTランタイムエンジン
│   │   ├── graph-to-tree.ts     # グラフ→木エンコーディング
│   │   └── dsl-to-mtt-compiler.ts  # DSL→MTTコンパイラ
│   └── tests/          # テスト
│       └── mtt-runtime.test.ts
├── examples/           # サンプルコード
│   └── simple-transformation.ts
├── samples/            # サンプルデータ
│   ├── data/          # CSVデータ
│   │   ├── facilities.csv
│   │   ├── energy.csv
│   │   └── emissions.csv
│   ├── manufacturing-ontology.ttl
│   ├── ghg-report-ontology.ttl
│   └── transformation_rules.yaml
├── prior_documents/    # 背景資料
│   ├── dynamic_ontology.md
│   ├── DSL_spcification.md
│   └── MTT_THEORY.md
└── reserach_thema/     # 研究資料
    ├── background_and_initial_research_question.md
    ├── chatGPTs_research_plan.md
    └── dsl↔mtt_research_pack_dsl_spec_sample_compiler_testcases_paper_outline.md
```

## 主要コンポーネント

### 1. MTT Runtime (`src/mtt/runtime.ts`)

Macro Tree Transducerのランタイムエンジン。以下の機能を提供:
- パターンマッチング
- パラメータ付き変換
- 複数状態のサポート
- 再帰的変換

### 2. Graph-to-Tree Encoder (`src/mtt/graph-to-tree.ts`)

LPGを木構造に変換するエンコーダ。3つのエンコーディングポリシーをサポート:
- **Star encoding**: 各ノードをスター型の木として表現
- **Canonical-root**: ルートノードから木として展開
- **Nested**: 型ごとにグループ化

### 3. DSL Parser (`src/dsl/parser.ts`)

YAML形式の変換ルールをDSL ASTに変換するパーサー。

### 4. DSL-to-MTT Compiler (`src/mtt/dsl-to-mtt-compiler.ts`)

DSL操作をMTTルールに変換するコンパイラ。

## セットアップ

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# テスト実行
npm test
```

## 使用例

### 基本的なMTT変換

```typescript
import { MTTRuntime } from './src/mtt/runtime';
import { MTTProgram, TreeNode } from './src/types/common';

// MTTプログラムの定義
const program: MTTProgram = {
  initialState: 'q',
  rules: [
    {
      name: 'copy',
      state: 'q',
      inputPattern: {
        type: 'kind_pattern',
        kind: 'node',
        childPatterns: [
          { type: 'variable_pattern', varName: 'child' }
        ]
      },
      parameters: [],
      outputTemplate: {
        type: 'node_template',
        kind: 'node',
        children: [
          { type: 'variable_template', varName: 'child' }
        ]
      }
    }
  ]
};

// 変換実行
const runtime = new MTTRuntime(program);
const inputTree: TreeNode = { kind: 'node', children: [{ kind: 'leaf' }] };
const outputTree = runtime.transform('q', inputTree);
```

### グラフから木へのエンコーディング

```typescript
import { GraphToTreeEncoder } from './src/mtt/graph-to-tree';
import { Graph } from './src/types/common';

const graph: Graph = {
  nodes: [
    { id: 'n1', type: 'Facility', properties: { name: 'Factory A' } },
    { id: 'n2', type: 'Energy', properties: { amount: 1000 } }
  ],
  edges: [
    { id: 'e1', label: 'consumes', sourceId: 'n1', targetId: 'n2', properties: {} }
  ]
};

const encoder = new GraphToTreeEncoder();
const tree = encoder.encode(graph, 'canonical-root', 'n1');
```

## 実験シナリオ

### シナリオ1: 製造データからGHGレポート生成

サンプルデータ (`samples/data/*.csv`) を使用して、製造活動データをGHG排出レポートに変換します。

**手順:**
1. CSVデータをLPGとして読み込み
2. transformation_rules.yamlに基づいてDSL操作を生成
3. DSL→MTTコンパイルして実行
4. 結果を検証

### シナリオ2: 差分テスト (DSL→Cypher vs DSL→MTT)

同一のDSL記述から:
- Cypherクエリを生成してNeo4jで実行
- MTTルールを生成して実行
- 出力の意味的等価性を検証

## 研究成果物

### 実装アーティファクト
- [x] MTTランタイムエンジン
- [x] グラフ→木エンコーダ/デコーダ
- [x] DSL→MTTコンパイラ
- [x] テストスイート
- [ ] DSL→Cypherコンパイラ (今後の実装)

### 理論的成果
- [ ] DSL操作とMTTルールの形式的対応関係
- [ ] エンコーディングポリシーの性質と制約
- [ ] 等価性検証の手法

### 実験評価
- [ ] 意味的一致率の測定
- [ ] 表現力の比較
- [ ] 実行性能の評価

## 今後の課題

1. **DSL→Cypherコンパイラの実装**: Neo4jでの実行を可能にする
2. **差分テストフレームワーク**: 自動的に等価性を検証
3. **複雑な変換のサポート**: 集約、結合、条件分岐など
4. **最適化**: 生成されるMTTルールの効率化
5. **可視化ツール**: 変換過程のデバッグ支援

## 参考文献

- `prior_documents/dynamic_ontology.md` - Dynamic Ontologyの理論
- `prior_documents/MTT_THEORY.md` - Macro Tree Transducerの詳細
- `prior_documents/DSL_spcification.md` - DSL仕様
- `reserach_thema/dsl↔mtt_research_pack_*.md` - 研究計画と設計
- `EXPERIMENT_REPORT.md` - 実験結果レポート

## ライセンス

MIT License

## 貢献

このプロジェクトは研究目的で作成されています。フィードバックや改善提案は歓迎します。