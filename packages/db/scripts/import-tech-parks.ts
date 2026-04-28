#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
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

interface ImportStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{ place_id: string; error: string; data?: any }>;
}

class TechParkImporter {
  private prisma: PrismaClient;
  private stats: ImportStats;
  private maxRetries: number;
  private retryDelay: number;
  private batchSize: number;

  constructor() {
    this.prisma = new PrismaClient({
      log: ['error', 'warn'],
    });
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.batchSize = 50; // Process in batches of 50
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.log(`Retry ${retryCount + 1}/${this.maxRetries} after error:`, error);
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.retryOperation(operation, retryCount + 1);
      }
      throw error;
    }
  }

  private transformData(data: TechParkData) {
    return {
      place_id: data.place_id,
      name: data.name,
      address_line1: data.address_line1 || null,
      address_line2: data.address_line2 || null,
      locality: data.locality || null,
      city: data.city || null,
      district: data.district || null,
      state: data.state || null,
      pincode: data.pincode || null,
      country: data.country || null,
      lat: data.lat || null,
      lng: data.lng || null,
      map_url: data.map_url || null,
      photo_url: data.photo_url || null,
      website: data.website || null,
      reception_phone: data.reception_phone || null,
      international_phone: data.international_phone || null,
      generic_email: data.generic_email || null,
      contact_page_url: data.contact_page_url || null,
      rating: data.rating || null,
      total_ratings: data.total_ratings || null,
      business_status: data.business_status || null,
      types: data.types || [],
      operator_name: data.operator_name || null,
      campus_brand: data.campus_brand || null,
      legal_entity: data.legal_entity || null,
      campus_size_hint: data.campus_size_hint || null,
      tenant_signal: data.tenant_signal || null,
      amenities_signal: data.amenities_signal || null,
      source_primary: data.source_primary || null,
      sources_raw: data.sources_raw || null,
      confidence_overall: data.confidence_overall || null,
      qa_status: data.qa_status || null,
      is_active: data.is_active ?? true,
      notes_internal: data.notes_internal || null,
      first_seen_at: data.first_seen_at ? new Date(data.first_seen_at) : null,
      last_seen_at: data.last_seen_at ? new Date(data.last_seen_at) : null,
      last_changed_at: data.last_changed_at ? new Date(data.last_changed_at) : null,
    };
  }

  private async importSingleRecord(data: TechParkData): Promise<boolean> {
    try {
      const transformedData = this.transformData(data);

      // Check if record already exists
      const existing = await this.prisma.newTechPark.findUnique({
        where: { place_id: data.place_id },
      });

      if (existing) {
        const patchData: Record<string, unknown> = {};

        if (!existing.website && transformedData.website) {
          patchData.website = transformedData.website;
        }
        if (!existing.map_url && transformedData.map_url) {
          patchData.map_url = transformedData.map_url;
        }
        if (!existing.reception_phone && transformedData.reception_phone) {
          patchData.reception_phone = transformedData.reception_phone;
        }
        if (!existing.international_phone && transformedData.international_phone) {
          patchData.international_phone = transformedData.international_phone;
        }

        if (Object.keys(patchData).length > 0) {
          await this.retryOperation(async () => {
            await this.prisma.newTechPark.update({
              where: { place_id: data.place_id },
              data: patchData,
            });
          });
          console.log(`Updated missing fields for existing record: ${data.place_id} - ${data.name}`);
        } else {
          console.log(`Skipping existing record: ${data.place_id} - ${data.name}`);
        }

        this.stats.skipped++;
        return true;
      }

      await this.retryOperation(async () => {
        await this.prisma.newTechPark.create({
          data: transformedData,
        });
      });

      console.log(`✓ Imported: ${data.place_id} - ${data.name}`);
      this.stats.successful++;
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`✗ Failed to import ${data.place_id} - ${data.name}:`, errorMessage);
      
      this.stats.errors.push({
        place_id: data.place_id,
        error: errorMessage,
        data: data,
      });
      this.stats.failed++;
      return false;
    }
  }

  private async importBatch(batch: TechParkData[]): Promise<void> {
    const promises = batch.map(data => this.importSingleRecord(data));
    await Promise.allSettled(promises);
  }

  private async loadData(filePath: string): Promise<TechParkData[]> {
    try {
      console.log(`Loading data from: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);

      if (!Array.isArray(data)) {
        throw new Error('JSON data must be an array');
      }

      console.log(`Loaded ${data.length} records from JSON file`);
      return data;
    } catch (error) {
      throw new Error(`Failed to load data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private printProgress(current: number, total: number): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));
    process.stdout.write(`\rProgress: [${progressBar}] ${percentage}% (${current}/${total})`);
  }

  private printFinalStats(): void {
    console.log('\n\n=== IMPORT STATISTICS ===');
    console.log(`Total records: ${this.stats.total}`);
    console.log(`Successfully imported: ${this.stats.successful}`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`Skipped (already exists): ${this.stats.skipped}`);
    console.log(`Success rate: ${Math.round((this.stats.successful / this.stats.total) * 100)}%`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n=== ERRORS ===');
      this.stats.errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.place_id}: ${error.error}`);
      });
      
      if (this.stats.errors.length > 10) {
        console.log(`... and ${this.stats.errors.length - 10} more errors`);
      }
    }
  }

  public async import(filePath: string): Promise<void> {
    try {
      console.log('🚀 Starting Tech Parks Import Process...\n');

      // Load data
      const data = await this.loadData(filePath);
      this.stats.total = data.length;

      // Test database connection
      console.log('Testing database connection...');
      await this.prisma.$connect();
      console.log('✓ Database connection successful\n');

      // Process in batches
      console.log(`Processing ${data.length} records in batches of ${this.batchSize}...\n`);
      
      for (let i = 0; i < data.length; i += this.batchSize) {
        const batch = data.slice(i, i + this.batchSize);
        await this.importBatch(batch);
        
        const processed = Math.min(i + this.batchSize, data.length);
        this.printProgress(processed, data.length);
        
        // Small delay between batches to avoid overwhelming the database
        if (i + this.batchSize < data.length) {
          await this.delay(100);
        }
      }

      console.log('\n'); // New line after progress bar
      this.printFinalStats();

    } catch (error) {
      console.error('\n❌ Import process failed:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
      console.log('\n✓ Database connection closed');
    }
  }
}

// Main execution
async function main() {
  const importer = new TechParkImporter();
  
  // Default file path - adjust as needed
  const defaultFilePath = path.join(__dirname, '../../../apps/analyzer-api/tech_parks_seed.json');
  
  // Allow custom file path via command line argument
  const filePath = process.argv[2] || defaultFilePath;
  
  try {
    await importer.import(filePath);
    console.log('\n🎉 Import process completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Import process failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { TechParkImporter };
