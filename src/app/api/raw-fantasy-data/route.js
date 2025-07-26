import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Try to read from public directory first
    let filePath = path.join(process.cwd(), 'public', 'db', 'fantasy_football_db.json');
    
    // If not found, try src/app/db directory
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'src', 'app', 'db', 'fantasy_football_db_1752333750592.json');
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Fantasy football database file not found' },
        { status: 404 }
      );
    }

    // Read the file
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Return raw data without processing
    return NextResponse.json(rawData);
  } catch (error) {
    console.error('Error loading raw fantasy data:', error);
    return NextResponse.json(
      { error: 'Failed to load raw fantasy data', details: error.message },
      { status: 500 }
    );
  }
}