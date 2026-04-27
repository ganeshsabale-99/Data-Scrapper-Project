#!/bin/bash

# Full Tech Parks Import Script
# This script validates data first, then imports it with comprehensive error handling

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "This script must be run from the packages/db directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning "No .env file found. Make sure DATABASE_URL is set in your environment."
else
    print_status "Found .env file"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    pnpm install
fi

# Generate Prisma client if needed
print_status "Generating Prisma client..."
pnpm run prisma:generate

# Check if custom file path is provided
if [ $# -eq 1 ]; then
    FILE_PATH="$1"
    print_status "Using custom file path: $FILE_PATH"
    
    if [ ! -f "$FILE_PATH" ]; then
        print_error "File not found: $FILE_PATH"
        exit 1
    fi
else
    print_status "Using default file path: ../../apps/analyzer-api/tech_parks_seed.json"
    FILE_PATH="../../apps/analyzer-api/tech_parks_seed.json" 
    
    if [ ! -f "$FILE_PATH" ]; then
        print_error "Default file not found: $FILE_PATH"
        print_error "Please provide the correct path to your tech_parks.json file"
        exit 1
    fi
fi

# Step 1: Validate data
print_step "Step 1: Validating data..."
print_status "File: $FILE_PATH"

if npx tsx scripts/validate-data.ts "$FILE_PATH"; then
    print_success "Data validation passed!"
else
    print_error "Data validation failed! Please fix the errors before importing."
    print_warning "You can run the validation separately with: pnpm run validate:tech-parks"
    exit 1
fi

echo ""

# Step 2: Confirm import
print_step "Step 2: Confirming import..."
read -p "Do you want to proceed with the import? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Import cancelled by user"
    exit 0
fi

# Step 3: Import data
print_step "Step 3: Importing data..."
print_status "File: $FILE_PATH"

if npx tsx scripts/import-tech-parks.ts "$FILE_PATH"; then
    print_success "Import completed successfully!"
    echo ""
    print_success "🎉 All done! Your tech parks data has been imported to the database."
else
    print_error "Import failed!"
    print_warning "You can try running the import separately with: pnpm run import:tech-parks"
    exit 1
fi
