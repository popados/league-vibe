// UI component for displaying match history

export function createMatchHistoryView(matches = []) {
  const container = document.createElement("div");
  container.className = "match-history";

  const title = document.createElement("h2");
  title.textContent = "Match History";
  container.appendChild(title);

  const list = document.createElement("ul");
  list.className = "match-list";

  matches.forEach((match) => {
    const item = document.createElement("li");
    item.className = "match-item";
    item.textContent = `${match.date} - ${match.championName} - ${match.kda}`;
    list.appendChild(item);
  });

  container.appendChild(list);
  return container;
}
