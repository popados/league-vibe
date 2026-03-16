// Navigation component for switching between pages

export function createNavigation(onNavigate) {
  const nav = document.createElement("nav");
  nav.className = "app-navigation";

  const pages = [
    { id: "home", label: "Home" },
    { id: "champions", label: "Champions" },
    { id: "items", label: "Items" },
    { id: "match-detail", label: "Match Detail" },
    { id: "summoner-profile", label: "Summoner Profile" },
  ];

  pages.forEach((page) => {
    const button = document.createElement("button");
    button.textContent = page.label;
    button.onclick = () => onNavigate(page.id);
    nav.appendChild(button);
  });

  return nav;
}