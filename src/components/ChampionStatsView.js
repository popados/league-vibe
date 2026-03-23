// UI component for displaying champion statistics

const DDRAGON_BASE = "https://ddragon.leagueoflegends.com/cdn/16.6.1/img/champion";

function formatKda(kills, deaths, assists, games) {
  if (!games) return "N/A";
  const k = (kills / games).toFixed(1);
  const d = (deaths / games).toFixed(1);
  const a = (assists / games).toFixed(1);
  return `${k} / ${d} / ${a}`;
}

function createChampionCard(championName, stats) {
  const winRate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;
  const losses = stats.games - stats.wins;

  const card = document.createElement("div");
  card.className = "cs-card";

  // Champion icon
  const icon = document.createElement("img");
  icon.src = `${DDRAGON_BASE}/${championName}.png`;
  icon.alt = `${championName} icon`;
  icon.className = "cs-card-icon";
  icon.onerror = () => { icon.style.visibility = "hidden"; };

  // Right side content
  const body = document.createElement("div");
  body.className = "cs-card-body";

  const name = document.createElement("h3");
  name.className = "cs-card-name";
  name.textContent = championName;

  // Stats row
  const statsRow = document.createElement("div");
  statsRow.className = "cs-card-stats";

  function statChip(label, value, mod = "") {
    const chip = document.createElement("span");
    chip.className = `cs-chip${mod ? ` cs-chip--${mod}` : ""}`;
    chip.innerHTML = `<span class="cs-chip-label">${label}</span><span class="cs-chip-value">${value}</span>`;
    return chip;
  }

  statsRow.append(
    statChip("Games", stats.games),
    statChip("W", stats.wins, "win"),
    statChip("L", losses, "loss"),
    statChip("WR", `${winRate}%`, winRate >= 60 ? "high" : winRate <= 40 ? "low" : ""),
    statChip("KDA", formatKda(stats.kills ?? 0, stats.deaths ?? 0, stats.assists ?? 0, stats.games))
  );

  // Win rate bar
  const barWrap = document.createElement("div");
  barWrap.className = "cs-card-bar-wrap";
  const bar = document.createElement("div");
  bar.className = "cs-card-bar";
  bar.style.width = `${winRate}%`;
  barWrap.appendChild(bar);

  body.append(name, statsRow, barWrap);
  card.append(icon, body);
  return card;
}

function renderCards(grid, statusEl, championStats, emptyMessage) {
  grid.innerHTML = "";

  const entries = Object.entries(championStats).sort((left, right) => {
    const [leftName, leftStats] = left;
    const [rightName, rightStats] = right;

    const leftGames = leftStats.games ?? 0;
    const rightGames = rightStats.games ?? 0;
    const leftWinRate = leftGames > 0 ? (leftStats.wins ?? 0) / leftGames : 0;
    const rightWinRate = rightGames > 0 ? (rightStats.wins ?? 0) / rightGames : 0;

    return rightWinRate - leftWinRate
      || rightGames - leftGames
      || leftName.localeCompare(rightName);
  });
  if (entries.length === 0) {
    statusEl.textContent = emptyMessage;
    statusEl.style.display = "block";
    return;
  }

  statusEl.style.display = "none";
  entries.forEach(([championName, stats]) => {
    grid.appendChild(createChampionCard(championName, stats));
  });
}

export function createChampionStatsView(championStats = {}, summoner = null) {
  const container = document.createElement("div");
  container.className = "champion-stats cs-container";

  // Header
  const header = document.createElement("div");
  header.className = "cs-header";

  const title = document.createElement("h2");
  title.className = "cs-title";
  title.textContent = "Champion Stats";
  header.appendChild(title);

  const meta = document.createElement("p");
  meta.className = "cs-meta";
  header.appendChild(meta);

  container.appendChild(header);

  // Status placeholder (empty / error states)
  const statusEl = document.createElement("p");
  statusEl.className = "cs-status";
  container.appendChild(statusEl);

  // Cards grid
  const grid = document.createElement("div");
  grid.className = "cs-grid";
  container.appendChild(grid);

  if (!summoner?.gameName || !summoner?.tagLine || !summoner?.region) {
    meta.textContent = "Search for a summoner and save match history to view champion picks.";
    renderCards(grid, statusEl, championStats, "No champion stats available.");
    return container;
  }

  meta.textContent = `Loading champion stats for ${summoner.riotId || `${summoner.gameName}#${summoner.tagLine}`}\u2026`;
  statusEl.textContent = "Loading\u2026";
  statusEl.style.display = "block";

  fetch(
    `http://localhost:3001/api/summoner/${encodeURIComponent(summoner.region.toLowerCase())}/${encodeURIComponent(summoner.gameName)}/${encodeURIComponent(summoner.tagLine)}/champion-stats`
  )
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || `Server error: ${response.status}`);
      }
      meta.textContent = `${data.totalMatches} saved matches · ${data.summoner?.riotId || summoner.gameName}`;
      renderCards(grid, statusEl, data.championStats, "No champion picks found in cached matches.");
    })
    .catch((error) => {
      meta.textContent = error.message || "Failed to load champion stats.";
      renderCards(grid, statusEl, {}, "Save match history to MongoDB to view champion picks.");
    });

  return container;
}
