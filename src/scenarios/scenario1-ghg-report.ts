/**
 * Scenario 1: Manufacturing Data to GHG Report Generation
 *
 * Complete end-to-end transformation from CSV data to GHG emission reports
 */

import * as path from 'path';
import { CSVLoader } from '../utils/csv-loader';
import { CSVToGraphConverter, ConversionSchema } from '../utils/csv-to-graph';
import { GraphToTreeEncoder } from '../mtt/graph-to-tree';
import { GHGCalculator } from '../transformations/ghg-calculator';
import { Graph, TreeNode } from '../types/common';

/**
 * Scenario 1: GHG Report Generation
 */
export class Scenario1GHGReport {
  private csvLoader = new CSVLoader();
  private graphConverter = new CSVToGraphConverter();
  private treeEncoder = new GraphToTreeEncoder();
  private ghgCalculator = new GHGCalculator();

  /**
   * Execute complete scenario
   */
  public async execute(samplesDir: string): Promise<{
    graph: Graph;
    tree: TreeNode;
    emissions: TreeNode[];
    reports: TreeNode[];
  }> {
    console.log('=== Scenario 1: Manufacturing Data to GHG Report ===\n');

    // Step 1: Load CSV data
    console.log('Step 1: Loading CSV data...');
    const datasets = this.loadCSVData(samplesDir);
    console.log(`Loaded ${Object.keys(datasets).length} datasets`);
    console.log(`  - facilities: ${datasets.facilities.length} rows`);
    console.log(`  - energy: ${datasets.energy.length} rows`);
    console.log(`  - emissions: ${datasets.emissions?.length || 0} rows\n`);

    // Step 2: Convert CSV to Graph
    console.log('Step 2: Converting CSV to LPG...');
    const graph = this.convertToGraph(datasets);
    console.log(`Created graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges\n`);

    // Step 3: Encode Graph as Tree
    console.log('Step 3: Encoding graph as tree...');
    const tree = this.treeEncoder.encode(graph, 'nested');
    console.log('Tree encoding complete\n');

    // Step 4: Process energy data and calculate emissions
    console.log('Step 4: Calculating emissions...');
    const emissions = this.calculateEmissions(datasets.energy, datasets.facilities);
    console.log(`Generated ${emissions.length} emission records\n`);

    // Step 5: Generate reports by facility
    console.log('Step 5: Generating GHG reports...');
    const reports = this.generateReports(emissions, datasets.energy);
    console.log(`Generated ${reports.length} GHG reports\n`);

    // Step 6: Display results
    this.displayResults(reports);

    return {
      graph,
      tree,
      emissions,
      reports,
    };
  }

  /**
   * Load CSV data from samples directory
   */
  private loadCSVData(samplesDir: string): {
    facilities: any[];
    energy: any[];
    emissions?: any[];
  } {
    const dataDir = path.join(samplesDir, 'data');

    return {
      facilities: this.csvLoader.loadSync(path.join(dataDir, 'facilities.csv')),
      energy: this.csvLoader.loadSync(path.join(dataDir, 'energy.csv')),
      emissions: this.csvLoader.loadSync(path.join(dataDir, 'emissions.csv')),
    };
  }

  /**
   * Convert CSV datasets to unified graph
   */
  private convertToGraph(datasets: any): Graph {
    const schemas: { [name: string]: ConversionSchema } = {
      facilities: {
        nodeType: 'Facility',
        idField: 'facility_id',
        propertyFields: ['facility_name', 'facility_type', 'location', 'capacity'],
      },
      energy: {
        nodeType: 'EnergyConsumption',
        idField: 'facility_id', // Will create composite ID
        propertyFields: ['year', 'month', 'electricity_kwh', 'gas_m3', 'renewable_ratio'],
        edges: [
          {
            label: 'consumes_at',
            sourceField: 'facility_id',
            targetNodeType: 'Facility',
            targetField: 'facility_id',
          },
        ],
      },
    };

    return this.graphConverter.convertMultipleToGraph(datasets, schemas);
  }

  /**
   * Calculate emissions from energy data
   */
  private calculateEmissions(energyData: any[], facilitiesData: any[]): TreeNode[] {
    const emissions: TreeNode[] = [];

    for (const row of energyData) {
      const facilityId = row.facility_id;

      // Calculate emissions for electricity
      if (row.electricity_kwh) {
        const emission = this.ghgCalculator.createEmissionNode(
          facilityId,
          'electricity',
          row.electricity_kwh,
          'kWh'
        );
        // Add year and month
        emission.attrs?.push(
          { key: 'year', value: row.year },
          { key: 'month', value: row.month }
        );
        emissions.push(emission);
      }

      // Calculate emissions for natural gas
      if (row.gas_m3) {
        const emission = this.ghgCalculator.createEmissionNode(
          facilityId,
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
   * Generate GHG reports grouped by facility and period
   */
  private generateReports(emissions: TreeNode[], energyData: any[]): TreeNode[] {
    const reports: TreeNode[] = [];
    const grouped = new Map<string, TreeNode[]>();

    // Group emissions by facility-year-month
    for (const emission of emissions) {
      const facilityId = emission.attrs?.find(a => a.key === 'facility_id')?.value;
      const year = emission.attrs?.find(a => a.key === 'year')?.value;
      const month = emission.attrs?.find(a => a.key === 'month')?.value;

      const key = `${facilityId}-${year}-${month}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(emission);
    }

    // Create report for each group
    for (const [key, emissionNodes] of grouped) {
      const [facilityId, year, month] = key.split('-');
      const report = this.ghgCalculator.createReport(
        facilityId,
        emissionNodes,
        parseInt(year),
        parseInt(month)
      );
      reports.push(report);
    }

    return reports;
  }

  /**
   * Display results summary
   */
  private displayResults(reports: TreeNode[]): void {
    console.log('=== GHG Report Summary ===\n');

    for (const report of reports) {
      const facilityId = report.attrs?.find(a => a.key === 'facility_id')?.value;
      const year = report.attrs?.find(a => a.key === 'year')?.value;
      const month = report.attrs?.find(a => a.key === 'month')?.value;
      const scope1 = report.attrs?.find(a => a.key === 'total_scope1')?.value;
      const scope2 = report.attrs?.find(a => a.key === 'total_scope2')?.value;
      const total = report.attrs?.find(a => a.key === 'total_emissions')?.value;

      console.log(`Facility: ${facilityId} | Period: ${year}-${String(month).padStart(2, '0')}`);
      console.log(`  Scope 1 (Direct): ${scope1} kg-CO2`);
      console.log(`  Scope 2 (Indirect): ${scope2} kg-CO2`);
      console.log(`  Total: ${total} kg-CO2`);
      console.log('');
    }
  }

  /**
   * Export results to JSON
   */
  public exportToJSON(reports: TreeNode[]): string {
    return JSON.stringify(reports, null, 2);
  }
}

/**
 * Main execution function
 */
export async function runScenario1(samplesDir?: string): Promise<void> {
  const scenario = new Scenario1GHGReport();
  const dir = samplesDir || path.join(__dirname, '../../samples');

  try {
    const results = await scenario.execute(dir);
    console.log('=== Scenario 1 completed successfully! ===\n');

    // Export to JSON
    const json = scenario.exportToJSON(results.reports);
    console.log('JSON Export (first 500 chars):');
    console.log(json.substring(0, 500) + '...\n');
  } catch (error) {
    console.error('Scenario 1 failed:', error);
    throw error;
  }
}

// Allow running as standalone script
if (require.main === module) {
  runScenario1().catch(console.error);
}
