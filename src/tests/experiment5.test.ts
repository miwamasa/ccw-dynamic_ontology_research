/**
 * Experiment 5 Test: DSL → MTT Verification
 */

import * as path from 'path';
import { Experiment5DSLToMTT } from '../scenarios/experiment5-dsl-to-mtt';

describe('Experiment 5: DSL → MTT Verification', () => {
  const samplesDir = path.join(__dirname, '../../samples');
  let experiment: Experiment5DSLToMTT;

  beforeEach(() => {
    experiment = new Experiment5DSLToMTT();
  });

  test('should load DSL definition successfully', async () => {
    const results = await experiment.execute(samplesDir);

    expect(results.dslDefinition).toBeDefined();
    expect(results.dslDefinition.metadata).toBeDefined();
    expect(results.dslDefinition.metadata.name).toBe('Energy to GHG Emission Transformation');
    expect(results.dslDefinition.transformations).toBeDefined();
    expect(results.dslDefinition.emission_factors).toBeDefined();
  });

  test('should compile DSL to MTT program', async () => {
    const results = await experiment.execute(samplesDir);

    expect(results.mttProgram).toBeDefined();
    expect(results.mttProgram.rules).toBeDefined();
    expect(results.mttProgram.rules.length).toBeGreaterThan(0);
    expect(results.mttProgram.initialState).toBe('q0');
  });

  test('should execute direct transformation', async () => {
    const results = await experiment.execute(samplesDir);

    expect(results.directResults).toBeDefined();
    expect(results.directResults.length).toBeGreaterThan(0);

    // Verify each emission has required attributes
    for (const emission of results.directResults) {
      expect(emission.kind).toBe('Emission');
      expect(emission.attrs).toBeDefined();

      const attrKeys = emission.attrs!.map(a => a.key);
      expect(attrKeys).toContain('facility_id');
      expect(attrKeys).toContain('energy_type');
      expect(attrKeys).toContain('scope');
      expect(attrKeys).toContain('co2_amount');
      expect(attrKeys).toContain('year');
      expect(attrKeys).toContain('month');
    }
  });

  test('should execute MTT transformation', async () => {
    const results = await experiment.execute(samplesDir);

    expect(results.mttResults).toBeDefined();
    expect(results.mttResults.length).toBeGreaterThan(0);

    // Verify each emission has required attributes
    for (const emission of results.mttResults) {
      expect(emission.kind).toBe('Emission');
      expect(emission.attrs).toBeDefined();

      const attrKeys = emission.attrs!.map(a => a.key);
      expect(attrKeys).toContain('facility_id');
      expect(attrKeys).toContain('energy_type');
      expect(attrKeys).toContain('scope');
      expect(attrKeys).toContain('co2_amount');
    }
  });

  test('should produce identical results between direct and MTT transformations', async () => {
    const results = await experiment.execute(samplesDir);

    expect(results.comparison).toBeDefined();
    expect(results.comparison.totalCount).toBe(results.directResults.length);
    expect(results.comparison.totalCount).toBe(results.mttResults.length);

    // Results should match
    expect(results.comparison.accuracy).toBe(1.0);
    expect(results.comparison.matchCount).toBe(results.comparison.totalCount);
    expect(results.comparison.mismatchCount).toBe(0);
  });

  test('should calculate correct emissions for F001', async () => {
    const results = await experiment.execute(samplesDir);

    // Find F001 emissions in direct results
    const f001DirectEmissions = results.directResults.filter(e => {
      const facilityId = e.attrs?.find(a => a.key === 'facility_id')?.value;
      return facilityId === 'F001';
    });

    // Find F001 emissions in MTT results
    const f001MTTEmissions = results.mttResults.filter(e => {
      const facilityId = e.attrs?.find(a => a.key === 'facility_id')?.value;
      return facilityId === 'F001';
    });

    expect(f001DirectEmissions.length).toBe(f001MTTEmissions.length);
    expect(f001DirectEmissions.length).toBeGreaterThan(0);

    // Compare each emission
    for (let i = 0; i < f001DirectEmissions.length; i++) {
      const direct = f001DirectEmissions[i];
      const mtt = f001MTTEmissions[i];

      const directCO2 = direct.attrs?.find(a => a.key === 'co2_amount')?.value as number;
      const mttCO2 = mtt.attrs?.find(a => a.key === 'co2_amount')?.value as number;

      expect(Math.abs(directCO2 - mttCO2)).toBeLessThan(0.01);

      const directScope = direct.attrs?.find(a => a.key === 'scope')?.value;
      const mttScope = mtt.attrs?.find(a => a.key === 'scope')?.value;

      expect(directScope).toBe(mttScope);
    }
  });

  test('should verify emission factors from DSL', async () => {
    const results = await experiment.execute(samplesDir);

    // Check that DSL emission factors are defined
    expect(results.dslDefinition.emission_factors).toBeDefined();
    expect(results.dslDefinition.emission_factors.electricity).toBeDefined();
    expect(results.dslDefinition.emission_factors.electricity.factor).toBe(0.5);

    expect(results.dslDefinition.emission_factors.natural_gas).toBeDefined();
    expect(results.dslDefinition.emission_factors.natural_gas.factor).toBe(2.03);

    // Verify that MTT uses these factors correctly
    const electricityEmission = results.mttResults.find(e => {
      const energyType = e.attrs?.find(a => a.key === 'energy_type')?.value;
      return energyType === 'electricity';
    });

    if (electricityEmission) {
      const emissionFactor = electricityEmission.attrs?.find(a => a.key === 'emission_factor')?.value;
      expect(emissionFactor).toBe(0.5);
    }
  });
});
