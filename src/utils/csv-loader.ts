/**
 * CSV Loader Utility
 *
 * Loads CSV files and converts them to structured data
 */

import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

export interface CSVRow {
  [key: string]: string | number;
}

/**
 * Load CSV file and parse it
 */
export class CSVLoader {
  /**
   * Load CSV file synchronously
   */
  public loadSync(filePath: string): CSVRow[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * Parse CSV content
   */
  public parse(content: string): CSVRow[] {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        // Try to parse as number
        if (context.column && value) {
          const num = Number(value);
          if (!isNaN(num) && value.trim() !== '') {
            return num;
          }
        }
        return value;
      },
    });

    return records;
  }

  /**
   * Load multiple CSV files
   */
  public loadMultiple(filePaths: string[]): { [fileName: string]: CSVRow[] } {
    const result: { [fileName: string]: CSVRow[] } = {};

    for (const filePath of filePaths) {
      const fileName = filePath.split('/').pop()?.replace('.csv', '') || filePath;
      result[fileName] = this.loadSync(filePath);
    }

    return result;
  }
}
