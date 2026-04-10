const PROD_API_BASE_URL = "https://ritoheatmap.info";

export const API_BASE_URL =
	window.__LEAGUE_VIBE_API_BASE_URL__
	|| (window.location.hostname === "ritoheatmap.info" ? PROD_API_BASE_URL : window.location.origin);
