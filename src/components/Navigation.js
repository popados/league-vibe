// Navigation component for switching between pages

export function createNavigation(onNavigate, currentPage = "home") {
  const nav = document.createElement("nav");
  nav.className = "app-navigation";

  const pageRows = [
    [
      { id: "home", label: "Home" },
      { id: "match-history", label: "Match History" },
      { id: "champion-stats", label: "Champion Stats" },
      { id: "match-details", label: "Match Details" },
      { id: "map-summoners-rift", label: "Map View" },
      { id: "heat-map-rift", label: "Heat Map View" },
    ],
    [
      { id: "champions-selected", label: "Win/Pick Rate" },
      { id: "items", label: "Items" },
      { id: "champions", label: "Champions" },
      { id: "summoner-profile", label: "Summoner Profile" },
    ],
  ];

  pageRows.forEach((row) => {
    const rowElement = document.createElement("div");
    rowElement.className = "app-navigation-row";

    row.forEach((page) => {
      const button = document.createElement("button");
      if (page.id === currentPage) {
        button.className = "active";
        button.setAttribute("aria-current", "page");
      }
      button.textContent = page.label;
      button.onclick = () => onNavigate(page.id);
      rowElement.appendChild(button);
    });

    nav.appendChild(rowElement);
  });

  return nav;
}