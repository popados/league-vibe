// UI component for entering a summoner name and region

export function createSummonerSearch(onSearch) {
  const container = document.createElement("div");
  container.className = "summoner-search";

  const input = document.createElement("input");
  input.placeholder = "Summoner name";
  input.className = "summoner-input";

  const regionSelect = document.createElement("select");
  regionSelect.className = "region-select";
  [
    { value: "na1", label: "NA" },
    { value: "euw1", label: "EUW" },
    { value: "eun1", label: "EUNE" },
    { value: "kr", label: "KR" },
  ].forEach((region) => {
    const option = document.createElement("option");
    option.value = region.value;
    option.textContent = region.label;
    regionSelect.appendChild(option);
  });

  const button = document.createElement("button");
  button.textContent = "Search";
  button.onclick = () => onSearch(input.value.trim(), regionSelect.value);

  container.append(input, regionSelect, button);
  return container;
}
