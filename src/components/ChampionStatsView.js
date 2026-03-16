// UI component for displaying champion statistics

export function createChampionStatsView(championStats = {}) {
  const container = document.createElement("div");
  container.className = "champion-stats";

  const title = document.createElement("h2");
  title.textContent = "Champion Stats";
  container.appendChild(title);

  const list = document.createElement("ul");
  list.className = "champion-stats-list";

  Object.entries(championStats).forEach(([champId, stats]) => {
    const item = document.createElement("li");
    item.className = "champion-stats-item";
    item.textContent = `Champion ${champId} – ${stats.games} games, ${stats.wins} wins`;
    list.appendChild(item);
  });

  container.appendChild(list);
  return container;
}
