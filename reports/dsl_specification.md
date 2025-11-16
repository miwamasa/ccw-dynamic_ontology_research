# Dynamic Ontology DSL 仕様書

**バージョン**: 1.0
**最終更新**: 2025-11-16
**ステータス**: 安定版

---

## 目次

1. [概要](#1-概要)
2. [設計原則](#2-設計原則)
3. [文法仕様](#3-文法仕様)
4. [セマンティクス](#4-セマンティクス)
5. [型システム](#5-型システム)
6. [操作リファレンス](#6-操作リファレンス)
7. [使用例](#7-使用例)
8. [ベストプラクティス](#8-ベストプラクティス)
9. [エラーハンドリング](#9-エラーハンドリング)

---

## 1. 概要

### 1.1 Dynamic Ontology DSLとは

Dynamic Ontology DSLは、Labeled Property Graph (LPG)上でのデータ変換を宣言的に記述するためのドメイン特化言語（Domain Specific Language）です。

**主な特徴**:
- **宣言的**: 「何を」変換するかを記述（「どのように」は実装が決定）
- **型安全**: スキーマとプロパティの型チェック
- **人間可読**: YAML形式で業務担当者でも理解可能
- **実行可能**: MTTまたはCypherへコンパイル可能

### 1.2 ユースケース

- **データ統合**: 異なるスキーマ間でのデータ変換
- **ビジネスルール実装**: 排出量計算、価格計算など
- **規制報告**: GHGプロトコル、財務報告など
- **ETLパイプライン**: データウェアハウスへの投入

### 1.3 処理フロー

```
YAML DSL定義
    ↓
DSLパーサー
    ↓
DSLプログラム（内部表現）
    ↓
    ├→ DSL→MTTコンパイラ → MTTランタイム → 実行
    └→ DSL→Cypherコンパイラ → Neo4j → 実行
```

---

## 2. 設計原則

### 2.1 宣言的記述

**良い例**:
```yaml
operations:
  - operation: "calculate"
    field: "co2_amount"
    formula: "amount * emission_factor"
```

**悪い例** (手続き的):
```yaml
operations:
  - operation: "get_amount"
  - operation: "get_factor"
  - operation: "multiply"
  - operation: "set_co2_amount"
```

### 2.2 ドメイン駆動

ビジネス用語を直接使用：

```yaml
emission_factors:
  electricity: 0.5  # kg-CO2/kWh
  natural_gas: 2.03  # kg-CO2/m³
```

技術用語を避ける：
```yaml
# 悪い例
coefficients:
  type_001: 0.5
  type_002: 2.03
```

### 2.3 コンポーザビリティ

小さな変換を組み合わせて複雑な変換を構築：

```yaml
transformations:
  - name: "energy_to_emission"
    operations: [...]

  - name: "aggregate_by_facility"
    operations: [...]

  - name: "generate_report"
    operations: [...]
```

---

## 3. 文法仕様

### 3.1 プログラム構造

DSLプログラムは以下の3つのセクションから構成されます：

```yaml
metadata:
  # プログラムのメタ情報

constants:
  # 定数定義（排出係数、単価など）

transformation_steps:
  # 変換操作のシーケンス
```

### 3.2 メタデータセクション

```yaml
metadata:
  name: string              # 必須: プログラム名
  version: string           # 必須: バージョン（例: "1.0"）
  description: string       # 任意: 説明
  author: string           # 任意: 作成者
  created_at: date         # 任意: 作成日
  tags: string[]           # 任意: タグ
```

**例**:
```yaml
metadata:
  name: "Energy to GHG Emission Transformation"
  version: "1.0"
  description: "Transform energy consumption data to GHG emissions"
  author: "Sustainability Team"
  created_at: "2025-11-16"
  tags: ["ghg", "sustainability", "reporting"]
```

### 3.3 定数セクション

```yaml
constants:
  <constant_name>:
    <key>: <value>
    ...
```

**構造**:
- ネストした辞書として定義
- 任意の深さまでネスト可能
- 操作から `$constants.<path>` で参照

**例**:
```yaml
constants:
  emission_factors:
    electricity:
      factor: 0.5
      unit: "kg-CO2/kWh"
      scope: 2
    natural_gas:
      factor: 2.03
      unit: "kg-CO2/m³"
      scope: 1

  conversion_rates:
    usd_to_jpy: 150.0
    eur_to_jpy: 165.0
```

### 3.4 変換ステップセクション

```yaml
transformation_steps:
  - name: string              # ステップ名
    operations:               # 操作のリスト
      - operation: string     # 操作タイプ
        <param>: <value>      # 操作固有のパラメータ
        ...
```

---

## 4. セマンティクス

### 4.1 実行モデル

DSLプログラムは以下の順序で実行されます：

1. **初期化**: メタデータと定数を読み込み
2. **グラフ構築**: 入力データからLPGを構築
3. **変換実行**: transformation_stepsを順次実行
4. **出力生成**: 変換後のグラフを出力形式に変換

### 4.2 変数スコープ

**グローバルスコープ**:
- `metadata.*`: メタデータ
- `constants.*`: 定数

**ステップスコープ**:
- `$match.*`: マッチした要素への参照
- `$created.*`: 作成した要素への参照

**例**:
```yaml
operations:
  - operation: "match"
    pattern:
      type: "EnergyConsumption"
    bind_as: "$energy"  # $energy.amount でアクセス可能

  - operation: "calculate"
    field: "co2"
    formula: "$energy.amount * $constants.emission_factors.electricity.factor"
```

### 4.3 型強制と変換

DSLは動的型付けですが、以下の自動変換を行います：

```yaml
# 文字列 → 数値
amount: "1000"  # 1000 (number) に変換

# 日付文字列 → Date
date: "2024-01-15"  # Date object に変換

# null許容
optional_field: null  # プロパティとして設定されない
```

---

## 5. 型システム

### 5.1 基本型

| 型名 | 説明 | 例 |
|------|------|-----|
| `string` | 文字列 | `"Tokyo Plant"` |
| `number` | 数値（整数・浮動小数点） | `85000`, `0.5` |
| `boolean` | 真偽値 | `true`, `false` |
| `date` | 日付 | `"2024-01-15"` |
| `null` | Null値 | `null` |

### 5.2 複合型

**配列**:
```yaml
tags: ["ghg", "scope1", "scope2"]
```

**辞書**:
```yaml
properties:
  name: "F001"
  capacity: 1000
  active: true
```

### 5.3 グラフ型

**ノード型**:
```yaml
node:
  type: "Facility"
  properties:
    id: "F001"
    name: "Tokyo Plant"
```

**エッジ型**:
```yaml
edge:
  type: "CONSUMES"
  source: "$facility"
  target: "$energy"
  properties:
    since: "2024-01-01"
```

---

## 6. 操作リファレンス

### 6.1 MATCH操作

グラフからパターンにマッチする要素を検索します。

**文法**:
```yaml
operation: "match"
pattern:
  type: string                # ノード/エッジ型
  properties:                 # プロパティ条件（任意）
    <key>: <value>
  bind_as: string            # 変数名（任意）
```

**例**:
```yaml
- operation: "match"
  pattern:
    type: "EnergyConsumption"
    properties:
      facility_id: "F001"
      month: "2024-01"
  bind_as: "$energy"
```

**セマンティクス**:
- `type`にマッチするすべてのノードを検索
- `properties`の条件を満たすノードをフィルタ
- マッチした要素を`bind_as`で指定した変数に束縛

### 6.2 CREATE操作

新しいノードまたはエッジを作成します。

**文法（ノード）**:
```yaml
operation: "create"
node:
  type: string
  properties:
    <key>: <value_or_expression>
  bind_as: string            # 任意
```

**例**:
```yaml
- operation: "create"
  node:
    type: "Emission"
    properties:
      facility_id: "$energy.facility_id"
      co2_amount: "$calculated.co2"
      scope: 1
  bind_as: "$emission"
```

**文法（エッジ）**:
```yaml
operation: "create"
edge:
  type: string
  source: string             # ノード参照
  target: string             # ノード参照
  properties:
    <key>: <value>
```

**例**:
```yaml
- operation: "create"
  edge:
    type: "EMITS"
    source: "$facility"
    target: "$emission"
    properties:
      calculated_at: "2024-11-16"
```

### 6.3 CALCULATE操作

計算を実行し、結果をフィールドに設定します。

**文法**:
```yaml
operation: "calculate"
field: string                # 設定先フィールド名
formula: string              # 式または関数名
parameters:                  # 任意: パラメータ
  <key>: <value>
bind_as: string             # 任意: 結果を変数に束縛
```

**サポートされる式**:
- 算術演算: `+`, `-`, `*`, `/`, `%`, `**`
- 比較演算: `==`, `!=`, `<`, `>`, `<=`, `>=`
- 論理演算: `&&`, `||`, `!`
- 関数呼び出し: `sum()`, `avg()`, `min()`, `max()`

**例**:
```yaml
- operation: "calculate"
  field: "co2_amount"
  formula: "$energy.amount * $constants.emission_factors[$energy.energy_type].factor"
  bind_as: "$calculated.co2"
```

**組み込み関数**:

| 関数 | 説明 | 例 |
|------|------|-----|
| `sum(array)` | 配列の合計 | `sum($emissions.co2_amount)` |
| `avg(array)` | 配列の平均 | `avg($temperatures)` |
| `min(array)` | 最小値 | `min($values)` |
| `max(array)` | 最大値 | `max($values)` |
| `round(num, digits)` | 四捨五入 | `round($value, 2)` |
| `abs(num)` | 絶対値 | `abs($diff)` |

### 6.4 AGGREGATE操作

グループ化と集約を行います。

**文法**:
```yaml
operation: "aggregate"
group_by: string[]           # グループキー
aggregations:                # 集約関数
  - field: string            # 出力フィールド名
    function: string         # 集約関数（sum, avg, count, min, max）
    source: string           # 集約対象フィールド
output_type: string          # 出力ノード型
```

**例**:
```yaml
- operation: "aggregate"
  group_by: ["facility_id", "month"]
  aggregations:
    - field: "total_co2"
      function: "sum"
      source: "co2_amount"
    - field: "emission_count"
      function: "count"
      source: "*"
    - field: "avg_co2"
      function: "avg"
      source: "co2_amount"
  output_type: "MonthlyReport"
```

**セマンティクス**:
1. `group_by`で指定したフィールドでグループ化
2. 各グループに対して`aggregations`を実行
3. 結果を`output_type`型のノードとして作成

### 6.5 FILTER操作

条件に基づいて要素をフィルタします。

**文法**:
```yaml
operation: "filter"
condition: string            # 条件式
keep: boolean               # true: 条件を満たす要素を保持, false: 削除
```

**例**:
```yaml
- operation: "filter"
  condition: "$emission.co2_amount > 1000"
  keep: true

- operation: "filter"
  condition: "$facility.active == false"
  keep: false  # 非アクティブな施設を除外
```

### 6.6 SET操作

既存ノードのプロパティを更新します。

**文法**:
```yaml
operation: "set"
target: string               # 対象ノード参照
properties:
  <key>: <value_or_expression>
```

**例**:
```yaml
- operation: "set"
  target: "$facility"
  properties:
    last_calculated: "2024-11-16"
    total_emissions: "$calculated.total_co2"
    status: "reported"
```

### 6.7 DELETE操作

ノードまたはエッジを削除します。

**文法**:
```yaml
operation: "delete"
target: string               # 削除対象参照
cascade: boolean            # true: 関連要素も削除
```

**例**:
```yaml
- operation: "delete"
  target: "$temporary_node"
  cascade: false

- operation: "delete"
  target: "$facility"
  cascade: true  # このノードと接続されたエッジも削除
```

---

## 7. 使用例

### 7.1 基本例: エネルギー消費からGHG排出量計算

```yaml
metadata:
  name: "Energy to GHG Emission"
  version: "1.0"
  description: "Calculate GHG emissions from energy consumption"

constants:
  emission_factors:
    electricity:
      factor: 0.5
      scope: 2
    natural_gas:
      factor: 2.03
      scope: 1

transformation_steps:
  # ステップ1: エネルギー消費データをマッチ
  - name: "match_energy"
    operations:
      - operation: "match"
        pattern:
          type: "EnergyConsumption"
        bind_as: "$energy"

  # ステップ2: CO2排出量を計算
  - name: "calculate_emissions"
    operations:
      - operation: "calculate"
        field: "co2_amount"
        formula: "$energy.amount * $constants.emission_factors[$energy.energy_type].factor"
        bind_as: "$co2"

      - operation: "calculate"
        field: "scope"
        formula: "$constants.emission_factors[$energy.energy_type].scope"
        bind_as: "$scope"

  # ステップ3: 排出レコードを作成
  - name: "create_emission"
    operations:
      - operation: "create"
        node:
          type: "Emission"
          properties:
            facility_id: "$energy.facility_id"
            month: "$energy.month"
            energy_type: "$energy.energy_type"
            co2_amount: "$co2"
            scope: "$scope"
            source_id: "$energy.id"
        bind_as: "$emission"

      - operation: "create"
        edge:
          type: "CALCULATED_FROM"
          source: "$emission"
          target: "$energy"
```

### 7.2 中級例: 施設別月次レポート生成

```yaml
metadata:
  name: "Monthly Facility GHG Report"
  version: "1.0"

transformation_steps:
  # ステップ1: 排出データを集約
  - name: "aggregate_by_facility_month"
    operations:
      - operation: "match"
        pattern:
          type: "Emission"
        bind_as: "$emission"

      - operation: "aggregate"
        group_by: ["facility_id", "month"]
        aggregations:
          - field: "total_scope1"
            function: "sum"
            source: "co2_amount"
            filter: "$emission.scope == 1"

          - field: "total_scope2"
            function: "sum"
            source: "co2_amount"
            filter: "$emission.scope == 2"

          - field: "total_co2"
            function: "sum"
            source: "co2_amount"

          - field: "emission_count"
            function: "count"
            source: "*"

        output_type: "MonthlyReport"
        bind_as: "$report"

  # ステップ2: 施設情報を追加
  - name: "enrich_with_facility_info"
    operations:
      - operation: "match"
        pattern:
          type: "Facility"
          properties:
            id: "$report.facility_id"
        bind_as: "$facility"

      - operation: "set"
        target: "$report"
        properties:
          facility_name: "$facility.name"
          facility_type: "$facility.type"
          facility_location: "$facility.location"

  # ステップ3: コンプライアンスチェック
  - name: "check_compliance"
    operations:
      - operation: "calculate"
        field: "compliance_status"
        formula: "$report.total_co2 <= $facility.emission_limit ? 'COMPLIANT' : 'EXCEEDED'"

      - operation: "set"
        target: "$report"
        properties:
          compliance_status: "$compliance_status"
          check_date: "2024-11-16"
```

### 7.3 高度な例: サプライチェーンScope 3計算

```yaml
metadata:
  name: "Supply Chain Scope 3 Emissions"
  version: "1.0"
  description: "Calculate Scope 3 emissions across supply chain"

constants:
  transport_factors:
    truck:
      factor: 0.1  # kg-CO2/ton-km
    ship:
      factor: 0.015
    air:
      factor: 0.5

  supplier_intensity:
    steel: 2.5    # kg-CO2/kg
    plastic: 3.2
    aluminum: 8.1

transformation_steps:
  # ステップ1: 調達データからScope 3計算
  - name: "calculate_procurement_emissions"
    operations:
      - operation: "match"
        pattern:
          type: "Procurement"
        bind_as: "$proc"

      - operation: "calculate"
        field: "embodied_co2"
        formula: "$proc.quantity * $constants.supplier_intensity[$proc.material_type]"
        bind_as: "$embodied"

      - operation: "create"
        node:
          type: "Scope3Emission"
          properties:
            category: "Purchased Goods"
            source_id: "$proc.id"
            co2_amount: "$embodied"
            material_type: "$proc.material_type"

  # ステップ2: 輸送データからScope 3計算
  - name: "calculate_transport_emissions"
    operations:
      - operation: "match"
        pattern:
          type: "Transport"
        bind_as: "$trans"

      - operation: "calculate"
        field: "transport_co2"
        formula: "$trans.weight * $trans.distance * $constants.transport_factors[$trans.mode].factor"
        bind_as: "$trans_co2"

      - operation: "create"
        node:
          type: "Scope3Emission"
          properties:
            category: "Upstream Transportation"
            source_id: "$trans.id"
            co2_amount: "$trans_co2"
            transport_mode: "$trans.mode"

  # ステップ3: 全体を集約
  - name: "aggregate_scope3"
    operations:
      - operation: "match"
        pattern:
          type: "Scope3Emission"
        bind_as: "$scope3"

      - operation: "aggregate"
        group_by: ["category"]
        aggregations:
          - field: "total_co2"
            function: "sum"
            source: "co2_amount"
          - field: "emission_count"
            function: "count"
            source: "*"
        output_type: "Scope3Summary"
```

---

## 8. ベストプラクティス

### 8.1 命名規則

**推奨**:
- メタデータ名: 動詞 + 対象（例: "Calculate GHG Emissions"）
- ステップ名: 動詞_対象（例: "aggregate_by_facility"）
- 変数名: $小文字_アンダースコア（例: "$energy_consumption"）
- 定数名: UPPER_SNAKE_CASE（例: "EMISSION_FACTORS"）

**例**:
```yaml
metadata:
  name: "Transform Manufacturing Data to GHG Report"

constants:
  EMISSION_FACTORS:
    electricity: 0.5

transformation_steps:
  - name: "calculate_scope1_emissions"
    operations:
      - operation: "match"
        bind_as: "$energy_data"
```

### 8.2 モジュール化

複雑な変換は複数のステップに分割：

```yaml
# 良い例: ステップを明確に分離
transformation_steps:
  - name: "extract_energy_data"
    operations: [...]

  - name: "calculate_emissions"
    operations: [...]

  - name: "aggregate_by_facility"
    operations: [...]

  - name: "generate_report"
    operations: [...]
```

```yaml
# 悪い例: すべてを1ステップに
transformation_steps:
  - name: "do_everything"
    operations:
      - operation: "match"
      - operation: "calculate"
      - operation: "aggregate"
      - operation: "create"
      # ... 50個の操作
```

### 8.3 定数の活用

マジックナンバーを避け、定数として定義：

```yaml
# 良い例
constants:
  ELECTRICITY_FACTOR: 0.5
  GAS_FACTOR: 2.03

operations:
  - operation: "calculate"
    formula: "$amount * $constants.ELECTRICITY_FACTOR"
```

```yaml
# 悪い例
operations:
  - operation: "calculate"
    formula: "$amount * 0.5"  # この0.5は何？
```

### 8.4 バリデーション

重要な計算の前に条件チェック：

```yaml
operations:
  - operation: "filter"
    condition: "$energy.amount > 0"
    keep: true

  - operation: "filter"
    condition: "$energy.energy_type != null"
    keep: true

  - operation: "calculate"
    field: "co2"
    formula: "$energy.amount * $factor"
```

### 8.5 ドキュメント化

メタデータとコメントで意図を明確に：

```yaml
metadata:
  name: "Energy to GHG Emission Transformation"
  description: |
    This transformation calculates GHG emissions from energy consumption data
    according to GHG Protocol standards.

    Scope 1: Direct emissions from owned sources (natural gas, fuel oil)
    Scope 2: Indirect emissions from purchased electricity

    Emission factors are based on national averages as of 2024.

  version: "1.0"
  author: "Sustainability Team"
  references:
    - "GHG Protocol Corporate Standard (2004)"
    - "EPA Emission Factors (2024)"
```

---

## 9. エラーハンドリング

### 9.1 パースエラー

**エラー**: YAML構文エラー

```yaml
# エラー例: インデントが不正
metadata:
  name: "Test"
 version: "1.0"  # インデントが浅すぎる
```

**エラーメッセージ**:
```
DSLParseError: Invalid YAML syntax at line 3
Expected indentation of 2 spaces, found 1
```

**解決策**: YAMLバリデータでチェック、エディタの構文ハイライトを使用

### 9.2 型エラー

**エラー**: 不正な型の値

```yaml
operations:
  - operation: "calculate"
    formula: "$energy.amount * 'invalid'"  # 文字列を数値演算
```

**エラーメッセージ**:
```
DSLTypeError: Cannot multiply number with string
at operation 'calculate', formula "$energy.amount * 'invalid'"
```

**解決策**: 型を確認、必要に応じて型変換関数を使用

### 9.3 参照エラー

**エラー**: 存在しない変数の参照

```yaml
operations:
  - operation: "create"
    properties:
      value: "$undefined_variable"  # 未定義
```

**エラーメッセージ**:
```
DSLReferenceError: Undefined variable '$undefined_variable'
Available variables: $energy, $facility, $constants
```

**解決策**: 変数のスコープを確認、bind_asで正しく束縛されているか確認

### 9.4 ランタイムエラー

**エラー**: 実行時の条件違反

```yaml
operations:
  - operation: "calculate"
    formula: "$amount / $divisor"  # $divisor が 0
```

**エラーメッセージ**:
```
DSLRuntimeError: Division by zero
at operation 'calculate', formula "$amount / $divisor"
Values: $amount=100, $divisor=0
```

**解決策**: ガード条件を追加

```yaml
operations:
  - operation: "filter"
    condition: "$divisor != 0"
    keep: true

  - operation: "calculate"
    formula: "$amount / $divisor"
```

### 9.5 エラーハンドリング戦略

**戦略1: 早期失敗（Fail Fast）**

```yaml
transformation_steps:
  - name: "validate_input"
    operations:
      - operation: "filter"
        condition: "$energy.amount != null && $energy.amount > 0"
        keep: true
        on_error: "abort"  # エラー時は即座に中止
```

**戦略2: デフォルト値**

```yaml
operations:
  - operation: "calculate"
    formula: "$energy.amount * ($constants.FACTOR ?? 0.5)"  # null合体演算子
```

**戦略3: エラーログ**

```yaml
operations:
  - operation: "calculate"
    formula: "$risky_calculation"
    on_error:
      action: "log_and_continue"
      default_value: 0
      log_level: "warning"
```

---

## 10. パフォーマンスガイドライン

### 10.1 効率的なパターンマッチング

**推奨**: 具体的な条件を先に指定

```yaml
# 良い例: typeとpropertiesで絞り込み
- operation: "match"
  pattern:
    type: "EnergyConsumption"
    properties:
      facility_id: "F001"
      month: "2024-01"
```

```yaml
# 悪い例: すべてマッチしてからフィルタ
- operation: "match"
  pattern:
    type: "EnergyConsumption"

- operation: "filter"
  condition: "$energy.facility_id == 'F001' && $energy.month == '2024-01'"
```

### 10.2 集約の最適化

**推奨**: 1回の集約で複数の指標を計算

```yaml
# 良い例
- operation: "aggregate"
  group_by: ["facility_id"]
  aggregations:
    - field: "total_co2"
      function: "sum"
      source: "co2_amount"
    - field: "avg_co2"
      function: "avg"
      source: "co2_amount"
    - field: "max_co2"
      function: "max"
      source: "co2_amount"
```

```yaml
# 悪い例: 3回集約
- operation: "aggregate"
  aggregations:
    - field: "total_co2"
      function: "sum"

- operation: "aggregate"
  aggregations:
    - field: "avg_co2"
      function: "avg"

- operation: "aggregate"
  aggregations:
    - field: "max_co2"
      function: "max"
```

### 10.3 メモリ効率

大規模データでは、不要なノードを早期に削除：

```yaml
operations:
  - operation: "create"
    node:
      type: "TemporaryCalculation"
    bind_as: "$temp"

  - operation: "calculate"
    # $tempを使用

  - operation: "delete"
    target: "$temp"  # 不要になったら削除
```

---

## 11. まとめ

Dynamic Ontology DSLは、グラフデータの変換を宣言的に記述するための強力な言語です。

**主な利点**:
- ✅ 人間可読なYAML形式
- ✅ 型安全な操作
- ✅ MTT/Cypherへのコンパイル可能
- ✅ ビジネスロジックの明確な表現

**次のステップ**:
1. サンプルDSLを実行（`examples/ghg-transformation.dsl.yaml`）
2. 自分のユースケースに応じてカスタマイズ
3. MTT仕様書も参照して内部動作を理解

---

## 付録 A: 完全な文法（EBNF）

```ebnf
Program ::= Metadata Constants TransformationSteps

Metadata ::= "metadata:" MetadataFields

MetadataFields ::=
  "name:" String
  "version:" String
  ("description:" String)?
  ("author:" String)?
  ("created_at:" Date)?
  ("tags:" StringArray)?

Constants ::= "constants:" ConstantDefinitions

ConstantDefinitions ::= (Identifier ":" Value)*

TransformationSteps ::= "transformation_steps:" StepList

StepList ::= Step*

Step ::=
  "- name:" String
  "operations:" OperationList

OperationList ::= Operation*

Operation ::= MatchOp | CreateOp | CalculateOp | AggregateOp |
              FilterOp | SetOp | DeleteOp

MatchOp ::=
  "- operation: \"match\""
  "pattern:"
  "  type:" String
  ("  properties:" PropertyMap)?
  ("bind_as:" Variable)?

CreateOp ::=
  "- operation: \"create\""
  ("node:" NodeDef | "edge:" EdgeDef)
  ("bind_as:" Variable)?

CalculateOp ::=
  "- operation: \"calculate\""
  "field:" String
  "formula:" Expression
  ("bind_as:" Variable)?

AggregateOp ::=
  "- operation: \"aggregate\""
  "group_by:" StringArray
  "aggregations:" AggregationList
  "output_type:" String

FilterOp ::=
  "- operation: \"filter\""
  "condition:" Expression
  "keep:" Boolean

SetOp ::=
  "- operation: \"set\""
  "target:" Variable
  "properties:" PropertyMap

DeleteOp ::=
  "- operation: \"delete\""
  "target:" Variable
  ("cascade:" Boolean)?

Expression ::=
  Literal | Variable | BinaryOp | FunctionCall

Literal ::= String | Number | Boolean | Null

Variable ::= "$" Identifier ("." Identifier)*

BinaryOp ::= Expression Operator Expression

Operator ::= "+" | "-" | "*" | "/" | "%" | "**" |
             "==" | "!=" | "<" | ">" | "<=" | ">=" |
             "&&" | "||"

FunctionCall ::= Identifier "(" (Expression ("," Expression)*)? ")"
```

---

## 付録 B: クイックリファレンス

| 操作 | 用途 | 例 |
|------|------|-----|
| `match` | パターンマッチング | `type: "EnergyConsumption"` |
| `create` | ノード/エッジ作成 | `node: {type: "Emission"}` |
| `calculate` | 計算 | `formula: "$a * $b"` |
| `aggregate` | 集約 | `function: "sum"` |
| `filter` | フィルタリング | `condition: "$x > 10"` |
| `set` | プロパティ更新 | `target: "$node"` |
| `delete` | 削除 | `target: "$temp"` |

---

**ドキュメント終わり**
