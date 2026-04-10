const MAP_IMAGE_URL = "https://ddragon.leagueoflegends.com/cdn/6.8.1/img/map/map11.png";
const HEATMAP_CELL_SIZE = 25;

function formatSubtitle({ visibleCount, total, matchCount, selectedVictim }) {
	const matchLabel = `${matchCount} saved match${matchCount !== 1 ? "es" : ""}`;

	if (selectedVictim === "all") {
		return `${visibleCount} kill event${visibleCount !== 1 ? "s" : ""} across ${matchLabel}`;
	}

	return `${visibleCount} kill event${visibleCount !== 1 ? "s" : ""} where ${selectedVictim} was the victim out of ${total} total event${total !== 1 ? "s" : ""} across ${matchLabel}`;
}

function createHeatmapCell({ x, y, count, maxCount }) {
	const cell = document.createElement("div");
	const ratio = maxCount > 0 ? count / maxCount : 0;
	const hue = Math.round(44 - (44 * ratio));

	cell.className = "heatmap-cell";
	cell.style.left = `${x}px`;
	cell.style.top = `${y}px`;
	cell.style.width = `${HEATMAP_CELL_SIZE}px`;
	cell.style.height = `${HEATMAP_CELL_SIZE}px`;
	cell.style.background = count > 0
		? `hsla(${hue}, 95%, 52%, 0.7)`
		: "hsla(0, 0%, 12%, 0.12)";
	cell.title = `${count} champion position${count > 1 ? "s" : ""} in this tile`;

	if (count > 0) {
		const countLabel = document.createElement("span");
		countLabel.className = "heatmap-cell-label";
		countLabel.textContent = String(count);
		cell.appendChild(countLabel);
	}

	return cell;
}

export function createHeatMapView({ events = [], total = 0, matchCount = 0 } = {}) {
	const heatmapView = document.createElement("div");
	heatmapView.className = "map-view heatmap-view";
	let selectedVictim = "all";

	const victimChampions = Array.from(
		new Set(
			events
				.map((event) => event?.victimChampion)
				.filter((victimChampion) => typeof victimChampion === "string" && victimChampion.trim() !== "")
		)
	).sort((left, right) => left.localeCompare(right));

	const title = document.createElement("h2");
	title.textContent = "Heatmap - Summoner's Rift";
	heatmapView.appendChild(title);

	const subtitle = document.createElement("p");
	subtitle.className = "map-view-subtitle";
	heatmapView.appendChild(subtitle);

	const controls = document.createElement("div");
	controls.className = "heatmap-controls";

	const victimLabel = document.createElement("label");
	victimLabel.className = "heatmap-filter-label";
	victimLabel.textContent = "Victim champion";
	victimLabel.setAttribute("for", "heatmap-victim-filter");
	controls.appendChild(victimLabel);

	const victimSelect = document.createElement("select");
	victimSelect.id = "heatmap-victim-filter";
	victimSelect.className = "filter-select heatmap-filter-select";

	const allOption = document.createElement("option");
	allOption.value = "all";
	allOption.textContent = "All champions";
	victimSelect.appendChild(allOption);

	victimChampions.forEach((victimChampion) => {
		const option = document.createElement("option");
		option.value = victimChampion;
		option.textContent = victimChampion;
		victimSelect.appendChild(option);
	});

	controls.appendChild(victimSelect);
	heatmapView.appendChild(controls);

	const imgContainer = document.createElement("div");
	imgContainer.className = "map-image-container heatmap-image-container";

	const mapImage = document.createElement("img");
	mapImage.src = MAP_IMAGE_URL;
	mapImage.alt = "Summoner's Rift Map";
	mapImage.className = "map-image";
	imgContainer.appendChild(mapImage);

	const overlay = document.createElement("div");
	overlay.className = "map-overlay heatmap-overlay";
	imgContainer.appendChild(overlay);

	function getFilteredEvents() {
		if (selectedVictim === "all") {
			return events;
		}

		return events.filter((event) => event?.victimChampion === selectedVictim);
	}

	function updateSubtitle() {
		const filteredEvents = getFilteredEvents();
		subtitle.textContent = formatSubtitle({
			visibleCount: filteredEvents.length,
			total,
			matchCount,
			selectedVictim
		});
	}

	function renderHeatmapGrid() {
		const width = imgContainer.clientWidth;
		const height = imgContainer.clientHeight;

		if (!width || !height) {
			return;
		}

		const heatTiles = new Map();
		const filteredEvents = getFilteredEvents();

		filteredEvents.forEach((event) => {
			const left = event?.mapPosition?.left;
			const top = event?.mapPosition?.top;

			if (typeof left !== "number" || typeof top !== "number") {
				return;
			}

			const x = Math.min(width - 1, Math.max(0, (left / 100) * width));
			const y = Math.min(height - 1, Math.max(0, (top / 100) * height));
			const tileX = Math.floor(x / HEATMAP_CELL_SIZE) * HEATMAP_CELL_SIZE;
			const tileY = Math.floor(y / HEATMAP_CELL_SIZE) * HEATMAP_CELL_SIZE;
			const key = `${tileX}:${tileY}`;
			const current = heatTiles.get(key) ?? 0;

			heatTiles.set(key, current + 1);
		});

		overlay.innerHTML = "";

		const maxCount = Math.max(...heatTiles.values(), 0);
		const columns = Math.ceil(width / HEATMAP_CELL_SIZE);
		const rows = Math.ceil(height / HEATMAP_CELL_SIZE);

		for (let row = 0; row < rows; row += 1) {
			for (let column = 0; column < columns; column += 1) {
				const x = column * HEATMAP_CELL_SIZE;
				const y = row * HEATMAP_CELL_SIZE;
				const key = `${x}:${y}`;
				const count = heatTiles.get(key) ?? 0;

				overlay.appendChild(createHeatmapCell({ x, y, count, maxCount }));
			}
		}
	}

	heatmapView.appendChild(imgContainer);

	victimSelect.addEventListener("change", (event) => {
		selectedVictim = event.target.value;
		updateSubtitle();
		renderHeatmapGrid();
	});

	mapImage.addEventListener("load", () => {
		renderHeatmapGrid();
	});

	const handleResize = () => {
		if (!heatmapView.isConnected) {
			window.removeEventListener("resize", handleResize);
			return;
		}
		renderHeatmapGrid();
	};
	window.addEventListener("resize", handleResize);

	if (!mapImage.complete) {
		subtitle.textContent = "Loading map image...";
	} else {
		updateSubtitle();
	}

	updateSubtitle();
	renderHeatmapGrid();
	return heatmapView;
}
