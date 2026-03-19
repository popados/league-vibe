// UI component for entering a summoner Riot ID (gameName#tagLine) and region

export function createSummonerSearch(onSearch, cachedSummoner = null) {
  const container = document.createElement("div");
  container.className = "summoner-search";

  const cachedCount = cachedSummoner?.matchCount || 10;

  const cachedGameName = cachedSummoner?.gameName || "";
  const cachedTag = cachedSummoner?.tagLine || "";
  const cachedRegion = cachedSummoner?.region?.toLowerCase() || "na";

  // Game name input
  const gameNameInput = document.createElement("input");
  gameNameInput.placeholder = cachedGameName || "Game name";
  gameNameInput.value = cachedGameName;
  gameNameInput.className = "summoner-input game-name-input";

  // Tag input
  const tagInput = document.createElement("input");
  tagInput.placeholder = cachedTag || "Tag";
  tagInput.value = cachedTag;
  tagInput.className = "summoner-input tag-input";

  // Add # symbol between inputs
  const hashSymbol = document.createElement("span");
  hashSymbol.textContent = "#";
  hashSymbol.className = "hash-symbol";

  const regionSelect = document.createElement("select");
  regionSelect.className = "region-select";
  [
    { value: "na", label: "NA" },
    { value: "euw", label: "EUW" },
    { value: "eune", label: "EUNE" },
    { value: "kr", label: "KR" },
    { value: "br", label: "BR" },
    { value: "lan", label: "LAN" },
    { value: "las", label: "LAS" },
    { value: "oce", label: "OCE" },
    { value: "ru", label: "RU" },
    { value: "tr", label: "TR" },
    { value: "jp", label: "JP" },
  ].forEach((region) => {
    const option = document.createElement("option");
    option.value = region.value;
    option.textContent = region.label;
    regionSelect.appendChild(option);
  });
  regionSelect.value = cachedRegion;

  const countSelect = document.createElement("select");
  countSelect.className = "count-select";
  [10, 20].forEach((n) => {
    const option = document.createElement("option");
    option.value = n;
    option.textContent = `${n} matches`;
    countSelect.appendChild(option);
  });
  countSelect.value = cachedCount;

  const button = document.createElement("button");
  button.textContent = "Search";
  button.className = "search-button";
  button.onclick = () => {
    const gameName = gameNameInput.value.trim();
    const tag = tagInput.value.trim();
    const region = regionSelect.value;
    const count = Number(countSelect.value);

    if (!gameName || !tag) {
      alert("Please enter both game name and tag");
      return;
    }

    onSearch(gameName, tag, region, count);
  };

  // Allow Enter key to trigger search
  [gameNameInput, tagInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        button.click();
      }
    });
  });

  container.append(gameNameInput, hashSymbol, tagInput, regionSelect, countSelect, button);
  return container;
}
