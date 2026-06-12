// Navigation component for switching between pages

export function createNavigation(onNavigate, currentPage = "home") {
  const nav = document.createElement("nav");
  nav.className = "app-navigation";

  // Hamburger toggle (visible only on mobile)
  const hamburger = document.createElement("button");
  hamburger.className = "nav-hamburger";
  hamburger.textContent = "☰ Menu";
  hamburger.setAttribute("aria-label", "Toggle navigation");
  hamburger.setAttribute("aria-expanded", "false");
  hamburger.onclick = () => {
    const isOpen = nav.classList.toggle("nav-open");
    hamburger.setAttribute("aria-expanded", String(isOpen));
    hamburger.textContent = isOpen ? "✕ Close" : "☰ Menu";
  };
  nav.appendChild(hamburger);

  // Rows container
  const rowsContainer = document.createElement("div");
  rowsContainer.className = "app-navigation-rows";

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
      button.onclick = () => {
        onNavigate(page.id);
        // Close menu after selection on mobile
        nav.classList.remove("nav-open");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.textContent = "☰ Menu";
      };
      rowElement.appendChild(button);
    });

    rowsContainer.appendChild(rowElement);
  });

  nav.appendChild(rowsContainer);
  return nav;
}