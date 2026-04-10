// UI component for displaying summoner data including match history

import { API_BASE_URL } from "../config/apiBaseUrl.js";

export async function createSummonerProfileView(cachedSummoner) {
  const container = document.createElement("div");
  container.className = "summoner-profile-view match-history";

  // Show loading state
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "summoner-profile-loading no-matches";
  loadingDiv.textContent = "Loading summoner profile...";
  container.appendChild(loadingDiv);

  try {
    // Fetch fresh summoner data from API using cached summoner info
    const region = cachedSummoner?.region?.toLowerCase() || 'na';
    const gameName = cachedSummoner?.gameName;
    const tagLine = cachedSummoner?.tagLine;

    if (!gameName || !tagLine) {
      throw new Error('Summoner information not available');
    }

    const response = await fetch(`${API_BASE_URL}/api/summoner/${region}/${gameName}/${tagLine}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const summoner = await response.json();

    // Remove loading state
    container.removeChild(loadingDiv);

    // Render the profile with fresh data
    renderSummonerProfile(container, summoner);

  } catch (error) {
    console.error('Failed to fetch summoner profile:', error);
    loadingDiv.className = "summoner-profile-error";
    loadingDiv.textContent = `Failed to load summoner profile: ${error.message}`;
  }

  return container;
}

function renderSummonerProfile(container, summoner) {
  const title = document.createElement("h2");
  title.textContent = `Summoner Profile: ${summoner.riotId}`;
  container.appendChild(title);

  const profile = document.createElement("div");
  profile.className = "summoner-profile-header match-item";

  // Profile icon
  const icon = document.createElement("img");
  icon.src = summoner.profileIconUrl;
  icon.alt = "Profile Icon";
  icon.className = "summoner-profile-icon";

  // Basic info
  const info = document.createElement("div");
  info.className = "summoner-profile-info";

  const [gameName = summoner.riotId, tagLine] = (summoner.riotId || "").split("#");

  const name = document.createElement("h3");
  name.className = "summoner-profile-name";
  name.textContent = gameName;

  if (tagLine) {
    const tag = document.createElement("span");
    tag.className = "summoner-profile-tag";
    tag.textContent = `#${tagLine}`;
    name.appendChild(tag);
  }

  const level = document.createElement("p");
  level.textContent = `Level: ${summoner.summonerLevel}`;
  level.className = "summoner-profile-level";

  const region = document.createElement("p");
  region.textContent = `Region: ${summoner.region}`;
  region.className = "match-id";

  info.append(name, level, region);
  profile.append(icon, info);
  container.appendChild(profile);

  // Additional stats section
  const stats = document.createElement("div");
  stats.className = "summoner-profile-stats";

  const statsTitle = document.createElement("h3");
  statsTitle.textContent = "Account Information";
  statsTitle.className = "summoner-profile-stats-title";
  stats.appendChild(statsTitle);

  const fields = [
    { label: "PUUID", value: summoner.puuid },
    { label: "Account ID", value: summoner.accountId },
    { label: "Summoner ID", value: summoner.id }
  ];

  const statsList = document.createElement("ul");
  statsList.className = "match-list";

  fields.forEach((field) => {
    const statItem = document.createElement("li");
    statItem.className = "match-item";

    const summary = document.createElement("div");
    summary.className = "match-summary";

    const label = document.createElement("span");
    label.className = "stat-label";
    label.textContent = field.label;

    const value = document.createElement("span");
    value.className = "stat-value";
    value.textContent = field.value || "N/A";

    summary.append(label, value);
    statItem.appendChild(summary);
    statsList.appendChild(statItem);
  });

  stats.appendChild(statsList);
  container.appendChild(stats);
}