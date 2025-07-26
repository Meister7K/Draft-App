'use client'

import { useState, useEffect } from 'react'

export function DataDebugger() {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadRawData = async () => {
      try {
        // Try to load the raw data directly
        let response = await fetch('/db/fantasy_football_db.json')
        
        if (!response.ok) {
          // Try the src/app/db file
          response = await fetch('/api/raw-fantasy-data')
        }

        if (!response.ok) {
          throw new Error('Failed to load raw data')
        }

        const data = await response.json()
        console.log('Raw data structure:', data)
        console.log('Raw data keys:', Object.keys(data))
        if (data.players) {
          console.log('First player:', data.players[0])
          console.log('Player keys:', Object.keys(data.players[0]))
        }
        setRawData(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadRawData()
  }, [])

  if (loading) return <div>Loading raw data...</div>
  if (error) return <div>Error: {error}</div>
  if (!rawData) return <div>No raw data</div>

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Raw Data Structure Debug</h2>
      
      <div className="mb-4">
        <h3 className="font-semibold">Data Keys:</h3>
        <pre className="bg-gray-100 p-2 text-sm">
          {JSON.stringify(Object.keys(rawData), null, 2)}
        </pre>
      </div>

      {rawData.players && (
        <div className="mb-4">
          <h3 className="font-semibold">First Player Structure:</h3>
          <pre className="bg-gray-100 p-2 text-sm max-h-96 overflow-auto">
            {JSON.stringify(rawData.players[0], null, 2)}
          </pre>
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-semibold">Players Count:</h3>
        <p>{rawData.players?.length || 'No players array'}</p>
      </div>
    </div>
  )
}