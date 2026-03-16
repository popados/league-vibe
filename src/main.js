// Entry point for the League Vibe app.

import { createNavigation } from "./components/Navigation.js";
import { createSummonerSearch } from "./components/SummonerSearch.js";
import { createMatchHistoryView } from "./components/MatchHistoryView.js";
import { createChampionStatsView } from "./components/ChampionStatsView.js";
import { createChampionsView } from "./components/ChampionsView.js";
import { createItemsView } from "./components/ItemsView.js";
import { createMatchDetailView } from "./components/MatchDetailView.js";
import { createSummonerProfileView } from "./components/SummonerProfileView.js";

const app = document.getElementById("app");

let currentPage = "home";

function renderApp(data = {}) {
  app.innerHTML = "";

  const nav = createNavigation((page) => {
    currentPage = page;
    renderApp(data);
  });

  app.appendChild(nav);

  switch (currentPage) {
    case "home":
      renderHome(data);
      break;
    case "champions":
      renderChampions(data.champions || []);
      break;
    case "items":
      renderItems(data.items || []);
      break;
    case "match-detail":
      renderMatchDetail(data.matchDetail);
      break;
    case "summoner-profile":
      renderSummonerProfile(data.summoner);
      break;
    default:
      renderHome(data);
  }
}

function renderHome({ matchHistory = [], championStats = {} } = {}) {
  const search = createSummonerSearch(async (summonerName, region) => {
    if (!summonerName) return;
    // TODO: Replace with real Riot API calls.
    renderApp({ matchHistory, championStats });
  });

  const matchHistoryView = createMatchHistoryView(matchHistory);
  const championStatsView = createChampionStatsView(championStats);

  app.append(search, matchHistoryView, championStatsView);
}

function renderChampions(champions) {
  // If champions data is not provided, fetch from server
  if (!champions || champions.length === 0) {
    fetchChampionsFromServer();
    return;
  }

  const championsView = createChampionsView(champions);
  app.appendChild(championsView);
}

async function fetchChampionsFromServer() {
  try {
    const response = await fetch('/api/champions');
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    const champions = await response.json();

    // Update the data and re-render
    const data = await loadMockData();
    data.champions = champions;
    renderApp(data);
  } catch (error) {
    console.error('Failed to fetch champions from server:', error);

    // Fallback to mock data
    const data = await loadMockData();
    renderApp(data);

    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.style.textAlign = 'center';
    errorDiv.style.padding = '20px';
    errorDiv.textContent = 'Failed to load champions from server. Using mock data.';
    app.appendChild(errorDiv);
  }
}

function renderItems(items) {
  const itemsView = createItemsView(items);
  app.appendChild(itemsView);
}

function renderMatchDetail(matchDetail) {
  const matchDetailView = createMatchDetailView(matchDetail);
  app.appendChild(matchDetailView);
}

function renderSummonerProfile(summoner) {
  const summonerProfileView = createSummonerProfileView(summoner);
  app.appendChild(summonerProfileView);
}

async function loadMockData() {
  try {
    const [
      matchesResp,
      statsResp,
      itemsResp,
      matchDetailResp,
      summonerResp,
    ] = await Promise.all([
      fetch("./data/mockMatchHistory.json"),
      fetch("./data/mockChampionStats.json"),
      fetch("./data/mockItems.json"),
      fetch("./data/mockMatchDetail.json"),
      fetch("./data/mockSummoner.json"),
    ]);

    const [
      matches,
      championStats,
      items,
      matchDetail,
      summoner,
    ] = await Promise.all([
      matchesResp.json(),
      statsResp.json(),
      itemsResp.json(),
      matchDetailResp.json(),
      summonerResp.json(),
    ]);

    return {
      matchHistory: matches,
      championStats,
      champions: [], // Will be loaded from server when needed
      items,
      matchDetail,
      summoner
    };
  } catch (err) {
    console.warn("Failed to load mock data", err);
    return {
      matchHistory: [],
      championStats: {},
      champions: [],
      items: [],
      matchDetail: null,
      summoner: null,
    };
  }
}

(async function init() {
  const data = await loadMockData();
  renderApp(data);
})();
