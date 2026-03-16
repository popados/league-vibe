// Champion stats utilities (data aggregation, champion mastery)
// This module can be extended to fetch champion mastery or compute aggregate stats.

export function summarizeChampionStats(matches) {
  // Placeholder: Aggregate stats for champions played in the provided matches.
  const stats = {};
  matches.forEach((match) => {
    const champId = match.championId;
    if (!stats[champId]) {
      stats[champId] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
    }
    stats[champId].games += 1;
    stats[champId].wins += match.win ? 1 : 0;
    stats[champId].kills += match.kills;
    stats[champId].deaths += match.deaths;
    stats[champId].assists += match.assists;
  });

  return stats;
}
