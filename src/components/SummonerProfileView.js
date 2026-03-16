// UI component for displaying summoner data including match history

export function createSummonerProfileView(summoner) {
  const container = document.createElement("div");
  container.className = "summoner-profile-view";

  const title = document.createElement("h2");
  title.textContent = `Summoner: ${summoner.name}`;
  container.appendChild(title);

  const profile = document.createElement("div");
  profile.className = "summoner-profile";

  const icon = document.createElement("img");
  icon.src = `https://ddragon.leagueoflegends.com/cdn/13.6.1/img/profileicon/${summoner.profileIconId}.png`;
  icon.alt = "Profile Icon";
  icon.className = "profile-icon";

  const level = document.createElement("p");
  level.textContent = `Level: ${summoner.summonerLevel}`;

  profile.append(icon, level);
  container.appendChild(profile);

  const historyTitle = document.createElement("h3");
  historyTitle.textContent = "Match History";
  container.appendChild(historyTitle);

  const historyList = document.createElement("ul");
  historyList.className = "match-history-list";

//   summoner.matchHistory.forEach((match) => {
//     const li = document.createElement("li");
//     li.className = "match-history-item";
//     li.textContent = `${match.date} - ${match.championName} - ${match.kda} - ${match.win ? 'Win' : 'Loss'}`;
//     historyList.appendChild(li);
//   });

  container.appendChild(historyList);

  return container;
}