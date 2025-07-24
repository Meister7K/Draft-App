'use client'

import { useState } from 'react'

export function UserForm({ onSubmit }) {
  const [username, setUsername] = useState('')
  const [year, setYear] = useState('2024')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username.trim() && year) {
      onSubmit(username.trim(), year)
    }
  }

  // Generate year options from 2018 (when Sleeper started) to current year
  const currentYear = new Date().getFullYear()
  const years = []
  for (let i = currentYear; i >= 2018; i--) {
    years.push(i)
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 text-[var(--foreground)]">Enter Your Sleeper Details</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1 text-[var(--foreground)] opacity-80">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--secondary)] text-[var(--foreground)]"
              placeholder="Enter your Sleeper username"
              required
            />
          </div>
          
          <div>
            <label htmlFor="year" className="block text-sm font-medium mb-1 text-[var(--foreground)] opacity-80">
              Season Year
            </label>
            <select
              id="year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-[var(--secondary)] text-[var(--foreground)]"
              required
            >
              {years.map((yearOption) => (
                <option key={yearOption} value={yearOption}>
                  {yearOption} Season
                </option>
              ))}
            </select>
          </div>
          
          <button
            type="submit"
            className="w-full btn"
          >
            Find My Leagues
          </button>
        </form>
      </div>
    </div>
  )
}