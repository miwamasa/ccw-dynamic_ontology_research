/**
 * Scenario 1 Integration Test
 */

import * as path from 'path';
import { Scenario1GHGReport } from '../scenarios/scenario1-ghg-report';

describe('Scenario 1: GHG Report Generation', () => {
  const samplesDir = path.join(__dirname, '../../samples');
  let scenario: Scenario1GHGReport;

  beforeEach(() => {
    scenario = new Scenario1GHGReport();
  });

  test('should load CSV data and generate GHG reports', async () => {
    const results = await scenario.execute(samplesDir);

    // Verify graph was created
    expect(results.graph).toBeDefined();
    expect(results.graph.nodes.length).toBeGreaterThan(0);

    // Verify tree encoding
    expect(results.tree).toBeDefined();
    expect(results.tree.kind).toBe('graph');

    // Verify emissions were calculated
    expect(results.emissions).toBeDefined();
    expect(results.emissions.length).toBeGreaterThan(0);

    // Each emission should have required attributes
    for (const emission of results.emissions) {
      expect(emission.kind).toBe('Emission');
      expect(emission.attrs).toBeDefined();

      const attrs = emission.attrs!;
      const attrKeys = attrs.map(a => a.key);

      expect(attrKeys).toContain('facility_id');
      expect(attrKeys).toContain('energy_type');
      expect(attrKeys).toContain('scope');
      expect(attrKeys).toContain('co2_amount');
    }

    // Verify reports were generated
    expect(results.reports).toBeDefined();
    expect(results.reports.length).toBeGreaterThan(0);

    // Each report should have totals
    for (const report of results.reports) {
      expect(report.kind).toBe('GHGReport');
      expect(report.attrs).toBeDefined();

      const attrs = report.attrs!;
      const attrKeys = attrs.map(a => a.key);

      expect(attrKeys).toContain('facility_id');
      expect(attrKeys).toContain('total_scope1');
      expect(attrKeys).toContain('total_scope2');
      expect(attrKeys).toContain('total_emissions');

      // Verify total equals sum of scopes
      const scope1 = attrs.find(a => a.key === 'total_scope1')?.value as number;
      const scope2 = attrs.find(a => a.key === 'total_scope2')?.value as number;
      const total = attrs.find(a => a.key === 'total_emissions')?.value as number;

      expect(Math.abs(total - (scope1 + scope2))).toBeLessThan(0.01);
    }
  });

  test('should calculate correct emissions for F001', async () => {
    const results = await scenario.execute(samplesDir);

    // Find emissions for F001 in 2024-01
    const f001Emissions = results.emissions.filter(e => {
      const facilityId = e.attrs?.find(a => a.key === 'facility_id')?.value;
      const year = e.attrs?.find(a => a.key === 'year')?.value;
      const month = e.attrs?.find(a => a.key === 'month')?.value;
      return facilityId === 'F001' && year === 2024 && month === 1;
    });

    expect(f001Emissions.length).toBe(2); // electricity + gas

    // Find electricity emission
    const electricityEmission = f001Emissions.find(e => {
      const energyType = e.attrs?.find(a => a.key === 'energy_type')?.value;
      return energyType === 'electricity';
    });

    expect(electricityEmission).toBeDefined();

    // Expected: 85000 kWh * 0.5 kg-CO2/kWh = 42500 kg-CO2
    const co2Amount = electricityEmission?.attrs?.find(a => a.key === 'co2_amount')?.value;
    expect(co2Amount).toBe(42500);

    // Verify scope
    const scope = electricityEmission?.attrs?.find(a => a.key === 'scope')?.value;
    expect(scope).toBe(2); // Electricity is Scope 2
  });

  test('should generate correct report for F001 in 2024-01', async () => {
    const results = await scenario.execute(samplesDir);

    // Find report for F001 in 2024-01
    const report = results.reports.find(r => {
      const facilityId = r.attrs?.find(a => a.key === 'facility_id')?.value;
      const year = r.attrs?.find(a => a.key === 'year')?.value;
      const month = r.attrs?.find(a => a.key === 'month')?.value;
      return facilityId === 'F001' && year === 2024 && month === 1;
    });

    expect(report).toBeDefined();

    const attrs = report!.attrs!;

    // Expected calculations:
    // Scope 1 (gas): 3000 m³ * 2.03 kg-CO2/m³ = 6090 kg-CO2
    // Scope 2 (electricity): 85000 kWh * 0.5 kg-CO2/kWh = 42500 kg-CO2
    // Total: 48590 kg-CO2

    const scope1 = attrs.find(a => a.key === 'total_scope1')?.value as number;
    const scope2 = attrs.find(a => a.key === 'total_scope2')?.value as number;
    const total = attrs.find(a => a.key === 'total_emissions')?.value as number;

    expect(scope1).toBe(6090);
    expect(scope2).toBe(42500);
    expect(total).toBe(48590);
  });

  test('should export reports to JSON', async () => {
    const results = await scenario.execute(samplesDir);
    const json = scenario.exportToJSON(results.reports);

    expect(json).toBeDefined();
    expect(typeof json).toBe('string');

    // Should be valid JSON
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(results.reports.length);
  });
});
