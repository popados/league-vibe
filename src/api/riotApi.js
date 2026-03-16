// Riot API helper functions
// This module should handle request signing, rate limiting, and base URL configuration.

const RIOT_API_BASE = "https://REGION.api.riotgames.com";

// TODO: Replace with a secure method of storing and retrieving the API key (not hardcoded).
const RIOT_API_KEY = "YOUR_API_KEY_HERE";

export function buildUrl(region, path, queryParams = {}) {
  const url = new URL(path, `https://${region}.api.riotgames.com`);
  url.search = new URLSearchParams({ ...queryParams }).toString();
  return url.toString();
}

export async function riotFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "X-Riot-Token": RIOT_API_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Riot API error ${response.status}: ${text}`);
  }

  return response.json();
}
