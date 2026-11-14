import { ExtractedBill } from '../../schemas/bill-extraction.schema.js';

export interface IBillReader {
  readonly name: string;
  readBill(filePath: string, fileType: string): Promise<ExtractedBill>;
}
