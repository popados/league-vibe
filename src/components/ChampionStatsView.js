// UI component for displaying champion statistics

function renderChampionStatsList(list, championStats = {}, emptyMessage) {
  list.innerHTML = "";

  const entries = Object.entries(championStats);

  if (entries.length === 0) {
    const item = document.createElement("li");
    item.className = "champion-stats-item";
    item.textContent = emptyMessage;
    list.appendChild(item);
    return;
  }

  entries.forEach(([championName, stats]) => {
    const item = document.createElement("li");
    item.className = "champion-stats-item";
    const winRate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;
    item.textContent = `${championName} - ${stats.games} picks, ${stats.wins} wins, ${winRate}% win rate`;
    list.appendChild(item);
  });
}

export function createChampionStatsView(championStats = {}, summoner = null) {
  const container = document.createElement("div");
  container.className = "champion-stats";

  const title = document.createElement("h2");
  title.textContent = "Champion Stats";
  container.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "champion-stats-summary";
  container.appendChild(subtitle);

  const list = document.createElement("ul");
  list.className = "champion-stats-list";
  container.appendChild(list);

  if (!summoner?.gameName || !summoner?.tagLine || !summoner?.region) {
    subtitle.textContent = "Search for a summoner and save match history to view cached champion picks.";
    renderChampionStatsList(list, championStats, "No champion stats available.");
    return container;
  }

  subtitle.textContent = `Loading cached champion stats for ${summoner.riotId || `${summoner.gameName}#${summoner.tagLine}`}...`;
  renderChampionStatsList(list, {}, "Loading cached champion stats...");

  fetch(
    `http://localhost:3001/api/summoner/${encodeURIComponent(summoner.region.toLowerCase())}/${encodeURIComponent(summoner.gameName)}/${encodeURIComponent(summoner.tagLine)}/champion-stats`
  )
    .then(async (response) => {
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || `Server error: ${response.status}`);
      }

      subtitle.textContent = `Cached picks across ${data.totalMatches} saved matches for ${data.summoner.riotId}`;
      renderChampionStatsList(list, data.championStats, "No champion picks found in cached matches.");
    })
    .catch((error) => {
      subtitle.textContent = error.message || "Failed to load cached champion stats.";
      renderChampionStatsList(list, {}, "Save match history to MongoDB to view cached champion picks.");
    });

  return container;
}
