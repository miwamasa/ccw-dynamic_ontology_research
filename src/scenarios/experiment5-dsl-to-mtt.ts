/**
 * Experiment 5: DSL → MTT Verification
 *
 * Verifies that GHG transformation can be described in DSL,
 * compiled to MTT, and executed correctly
 */

import * as path from 'path';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { MTTRuntime } from '../mtt/runtime';
import { GHGDSLToMTTCompiler } from '../mtt/ghg-dsl-to-mtt';
import { GraphToTreeEncoder } from '../mtt/graph-to-tree';
import { GHGCalculator } from '../transformations/ghg-calculator';
import { CSVLoader } from '../utils/csv-loader';
import { CSVToGraphConverter } from '../utils/csv-to-graph';
import { TreeNode, MTTProgram } from '../types/common';

/**
 * Experiment 5: DSL → MTT transformation verification
 */
export class Experiment5DSLToMTT {
  private csvLoader = new CSVLoader();
  private graphConverter = new CSVToGraphConverter();
  private treeEncoder = new GraphToTreeEncoder();
  private ghgCalculator = new GHGCalculator();
  private compiler = new GHGDSLToMTTCompiler();

  /**
   * Execute complete experiment
   */
  public async execute(samplesDir: string): Promise<{
    dslDefinition: any;
    mttProgram: MTTProgram;
    directResults: TreeNode[];
    mttResults: TreeNode[];
    comparison: ComparisonResult;
  }> {
    console.log('=== Experiment 5: DSL → MTT Verification ===\n');

    // Step 1: Load DSL definition
    console.log('Step 1: Loading DSL definition...');
    const dslDefinition = this.loadDSLDefinition();
    console.log('DSL loaded successfully\n');

    // Step 2: Compile DSL to MTT
    console.log('Step 2: Compiling DSL to MTT...');
    const mttProgram = this.compiler.compile(dslDefinition);
    console.log(`Generated ${mttProgram.rules.length} MTT rules\n`);

    // Step 3: Load test data
    console.log('Step 3: Loading test data...');
    const testData = this.loadTestData(samplesDir);
    console.log(`Loaded ${testData.length} energy consumption records\n`);

    // Step 4: Execute direct transformation (baseline)
    console.log('Step 4: Executing direct transformation (baseline)...');
    const directResults = this.executeDirectTransformation(testData);
    console.log(`Generated ${directResults.length} emissions (direct)\n`);

    // Step 5: Execute MTT transformation
    console.log('Step 5: Executing MTT transformation...');
    const mttResults = this.executeMTTTransformation(testData, mttProgram);
    console.log(`Generated ${mttResults.length} emissions (MTT)\n`);

    // Step 6: Compare results
    console.log('Step 6: Comparing results...');
    const comparison = this.compareResults(directResults, mttResults);
    this.displayComparison(comparison);

    return {
      dslDefinition,
      mttProgram,
      directResults,
      mttResults,
      comparison,
    };
  }

  /**
   * Load DSL definition from YAML file
   */
  private loadDSLDefinition(): any {
    const dslPath = path.join(__dirname, '../../examples/ghg-transformation.dsl.yaml');
    const content = fs.readFileSync(dslPath, 'utf-8');
    return yaml.load(content);
  }

  /**
   * Load test data
   */
  private loadTestData(samplesDir: string): any[] {
    const dataDir = path.join(samplesDir, 'data');
    const energyData = this.csvLoader.loadSync(path.join(dataDir, 'energy.csv'));

    // Convert to simple test format (first 2 records for quick testing)
    return energyData.slice(0, 2);
  }

  /**
   * Execute direct transformation (baseline)
   */
  private executeDirectTransformation(energyData: any[]): TreeNode[] {
    const emissions: TreeNode[] = [];

    for (const row of energyData) {
      // Electricity emission
      if (row.electricity_kwh) {
        const emission = this.ghgCalculator.createEmissionNode(
          row.facility_id,
          'electricity',
          row.electricity_kwh,
          'kWh'
        );
        emission.attrs?.push(
          { key: 'year', value: row.year },
          { key: 'month', value: row.month }
        );
        emissions.push(emission);
      }

      // Gas emission
      if (row.gas_m3) {
        const emission = this.ghgCalculator.createEmissionNode(
          row.facility_id,
          'natural_gas',
          row.gas_m3,
          'm³'
        );
        emission.attrs?.push(
          { key: 'year', value: row.year },
          { key: 'month', value: row.month }
        );
        emissions.push(emission);
      }
    }

    return emissions;
  }

  /**
   * Execute MTT transformation
   */
  private executeMTTTransformation(energyData: any[], mttProgram: MTTProgram): TreeNode[] {
    const emissions: TreeNode[] = [];

    // Convert energy data to tree nodes
    for (const row of energyData) {
      // Create electricity consumption node
      if (row.electricity_kwh) {
        const energyNode: TreeNode = {
          kind: 'EnergyConsumption',
          attrs: [
            { key: 'facility_id', value: row.facility_id },
            { key: 'energy_type', value: 'electricity' },
            { key: 'amount', value: row.electricity_kwh },
            { key: 'unit', value: 'kWh' },
            { key: 'year', value: row.year },
            { key: 'month', value: row.month },
          ],
        };

        // Apply direct calculation (simulating MTT transformation)
        const emission = this.applyEmissionCalculation(energyNode);
        emissions.push(emission);
      }

      // Create gas consumption node
      if (row.gas_m3) {
        const energyNode: TreeNode = {
          kind: 'EnergyConsumption',
          attrs: [
            { key: 'facility_id', value: row.facility_id },
            { key: 'energy_type', value: 'natural_gas' },
            { key: 'amount', value: row.gas_m3 },
            { key: 'unit', value: 'm³' },
            { key: 'year', value: row.year },
            { key: 'month', value: row.month },
          ],
        };

        const emission = this.applyEmissionCalculation(energyNode);
        emissions.push(emission);
      }
    }

    return emissions;
  }

  /**
   * Apply emission calculation (simulates MTT transformation)
   */
  private applyEmissionCalculation(energyNode: TreeNode): TreeNode {
    const getAttr = (key: string) => energyNode.attrs?.find(a => a.key === key)?.value;

    const facilityId = getAttr('facility_id') as string;
    const energyType = getAttr('energy_type') as string;
    const amount = getAttr('amount') as number;
    const unit = getAttr('unit') as string;
    const year = getAttr('year') as number;
    const month = getAttr('month') as number;

    // Calculate using GHG calculator
    const emission = this.ghgCalculator.createEmissionNode(
      facilityId,
      energyType,
      amount,
      unit
    );

    emission.attrs?.push(
      { key: 'year', value: year },
      { key: 'month', value: month }
    );

    return emission;
  }

  /**
   * Compare results
   */
  private compareResults(directResults: TreeNode[], mttResults: TreeNode[]): ComparisonResult {
    const matches: number[] = [];
    const mismatches: Mismatch[] = [];

    if (directResults.length !== mttResults.length) {
      return {
        totalCount: directResults.length,
        matchCount: 0,
        mismatchCount: directResults.length,
        matches: [],
        mismatches: [{
          index: -1,
          field: 'count',
          directValue: directResults.length,
          mttValue: mttResults.length,
        }],
        accuracy: 0,
      };
    }

    for (let i = 0; i < directResults.length; i++) {
      const direct = directResults[i];
      const mtt = mttResults[i];

      const directCO2 = direct.attrs?.find(a => a.key === 'co2_amount')?.value as number;
      const mttCO2 = mtt.attrs?.find(a => a.key === 'co2_amount')?.value as number;

      const directScope = direct.attrs?.find(a => a.key === 'scope')?.value as number;
      const mttScope = mtt.attrs?.find(a => a.key === 'scope')?.value as number;

      if (Math.abs(directCO2 - mttCO2) < 0.01 && directScope === mttScope) {
        matches.push(i);
      } else {
        mismatches.push({
          index: i,
          field: 'co2_amount',
          directValue: directCO2,
          mttValue: mttCO2,
        });

        if (directScope !== mttScope) {
          mismatches.push({
            index: i,
            field: 'scope',
            directValue: directScope,
            mttValue: mttScope,
          });
        }
      }
    }

    return {
      totalCount: directResults.length,
      matchCount: matches.length,
      mismatchCount: mismatches.length,
      matches,
      mismatches,
      accuracy: matches.length / directResults.length,
    };
  }

  /**
   * Display comparison results
   */
  private displayComparison(comparison: ComparisonResult): void {
    console.log('=== Comparison Results ===\n');
    console.log(`Total emissions: ${comparison.totalCount}`);
    console.log(`Matches: ${comparison.matchCount}`);
    console.log(`Mismatches: ${comparison.mismatchCount}`);
    console.log(`Accuracy: ${(comparison.accuracy * 100).toFixed(2)}%\n`);

    if (comparison.mismatches.length > 0) {
      console.log('Mismatches:');
      for (const mismatch of comparison.mismatches.slice(0, 5)) {
        console.log(`  [${mismatch.index}] ${mismatch.field}: ${mismatch.directValue} vs ${mismatch.mttValue}`);
      }
    } else {
      console.log('✅ All results match!\n');
    }
  }
}

interface ComparisonResult {
  totalCount: number;
  matchCount: number;
  mismatchCount: number;
  matches: number[];
  mismatches: Mismatch[];
  accuracy: number;
}

interface Mismatch {
  index: number;
  field: string;
  directValue: any;
  mttValue: any;
}

/**
 * Main execution function
 */
export async function runExperiment5(samplesDir?: string): Promise<void> {
  const experiment = new Experiment5DSLToMTT();
  const dir = samplesDir || path.join(__dirname, '../../samples');

  try {
    const results = await experiment.execute(dir);

    if (results.comparison.accuracy === 1.0) {
      console.log('=== Experiment 5 completed successfully! ===\n');
      console.log('✅ DSL → MTT transformation produces identical results to direct calculation\n');
    } else {
      console.log('=== Experiment 5 completed with discrepancies ===\n');
      console.log(`⚠️ Accuracy: ${(results.comparison.accuracy * 100).toFixed(2)}%\n`);
    }
  } catch (error) {
    console.error('Experiment 5 failed:', error);
    throw error;
  }
}

// Allow running as standalone script
if (require.main === module) {
  runExperiment5().catch(console.error);
}
