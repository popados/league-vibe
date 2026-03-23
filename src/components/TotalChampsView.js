export function createTotalChampsView() {
	const container = document.createElement("div");
	container.className = "total-champs-view tc-container";
	let championData = [];
	let currentSort = "selection-rate";

	const title = document.createElement("h2");
	title.className = "tc-title";
	title.textContent = "Champion Selection Rate";
	container.appendChild(title);

	const subtitle = document.createElement("p");
	subtitle.className = "tc-subtitle";
	subtitle.textContent = "Loading champion selection rates...";
	container.appendChild(subtitle);

	const controls = document.createElement("div");
	controls.className = "tc-controls";

	const sortLabel = document.createElement("label");
	sortLabel.className = "tc-sort-label";
	sortLabel.setAttribute("for", "tc-sort-select");
	sortLabel.textContent = "Sort by:";

	const sortSelect = document.createElement("select");
	sortSelect.id = "tc-sort-select";
	sortSelect.className = "filter-select";

	const optionSelectionRate = document.createElement("option");
	optionSelectionRate.value = "selection-rate";
	optionSelectionRate.textContent = "Selection Rate";

	const optionAlphabetical = document.createElement("option");
	optionAlphabetical.value = "alphabetical";
	optionAlphabetical.textContent = "Alphabetical";

	sortSelect.append(optionSelectionRate, optionAlphabetical);
	controls.append(sortLabel, sortSelect);
	container.appendChild(controls);

	const list = document.createElement("ul");
	list.className = "tc-list";
	container.appendChild(list);

	function renderList() {
		list.innerHTML = "";

		if (!Array.isArray(championData) || championData.length === 0) {
			const emptyItem = document.createElement("li");
			emptyItem.className = "tc-item";
			emptyItem.textContent = "No champion selection data found.";
			list.appendChild(emptyItem);
			return;
		}

		const sorted = [...championData].sort((left, right) => {
			if (currentSort === "alphabetical") {
				return left.championName.localeCompare(right.championName);
			}

			return (right.selectionRate ?? 0) - (left.selectionRate ?? 0)
				|| (right.selected ?? 0) - (left.selected ?? 0)
				|| left.championName.localeCompare(right.championName);
		});

		sorted.forEach((champion) => {
			const item = document.createElement("li");
			item.className = "tc-item";
			item.textContent = `${champion.championName}: ${champion.selectionRateLabel} (${champion.selectionRatePercent}%)`;
			list.appendChild(item);
		});
	}

	sortSelect.addEventListener("change", (event) => {
		currentSort = event.target.value;
		renderList();
	});

	fetch("http://localhost:3001/api/champions/selection-rate")
		.then(async (response) => {
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.details || data.error || `Server error: ${response.status}`);
			}

			championData = Array.isArray(data.champions) ? data.champions : [];
			subtitle.textContent = `${data.totalGames ?? 0} total games in database`;
			renderList();
		})
		.catch((error) => {
			subtitle.textContent = error.message || "Failed to load champion selection rates.";

			const errorItem = document.createElement("li");
			errorItem.className = "tc-item";
			errorItem.textContent = "Unable to load selection rate data.";
			list.appendChild(errorItem);
		});

	return container;
}
