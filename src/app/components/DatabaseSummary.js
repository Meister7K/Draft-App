'use client'

import { useState, useEffect } from 'react'

export function DatabaseSummary() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/db/fantasy_football_db_summary.json')
        if (!response.ok) {
          throw new Error('Failed to load database summary')
        }
        const jsonData = await response.json()
        setData(jsonData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 border border-red-400 text-red-300 rounded-lg bg-red-900/60 card">
        Error: {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-4 border border-yellow-400 text-yellow-300 rounded-lg bg-yellow-900/60 card">
        No data available
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'top-players', label: 'Top Players' },
    { id: 'career-leaders', label: 'Career Leaders' },
    { id: 'teams', label: 'Teams' }
  ]

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num)
  }

  return (
    <div className="card">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 text-[var(--foreground)]">Fantasy Football Database Summary</h2>
        <p className="opacity-80">{data.selection_criteria}</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--border)] mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--foreground)] opacity-60 hover:text-[var(--primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--primary)]/10 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-[var(--primary)]">Total Players</h3>
              <p className="text-3xl font-bold text-[var(--primary)]">{formatNumber(data.total_players)}</p>
            </div>
            <div className="bg-green-900/20 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-300">Total Weeks</h3>
              <p className="text-3xl font-bold text-green-300">{formatNumber(data.total_weeks)}</p>
            </div>
            <div className="bg-purple-900/20 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-300">Seasons Covered</h3>
              <p className="text-3xl font-bold text-purple-300">{data.seasons_covered.length}</p>
            </div>
            <div className="bg-orange-900/20 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-300">Teams</h3>
              <p className="text-3xl font-bold text-orange-300">{Object.keys(data.teams).length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Position Breakdown</h3>
              <div className="space-y-2">
                {Object.entries(data.positions).map(([pos, count]) => (
                  <div key={pos} className="flex justify-between items-center p-2 bg-[var(--secondary)] rounded">
                    <span className="font-medium text-[var(--foreground)]">{pos}</span>
                    <span className="opacity-80">{count} players</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Top Teams by Player Count</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(data.teams)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 10)
                  .map(([team, count]) => (
                    <div key={team} className="flex justify-between items-center p-2 bg-[var(--secondary)] rounded">
                      <span className="font-medium text-[var(--foreground)]">{team}</span>
                      <span className="opacity-80">{count} players</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Players Tab */}
      {activeTab === 'top-players' && (
        <div className="space-y-6">
          {Object.entries(data.top_players_by_projected_points).map(([position, players]) => (
            <div key={position} className="border rounded-lg p-4 border-[var(--border)] bg-[var(--secondary)]">
              <h3 className="text-lg font-semibold mb-3 text-[var(--foreground)]">{position} - Top 10 Projected</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--border)]">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Rank</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Player</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Team</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Projected Points</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Overall Rank</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Experience</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => (
                      <tr key={player.name} className={index % 2 === 0 ? 'bg-[var(--background)]' : 'bg-[var(--secondary)]'}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-[var(--foreground)]">{index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-[var(--foreground)]">{player.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm opacity-80">{player.team}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium opacity-90">{player.projected_2025_points.toFixed(1)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm opacity-80">#{player.overall_rank}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm opacity-80">{player.years_exp} years</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Career Leaders Tab */}
      {activeTab === 'career-leaders' && (
        <div className="space-y-6">
          {Object.entries(data.career_leaders).map(([stat, players]) => (
            <div key={stat} className="border rounded-lg p-4 border-[var(--border)] bg-[var(--secondary)]">
              <h3 className="text-[var(--foreground)] text-lg font-semibold mb-3 capitalize">{stat.replace(/_/g, ' ')} - Career Leaders</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--border)]">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Rank</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Player</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Position</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Team</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Value</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[var(--foreground)] uppercase tracking-wider">Overall Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => (
                      <tr key={player.name} className={index % 2 === 0 ? 'bg-[var(--background)]' : 'bg-[var(--secondary)]'}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-[var(--foreground)]">{index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-[var(--foreground)]">{player.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm opacity-80">{player.position}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm opacity-80">{player.team}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium opacity-90">{formatNumber(player.value)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm opacity-80">#{player.overall_rank}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'teams' && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-800">Teams by Player Count</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(data.teams)
              .sort(([,a], [,b]) => b - a)
              .map(([team, count]) => (
                <div key={team} className="bg-[var(--secondary)] p-3 rounded-lg">
                  <div className="text-lg font-semibold text-[var(--foreground)]">{team}</div>
                  <div className="text-sm opacity-80">{count} players</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
} 