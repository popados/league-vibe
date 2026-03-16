// UI component for displaying a list of champions

export function createChampionsView(champions = []) {
  const container = document.createElement("div");
  container.className = "champions-view";

  const title = document.createElement("h2");
  title.textContent = "Champions";
  container.appendChild(title);

  const list = document.createElement("div");
  list.className = "champions-list";

  champions.forEach((champion) => {
    const item = document.createElement("div");
    item.className = "champion-item";

    const img = document.createElement("img");
    img.src = champion.image;
    img.alt = champion.name;
    img.className = "champion-image";

    const info = document.createElement("div");
    info.className = "champion-info";

    const name = document.createElement("h3");
    name.textContent = `${champion.name} - ${champion.title}`;

    const tags = document.createElement("p");
    tags.textContent = `Tags: ${champion.tags.join(", ")}`;

    const stats = document.createElement("p");
    stats.textContent = `HP: ${champion.stats.hp}, MP: ${champion.stats.mp}, Armor: ${champion.stats.armor}, MR: ${champion.stats.mr}`;

    info.append(name, tags, stats);
    item.append(img, info);
    list.appendChild(item);
  });

  container.appendChild(list);
  return container;
}