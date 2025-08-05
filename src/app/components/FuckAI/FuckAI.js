'use client'

import {useState, useEffect} from 'react';
import { PerfectDraft } from '../PerfectDraft';


export function FuckAI() {

    const [storageData, setStorageData] = useState(null);
    const [playerData, setPlayerData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Load localStorage data after component mounts
    useEffect(() => {
        const data = localStorage.getItem('draftAppData');
        console.log('localStorage data:', data);
        if (data) {
            const parsedData = JSON.parse(data);
            console.log('parsed localStorage data:', parsedData);
            setStorageData(parsedData);
        } else {
            console.log('No data found in localStorage');
        }
    }, []);

    useEffect(() => {
        const fetchPlayerData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const response = await fetch('/api/raw-fantasy-data');
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                setPlayerData(data);
            } catch (err) {
                console.error('Error fetching player data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayerData();
    }, []);

    //   useEffect(() => {
    //     localStorage.setItem('inputValue', value);
    //   }, [value]); // Only re-run the effect if `value` changes
    
    //   const handleChange = (event) => {
    //     setValue(event.target.value);
    //   };


    //   const managers = ;
    

    if (loading) {
        return <div>Loading player data...</div>;
    }

    if (error) {
        return <div>Error loading player data: {error}</div>;
    }

    // Destructure the storageData object
    const { draftData, leagueData: leagueInfo, leagueUsers, userFormData } = storageData || {};

    

    const managers = leagueUsers

    // Debug: Log the draftData to see its structure
    // // console.log('draftData:', draftData);
    // console.log('draftData keys:', draftData ? Object.keys(draftData) : 'draftData is null');
    // console.log('year:', year);

    // Add null check for playerData before accessing its properties
    if (playerData && playerData.players && playerData.players[0]) {
        // console.log(JSON.stringify(playerData.players[0].seasons[year].season_projected_totals.adp_2qb, null, 2));

        const adp = JSON.stringify(playerData.players[0].seasons[year].season_projected_totals.adp_2qb, null, 2)

        const projectedPoints = JSON.stringify(playerData.players[0].seasons[year].season_projected_totals.pts_half_ppr, null, 2)
        const playerName = JSON.stringify(playerData.players[0].player_info.name, null, 2)
        const playerPos = JSON.stringify(playerData.players[0].player_info.position, null, 2)
        const playerID =JSON.stringify(playerData.players[0].player_info.player_id, null, 2)
    }

    // Correct path to access roster_positions from selectedLeague
    const rosterData = storageData?.leagueData?.selectedLeague?.roster_positions;

    const draftOrder = storageData?.draftData?.draft_order;
    let picks = storageData?.draftData?.picks;

    // console.log('storageData:', storageData);
    // console.log('storageData.selectedLeague:', storageData?.selectedLeague);
    // console.dir(rosterData)

    return (
      <>
        {storageData && playerData && (
          <PerfectDraft 
            playerData={playerData}
            draftData={draftData}
            leagueData={leagueInfo}
            leagueUsers={leagueUsers}
            year={year}
          />
        )}
        
        {(!storageData || !playerData) && (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <h2>Loading Perfect Draft Simulator...</h2>
            <p>Please ensure you have loaded draft data and player data.</p>
          </div>
        )}
      </>
    )
}
