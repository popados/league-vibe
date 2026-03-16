// Match history fetching logic (Riot Match API)
// Uses `riotApi.js` helper functions to call the Riot API.

import { buildUrl, riotFetch } from "./riotApi.js";

export async function fetchMatchIdsByPuuid(region, puuid, count = 20) {
  const url = buildUrl(region, `/lol/match/v5/matches/by-puuid/${puuid}/ids`, {
    start: 0,
    count,
  });
  return riotFetch(url);
}

export async function fetchMatchDetails(region, matchId) {
  const url = buildUrl(region, `/lol/match/v5/matches/${matchId}`);
  return riotFetch(url);
}
