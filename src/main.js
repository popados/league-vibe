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
let currentSummoner = null; // Cache for the currently searched summoner
let currentMatchHistory = []; // Cache for the current match history

function mapRegionToRouting(region = "NA") {
  const normalized = region.toLowerCase();
  const routingMap = {
    na: "americas",
    br: "americas",
    lan: "americas",
    las: "americas",
    oce: "americas",
    euw: "europe",
    eune: "europe",
    tr: "europe",
    ru: "europe",
    kr: "asia",
    jp: "asia"
  };

  return routingMap[normalized] || "americas";
}

async function saveMatchHistory({ summoner, matches }) {
  if (!summoner?.gameName || !summoner?.tagLine || !summoner?.region) {
    throw new Error("Summoner information is required before saving.");
  }

  const region = summoner.region.toLowerCase();
  const response = await fetch(
    `http://localhost:3001/api/summoner/${encodeURIComponent(region)}/${encodeURIComponent(summoner.gameName)}/${encodeURIComponent(summoner.tagLine)}/matches/save`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        count: matches.length,
        matchHistory: {
          summoner,
          matches
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.details || data.error || `Save failed: ${response.status}`);
  }

  return data;
}

function renderApp(data = {}) {
  app.innerHTML = "";

  // Always include the current summoner and match history in the data
  const fullData = { ...data, summoner: currentSummoner, matchHistory: currentMatchHistory };

  const nav = createNavigation((page) => {
    currentPage = page;
    renderApp(data); // Keep original data for navigation
  });

  app.appendChild(nav);

  switch (currentPage) {
    case "home":
      renderHome(fullData);
      break;
    case "match-history":
      renderMatchHistory(fullData);
      break;
    case "champions":
      renderChampions(fullData);
      break;
    case "items":
      renderItems(fullData);
      break;
    case "match-detail":
      renderMatchDetail(fullData);
      break;
    case "summoner-profile":
      renderSummonerProfile(fullData.summoner);
      break;
    default:
      renderHome(fullData);
  }
}

function renderHome({ matchHistory = [], championStats = {} } = {}) {
  const search = createSummonerSearch(async (gameName, tag, region) => {
    if (!gameName || !tag) return;

    // Show API endpoint alert
    const apiEndpoint = `http://localhost:3001/api/summoner/${region}/${gameName}/${tag}/matches?count=10`;
    alert(`API Endpoint: ${apiEndpoint}`);

    try {
      // Fetch match history from the API
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      // Cache the searched summoner and match history
      currentSummoner = data.summoner;
      currentMatchHistory = data.matches || [];

      // Update the app with the new match history data
      renderApp({
        matchHistory: data.matches || [],
        championStats
      });
    } catch (error) {
      console.error('Failed to fetch match history:', error);
      alert(`Failed to fetch match history: ${error.message}`);
      // Fallback to existing data
      renderApp({ matchHistory, championStats });
    }
  });

  const matchHistoryView = createMatchHistoryView(
    matchHistory,
    currentSummoner,
    (match) => {
      currentPage = "match-detail";
      renderApp({
        matchId: match.matchId
      });
    },
    saveMatchHistory
  );
  const championStatsView = createChampionStatsView(championStats);

  app.append(search, matchHistoryView, championStatsView);
}

function renderMatchHistory({ matchHistory = [], summoner } = {}) {
  const matchHistoryView = createMatchHistoryView(
    matchHistory,
    summoner,
    (match) => {
      currentPage = "match-detail";
      renderApp({
        matchId: match.matchId
      });
    },
    saveMatchHistory
  );
  app.appendChild(matchHistoryView);
}


function renderChampions({ champions = [] } = {}) {
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
    const response = await fetch('http://localhost:3001/api/champions');
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

function renderItems({ items = [] } = {}) {
  // If items data is not provided, fetch from server
  if (!items || items.length === 0) {
    fetchItemsFromServer();
    return;
  }

  const itemsView = createItemsView(items);
  app.appendChild(itemsView);
}

async function fetchItemsFromServer() {
  try {
    const response = await fetch('http://localhost:3001/api/items');
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    const items = await response.json();

    // Update the data and re-render
    const data = await loadMockData();
    data.items = items;
    renderApp(data);
  } catch (error) {
    console.error('Failed to fetch items from server:', error);

    // Fallback to mock data
    const data = await loadMockData();
    renderApp(data);

    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.style.textAlign = 'center';
    errorDiv.style.padding = '20px';
    errorDiv.textContent = 'Failed to load items from server. Using mock data.';
    app.appendChild(errorDiv);
  }
}

async function renderMatchDetail({ matchId, summoner } = {}) {
  if (!currentSummoner?.gameName || !currentSummoner?.tagLine) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'loading';
    errorDiv.textContent = 'No summoner selected. Search for a summoner to view match details.';
    app.appendChild(errorDiv);
    return;
  }

  const gameName = currentSummoner.gameName;
  const tag = currentSummoner.tagLine;
  const routingRegion = mapRegionToRouting(currentSummoner.region);
  const matchDetailView = await createMatchDetailView(
    gameName,
    tag,
    matchId,
    currentMatchHistory,
    (selectedMatchId) => {
      currentPage = "match-detail";
      renderApp({ matchId: selectedMatchId });
    },
    routingRegion
  );
  app.appendChild(matchDetailView);
}

async function renderSummonerProfile(summoner) {
  const summonerProfileView = await createSummonerProfileView(summoner);
  app.appendChild(summonerProfileView);
}

async function loadMockData() {
  try {
    const [
      matchesResp,
      statsResp,
      matchDetailResp,
      summonerResp,
    ] = await Promise.all([
      fetch("./data/mockMatchHistory.json"),
      fetch("./data/mockChampionStats.json"),
      fetch("./data/mockMatchDetail.json"),
      fetch("./data/mockSummoner.json"),
    ]);

    const [
      matches,
      championStats,
      matchDetail,
      summoner,
    ] = await Promise.all([
      matchesResp.json(),
      statsResp.json(),
      matchDetailResp.json(),
      summonerResp.json(),
    ]);

    return {
      matchHistory: matches,
      championStats,
      champions: [], // Will be loaded from server when needed
      items: [], // Will be loaded from server when needed
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
