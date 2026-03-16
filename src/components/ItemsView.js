// UI component for displaying a list of items

export function createItemsView(items = []) {
  const container = document.createElement("div");
  container.className = "items-view";

  const title = document.createElement("h2");
  title.textContent = "Items";
  container.appendChild(title);

  const list = document.createElement("div");
  list.className = "items-list";

  items.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "item-item";

    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.name;
    img.className = "item-image";

    const info = document.createElement("div");
    info.className = "item-info";

    const name = document.createElement("h3");
    name.textContent = item.name;

    const desc = document.createElement("p");
    desc.textContent = item.description;

    const gold = document.createElement("p");
    gold.textContent = `Cost: ${item.gold.total} gold (Sell: ${item.gold.sell})`;

    info.append(name, desc, gold);
    itemDiv.append(img, info);
    list.appendChild(itemDiv);
  });

  container.appendChild(list);
  return container;
}