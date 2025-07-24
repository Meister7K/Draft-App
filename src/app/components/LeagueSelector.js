"use client";

export function LeagueSelector({ leagues, onSelect, onBack, onRefresh }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Select a League
          </h2>
          <button onClick={onBack} className="btn text-sm px-2 py-1">
             Back to username
          </button>
        </div>

        <div className="space-y-3">
          {leagues.map((league) => (
            <div
              key={league.league_id}
              className="border border-[var(--border)] rounded-lg p-4 hover:bg-[var(--background)]/80 cursor-pointer transition-colors bg-[var(--secondary)] text-[var(--foreground)]"
              onClick={() => onSelect(league)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-[var(--foreground)]">
                    {league.name}
                  </h3>
                  <p className="text-sm opacity-80 mt-1">
                    {league.total_rosters} teams •{" "}
                    {league.settings.playoff_teams} playoff spots
                  </p>
                  <p className="text-xs opacity-60 mt-1">
                    Season: {league.season} • Status: {league.status}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-[var(--primary)]">
                    {league.settings.type === 1 ? "Redraft" : "Dynasty"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
