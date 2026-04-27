#!/bin/bash

# Tech Parks Import Script
# This script runs the tech parks import process with proper setup

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Run the import
print_status "Starting import process..."
print_status "File: $FILE_PATH"

# Run the TypeScript import script
npx tsx scripts/import-tech-parks.ts "$FILE_PATH"

# Check exit status
if [ $? -eq 0 ]; then
    print_success "Import completed successfully!"
else
    print_error "Import failed!"
    exit 1
fi
