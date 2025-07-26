import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { processFantasyDatabase } from '../../utils/dataProcessor';

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
    
    // Debug: Log the raw data structure
    console.log('Raw data keys:', Object.keys(rawData));
    console.log('Raw data players sample:', rawData.players?.slice(0, 2));
    
    // Process the data
    const processedData = processFantasyDatabase(rawData);
    
    return NextResponse.json(processedData);
  } catch (error) {
    console.error('Error processing fantasy data:', error);
    return NextResponse.json(
      { error: 'Failed to process fantasy data', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const rawData = await request.json();
    const processedData = processFantasyDatabase(rawData);
    
    return NextResponse.json(processedData);
  } catch (error) {
    console.error('Error processing posted fantasy data:', error);
    return NextResponse.json(
      { error: 'Failed to process fantasy data', details: error.message },
      { status: 500 }
    );
  }
}