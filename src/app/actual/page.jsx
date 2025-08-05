"use client";

import { useState, useEffect } from "react";
import { ActualDraftAnalysis } from "../components/ActualDraftAnalysis";
import { UserForm } from "../components/UserForm";
import { LeagueSelector } from "../components/LeagueSelector";

export default function ActualPage() {
  const [userFormData, setUserFormData] = useState(null);
  const [leagueData, setLeagueData] = useState(null);
  const [leagueUsers, setLeagueUsers] = useState(null);
  const [playerDatabase, setPlayerDatabase] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load player database on mount
  useEffect(() => {
    const loadPlayerDatabase = async () => {
      try {
        const response = await fetch("/db/fantasy_football_db.json");
        if (response.ok) {
          const jsonData = await response.json();
          setPlayerDatabase(jsonData);
        }
      } catch (err) {
        console.error("Failed to load player database:", err);
      }
    };

    loadPlayerDatabase();
  }, []);

  const handleUserSubmit = async (username, year) => {
    setLoading(true);
    setError(null);

    try {
      // Get user data
      const userResponse = await fetch(
        `https://api.sleeper.app/v1/user/${username}?t=${Date.now()}`
      );
      if (!userResponse.ok) {
        throw new Error("User not found");
      }
      const userData = await userResponse.json();
      setUserFormData({ ...userData, year });

      // Get user's leagues for selected season
      const leaguesResponse = await fetch(
        `https://api.sleeper.app/v1/user/${userData.user_id}/leagues/nfl/${year}?t=${Date.now()}`
      );
      if (!leaguesResponse.ok) {
        throw new Error(`Failed to fetch leagues for ${year}`);
      }
      const leaguesData = await leaguesResponse.json();
      if (leaguesData.length === 0) {
        throw new Error(`No leagues found for ${year}`);
      }
      setLeagueData({ leagues: leaguesData, selectedLeague: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeagueSelect = async (league) => {
    setLoading(true);
    setError(null);

    setLeagueData({ ...leagueData, selectedLeague: league });
    
    try {
      // Fetch league users
      const usersResponse = await fetch(
        `https://api.sleeper.app/v1/league/${league.league_id}/users?t=${Date.now()}`
      );
      if (!usersResponse.ok) {
        throw new Error("Failed to fetch league users");
      }
      const usersData = await usersResponse.json();
      setLeagueUsers(usersData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setUserFormData(null);
    setLeagueData(null);
    setLeagueUsers(null);
    setError(null);
  };

  const handleBack = () => {
    setLeagueData({ ...leagueData, selectedLeague: null });
    setLeagueUsers(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Actual Draft Analysis
          </h1>
          <p className="text-gray-300 text-lg mb-6">
            Analyze real draft picks from your Sleeper leagues and evaluate decision quality
          </p>
          <div className="flex justify-center">
            <a 
              href="/"
              className="inline-flex items-center px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </a>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 border border-red-400 text-red-300 rounded-lg bg-red-900/60 max-w-2xl mx-auto">
            <div>{error}</div>
            <button 
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" 
              onClick={handleReset}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* User Form */}
        {!userFormData && !loading && (
          <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6 border border-gray-700">
            <UserForm onSubmit={handleUserSubmit} />
          </div>
        )}

        {/* League Selector */}
        {userFormData && leagueData?.leagues && !leagueData.selectedLeague && !loading && (
          <div className="max-w-2xl mx-auto bg-gray-800 rounded-lg p-6 border border-gray-700">
            <LeagueSelector
              leagues={leagueData.leagues}
              onSelect={handleLeagueSelect}
              onBack={handleReset}
              onRefresh={() => handleUserSubmit(userFormData.username || userFormData.display_name, userFormData.year)}
            />
          </div>
        )}

        {/* Actual Draft Analysis Component */}
        {leagueData?.selectedLeague && leagueUsers && playerDatabase && !loading && (
          <ActualDraftAnalysis
            league={leagueData.selectedLeague}
            user={userFormData}
            leagueUsers={leagueUsers}
            data={playerDatabase}
            onBack={handleBack}
          />
        )}

        {/* Loading Player Database */}
        {leagueData?.selectedLeague && leagueUsers && !playerDatabase && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-300">Loading player database...</p>
          </div>
        )}
      </div>
    </div>
  );
}