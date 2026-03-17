// UI component for displaying match history

export function createMatchHistoryView(
  matches = [],
  summoner = null,
  onNavigateToMatchDetail = null,
  onSaveMatchHistory = null
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

      item.innerHTML = `
        <div class="match-summary">
          <span class="match-id">Match: ${match.matchId}</span>
          <span class="champion-name">${champion}</span>
          <span class="kda">${kda}</span>
          <span class="result ${result.toLowerCase()}">${result}</span>
        </div>
      `;
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

  if (summoner && typeof onSaveMatchHistory === "function") {
    const actions = document.createElement("div");
    actions.className = "match-history-actions";

    const status = document.createElement("p");
    status.className = "save-history-status";

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

    actions.append(saveButton, status);
    container.appendChild(actions);
  }

  return container;
}
