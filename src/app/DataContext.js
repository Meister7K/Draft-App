"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

const DataContext = createContext();

const LOCAL_STORAGE_KEY = "draftAppData";

const defaultState = {
  leagueData: null,
  draftData: null,
  playerData: {}, // keyed by player_id
  userFormData: null,
  leagueUsers: null, // NEW: store users in league
};

export function DataProvider({ children }) {
  const [data, setData] = useState(defaultState);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch (e) {
        setData(defaultState);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // Update functions
  const setLeagueData = (leagueData) => setData((d) => ({ ...d, leagueData }));
  const setDraftData = (draftData) => setData((d) => ({ ...d, draftData }));
  const setPlayerData = (player_id, playerDataObj) =>
    setData((d) => ({
      ...d,
      playerData: { ...d.playerData, [player_id]: playerDataObj },
    }));
  const submitUserForm = (userFormData) =>
    setData((d) => ({ ...d, userFormData }));
  const setLeagueUsers = (leagueUsers) =>
    setData((d) => ({ ...d, leagueUsers })); // NEW
  const clearAllData = () => {
    setData(defaultState);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return (
    <DataContext.Provider
      value={{
        ...data,
        setLeagueData,
        setDraftData,
        setPlayerData,
        submitUserForm,
        setLeagueUsers, // NEW
        clearAllData, // NEW
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useDataContext() {
  return useContext(DataContext);
}
