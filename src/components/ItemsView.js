// UI component for displaying a list of items

// Helper function to get tier text from depth
function getTierText(depth) {
  switch (depth) {
    case 1:
      return 'Basic';
    case 2:
      return 'Epic';
    case 3:
      return 'Legendary';
    default:
      return 'Basic';
  }
}

// Helper function to get map availability text
function getMapText(maps) {
  if (!maps || Object.keys(maps).length === 0) {
    return 'All Maps';
  }

  const availableMaps = [];
  if (maps['11']) availableMaps.push('Summoner\'s Rift');
  if (maps['12']) availableMaps.push('ARAM');
  if (maps['21']) availableMaps.push('Nexus Blitz');
  if (maps['22']) availableMaps.push('Teamfight Tactics');

  return availableMaps.length > 0 ? availableMaps.join(', ') : 'Limited Maps';
}

// Helper function to format item descriptions
function formatItemDescription(description) {
  if (!description) return 'No description available';

  let formattedText = description
    // Remove mainText wrapper
    .replace(/<\/?mainText>/g, '')
    // Remove stats wrapper
    .replace(/<\/?stats>/g, '')
    // Convert attention tags to highlighted spans
    .replace(/<attention>(.*?)<\/attention>/g, '<span class="stat-highlight">$1</span>')
    // Convert br tags to newlines
    .replace(/<br\s*\/?>/g, '\n')
    // Remove any remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Clean up extra whitespace and empty lines
    .replace(/\n\s*\n/g, '\n')
    .replace(/^\s*\n/gm, '') // Remove empty lines at start of lines
    .trim();

  // If the description is too long, truncate it
  if (formattedText.length > 200) {
    formattedText = formattedText.substring(0, 200) + '...';
  }

  return formattedText;
}

export function createItemsView(items = []) {
  const container = document.createElement("div");
  container.className = "items-view";

  const title = document.createElement("h2");
  title.textContent = "Items";
  container.appendChild(title);

  // Create filter controls
  const filtersContainer = document.createElement("div");
  filtersContainer.className = "items-filters";

  // Map filter
  const mapFilter = document.createElement("select");
  mapFilter.className = "filter-select";
  mapFilter.innerHTML = `
    <option value="">All Maps</option>
    <option value="11">Summoner's Rift</option>
    <option value="12">ARAM</option>
    <option value="21">Nexus Blitz</option>
    <option value="22">Teamfight Tactics</option>
  `;

  // Tier filter
  const tierFilter = document.createElement("select");
  tierFilter.className = "filter-select";
  tierFilter.innerHTML = `
    <option value="">All Tiers</option>
    <option value="1">Basic</option>
    <option value="2">Epic</option>
    <option value="3">Legendary</option>
  `;

  // Cost filter
  const costFilter = document.createElement("select");
  costFilter.className = "filter-select";
  costFilter.innerHTML = `
    <option value="">All Costs</option>
    <option value="0-500">0 - 500 gold</option>
    <option value="501-1500">501 - 1500 gold</option>
    <option value="1501-3000">1501 - 3000 gold</option>
    <option value="3001+">3001+ gold</option>
  `;

  // Search input
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Search by name…";
  searchInput.className = "filter-search";

  const searchLabel = document.createElement("label");
  searchLabel.textContent = "Name: ";
  searchLabel.appendChild(searchInput);

  // Filter labels
  const mapLabel = document.createElement("label");
  mapLabel.textContent = "Map: ";
  mapLabel.appendChild(mapFilter);

  const tierLabel = document.createElement("label");
  tierLabel.textContent = "Tier: ";
  tierLabel.appendChild(tierFilter);

  const costLabel = document.createElement("label");
  costLabel.textContent = "Cost: ";
  costLabel.appendChild(costFilter);

  filtersContainer.append(searchLabel, mapLabel, tierLabel, costLabel);
  container.appendChild(filtersContainer);

  const list = document.createElement("div");
  list.className = "items-list";

  // Function to filter and display items
  function updateItemDisplay() {
    const selectedMap = mapFilter.value;
    const selectedTier = tierFilter.value;
    const selectedCost = costFilter.value;
    const searchQuery = searchInput.value.trim().toLowerCase();

    // Filter items based on selections
    const filteredItems = items.filter(item => {
      // Name search filter
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery)) {
        return false;
      }
      // Map filter
      if (selectedMap && (!item.maps || !item.maps[selectedMap])) {
        return false;
      }

      // Tier filter
      if (selectedTier && item.depth != selectedTier) {
        return false;
      }

      // Cost filter
      if (selectedCost) {
        const cost = item.gold.total;
        switch (selectedCost) {
          case '0-500':
            if (cost > 500) return false;
            break;
          case '501-1500':
            if (cost <= 500 || cost > 1500) return false;
            break;
          case '1501-3000':
            if (cost <= 1500 || cost > 3000) return false;
            break;
          case '3001+':
            if (cost <= 3000) return false;
            break;
        }
      }

      return true;
    });

    // Clear current items
    list.innerHTML = '';

    // Display filtered items
    filteredItems.forEach((item) => {
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
    desc.className = "item-description";
    desc.innerHTML = formatItemDescription(item.description);

    const gold = document.createElement("p");
    gold.textContent = `Cost: ${item.gold.total} gold (Sell: ${item.gold.sell})`;

    // Add tier information
    const tier = document.createElement("p");
    const tierText = item.depth ? getTierText(item.depth) : 'Basic';
    tier.textContent = `Tier: ${tierText}`;
    tier.className = "item-tier";

    // Add map availability
    const maps = document.createElement("p");
    const mapText = getMapText(item.maps);
    maps.textContent = `Maps: ${mapText}`;
    maps.className = "item-maps";

    info.append(name, desc, gold, tier, maps);
    itemDiv.append(img, info);
    list.appendChild(itemDiv);
    });
  }

  // Add event listeners to filters
  searchInput.addEventListener('input', updateItemDisplay);
  mapFilter.addEventListener('change', updateItemDisplay);
  tierFilter.addEventListener('change', updateItemDisplay);
  costFilter.addEventListener('change', updateItemDisplay);

  // Initial display
  updateItemDisplay();

  container.appendChild(list);
  return container;
}