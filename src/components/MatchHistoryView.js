// UI component for displaying match history

const DDRAGON_BASE = "https://ddragon.leagueoflegends.com/cdn/16.6.1/img/champion";

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function formatDate(epochMs) {
  if (!epochMs) return "Unknown date";
  return new Date(epochMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function createTeamChampionIcons(allParticipants = []) {
  const blue = allParticipants.filter((p) => p.teamId === 100);
  const red  = allParticipants.filter((p) => p.teamId === 200);

  const strip = document.createElement("div");
  strip.className = "mh-teams-strip";

  [blue, red].forEach((team, idx) => {
    const group = document.createElement("div");
    group.className = `mh-team-icons mh-team-icons--${idx === 0 ? "blue" : "red"}`;
    team.forEach((p) => {
      const img = document.createElement("img");
      img.src = `${DDRAGON_BASE}/${p.championName}.png`;
      img.alt = p.championName;
      img.title = p.championName;
      img.className = "mh-champ-icon";
      img.onerror = () => { img.style.visibility = "hidden"; };
      group.appendChild(img);
    });
    strip.appendChild(group);
  });

  return strip;
}

export function createMatchHistoryView(
  matches = [],
  summoner = null,
  onNavigateToMatchDetail = null,
  onSaveMatchHistory = null,
  onSaveAllMatchDetails = null
) {
  const container = document.createElement("div");
  container.className = "match-history";

  const title = document.createElement("h2");
  title.textContent = "Match History";

  // Add summoner name and tag if available
  if (summoner && summoner.riotId) {
    // const summonerInfo = document.createElement("span");
    // summonerInfo.className = "summoner-info";
    // summonerInfo.textContent = ` - ${summoner.riotId}`;
    // title.appendChild(summonerInfo);
    title.textContent += ` - ${summoner.riotId}`;
  }

  container.appendChild(title);

  if (matches.length === 0) {
    const noMatches = document.createElement("p");
    noMatches.textContent = "No matches found. Try searching for a summoner above.";
    noMatches.className = "no-matches";
    container.appendChild(noMatches);
    return container;
  }

  const list = document.createElement("ul");
  list.className = "match-list";

  matches.forEach((match) => {
    const item = document.createElement("li");
    item.className = "match-item";

    if (match.matchId) {
      // Display match info with champion, KDA, and result
      const participant = match.participant;
      const champion = participant ? participant.championName : 'Unknown';
      const kda = participant ? `${participant.kills}/${participant.deaths}/${participant.assists}` : 'N/A';
      const result = participant ? (participant.win ? 'Win' : 'Loss') : 'Unknown';

      const duration = match.gameDuration ? formatDuration(match.gameDuration) : null;
      const date = formatDate(match.gameCreation);

      item.innerHTML = `
        <div class="match-summary">
          <span class="match-id">Match: ${match.matchId}</span>
          <span class="champion-name">${champion}</span>
          <span class="kda">${kda}</span>
          <span class="result ${result.toLowerCase()}">${result}</span>
          ${duration ? `<span class="mh-duration">${duration}</span>` : ""}
          <span class="mh-date">${date}</span>
        </div>
      `;

      if (Array.isArray(match.allParticipants) && match.allParticipants.length > 0) {
        item.appendChild(createTeamChampionIcons(match.allParticipants));
      }

      item.title = "Click to view match details";
      item.style.cursor = "pointer";
      item.addEventListener("click", () => {
        if (onNavigateToMatchDetail) {
          onNavigateToMatchDetail(match);
        } else {
          alert(`Match Details for: ${match.matchId}\n(This would open match details in a real implementation)`);
        }
      });
    } else {
      // Fallback for old format
      item.textContent = `${match.date || 'Unknown Date'} - ${match.championName || 'Unknown'} - ${match.kda || 'N/A'}`;
    }

    list.appendChild(item);
  });

  container.appendChild(list);

  if (summoner && (typeof onSaveMatchHistory === "function" || typeof onSaveAllMatchDetails === "function")) {
    const actions = document.createElement("div");
    actions.className = "match-history-actions";

    const buttonRow = document.createElement("div");
    buttonRow.className = "match-history-action-buttons";

    const status = document.createElement("p");
    status.className = "save-history-status";

    if (typeof onSaveMatchHistory === "function") {
      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "save-history-button";
      saveButton.textContent = "Save Match History";

      saveButton.addEventListener("click", async () => {
        saveButton.disabled = true;
        status.textContent = "Saving match history...";
        status.className = "save-history-status pending";

        try {
          const result = await onSaveMatchHistory({ summoner, matches });
          status.textContent = result?.message || "Match history saved.";
          status.className = "save-history-status success";
        } catch (error) {
          status.textContent = error.message || "Failed to save match history.";
          status.className = "save-history-status error";
        } finally {
          saveButton.disabled = false;
        }
      });

      buttonRow.appendChild(saveButton);
    }

    if (typeof onSaveAllMatchDetails === "function") {
      const saveDetailsButton = document.createElement("button");
      saveDetailsButton.type = "button";
      saveDetailsButton.className = "save-history-button save-all-details-button";
      saveDetailsButton.textContent = "Save All Match Details";

      saveDetailsButton.addEventListener("click", async () => {
        saveDetailsButton.disabled = true;
        status.textContent = "Saving all match details in sequence...";
        status.className = "save-history-status pending";

        try {
          const result = await onSaveAllMatchDetails({ summoner, matches });
          status.textContent = result?.message || "All match details saved.";
          status.className = "save-history-status success";
        } catch (error) {
          status.textContent = error.message || "Failed to save all match details.";
          status.className = "save-history-status error";
        } finally {
          saveDetailsButton.disabled = false;
        }
      });

      buttonRow.appendChild(saveDetailsButton);
    }

    actions.append(buttonRow, status);
    container.appendChild(actions);
  }

  return container;
}
