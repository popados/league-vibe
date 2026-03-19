// Navigation component for switching between pages

export function createNavigation(onNavigate, currentPage = "home") {
  const nav = document.createElement("nav");
  nav.className = "app-navigation";

  const pages = [
    { id: "home", label: "Home" },
    { id: "match-history", label: "Match History" },
    { id: "match-details", label: "Match Details" },
    { id: "summoner-profile", label: "Summoner Profile" },
    { id: "champion-stats", label: "Champion Stats" },
    { id: "champions", label: "Champions" },
    { id: "items", label: "Items" },
  ];

  pages.forEach((page) => {
    const button = document.createElement("button");
    if (page.id === currentPage) {
      button.className = "active";
      button.setAttribute("aria-current", "page");
    }
    button.textContent = page.label;
    button.onclick = () => onNavigate(page.id);
    nav.appendChild(button);
  });

  return nav;
}