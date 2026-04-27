#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

interface TechParkData {
  place_id: string;
  name: string;
  address_line1?: string;
  address_line2?: string;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  country?: string;
  lat?: number;
  lng?: number;
  map_url?: string;
  photo_url?: string;
  website?: string;
  reception_phone?: string;
  international_phone?: string;
  generic_email?: string;
  contact_page_url?: string;
  rating?: number;
  total_ratings?: number;
  business_status?: string;
  types?: string[];
  operator_name?: string;
  campus_brand?: string;
  legal_entity?: string;
  campus_size_hint?: string;
  tenant_signal?: string;
  amenities_signal?: string;
  source_primary?: string;
  sources_raw?: any;
  confidence_overall?: number;
  qa_status?: string;
  is_active?: boolean;
  notes_internal?: string;
  first_seen_at?: string;
  last_seen_at?: string;
  last_changed_at?: string;
}

interface ValidationResult {
  isValid: boolean;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: Array<{
    index: number;
    place_id?: string;
    field: string;
    message: string;
    value?: any;
  }>;
  warnings: Array<{
    index: number;
    place_id?: string;
    field: string;
    message: string;
    value?: any;
  }>;
  duplicates: Array<{
    place_id: string;
    count: number;
    indices: number[];
  }>;
}

class DataValidator {
  private errors: ValidationResult['errors'] = [];
  private warnings: ValidationResult['warnings'] = [];
  private placeIds = new Map<string, number[]>();

  private addError(index: number, field: string, message: string, place_id?: string, value?: any) {
    this.errors.push({ index, place_id, field, message, value });
  }

  private addWarning(index: number, field: string, message: string, place_id?: string, value?: any) {
    this.warnings.push({ index, place_id, field, message, value });
  }

  private validateRequiredFields(data: TechParkData, index: number): boolean {
    let isValid = true;

    // Required fields
    if (!data.place_id || typeof data.place_id !== 'string') {
      this.addError(index, 'place_id', 'place_id is required and must be a string', data.place_id, data.place_id);
      isValid = false;
    }

    if (!data.name || typeof data.name !== 'string') {
      this.addError(index, 'name', 'name is required and must be a string', data.place_id, data.name);
      isValid = false;
    }

    return isValid;
  }

  private validateDataTypes(data: TechParkData, index: number): void {
    // Validate numeric fields - allow null/undefined values
    if (data.lat !== undefined && data.lat !== null && (typeof data.lat !== 'number' || isNaN(data.lat))) {
      this.addError(index, 'lat', 'lat must be a valid number', data.place_id, data.lat);
    }

    if (data.lng !== undefined && data.lng !== null && (typeof data.lng !== 'number' || isNaN(data.lng))) {
      this.addError(index, 'lng', 'lng must be a valid number', data.place_id, data.lng);
    }

    if (data.rating !== undefined && data.rating !== null && (typeof data.rating !== 'number' || isNaN(data.rating))) {
      this.addError(index, 'rating', 'rating must be a valid number', data.place_id, data.rating);
    }

    if (data.total_ratings !== undefined && data.total_ratings !== null && (typeof data.total_ratings !== 'number' || isNaN(data.total_ratings))) {
      this.addError(index, 'total_ratings', 'total_ratings must be a valid number', data.place_id, data.total_ratings);
    }

    if (data.confidence_overall !== undefined && data.confidence_overall !== null && (typeof data.confidence_overall !== 'number' || isNaN(data.confidence_overall))) {
      this.addError(index, 'confidence_overall', 'confidence_overall must be a valid number', data.place_id, data.confidence_overall);
    }

    // Validate array fields - allow null/undefined values
    if (data.types !== undefined && data.types !== null && !Array.isArray(data.types)) {
      this.addError(index, 'types', 'types must be an array', data.place_id, data.types);
    }

    // Validate boolean fields - allow null/undefined values
    if (data.is_active !== undefined && data.is_active !== null && typeof data.is_active !== 'boolean') {
      this.addError(index, 'is_active', 'is_active must be a boolean', data.place_id, data.is_active);
    }

    // Validate date fields - allow null/undefined values
    const dateFields = ['first_seen_at', 'last_seen_at', 'last_changed_at'];
    dateFields.forEach(field => {
      const value = data[field as keyof TechParkData];
      if (value !== undefined && value !== null) {
        const date = new Date(value as string);
        if (isNaN(date.getTime())) {
          this.addError(index, field, `${field} must be a valid date string`, data.place_id, value);
        }
      }
    });
  }

  private validateDataRanges(data: TechParkData, index: number): void {
    // Validate latitude range - allow null/undefined values
    if (data.lat !== undefined && data.lat !== null && (data.lat < -90 || data.lat > 90)) {
      this.addError(index, 'lat', 'lat must be between -90 and 90', data.place_id, data.lat);
    }

    // Validate longitude range - allow null/undefined values
    if (data.lng !== undefined && data.lng !== null && (data.lng < -180 || data.lng > 180)) {
      this.addError(index, 'lng', 'lng must be between -180 and 180', data.place_id, data.lng);
    }

    // Validate rating range - allow null/undefined values
    if (data.rating !== undefined && data.rating !== null && (data.rating < 0 || data.rating > 5)) {
      this.addWarning(index, 'rating', 'rating should be between 0 and 5', data.place_id, data.rating);
    }

    // Validate confidence range - allow null/undefined values
    if (data.confidence_overall !== undefined && data.confidence_overall !== null && (data.confidence_overall < 0 || data.confidence_overall > 1)) {
      this.addWarning(index, 'confidence_overall', 'confidence_overall should be between 0 and 1', data.place_id, data.confidence_overall);
    }
  }

  private validateBusinessLogic(data: TechParkData, index: number): void {
    // Check for missing important fields
    if (!data.city) {
      this.addWarning(index, 'city', 'city is missing - this might affect data quality', data.place_id);
    }

    if (!data.state) {
      this.addWarning(index, 'state', 'state is missing - this might affect data quality', data.place_id);
    }

    if (!data.lat || !data.lng) {
      this.addWarning(index, 'coordinates', 'latitude and longitude are missing - this might affect mapping functionality', data.place_id);
    }

    // Check for suspicious data
    if (data.name && data.name.length < 2) {
      this.addWarning(index, 'name', 'name seems too short', data.place_id, data.name);
    }

    if (data.website && !data.website.startsWith('http')) {
      this.addWarning(index, 'website', 'website should start with http/https', data.place_id, data.website);
    }
  }

  private trackDuplicates(data: TechParkData, index: number): void {
    if (data.place_id) {
      if (!this.placeIds.has(data.place_id)) {
        this.placeIds.set(data.place_id, []);
      }
      this.placeIds.get(data.place_id)!.push(index);
    }
  }

  public validate(data: TechParkData[]): ValidationResult {
    console.log(`🔍 Validating ${data.length} records...\n`);

    let validRecords = 0;
    let invalidRecords = 0;

    data.forEach((record, index) => {
      const isRecordValid = this.validateRequiredFields(record, index);
      
      if (isRecordValid) {
        this.validateDataTypes(record, index);
        this.validateDataRanges(record, index);
        this.validateBusinessLogic(record, index);
        this.trackDuplicates(record, index);
        validRecords++;
      } else {
        invalidRecords++;
      }
    });

    // Find duplicates
    const duplicates: ValidationResult['duplicates'] = [];
    this.placeIds.forEach((indices, place_id) => {
      if (indices.length > 1) {
        duplicates.push({
          place_id,
          count: indices.length,
          indices
        });
      }
    });

    const result: ValidationResult = {
      isValid: this.errors.length === 0,
      totalRecords: data.length,
      validRecords,
      invalidRecords,
      errors: this.errors,
      warnings: this.warnings,
      duplicates
    };

    return result;
  }

  public printResults(result: ValidationResult): void {
    console.log('=== VALIDATION RESULTS ===\n');

    console.log(`📊 Summary:`);
    console.log(`   Total records: ${result.totalRecords}`);
    console.log(`   Valid records: ${result.validRecords}`);
    console.log(`   Invalid records: ${result.invalidRecords}`);
    console.log(`   Success rate: ${Math.round((result.validRecords / result.totalRecords) * 100)}%`);

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. Record ${error.index + 1} (${error.place_id || 'no place_id'}): ${error.field} - ${error.message}`);
        if (error.value !== undefined) {
          console.log(`      Value: ${JSON.stringify(error.value)}`);
        }
      });
      
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more errors`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.slice(0, 10).forEach((warning, index) => {
        console.log(`   ${index + 1}. Record ${warning.index + 1} (${warning.place_id || 'no place_id'}): ${warning.field} - ${warning.message}`);
      });
      
      if (result.warnings.length > 10) {
        console.log(`   ... and ${result.warnings.length - 10} more warnings`);
      }
    }

    if (result.duplicates.length > 0) {
      console.log(`\n🔄 Duplicates (${result.duplicates.length}):`);
      result.duplicates.slice(0, 5).forEach((duplicate, index) => {
        console.log(`   ${index + 1}. ${duplicate.place_id}: ${duplicate.count} occurrences at indices ${duplicate.indices.join(', ')}`);
      });
      
      if (result.duplicates.length > 5) {
        console.log(`   ... and ${result.duplicates.length - 5} more duplicates`);
      }
    }

    console.log(`\n${result.isValid ? '✅ Data is valid and ready for import!' : '❌ Data has errors that need to be fixed before import.'}`);
  }
}

async function main() {
  try {
    const validator = new DataValidator();
    
    // Get file path from command line or use default
    const filePath = process.argv[2] || path.join(__dirname, '../../../apps/analyzer-api/tech_parks_seed.json');
    
    console.log(`📁 Loading data from: ${filePath}\n`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    if (!Array.isArray(data)) {
      console.error('❌ JSON data must be an array');
      process.exit(1);
    }

    const result = validator.validate(data);
    validator.printResults(result);

    if (!result.isValid) {
      console.log('\n💡 Recommendations:');
      console.log('   - Fix all errors before importing');
      console.log('   - Review warnings for data quality issues');
      console.log('   - Consider removing or fixing duplicate records');
      process.exit(1);
    }

    console.log('\n🎉 Validation completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('💥 Validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DataValidator };
