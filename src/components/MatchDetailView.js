// UI component for displaying detailed match data including items

export function createMatchDetailView(matchDetail) {
  const container = document.createElement("div");
  container.className = "match-detail-view";

  const title = document.createElement("h2");
  title.textContent = `Match ${matchDetail.metadata.matchId}`;
  container.appendChild(title);

  const info = document.createElement("div");
  info.className = "match-info";

  const gameMode = document.createElement("p");
  gameMode.textContent = `Game Mode: ${matchDetail.info.gameMode}`;

  const duration = document.createElement("p");
  duration.textContent = `Duration: ${Math.floor(matchDetail.info.gameDuration / 60)}:${(matchDetail.info.gameDuration % 60).toString().padStart(2, '0')}`;

  const participantsTitle = document.createElement("h3");
  participantsTitle.textContent = "Participants";

  const participantsList = document.createElement("ul");
  participantsList.className = "participants-list";

  matchDetail.info.participants.forEach((participant) => {
    const li = document.createElement("li");
    li.className = "participant-item";

    const name = document.createElement("span");
    name.textContent = `${participant.summonerName} (${participant.championName})`;

    const kda = document.createElement("span");
    kda.textContent = `KDA: ${participant.kills}/${participant.deaths}/${participant.assists}`;

    const items = document.createElement("div");
    items.className = "participant-items";
    for (let i = 0; i < 7; i++) {
      const itemId = participant[`item${i}`];
      if (itemId) {
        const img = document.createElement("img");
        img.src = `https://ddragon.leagueoflegends.com/cdn/13.6.1/img/item/${itemId}.png`;
        img.alt = `Item ${itemId}`;
        img.className = "item-icon";
        items.appendChild(img);
      }
    }

    li.append(name, kda, items);
    participantsList.appendChild(li);
  });

  info.append(gameMode, duration, participantsTitle, participantsList);
  container.appendChild(info);

  return container;
}