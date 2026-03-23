const MAP_IMAGE_URL = "https://ddragon.leagueoflegends.com/cdn/6.8.1/img/map/map11.png";
const AUTOPLAY_INTERVAL_MS = 500;

function formatFrameTimestamp(timestamp) {
    if (typeof timestamp !== "number") {
        return "Unknown";
    }

    const totalSeconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function createParticipantMarker(participant) {
    const marker = document.createElement("div");
    marker.className = `map-player-marker team-${participant.teamId}`;
    marker.style.left = `${participant.mapPosition.left}%`;
    marker.style.top = `${participant.mapPosition.top}%`;
    marker.title = `${participant.summonerName}#${participant.tagLine} - ${participant.championName} (${participant.position.x}, ${participant.position.y})`;

    const badge = document.createElement("span");
    badge.className = "map-player-badge";
    badge.textContent = String(participant.participantId);

    const label = document.createElement("span");
    label.className = "map-player-label";
    label.textContent = participant.championName;

    marker.append(badge, label);
    return marker;
}

function createTeamList(titleText, participants, className, isWinner = false) {
    const teamSection = document.createElement("section");
    teamSection.className = `map-team-list ${className}${isWinner ? " is-winner" : ""}`;

    const title = document.createElement("h3");
    title.textContent = isWinner ? `${titleText} - Winner` : titleText;
    teamSection.appendChild(title);

    const list = document.createElement("ul");
    participants.forEach((participant) => {
        const item = document.createElement("li");
        item.className = "map-team-list-item";

        const championName = document.createElement("span");
        championName.className = "map-team-list-champion";
        championName.textContent = participant.championName;

        const summoner = document.createElement("span");
        summoner.className = "map-team-list-summoner";
        summoner.textContent = `${participant.summonerName}#${participant.tagLine}`;

        const coords = document.createElement("span");
        coords.className = "map-team-list-coords";
        coords.textContent = `(${participant.position.x}, ${participant.position.y})`;

        item.append(championName, summoner, coords);
        list.appendChild(item);
    });

    teamSection.appendChild(list);
    return teamSection;
}

function getAvailableFrames(mapData) {
    if (Array.isArray(mapData.frames) && mapData.frames.length > 0) {
        return mapData.frames;
    }

    return [
        {
            frameIndex: 0,
            frameNumber: 1,
            timestamp: mapData.firstFrameTimestamp ?? null,
            participants: mapData.participants || []
        }
    ];
}

export function createMapView(mapData, cachedMatches = [], onSelectMatch = null) {
    const mapView = document.createElement("div");
    mapView.className = "map-view";

    const title = document.createElement("h2");
    title.textContent = "Map - Summoner's Rift";
    mapView.appendChild(title);

    const frames = getAvailableFrames(mapData);
    let activeFrameIndex = 0;
    let frameSelector = null;
    let frameSlider = null;
    let frameCounter = null;
    let autoplayButton = null;
    let autoplayTimer = null;

    const subtitle = document.createElement("p");
    subtitle.className = "map-view-subtitle";
    mapView.appendChild(subtitle);

    function stopAutoplay() {
        if (autoplayTimer) {
            clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
        if (autoplayButton) {
            autoplayButton.textContent = "Auto Play";
        }
    }

    function renderFrame() {
        const frame = frames[activeFrameIndex] || frames[0];
        const participants = frame?.participants || [];

        subtitle.textContent = `Match ${mapData.matchId} • Frame ${frame.frameNumber} ${formatFrameTimestamp(frame.timestamp)}`;

        if (frameSelector) {
            frameSelector.value = String(activeFrameIndex);
        }
        if (frameSlider) {
            frameSlider.value = String(activeFrameIndex);
        }
        if (frameCounter) {
            frameCounter.textContent = `${activeFrameIndex + 1} / ${frames.length}`;
        }

        overlay.innerHTML = "";
        participants.forEach((participant) => {
            overlay.appendChild(createParticipantMarker(participant));
        });

        roster.innerHTML = "";
        const blueTeam = participants.filter((participant) => participant.teamId === 100);
        const redTeam = participants.filter((participant) => participant.teamId === 200);
        const blueWon = blueTeam.some((participant) => participant.win === true);
        const redWon = redTeam.some((participant) => participant.win === true);
        roster.append(
            createTeamList("Blue Team", blueTeam, "team-100", blueWon),
            createTeamList("Red Team", redTeam, "team-200", redWon)
        );
    }

    function setActiveFrame(index) {
        const safeIndex = Math.max(0, Math.min(frames.length - 1, index));
        activeFrameIndex = safeIndex;
        renderFrame();
    }

    function startAutoplay() {
        if (frames.length < 2 || autoplayTimer) {
            return;
        }

        if (autoplayButton) {
            autoplayButton.textContent = "Pause";
        }

        autoplayTimer = setInterval(() => {
            // Stop safely when this view is no longer mounted.
            if (!mapView.isConnected) {
                stopAutoplay();
                return;
            }

            const nextIndex = (activeFrameIndex + 1) % frames.length;
            setActiveFrame(nextIndex);
        }, AUTOPLAY_INTERVAL_MS);
    }
    
    if (Array.isArray(cachedMatches) && cachedMatches.length > 0) {
        const selectorContainer = document.createElement("div");
        selectorContainer.className = "match-selector-container";

        const selectorLabel = document.createElement("label");
        selectorLabel.className = "match-selector-label";
        selectorLabel.setAttribute("for", "map-match-selector");
        selectorLabel.textContent = "Select Match";

        const selector = document.createElement("select");
        selector.id = "map-match-selector";
        selector.className = "match-selector";

        cachedMatches.forEach((match) => {
            if (!match?.matchId) {
                return;
            }

            const option = document.createElement("option");
            option.value = match.matchId;

            const participant = match.participant || {};
            const champion = participant.championName || "Unknown";
            const kda = `${participant.kills ?? 0}/${participant.deaths ?? 0}/${participant.assists ?? 0}`;
            option.textContent = `${match.matchId} - ${champion} (${kda})`;
            option.selected = match.matchId === mapData.matchId;
            selector.appendChild(option);
        });

        selector.addEventListener("change", (event) => {
            if (typeof onSelectMatch === "function" && event.target.value !== mapData.matchId) {
                onSelectMatch(event.target.value);
            }
        });

        selectorContainer.append(selectorLabel, selector);
        mapView.appendChild(selectorContainer);
    }

    const imgContainer = document.createElement("div");
    imgContainer.className = "map-image-container";

    const mapImage = document.createElement("img");
    mapImage.src = MAP_IMAGE_URL;
    mapImage.alt = "Summoner's Rift Map";
    mapImage.className = "map-image";
    imgContainer.appendChild(mapImage);

    const overlay = document.createElement("div");
    overlay.className = "map-overlay";
    imgContainer.appendChild(overlay);
    mapView.appendChild(imgContainer);

    if (frames.length >= 1) {
        const frameSelectorWrap = document.createElement("div");
        frameSelectorWrap.className = "map-frame-selector";

        const frameSelectorLabel = document.createElement("label");
        frameSelectorLabel.className = "match-selector-label";
        frameSelectorLabel.setAttribute("for", "timeline-frame-selector");
        frameSelectorLabel.textContent = "Timeline Frame";

        frameSelector = document.createElement("select");
        frameSelector.id = "timeline-frame-selector";
        frameSelector.className = "match-selector";

        frames.forEach((frame, index) => {
            const option = document.createElement("option");
            option.value = String(index);
            option.textContent = `Frame ${frame.frameNumber} (${formatFrameTimestamp(frame.timestamp)})`;
            frameSelector.appendChild(option);
        });

        frameSelector.addEventListener("change", (event) => {
            stopAutoplay();
            setActiveFrame(Number(event.target.value));
        });

        const playbackControls = document.createElement("div");
        playbackControls.className = "map-frame-playback";

        frameSlider = document.createElement("input");
        frameSlider.type = "range";
        frameSlider.className = "map-frame-slider";
        frameSlider.min = "0";
        frameSlider.max = String(frames.length - 1);
        frameSlider.step = "1";
        frameSlider.value = String(activeFrameIndex);
        frameSlider.setAttribute("aria-label", "Timeline frame slider");
        frameSlider.addEventListener("input", (event) => {
            stopAutoplay();
            setActiveFrame(Number(event.target.value));
        });

        frameCounter = document.createElement("span");
        frameCounter.className = "map-frame-counter";

        autoplayButton = document.createElement("button");
        autoplayButton.type = "button";
        autoplayButton.className = "map-autoplay-button";
        autoplayButton.textContent = "Auto Play";
        autoplayButton.disabled = frames.length < 2;
        autoplayButton.addEventListener("click", () => {
            if (autoplayTimer) {
                stopAutoplay();
            } else {
                startAutoplay();
            }
        });

        playbackControls.append(frameSlider, frameCounter, autoplayButton);

        frameSelectorWrap.append(frameSelectorLabel, frameSelector, playbackControls);
        mapView.appendChild(frameSelectorWrap);
    }


    const roster = document.createElement("div");
    roster.className = "map-team-lists";
    mapView.appendChild(roster);

    renderFrame();

    return mapView;
}