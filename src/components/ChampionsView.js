// UI component for displaying a list of champions

export function createChampionsView(champions = []) {
  const container = document.createElement("div");
  container.className = "champions-view";

  const title = document.createElement("h2");
  title.className = "page-title";
  title.textContent = "Champions";
  container.appendChild(title);

  const grid = document.createElement("div");
  grid.id = "champion-cards";

  champions.forEach((champion, index) => {
    // Construct splash art URL (Data Dragon format)
    const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champion.id}_0.jpg`;

    const card = document.createElement("div");
    card.className = "champion-card";
    card.style.animationDelay = `${index * 0.05}s`;

    const splash = document.createElement("img");
    splash.src = splashUrl;
    splash.alt = `${champion.name} Splash Art`;
    splash.className = "splash";

    const info = document.createElement("div");
    info.className = "info";

    const sicon = document.createElement("img");
    sicon.src = champion.image;
    sicon.alt = `${champion.name} Icon`;
    sicon.className = "sicon";

    const details = document.createElement("div");
    details.className = "details";

    const name = document.createElement("strong");
    name.textContent = champion.name;

    const subtitle = document.createElement("small");
    subtitle.textContent = champion.title;

    details.appendChild(name);
    details.appendChild(subtitle);

    info.appendChild(sicon);
    info.appendChild(details);

    // Hover info overlay
    const hoverInfo = document.createElement("div");
    hoverInfo.className = "hover-info";
    hoverInfo.id = `info-${champion.id}`;

    const header = document.createElement("div");
    header.className = "champion-header";

    const hoverName = document.createElement("strong");
    hoverName.textContent = champion.name;

    const hoverTitle = document.createElement("small");
    hoverTitle.textContent = champion.title;

    header.appendChild(hoverName);
    header.appendChild(hoverTitle);

    const blurb = document.createElement("div");
    blurb.className = "blurb";
    blurb.textContent = champion.blurb || "Loading champion details...";

    const statsGrid = document.createElement("div");
    statsGrid.className = "stats-grid";

    // Add some key stats
    const stats = [
      { label: "❤️ HP", value: Math.round(champion.stats.hp) },
      { label: "⚔️ Attack", value: Math.round(champion.stats.attackdamage) },
      { label: "🛡️ Armor", value: Math.round(champion.stats.armor) },
      { label: "🔮 Magic Resist", value: Math.round(champion.stats.spellblock) },
      { label: "⚡ Attack Speed", value: champion.stats.attackspeed.toFixed(2) },
      { label: "💨 Move Speed", value: Math.round(champion.stats.movespeed) }
    ];

    stats.forEach(stat => {
      const statItem = document.createElement("div");
      statItem.className = "stat-item";

      const label = document.createElement("span");
      label.className = "stat-label";
      label.textContent = stat.label;

      const value = document.createElement("span");
      value.className = "stat-value";
      value.textContent = stat.value;

      statItem.appendChild(label);
      statItem.appendChild(value);
      statsGrid.appendChild(statItem);
    });

    hoverInfo.appendChild(header);
    hoverInfo.appendChild(blurb);
    hoverInfo.appendChild(statsGrid);

    card.appendChild(splash);
    card.appendChild(info);
    card.appendChild(hoverInfo);

    grid.appendChild(card);
  });

  container.appendChild(grid);
  return container;
}