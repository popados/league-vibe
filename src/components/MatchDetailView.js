// UI component for displaying detailed match data including items

export async function createMatchDetailView(
  gameName,
  tag,
  matchId,
  cachedMatches = [],
  onSelectMatch = null,
  routingRegion = "americas"
) {

  const container = document.createElement("div");
  container.className = "match-detail-view";

  // Show loading state
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "loading";
  loadingDiv.textContent = "Loading match details...";
  container.appendChild(loadingDiv);

  try {
    // Fetch match details from API
    const response = await fetch(`http://localhost:3001/api/summoner/${gameName}/${tag}/matches/${matchId}?region=${encodeURIComponent(routingRegion)}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const matchDetail = await response.json();

    // Remove loading state
    container.removeChild(loadingDiv);

    // Create match detail content
    renderMatchDetail(container, matchDetail, cachedMatches, onSelectMatch, gameName, tag, routingRegion);

  } catch (error) {
    console.error('Failed to fetch match details:', error);
    loadingDiv.textContent = `Failed to load match details: ${error.message}`;
    loadingDiv.style.color = '#f44336';
  }

  return container;
}

function renderMatchDetail(
  container,
  matchDetail,
  cachedMatches = [],
  onSelectMatch = null,
  gameName,
  tag,
  routingRegion = "americas"
) {
  const CURRENT_PATCH = '16.5.1'; // Default patch, will be updated from server if possible  
  const summonerRiotId = gameName && tag ? `${gameName}#${tag}` : gameName || "Unknown Summoner";

  if (Array.isArray(cachedMatches) && cachedMatches.length > 0) {
    const selectorContainer = document.createElement("div");
    selectorContainer.className = "match-selector-container";

    const selectorLabel = document.createElement("label");
    selectorLabel.className = "match-selector-label";
    selectorLabel.setAttribute("for", "match-selector");
    selectorLabel.textContent = "Select Match";

    const selector = document.createElement("select");
    selector.id = "match-selector";
    selector.className = "match-selector";

    cachedMatches.forEach((match) => {
      if (!match?.matchId) {
        return;
      }

      const option = document.createElement("option");
      option.value = match.matchId;

      const participant = match.participant || {};
      const champion = participant.championName || "Unknown";
      const kda = `${participant.kills ?? 0}/${participant.deaths ?? 0}/${participant.assists ?? 0}`;
      const result = participant.win ? "Win" : "Loss";

      option.textContent = `${match.matchId} - ${champion} (${kda}) ${result}`;
      option.selected = match.matchId === matchDetail.metadata.matchId;
      selector.appendChild(option);
    });

    selector.addEventListener("change", (event) => {
      if (typeof onSelectMatch === "function" && event.target.value !== matchDetail.metadata.matchId) {
        onSelectMatch(event.target.value);
      }
    });

    selectorContainer.append(selectorLabel, selector);
    container.appendChild(selectorContainer);
  }

  const title = document.createElement("h2");
  title.textContent = `Match ${matchDetail.metadata.matchId}`;
  container.appendChild(title);

  const summonerName = document.createElement("p");
  summonerName.className = "match-detail-summoner";
  summonerName.textContent = `Summoner: ${summonerRiotId}`;
  container.appendChild(summonerName);

  const info = document.createElement("div");
  info.className = "match-info";

  const gameMode = document.createElement("p");
  gameMode.textContent = `Game Mode: ${matchDetail.info.gameMode}`;

  const duration = document.createElement("p");
  duration.textContent = `Duration: ${Math.floor(matchDetail.info.gameDuration / 60)}:${(matchDetail.info.gameDuration % 60).toString().padStart(2, '0')}`;

  const gameType = document.createElement("p");
  gameType.textContent = `Game Type: ${matchDetail.info.gameType}`;

  const mapId = document.createElement("p");
  mapId.textContent = `Map ID: ${matchDetail.info.mapId}`;

  info.append(gameMode, duration, gameType, mapId);
  container.appendChild(info);

  // Display teams and their participants
  matchDetail.info.teams.forEach((team) => {
    const teamSection = document.createElement("div");
    teamSection.className = `team-section team-${team.teamId}`;

    const teamTitle = document.createElement("h3");
    teamTitle.textContent = `Team ${team.teamId === 100 ? 'Blue' : 'Red'} ${team.win ? '(Winner)' : '(Loser)'}`;
    teamTitle.className = team.win ? 'team-winner' : 'team-loser';
    teamSection.appendChild(teamTitle);

    const participantsList = document.createElement("ul");
    participantsList.className = "participants-list";

    team.participants.forEach((participant) => {
      const li = document.createElement("li");
      li.className = "participant-item";

      const name = document.createElement("span");
      name.className = "participant-name";
      name.textContent = `${participant.summonerName} (${participant.championName})`;

      const kda = document.createElement("span");
      kda.className = "participant-kda";
      kda.textContent = `KDA: ${participant.kills}/${participant.deaths}/${participant.assists}`;

      const level = document.createElement("span");
      level.className = "participant-level";
      level.textContent = `Level: ${participant.champLevel}`;

      const gold = document.createElement("span");
      gold.className = "participant-gold";
      gold.textContent = `Gold: ${participant.goldEarned.toLocaleString()}`;

      const cs = document.createElement("span");
      cs.className = "participant-cs";
      cs.textContent = `CS: ${participant.totalMinionsKilled + participant.neutralMinionsKilled}`;

      const items = document.createElement("div");
      items.className = "participant-items";
      for (let i = 0; i < 7; i++) {
        const itemId = participant[`item${i}`];
        if (itemId) {
          const img = document.createElement("img");
          img.src = `https://ddragon.leagueoflegends.com/cdn/${CURRENT_PATCH}/img/item/${itemId}.png`;
          img.alt = `Item ${itemId}`;
          img.className = "item-icon";
          items.appendChild(img);
        }
      }

      li.append(name, kda, level, gold, cs, items);
      participantsList.appendChild(li);
    });

    teamSection.appendChild(participantsList);
    container.appendChild(teamSection);
  });

  const detailActions = document.createElement("div");
  detailActions.className = "match-detail-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "save-detail-button";
  saveButton.textContent = "Save Match Details";

  const status = document.createElement("p");
  status.className = "save-detail-status";

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    status.className = "save-detail-status pending";
    status.textContent = "Saving match details...";

    try {
      const response = await fetch(
        `http://localhost:3001/api/summoner/${encodeURIComponent(gameName)}/${encodeURIComponent(tag)}/matches/${encodeURIComponent(matchDetail.metadata.matchId)}/save?region=${encodeURIComponent(routingRegion)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            matchDetail
          })
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || `Save failed: ${response.status}`);
      }

      status.className = "save-detail-status success";
      status.textContent = data.message || "Match details saved.";
    } catch (error) {
      status.className = "save-detail-status error";
      status.textContent = error.message || "Failed to save match details.";
    } finally {
      saveButton.disabled = false;
    }
  });

  detailActions.append(saveButton, status);
  container.appendChild(detailActions);
}