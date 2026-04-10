const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');
require('dotenv').config({ override: true });

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_API_BASE_URL = process.env.CLIENT_API_BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

app.get('/env.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.__LEAGUE_VIBE_API_BASE_URL__ = ${JSON.stringify(CLIENT_API_BASE_URL)};`);
});

// Riot Data Dragon API base URL
const RIOT_DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

// Riot API base URLs
const RIOT_API_BASE = 'https://REGION.api.riotgames.com';
const AMERICAS_API_BASE = 'https://americas.api.riotgames.com';

// Current patch version (you might want to fetch this dynamically)
const CURRENT_PATCH = '16.6.1';

// Riot API Key (should be set as environment variable)
const RIOT_API_KEY = process.env.RIOT_API_KEY || 'your_riot_api_key_here';
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'matchHistories';
const MONGODB_MATCH_HISTORY_COLLECTION = process.env.MONGODB_MATCH_HISTORY_COLLECTION || 'matchHistories';
const MONGODB_MATCH_DETAILS_COLLECTION = process.env.MONGODB_MATCH_DETAILS_COLLECTION || 'matchDetails';
const MONGODB_TIMELINE_COLLECTION = process.env.MONGODB_TIMELINE_COLLECTION || 'matchTimelines';
const SUMMONERS_RIFT_MAX_COORDINATE = 14870;
const RIOT_REQUEST_DELAY_MS = Math.max(0, Number.parseInt(process.env.RIOT_REQUEST_DELAY_MS || '120', 10) || 120);
const RIOT_MAX_429_RETRIES = Math.max(0, Number.parseInt(process.env.RIOT_MAX_429_RETRIES || '4', 10) || 4);
const RIOT_RETRY_BASE_DELAY_MS = Math.max(100, Number.parseInt(process.env.RIOT_RETRY_BASE_DELAY_MS || '1000', 10) || 1000);

let mongoClientPromise = null;
let riotRequestQueue = Promise.resolve();
const riotRequestMetrics = {
  totalRequests: 0,
  total429Responses: 0,
  totalRetryAttempts: 0,
  total429Exhausted: 0
};

// Region mapping for API calls
const REGION_MAP = {
  'na': 'na1',
  'euw': 'euw1',
  'eune': 'eun1',
  'kr': 'kr',
  'br': 'br1',
  'lan': 'la1',
  'las': 'la2',
  'oce': 'oc1',
  'ru': 'ru',
  'tr': 'tr1',
  'jp': 'jp1'
};

// Routing value for match history (Americas for NA, EUW, etc.)
const ROUTING_MAP = {
  'na': 'americas',
  'euw': 'europe',
  'eune': 'europe',
  'kr': 'asia',
  'br': 'americas',
  'lan': 'americas',
  'las': 'americas',
  'oce': 'americas',
  'ru': 'europe',
  'tr': 'europe',
  'jp': 'asia'
};

function createHttpError(status, error, details) {
  const httpError = new Error(details || error);
  httpError.status = status;
  httpError.error = error;
  httpError.details = details || error;
  return httpError;
}

function normalizeMatchCount(value) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return 10;
  }

  return Math.max(1, Math.min(parsed, 50));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enqueueRiotRequest(requestFn) {
  const queuedRequest = riotRequestQueue
    .catch(() => undefined)
    .then(async () => {
      if (RIOT_REQUEST_DELAY_MS > 0) {
        await sleep(RIOT_REQUEST_DELAY_MS);
      }
      return requestFn();
    });

  riotRequestQueue = queuedRequest.catch(() => undefined);
  return queuedRequest;
}

function getRiotRetryDelayMs(response, attempt) {
  const retryAfterHeader = response.headers?.get?.('retry-after');
  const retryAfterSeconds = Number.parseInt(retryAfterHeader || '', 10);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return RIOT_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
}

function getRiotRequestMetricsSnapshot() {
  return { ...riotRequestMetrics };
}

async function riotApiRequestWithRetry(url, options = {}) {
  let attempt = 0;

  while (true) {
    riotRequestMetrics.totalRequests += 1;

    const response = await enqueueRiotRequest(() => fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'X-Riot-Token': RIOT_API_KEY
      }
    }));

    if (response.status !== 429) {
      return response;
    }

    riotRequestMetrics.total429Responses += 1;

    if (attempt >= RIOT_MAX_429_RETRIES) {
      riotRequestMetrics.total429Exhausted += 1;
      return response;
    }

    const retryDelayMs = getRiotRetryDelayMs(response, attempt);
    riotRequestMetrics.totalRetryAttempts += 1;
    await sleep(retryDelayMs);
    attempt += 1;
  }
}

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw createHttpError(
      500,
      'MongoDB is not configured',
      'Please set the MONGODB_URI environment variable'
    );
  }

  if (!mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI);
    mongoClientPromise = client.connect().catch((error) => {
      mongoClientPromise = null;
      throw error;
    });
  }

  return mongoClientPromise;
}

async function getMatchHistoryCollection() {
  const client = await getMongoClient();
  return client.db(MONGODB_DB_NAME).collection(MONGODB_MATCH_HISTORY_COLLECTION);
}

async function getMatchDetailsCollection() {
  const client = await getMongoClient();
  return client.db(MONGODB_DB_NAME).collection(MONGODB_MATCH_DETAILS_COLLECTION);
}

async function getTimelineCollection() {
  const client = await getMongoClient();
  return client.db(MONGODB_DB_NAME).collection(MONGODB_TIMELINE_COLLECTION);
}

async function countTotalDeathsInTimeline(matchId = null) {
  const collection = await getTimelineCollection();
  const filter = matchId ? { matchId } : {};

  const pipeline = [
    { $match: filter },
    { $unwind: '$frames' },
    {
      $project: {
        deathCount: { $size: { $ifNull: ['$frames.events', []] } }
      }
    },
    {
      $group: {
        _id: null,
        totalDeaths: { $sum: '$deathCount' }
      }
    }
  ];

  const [result] = await collection.aggregate(pipeline).toArray();
  return result?.totalDeaths ?? 0;
}

async function fetchRiotAccount(region, gameName, tagLine) {
  if (!RIOT_API_KEY || RIOT_API_KEY === 'YOUR_API_KEY_HERE') {
    throw createHttpError(
      500,
      'Riot API key not configured',
      'Please set the RIOT_API_KEY environment variable'
    );
  }

  const routing = ROUTING_MAP[region.toLowerCase()];
  if (!routing) {
    throw createHttpError(
      400,
      'Invalid region',
      `Supported regions: ${Object.keys(ROUTING_MAP).join(', ')}`
    );
  }

  const accountUrl = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const accountResponse = await riotApiRequestWithRetry(accountUrl);

  if (!accountResponse.ok) {
    if (accountResponse.status === 404) {
      throw createHttpError(
        404,
        'Summoner not found',
        `Riot ID "${gameName}#${tagLine}" not found`
      );
    }

    if (accountResponse.status === 403) {
      throw createHttpError(
        403,
        'Invalid API key',
        'The Riot API key is invalid or expired'
      );
    }

    throw createHttpError(
      accountResponse.status,
      'Failed to fetch account',
      `Account API error: ${accountResponse.status}`
    );
  }

  return {
    routing,
    accountData: await accountResponse.json()
  };
}

async function fetchRiotAccountByPuuid(routing, puuid) {
  if (!RIOT_API_KEY || RIOT_API_KEY === 'YOUR_API_KEY_HERE') {
    throw createHttpError(
      500,
      'Riot API key not configured',
      'Please set the RIOT_API_KEY environment variable'
    );
  }

  const normalizedRouting = String(routing || '').toLowerCase();
  if (!['americas', 'asia', 'europe'].includes(normalizedRouting)) {
    throw createHttpError(
      400,
      'Invalid routing region',
      'Supported routing regions: americas, asia, europe'
    );
  }

  if (!puuid) {
    throw createHttpError(400, 'Missing puuid', 'A valid puuid is required');
  }

  const accountUrl = `https://${normalizedRouting}.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;
  const accountResponse = await riotApiRequestWithRetry(accountUrl);

  if (!accountResponse.ok) {
    if (accountResponse.status === 404) {
      throw createHttpError(404, 'Account not found', `No Riot account found for puuid "${puuid}"`);
    }

    if (accountResponse.status === 403) {
      throw createHttpError(
        403,
        'Invalid API key',
        'The Riot API key is invalid or expired'
      );
    }

    throw createHttpError(
      accountResponse.status,
      'Failed to fetch account by puuid',
      `Account API error: ${accountResponse.status}`
    );
  }

  return accountResponse.json();
}

async function fetchMatchHistoryByPuuid(routing, puuid, count = 10) {
  if (!RIOT_API_KEY || RIOT_API_KEY === 'YOUR_API_KEY_HERE') {
    throw createHttpError(
      500,
      'Riot API key not configured',
      'Please set the RIOT_API_KEY environment variable'
    );
  }

  const normalizedRouting = String(routing || '').toLowerCase();
  if (!['americas', 'asia', 'europe'].includes(normalizedRouting)) {
    throw createHttpError(
      400,
      'Invalid routing region',
      'Supported routing regions: americas, asia, europe'
    );
  }

  if (!puuid) {
    throw createHttpError(400, 'Missing puuid', 'A valid puuid is required');
  }

  const normalizedCount = normalizeMatchCount(count);
  const matchlistUrl = `https://${normalizedRouting}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${normalizedCount}`;

  const matchlistResponse = await riotApiRequestWithRetry(matchlistUrl);

  if (!matchlistResponse.ok) {
    throw createHttpError(
      matchlistResponse.status,
      'Failed to fetch match history',
      `Failed to fetch match list: ${matchlistResponse.status}`
    );
  }

  const matchIds = await matchlistResponse.json();
  const matchResults = await Promise.all(
    matchIds.map(async (matchId) => {
      try {
        const matchUrl = `https://${normalizedRouting}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
        const matchResponse = await riotApiRequestWithRetry(matchUrl);

        if (!matchResponse.ok) {
          return null;
        }

        const matchData = await matchResponse.json();
        const participant = matchData.info.participants.find((entry) => entry.puuid === puuid);

        if (!participant) {
          return null;
        }

        return {
          matchId: matchData.metadata.matchId,
          gameMode: matchData.info.gameMode,
          gameType: matchData.info.gameType,
          gameDuration: matchData.info.gameDuration,
          gameCreation: matchData.info.gameCreation,
          gameVersion: matchData.info.gameVersion,
          mapId: matchData.info.mapId,
          queueId: matchData.info.queueId,
          participant: {
            championId: participant.championId,
            championName: participant.championName,
            win: participant.win,
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
            totalDamageDealt: participant.totalDamageDealt,
            totalDamageTaken: participant.totalDamageTaken,
            goldEarned: participant.goldEarned,
            totalMinionsKilled: participant.totalMinionsKilled,
            neutralMinionsKilled: participant.neutralMinionsKilled,
            champLevel: participant.champLevel,
            item0: participant.item0,
            item1: participant.item1,
            item2: participant.item2,
            item3: participant.item3,
            item4: participant.item4,
            item5: participant.item5,
            item6: participant.item6,
            summoner1Id: participant.summoner1Id,
            summoner2Id: participant.summoner2Id,
            teamId: participant.teamId
          },
          teams: matchData.info.teams,
          allParticipants: matchData.info.participants.map((p) => ({
            championName: p.championName,
            teamId: p.teamId
          }))
        };
      } catch (matchError) {
        console.warn(`Failed to fetch match ${matchId}:`, matchError.message);
        return null;
      }
    })
  );

  return matchResults.filter(Boolean);
}

async function fetchSummonerMatchHistory(region, gameName, tagLine, count = 10) {
  const { routing, accountData } = await fetchRiotAccount(region, gameName, tagLine);
  const puuid = accountData.puuid;
  const matches = await fetchMatchHistoryByPuuid(routing, puuid, count);

  return {
    summoner: {
      name: accountData.gameName,
      riotId: `${accountData.gameName}#${accountData.tagLine}`,
      gameName: accountData.gameName,
      tagLine: accountData.tagLine,
      puuid: accountData.puuid,
      region: region.toUpperCase()
    },
    matches
  };
}

async function fetchMatchDetails(matchId, region = 'americas') {
  if (!RIOT_API_KEY || RIOT_API_KEY === 'YOUR_API_KEY_HERE') {
    throw createHttpError(
      500,
      'Riot API key not configured',
      'Please set the RIOT_API_KEY environment variable'
    );
  }

  if (!['americas', 'asia', 'europe'].includes(region.toLowerCase())) {
    throw createHttpError(
      400,
      'Invalid region',
      'Supported regions: americas, asia, europe'
    );
  }

  const normalizedRegion = region.toLowerCase();
  const matchUrl = `https://${normalizedRegion}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  const matchResponse = await fetch(matchUrl, {
    headers: {
      'X-Riot-Token': RIOT_API_KEY
    }
  });

  if (!matchResponse.ok) {
    if (matchResponse.status === 404) {
      throw createHttpError(
        404,
        'Match not found',
        `Match ID "${matchId}" not found`
      );
    }

    throw createHttpError(
      matchResponse.status,
      'Failed to fetch match details',
      `Failed to fetch match: ${matchResponse.status}`
    );
  }

  const matchData = await matchResponse.json();

  return {
    metadata: matchData.metadata,
    info: {
      gameCreation: matchData.info.gameCreation,
      gameDuration: matchData.info.gameDuration,
      gameEndTimestamp: matchData.info.gameEndTimestamp,
      gameId: matchData.info.gameId,
      gameMode: matchData.info.gameMode,
      gameName: matchData.info.gameName,
      gameStartTimestamp: matchData.info.gameStartTimestamp,
      gameType: matchData.info.gameType,
      gameVersion: matchData.info.gameVersion,
      mapId: matchData.info.mapId,
      platformId: matchData.info.platformId,
      queueId: matchData.info.queueId,
      tournamentCode: matchData.info.tournamentCode,

      // Organize participants by team
      teams: matchData.info.teams.map(team => ({
        teamId: team.teamId,
        win: team.win,
        bans: team.bans || [],
        objectives: team.objectives || {},
        participants: matchData.info.participants
          .filter(participant => participant.teamId === team.teamId)
          .map(participant => ({
            participantId: participant.participantId,
            puuid: participant.puuid,
            summonerName: participant.riotIdGameName,
            tagLine: participant.riotIdTagline,
            summonerId: participant.summonerId,
            summonerLevel: participant.summonerLevel,
            championId: participant.championId,
            championName: participant.championName,
            champLevel: participant.champLevel,
            teamId: participant.teamId,
            win: participant.win,

            // KDA
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,

            // Damage stats
            totalDamageDealt: participant.totalDamageDealt,
            totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
            totalDamageTaken: participant.totalDamageTaken,
            damageDealtToObjectives: participant.damageDealtToObjectives,
            damageDealtToTurrets: participant.damageDealtToTurrets,
            damageSelfMitigated: participant.damageSelfMitigated,

            // Economy
            goldEarned: participant.goldEarned,
            goldSpent: participant.goldSpent,

            // Farming
            totalMinionsKilled: participant.totalMinionsKilled,
            neutralMinionsKilled: participant.neutralMinionsKilled,
            neutralMinionsKilledTeamJungle: participant.neutralMinionsKilledTeamJungle,
            neutralMinionsKilledEnemyJungle: participant.neutralMinionsKilledEnemyJungle,

            // Vision
            visionScore: participant.visionScore,
            wardsPlaced: participant.wardsPlaced,
            wardsKilled: participant.wardsKilled,
            visionWardsBoughtInGame: participant.visionWardsBoughtInGame,

            // Items
            item0: participant.item0,
            item1: participant.item1,
            item2: participant.item2,
            item3: participant.item3,
            item4: participant.item4,
            item5: participant.item5,
            item6: participant.item6,

            // Summoner spells
            summoner1Id: participant.summoner1Id,
            summoner2Id: participant.summoner2Id,

            // Runes and perks
            perks: participant.perks || {},

            // Position and role
            individualPosition: participant.individualPosition,
            teamPosition: participant.teamPosition,
            role: participant.role,
            lane: participant.lane,

            // Additional stats
            longestTimeSpentLiving: participant.longestTimeSpentLiving,
            largestKillingSpree: participant.largestKillingSpree,
            largestMultiKill: participant.largestMultiKill,
            firstBloodKill: participant.firstBloodKill,
            firstBloodAssist: participant.firstBloodAssist,
            firstTowerKill: participant.firstTowerKill,
            firstTowerAssist: participant.firstTowerAssist,
            inhibitorKills: participant.inhibitorKills,
            turretKills: participant.turretKills,
            nexusKills: participant.nexusKills,

            // CC stats
            timeCCingOthers: participant.timeCCingOthers,
            totalTimeCCDealt: participant.totalTimeCCDealt,

            // Healing and shielding
            totalHeal: participant.totalHeal,
            totalHealsOnTeammates: participant.totalHealsOnTeammates,
            totalDamageShieldedOnTeammates: participant.totalDamageShieldedOnTeammates,

            // Profile icon
            profileIcon: participant.profileIcon
          }))
      }))
    }
  };
}

async function fetchMatchTimeline(matchId, region = 'americas') {
  if (!RIOT_API_KEY || RIOT_API_KEY === 'YOUR_API_KEY_HERE') {
    throw createHttpError(
      500,
      'Riot API key not configured',
      'Please set the RIOT_API_KEY environment variable'
    );
  }

  if (!['americas', 'asia', 'europe'].includes(region.toLowerCase())) {
    throw createHttpError(
      400,
      'Invalid region',
      'Supported regions: americas, asia, europe'
    );
  }

  const normalizedRegion = region.toLowerCase();
  const timelineUrl = `https://${normalizedRegion}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;
  const timelineResponse = await fetch(timelineUrl, {
    headers: {
      'X-Riot-Token': RIOT_API_KEY
    }
  });

  if (!timelineResponse.ok) {
    if (timelineResponse.status === 404) {
      throw createHttpError(
        404,
        'Timeline not found',
        `Timeline for match ID "${matchId}" not found`
      );
    }

    throw createHttpError(
      timelineResponse.status,
      'Failed to fetch match timeline',
      `Failed to fetch match timeline: ${timelineResponse.status}`
    );
  }

  return timelineResponse.json();
}

function mapPositionToPercent(position) {
  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
    return null;
  }

  const left = Math.max(0, Math.min(100, (position.x / SUMMONERS_RIFT_MAX_COORDINATE) * 100));
  const top = Math.max(0, Math.min(100, 100 - ((position.y / SUMMONERS_RIFT_MAX_COORDINATE) * 100)));

  return {
    left,
    top
  };
}

async function fetchInitialFramePlayerPositions(matchId, region = 'americas') {
  const [matchDetail, timelineData] = await Promise.all([
    fetchMatchDetails(matchId, region),
    fetchMatchTimeline(matchId, region)
  ]);

  const selectedFrames = timelineData?.info?.frames || [];
//   const selectedFrames = timelineFrames.slice(0, 2);
  const allParticipants = matchDetail.info.teams.flatMap((team) => team.participants);

  const participantById = Object.fromEntries(
    allParticipants.map((p) => [String(p.participantId), p])
  );

  const frames = selectedFrames.map((frame, index) => {
    const participantFrames = frame?.participantFrames || {};
    const participants = allParticipants
      .map((participant) => {
        const frameParticipant = participantFrames[String(participant.participantId)] || participantFrames[participant.participantId];
        const rawPosition = frameParticipant?.position || null;
        const mapPosition = mapPositionToPercent(rawPosition);

        return {
          participantId: participant.participantId,
          teamId: participant.teamId,
          win: participant.win,
          summonerName: participant.summonerName,
          tagLine: participant.tagLine,
          championName: participant.championName,
          position: rawPosition,
          mapPosition
        };
      })
      .filter((participant) => participant.mapPosition);

    const rawEvents = frame?.events || [];
    const deathEvents = rawEvents
      .filter((event) => event.type === 'CHAMPION_KILL')
      .map((event) => {
        const victim = participantById[String(event.victimId)] || null;
        const killer = participantById[String(event.killerId)] || null;
        const assistIds = Array.isArray(event.assistingParticipantIds)
          ? event.assistingParticipantIds
          : [];
        const assists = assistIds
          .map((id) => {
            const p = participantById[String(id)];
            return p ? { participantId: p.participantId, championName: p.championName, teamId: p.teamId } : null;
          })
          .filter(Boolean);

        const rawPosition = event.position || null;
        const mapPosition = mapPositionToPercent(rawPosition);

        return {
          type: 'CHAMPION_KILL',
          timestamp: event.timestamp ?? null,
          position: rawPosition,
          mapPosition,
          victimId: event.victimId ?? null,
          victimChampion: victim?.championName ?? null,
          victimTeamId: victim?.teamId ?? null,
          killerId: event.killerId ?? null,
          killerChampion: killer?.championName ?? null,
          killerTeamId: killer?.teamId ?? null,
          assists
        };
      });

    return {
      frameIndex: index,
      frameNumber: index + 1,
      timestamp: frame?.timestamp ?? null,
      participants,
      events: deathEvents
    };
  });

  const firstFrame = frames[0] || null;

  return {
    matchId,
    region: region.toLowerCase(),
    firstFrameTimestamp: firstFrame?.timestamp ?? null,
    participants: firstFrame?.participants || [],
    frames
  };
}

function summarizeCachedChampionStats(matches = []) {
  const championStats = {};

  matches.forEach((match) => {
    const participant = match?.participant;
    const championName = participant?.championName;

    if (!participant || !championName) {
      return;
    }

    if (!championStats[championName]) {
      championStats[championName] = {
        championId: participant.championId ?? null,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0
      };
    }

    championStats[championName].games += 1;
    championStats[championName].wins += participant.win ? 1 : 0;
    championStats[championName].kills += participant.kills ?? 0;
    championStats[championName].deaths += participant.deaths ?? 0;
    championStats[championName].assists += participant.assists ?? 0;
  });

  return Object.fromEntries(
    Object.entries(championStats).sort((left, right) => right[1].games - left[1].games || left[0].localeCompare(right[0]))
  );
}

// Endpoint to get all champions
app.get('/api/champions', async (req, res) => {
  try {
    const response = await fetch(`${RIOT_DDRAGON_BASE}/cdn/${CURRENT_PATCH}/data/en_US/champion.json`);

    if (!response.ok) {
      throw new Error(`Riot API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform the data to match our component's expected format
    const champions = Object.values(data.data).map(champion => ({
      id: champion.id,
      name: champion.name,
      title: champion.title,
      blurb: champion.blurb,
      tags: champion.tags,
      stats: champion.stats,
      image: `${RIOT_DDRAGON_BASE}/cdn/${CURRENT_PATCH}/img/champion/${champion.image.full}`
    }));

    res.json(champions);
  } catch (error) {
    console.error('Error fetching champions:', error);
    res.status(500).json({
      error: 'Failed to fetch champions from Riot API',
      details: error.message
    });
  }
});

// Endpoint to get global champion selection rates from all saved match details
app.get('/api/champions/selection-rate', async (req, res) => {
  try {
    const detailsCollection = await getMatchDetailsCollection();
    const matchDocs = await detailsCollection
      .find({}, { projection: { matchId: 1, 'matchDetail.info.teams.participants.championName': 1, 'matchDetail.info.teams.participants.win': 1, 'matchDetail.info.participants.championName': 1, 'matchDetail.info.participants.win': 1 } })
      .toArray();

    const totalGames = matchDocs.length;
    const selectedCounts = {};
    const winCounts = {};

    matchDocs.forEach((doc) => {
      const teamParticipants = (doc.matchDetail?.info?.teams || []).flatMap((team) => team.participants || []);
      const fallbackParticipants = doc.matchDetail?.info?.participants || [];
      const participants = teamParticipants.length > 0 ? teamParticipants : fallbackParticipants;

      participants.forEach((participant) => {
        const championName = participant?.championName;
        if (!championName) {
          return;
        }

        selectedCounts[championName] = (selectedCounts[championName] || 0) + 1;
        winCounts[championName] = (winCounts[championName] || 0) + (participant?.win ? 1 : 0);
      });
    });

    const championResponse = await fetch(`${RIOT_DDRAGON_BASE}/cdn/${CURRENT_PATCH}/data/en_US/champion.json`);
    if (!championResponse.ok) {
      throw new Error(`Riot API error: ${championResponse.status}`);
    }

    const championData = await championResponse.json();
    const allChampions = Object.values(championData.data);

    const champions = allChampions
      .map((champion) => {
        const championName = champion.name;
        const selected = selectedCounts[championName] || 0;
        const wins = winCounts[championName] || 0;
        const selectionRate = totalGames > 0 ? selected / totalGames : 0;
        const winRate = selected > 0 ? wins / selected : 0;

        return {
          championName,
          championId: champion.id,
          image: `${RIOT_DDRAGON_BASE}/cdn/${CURRENT_PATCH}/img/champion/${champion.image.full}`,
          selected,
          wins,
          total: totalGames,
          selectionRate,
          winRate,
          selectionRatePercent: Number((selectionRate * 100).toFixed(2)),
          winRatePercent: Number((winRate * 100).toFixed(2)),
          selectionRateLabel: `${selected}/${totalGames}`,
          winRateLabel: `${wins}/${selected}`
        };
      })
      .sort((left, right) => right.selectionRate - left.selectionRate || left.championName.localeCompare(right.championName));

    res.json({
      totalGames,
      champions
    });
  } catch (error) {
    console.error('Error fetching champion selection rates:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to fetch champion selection rates',
      details: error.details || error.message
    });
  }
});

// Endpoint to get a specific champion's detailed data
app.get('/api/champions/:championId', async (req, res) => {
  try {
    const { championId } = req.params;
    const response = await fetch(`${RIOT_DDRAGON_BASE}/cdn/${CURRENT_PATCH}/data/en_US/champion/${championId}.json`);

    if (!response.ok) {
      throw new Error(`Riot API error: ${response.status}`);
    }

    const data = await response.json();
    const champion = data.data[championId];

    res.json({
      id: champion.id,
      name: champion.name,
      title: champion.title,
      tags: champion.tags,
      stats: champion.stats,
      image: `${RIOT_DDRAGON_BASE}/cdn/${CURRENT_PATCH}/img/champion/${champion.image.full}`,
      blurb: champion.blurb,
      lore: champion.lore,
      spells: champion.spells,
      passive: champion.passive
    });
  } catch (error) {
    console.error(`Error fetching champion ${req.params.championId}:`, error);
    res.status(500).json({
      error: `Failed to fetch champion ${req.params.championId}`,
      details: error.message
    });
  }
});

// Endpoint to get all items
app.get('/api/items', async (req, res) => {
  try {
    const response = await fetch(`${RIOT_DDRAGON_BASE}/cdn/${CURRENT_PATCH}/data/en_US/item.json`);

    if (!response.ok) {
      throw new Error(`Riot API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform the data to match our component's expected format
    const items = Object.values(data.data).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description || item.plaintext || 'No description available',
      gold: item.gold,
      tags: item.tags || [],
      stats: item.stats || {},
      image: `${RIOT_DDRAGON_BASE}/cdn/${CURRENT_PATCH}/img/item/${item.image.full}`,
      into: item.into || [],
      from: item.from || [],
      maps: item.maps || {},
      depth: item.depth || null, // Item tier/depth (1 = basic, 2 = advanced, 3 = legendary)
      requiredChampion: item.requiredChampion || null,
      requiredAlly: item.requiredAlly || null,
      specialRecipe: item.specialRecipe || null
    }));

    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      error: 'Failed to fetch items from Riot API',
      details: error.message
    });
  }
});

// Endpoint to get summoner information by Riot ID (gameName#tagLine)
app.get('/api/summoner/:region/:gameName/:tagLine', async (req, res) => {
  try {
    const { region, gameName, tagLine } = req.params;

    if (!RIOT_API_KEY || RIOT_API_KEY === 'YOUR_API_KEY_HERE') {
      return res.status(500).json({
        error: 'Riot API key not configured',
        details: 'Please set the RIOT_API_KEY environment variable'
      });
    }

    // Validate region
    var routing = ROUTING_MAP[region.toLowerCase()];
    if (!routing) {
      return res.status(400).json({
        error: 'Invalid region',
        details: `Supported regions: ${Object.keys(ROUTING_MAP).join(', ')}`
      });
    }

    // First, get the PUUID using the Account API
    const accountUrl = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;

    const accountResponse = await fetch(accountUrl, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      }
    });

    if (!accountResponse.ok) {
      if (accountResponse.status === 404) {
        return res.status(404).json({
          error: 'Summoner not found',
          details: `Riot ID "${gameName}#${tagLine}" not found`
        });
      }
      if (accountResponse.status === 403) {
        return res.status(403).json({
          error: 'Invalid API key',
          details: 'The Riot API key is invalid or expired'
        });
      }
      throw new Error(`Account API error: ${accountResponse.status}`);
    }

    const accountData = await accountResponse.json();

    // Now get summoner info using the PUUID
    const platform = REGION_MAP[region.toLowerCase()];
    const summonerUrl = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountData.puuid}`;

    const summonerResponse = await fetch(summonerUrl, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      }
    });

    if (!summonerResponse.ok) {
      throw new Error(`Summoner API error: ${summonerResponse.status}`);
    }

    const summonerData = await summonerResponse.json();

    // Transform the data to include profile icon URL and Riot ID info
    const summonerInfo = {
      id: summonerData.id,
      accountId: summonerData.accountId,
      puuid: summonerData.puuid,
      name: summonerData.name,
      gameName: accountData.gameName,
      tagLine: accountData.tagLine,
      riotId: `${accountData.gameName}#${accountData.tagLine}`,
      profileIconId: summonerData.profileIconId,
      profileIconUrl: `${RIOT_DDRAGON_BASE}/cdn/${CURRENT_PATCH}/img/profileicon/${summonerData.profileIconId}.png`,
      summonerLevel: summonerData.summonerLevel,
      revisionDate: summonerData.revisionDate,
      region: region.toUpperCase()
    };

    res.json(summonerInfo);
  } catch (error) {
    console.error('Error fetching summoner:', error);
    res.status(500).json({
      error: 'Failed to fetch summoner information',
      details: error.message
    });
  }
});

// Legacy endpoint for backward compatibility (deprecated)
app.get('/api/summoner/:region/:summonerName', async (req, res) => {
  return res.status(410).json({
    error: 'Deprecated endpoint',
    details: 'Please use the new Riot ID format: /api/summoner/:region/:gameName/:tagLine',
    example: '/api/summoner/na/Doublelift/NA1'
  });
});

// Endpoint to get summoner match history by Riot ID
app.get('/api/summoner/:region/:gameName/:tagLine/matches', async (req, res) => {
  try {
    const { region, gameName, tagLine } = req.params;
    const { count = 10 } = req.query;
    const matchHistory = await fetchSummonerMatchHistory(region, gameName, tagLine, count);

    res.json(matchHistory);

  } catch (error) {
    console.error('Error fetching match history:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to fetch match history',
      details: error.details || error.message
    });
  }
});

app.get('/api/summoner/:region/:gameName/:tagLine/champion-stats', async (req, res) => {
  try {
    const { region, gameName, tagLine } = req.params;
    const historyCollection = await getMatchHistoryCollection();
    const detailsCollection = await getMatchDetailsCollection();

    // Get the summoner's puuid from the match history document
    const summonerDoc = await historyCollection.findOne(
      { region: region.toUpperCase(), gameName, tagLine },
      {
        projection: {
          puuid: 1,
          riotId: 1,
          gameName: 1,
          tagLine: 1,
          region: 1,
          matchCount: 1,
          requestedCount: 1,
          'matchHistory.matches': 1
        }
      }
    );

    if (!summonerDoc?.puuid) {
      throw createHttpError(
        404,
        'Summoner not found in database',
        'Save match history to MongoDB before requesting champion stats'
      );
    }

    const { puuid } = summonerDoc;

    // Find ALL match details in the database where this summoner participated
    const allMatchDocs = await detailsCollection
      .find(
        { 'matchDetail.metadata.participants': puuid },
        { projection: { matchId: 1, 'matchDetail.info.teams.participants': 1, 'matchDetail.info.participants': 1 } }
      )
      .toArray();

    // Extract the summoner-specific participant entry from each match detail document
    const missingParticipantMatchIds = [];
    const debugMatches = [];
    const detailParticipantMatches = allMatchDocs
      .map((doc) => {
        const teamParticipants = (doc.matchDetail?.info?.teams || []).flatMap((team) => team.participants || []);
        const fallbackParticipants = doc.matchDetail?.info?.participants || [];
        const allParticipants = teamParticipants.length > 0 ? teamParticipants : fallbackParticipants;
        const participant = allParticipants.find(
          (p) => p.puuid === puuid
        );

        if (!participant) {
          missingParticipantMatchIds.push(doc.matchId || null);
          debugMatches.push({
            source: 'matchDetails',
            matchId: doc.matchId || null,
            puuid,
            championId: null,
            championName: null,
            hasParticipant: false,
            hasChampionId: false
          });
          return null;
        }

        debugMatches.push({
          source: 'matchDetails',
          matchId: doc.matchId || null,
          puuid,
          championId: participant.championId ?? null,
          championName: participant.championName || null,
          hasParticipant: true,
          hasChampionId: typeof participant.championId === 'number'
        });

        return { matchId: doc.matchId || null, participant };
      })
      .filter(Boolean);

    // Fallback: use cached match history participant records when no detailed match docs exist
    const historyMatches = Array.isArray(summonerDoc?.matchHistory?.matches)
      ? summonerDoc.matchHistory.matches
      : [];

    const historyParticipantMatches = historyMatches
      .map((match) => {
        const participant = match?.participant;
        if (!participant) {
          return null;
        }

        debugMatches.push({
          source: 'matchHistory',
          matchId: match.matchId || null,
          puuid,
          championId: participant.championId ?? null,
          championName: participant.championName || null,
          hasParticipant: true,
          hasChampionId: typeof participant.championId === 'number'
        });

        return { matchId: match.matchId || null, participant };
      })
      .filter(Boolean);

    const usingFallback = detailParticipantMatches.length === 0 && historyParticipantMatches.length > 0;
    const participantMatches = usingFallback ? historyParticipantMatches : detailParticipantMatches;
    const dataSource = usingFallback ? 'matchHistory' : 'matchDetails';

    res.json({
      summoner: {
        region: summonerDoc.region,
        gameName: summonerDoc.gameName,
        tagLine: summonerDoc.tagLine,
        riotId: summonerDoc.riotId
      },
      totalMatches: dataSource === 'matchHistory'
        ? (summonerDoc.matchCount ?? historyMatches.length)
        : allMatchDocs.length,
      requestedCount: dataSource === 'matchHistory'
        ? (summonerDoc.requestedCount ?? historyMatches.length)
        : allMatchDocs.length,
      championStats: summarizeCachedChampionStats(participantMatches),
      debug: {
        dataSource,
        matchedDocuments: allMatchDocs.length,
        matchedParticipants: detailParticipantMatches.length,
        fallbackMatchedParticipants: historyParticipantMatches.length,
        missingParticipants: missingParticipantMatchIds.length,
        missingParticipantMatchIds,
        matchesWithChampionId: debugMatches.filter((match) => match.hasChampionId).length,
        matchesMissingChampionId: debugMatches.filter((match) => !match.hasChampionId).length,
        matchIdsWithChampionId: debugMatches.filter((match) => match.hasChampionId).map((match) => match.matchId),
        matchIdsMissingChampionId: debugMatches.filter((match) => !match.hasChampionId).map((match) => match.matchId),
        matches: debugMatches
      }
    });
  } catch (error) {
    console.error('Error fetching cached champion stats:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to fetch cached champion stats',
      details: error.details || error.message
    });
  }
});

// Endpoint to save hosted match history JSON to MongoDB
app.post('/api/summoner/:region/:gameName/:tagLine/matches/save', async (req, res) => {
  try {
    const { region, gameName, tagLine } = req.params;
    const requestedCount = req.body.count ?? req.query.count ?? 10;
    const matchHistory = req.body.matchHistory || await fetchSummonerMatchHistory(region, gameName, tagLine, requestedCount);
    const collection = await getMatchHistoryCollection();
    const now = new Date();

    const documentToSave = {
      region: matchHistory.summoner.region,
      gameName: matchHistory.summoner.gameName,
      tagLine: matchHistory.summoner.tagLine,
      riotId: matchHistory.summoner.riotId,
      puuid: matchHistory.summoner.puuid,
      matchCount: Array.isArray(matchHistory.matches) ? matchHistory.matches.length : 0,
      requestedCount: normalizeMatchCount(requestedCount),
      matchHistory,
      updatedAt: now
    };

    const filter = {
      region: matchHistory.summoner.region,
      puuid: matchHistory.summoner.puuid
    };

    const existingDocument = await collection.findOne(filter, {
      projection: { _id: 1 }
    });

    await collection.updateOne(
      filter,
      {
        $set: documentToSave,
        $setOnInsert: {
          createdAt: now
        }
      },
      {
        upsert: true
      }
    );

    const savedDocument = await collection.findOne(filter, {
      projection: { _id: 1 }
    });

    res.status(existingDocument ? 200 : 201).json({
      message: 'Match history saved to MongoDB',
      documentId: savedDocument?._id || null,
      savedAt: now.toISOString(),
      matchCount: documentToSave.matchCount,
      summoner: matchHistory.summoner
    });
  } catch (error) {
    console.error('Error saving match history:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to save match history',
      details: error.details || error.message
    });
  }
});

// Endpoint to save details for each match in match history (sequentially)
app.post('/api/summoner/:region/:gameName/:tagLine/matches/save-details', async (req, res) => {
  try {
    const { region, gameName, tagLine } = req.params;
    const requestedCount = req.body.count ?? req.query.count ?? 10;
    const detailsCollection = await getMatchDetailsCollection();
    const routingRegion = ROUTING_MAP[region.toLowerCase()];

    if (!routingRegion) {
      throw createHttpError(
        400,
        'Invalid region',
        `Supported regions: ${Object.keys(ROUTING_MAP).join(', ')}`
      );
    }

    const matchHistory = req.body.matchHistory || await fetchSummonerMatchHistory(region, gameName, tagLine, requestedCount);
    const matches = Array.isArray(matchHistory?.matches) ? matchHistory.matches : [];

    if (matches.length === 0) {
      return res.status(400).json({
        error: 'No matches to save',
        details: 'Match history payload did not contain any matches'
      });
    }

    const now = new Date();
    const savedMatches = [];
    const skippedMatches = [];
    const failedMatches = [];

    // Bulk-check which matchIds are already in the database in a single query
    const allMatchIds = matches.map((m) => m?.matchId).filter(Boolean);
    const existingDocs = await detailsCollection
      .find(
        { matchId: { $in: allMatchIds }, region: routingRegion },
        { projection: { matchId: 1 } }
      )
      .toArray();
    const alreadySavedIds = new Set(existingDocs.map((d) => d.matchId));

    for (const match of matches) {
      const matchId = match?.matchId;

      if (!matchId) {
        failedMatches.push({
          matchId: null,
          error: 'Missing matchId in match history entry'
        });
        continue;
      }

      // Skip Riot API fetch and upsert if already saved
      if (alreadySavedIds.has(matchId)) {
        skippedMatches.push(matchId);
        continue;
      }

      try {
        const matchDetail = await fetchMatchDetails(matchId, routingRegion);
        const documentToSave = {
          matchId,
          region: routingRegion,
          gameName,
          tagLine,
          riotId: `${gameName}#${tagLine}`,
          matchDetail,
          updatedAt: now
        };

        await detailsCollection.updateOne(
          {
            matchId,
            region: routingRegion
          },
          {
            $set: documentToSave,
            $setOnInsert: {
              createdAt: now
            }
          },
          {
            upsert: true
          }
        );

        savedMatches.push(matchId);
      } catch (matchError) {
        failedMatches.push({
          matchId,
          error: matchError.details || matchError.message
        });
      }
    }

    res.status(200).json({
      message: `Saved ${savedMatches.length} new, skipped ${skippedMatches.length} existing, ${failedMatches.length} failed out of ${matches.length} matches`,
      riotId: `${gameName}#${tagLine}`,
      region: routingRegion,
      requestedCount: normalizeMatchCount(requestedCount),
      totalMatches: matches.length,
      savedCount: savedMatches.length,
      skippedCount: skippedMatches.length,
      failedCount: failedMatches.length,
      savedMatches,
      skippedMatches,
      failedMatches,
      savedAt: now.toISOString()
    });
  } catch (error) {
    console.error('Error saving all match details:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to save all match details',
      details: error.details || error.message
    });
  }
});

// Endpoint to get specific match details by match ID
app.get('/api/summoner/:gameName/:tagLine/matches/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { region = 'americas' } = req.query; // Default to americas routing
    const transformedMatch = await fetchMatchDetails(matchId, region);
    res.json(transformedMatch);

  } catch (error) {
    console.error('Error fetching match details:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to fetch match details',
      details: error.details || error.message
    });
  }
});

app.get('/api/summoner/:gameName/:tagLine/matches/:matchId/timeline', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { region = 'americas' } = req.query;
    const timelineSummary = await fetchInitialFramePlayerPositions(matchId, region);
    res.json(timelineSummary);
  } catch (error) {
    console.error('Error fetching match timeline:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to fetch match timeline',
      details: error.details || error.message
    });
  }
});

// Endpoint to save timeline data to MongoDB
app.post('/api/summoner/:gameName/:tagLine/matches/:matchId/timeline/save', async (req, res) => {
  try {
    const { gameName, tagLine, matchId } = req.params;
    const { region = 'americas' } = req.query;
    const collection = await getTimelineCollection();
    const now = new Date();

    const timelineData = req.body.timeline || await fetchInitialFramePlayerPositions(matchId, region);

    const filter = { matchId, region: region.toLowerCase() };

    const existingDocument = await collection.findOne(filter, { projection: { _id: 1 } });

    if (existingDocument && !req.body.timeline) {
      const [totalDeaths, totalDocuments] = await Promise.all([
        countTotalDeathsInTimeline(matchId),
        collection.countDocuments({})
      ]);
      return res.status(200).json({
        message: 'Timeline already exists in MongoDB — skipped',
        documentId: existingDocument._id,
        matchId,
        region: region.toLowerCase(),
        skipped: true,
        totalDeaths,
        totalDocuments,
        savedAt: now.toISOString()
      });
    }

    const documentToSave = {
      matchId,
      region: region.toLowerCase(),
      gameName,
      tagLine,
      riotId: `${gameName}#${tagLine}`,
      frames: timelineData.frames,
      firstFrameTimestamp: timelineData.firstFrameTimestamp ?? null,
      updatedAt: now
    };

    await collection.updateOne(
      filter,
      {
        $set: documentToSave,
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );

    const savedDocument = await collection.findOne(filter, { projection: { _id: 1 } });
    const [totalDeaths, totalDocuments] = await Promise.all([
      countTotalDeathsInTimeline(matchId),
      collection.countDocuments({})
    ]);

    res.status(existingDocument ? 200 : 201).json({
      message: existingDocument ? 'Timeline updated in MongoDB' : 'Timeline saved to MongoDB',
      documentId: savedDocument?._id || null,
      matchId,
      region: region.toLowerCase(),
      skipped: false,
      totalDeaths,
      totalDocuments,
      savedAt: now.toISOString()
    });
  } catch (error) {
    console.error('Error saving timeline:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to save timeline',
      details: error.details || error.message
    });
  }
});

// Endpoint to save match details JSON to MongoDB
app.post('/api/summoner/:gameName/:tagLine/matches/:matchId/save', async (req, res) => {
  try {
    const { gameName, tagLine, matchId } = req.params;
    const { region = 'americas' } = req.query;
    const collection = await getMatchDetailsCollection();
    const now = new Date();

    const matchDetail = req.body.matchDetail || await fetchMatchDetails(matchId, region);
    const documentToSave = {
      matchId,
      region: region.toLowerCase(),
      gameName,
      tagLine,
      riotId: `${gameName}#${tagLine}`,
      matchDetail,
      updatedAt: now
    };

    const filter = {
      matchId,
      region: region.toLowerCase()
    };

    const existingDocument = await collection.findOne(filter, {
      projection: { _id: 1 }
    });

    // If already saved and no new data was provided in the request body, skip the upsert
    if (existingDocument && !req.body.matchDetail) {
      return res.status(200).json({
        message: 'Match details already exist in MongoDB — skipped',
        documentId: existingDocument._id,
        matchId,
        region: region.toLowerCase(),
        skipped: true,
        savedAt: now.toISOString()
      });
    }

    await collection.updateOne(
      filter,
      {
        $set: documentToSave,
        $setOnInsert: {
          createdAt: now
        }
      },
      {
        upsert: true
      }
    );

    const savedDocument = await collection.findOne(filter, {
      projection: { _id: 1 }
    });

    res.status(existingDocument ? 200 : 201).json({
      message: existingDocument ? 'Match details updated in MongoDB' : 'Match details saved to MongoDB',
      documentId: savedDocument?._id || null,
      matchId,
      region: region.toLowerCase(),
      skipped: false,
      savedAt: now.toISOString()
    });
  } catch (error) {
    console.error('Error saving match details:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to save match details',
      details: error.details || error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Batch backfill: read every puuid from match details and save match history documents
app.post('/api/match-details/sync-match-histories', async (req, res) => {
  try {
    const requestedCount = req.body.count ?? req.query.count ?? 10;
    const maxPuuidsRaw = req.body.maxPuuids ?? req.query.maxPuuids ?? null;
    const maxPuuids = maxPuuidsRaw === null ? null : Math.max(1, Number.parseInt(maxPuuidsRaw, 10) || 1);
    const normalizedCount = normalizeMatchCount(requestedCount);

    const detailsCollection = await getMatchDetailsCollection();
    const historyCollection = await getMatchHistoryCollection();
    const now = new Date();

    const puuidAggregation = [
      {
        $project: {
          region: { $ifNull: ['$region', 'americas'] },
          participants: {
            $cond: [
              {
                $gt: [
                  { $size: { $ifNull: ['$matchDetail.info.participants', []] } },
                  0
                ]
              },
              { $ifNull: ['$matchDetail.info.participants', []] },
              {
                $reduce: {
                  input: { $ifNull: ['$matchDetail.info.teams', []] },
                  initialValue: [],
                  in: {
                    $concatArrays: ['$$value', { $ifNull: ['$$this.participants', []] }]
                  }
                }
              }
            ]
          }
        }
      },
      { $unwind: '$participants' },
      {
        $match: {
          'participants.puuid': { $type: 'string', $ne: '' }
        }
      },
      {
        $group: {
          _id: {
            puuid: '$participants.puuid',
            region: '$region'
          },
          gameName: { $first: '$participants.riotIdGameName' },
          tagLine: { $first: '$participants.riotIdTagline' }
        }
      }
    ];

    if (maxPuuids !== null) {
      puuidAggregation.push({ $limit: maxPuuids });
    }

    const puuidRows = await detailsCollection.aggregate(puuidAggregation).toArray();

    if (puuidRows.length === 0) {
      return res.status(200).json({
        message: 'No puuids found in matchDetails collection',
        scannedPuuids: 0,
        saved: 0,
        updated: 0,
        failed: 0,
        skipped: 0,
        savedCalls: [],
        updatedCalls: [],
        skippedCalls: [],
        errors: []
      });
    }

    const summary = {
      scannedPuuids: puuidRows.length,
      saved: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      savedCalls: [],
      updatedCalls: [],
      skippedCalls: [],
      errors: []
    };

    let processedCount = 0;
    const metricsStart = getRiotRequestMetricsSnapshot();

    // Set up interval to report progress every 1 second
    const progressInterval = setInterval(() => {
      const metricsNow = getRiotRequestMetricsSnapshot();

      res.write(`data: ${JSON.stringify({
        status: 'processing',
        timestamp: new Date().toISOString(),
        processingProgress: {
          documentsPuuidsProcessed: processedCount,
          totalPuuidsToProcess: puuidRows.length,
          saved: summary.saved,
          updated: summary.updated,
          skipped: summary.skipped,
          failed: summary.failed,
          savedCallsCount: summary.savedCalls.length,
          updatedCallsCount: summary.updatedCalls.length,
          skippedCallsCount: summary.skippedCalls.length,
          riotRequestsSent: metricsNow.totalRequests - metricsStart.totalRequests,
          riot429Responses: metricsNow.total429Responses - metricsStart.total429Responses,
          riotRetryAttempts: metricsNow.totalRetryAttempts - metricsStart.totalRetryAttempts,
          riot429Exhausted: metricsNow.total429Exhausted - metricsStart.total429Exhausted
        }
      })}\n\n`);
    }, 1000);

    // Set response headers for streaming/SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for (const row of puuidRows) {
      const puuid = row?._id?.puuid;
      const routingRegion = String(row?._id?.region || 'americas').toLowerCase();

      if (!['americas', 'asia', 'europe'].includes(routingRegion)) {
        summary.failed += 1;
        summary.errors.push({ puuid, region: routingRegion, error: 'Unsupported routing region' });
        processedCount += 1;
        continue;
      }

      try {
        const accountData = await fetchRiotAccountByPuuid(routingRegion, puuid);
        const gameName = accountData?.gameName || row?.gameName || 'Unknown';
        const tagLine = accountData?.tagLine || row?.tagLine || 'Unknown';
        const matches = await fetchMatchHistoryByPuuid(routingRegion, puuid, normalizedCount);

        if (!Array.isArray(matches) || matches.length === 0) {
          summary.skipped += 1;
          summary.skippedCalls.push({
            puuid,
            region: routingRegion,
            reason: 'No matches returned'
          });
          processedCount += 1;
          continue;
        }

        // Construct the matchHistory object in the same format as fetchSummonerMatchHistory
        const matchHistory = {
          summoner: {
            name: gameName,
            riotId: `${gameName}#${tagLine}`,
            gameName,
            tagLine,
            puuid,
            region: routingRegion.toUpperCase()
          },
          matches
        };

        const documentToSave = {
          region: matchHistory.summoner.region,
          gameName: matchHistory.summoner.gameName,
          tagLine: matchHistory.summoner.tagLine,
          riotId: matchHistory.summoner.riotId,
          puuid: matchHistory.summoner.puuid,
          matchCount: Array.isArray(matchHistory.matches) ? matchHistory.matches.length : 0,
          requestedCount: normalizedCount,
          matchHistory,
          updatedAt: now
        };

        const filter = {
          region: matchHistory.summoner.region,
          puuid: matchHistory.summoner.puuid
        };

        const existingDocument = await historyCollection.findOne(filter, {
          projection: { _id: 1 }
        });

        await historyCollection.updateOne(
          filter,
          {
            $set: documentToSave,
            $setOnInsert: {
              createdAt: now
            }
          },
          {
            upsert: true
          }
        );

        if (existingDocument) {
          summary.updated += 1;
          summary.updatedCalls.push({
            puuid,
            region: matchHistory.summoner.region,
            riotId: matchHistory.summoner.riotId,
            matchCount: documentToSave.matchCount
          });
        } else {
          summary.saved += 1;
          summary.savedCalls.push({
            puuid,
            region: matchHistory.summoner.region,
            riotId: matchHistory.summoner.riotId,
            matchCount: documentToSave.matchCount
          });
        }
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({
          puuid,
          region: routingRegion,
          error: error.details || error.message || 'Failed to sync puuid'
        });
      }

      processedCount += 1;
    }

    // Clear the progress interval
    clearInterval(progressInterval);

    const metricsEnd = getRiotRequestMetricsSnapshot();

    // Send final completion message
    res.write(`data: ${JSON.stringify({
      status: 'completed',
      message: 'PUUID sync from matchDetails to matchHistories completed',
      requestedCount: normalizedCount,
      timestamp: new Date().toISOString(),
      retryMetrics: {
        riotRequestsSent: metricsEnd.totalRequests - metricsStart.totalRequests,
        riot429Responses: metricsEnd.total429Responses - metricsStart.total429Responses,
        riotRetryAttempts: metricsEnd.totalRetryAttempts - metricsStart.totalRetryAttempts,
        riot429Exhausted: metricsEnd.total429Exhausted - metricsStart.total429Exhausted
      },
      ...summary
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error syncing match histories from match details:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to sync match histories from match details',
      details: error.details || error.message
    });
  }
});

// Batch timeline sync: scan matchHistories and save timelines into matchTimelines schema
app.post('/api/match-histories/sync-timelines', async (req, res) => {
  let progressInterval = null;

  try {
    const maxMatchIdsRaw = req.body.maxMatchIds ?? req.query.maxMatchIds ?? null;
    const maxMatchIds = maxMatchIdsRaw === null ? null : Math.max(1, Number.parseInt(maxMatchIdsRaw, 10) || 1);
    const forceUpdate = req.body.forceUpdate === true || String(req.query.forceUpdate || '').toLowerCase() === 'true';
    const delayMsRaw = req.body.delayMs ?? req.query.delayMs ?? process.env.SYNC_TIMELINES_DELAY_MS ?? 300;
    const delayMs = Math.max(0, Number.parseInt(delayMsRaw, 10) || 0);
    const progressIntervalMsRaw = req.body.progressIntervalMs ?? req.query.progressIntervalMs ?? process.env.SYNC_TIMELINES_PROGRESS_INTERVAL_MS ?? 1000;
    const progressIntervalMs = Math.max(250, Number.parseInt(progressIntervalMsRaw, 10) || 1000);

    const sendEvent = (payload) => {
      if (res.writableEnded) {
        return;
      }

      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const historyCollection = await getMatchHistoryCollection();
    const timelineCollection = await getTimelineCollection();

    const aggregation = [
      {
        $project: {
          region: { $ifNull: ['$region', '$matchHistory.summoner.region'] },
          gameName: { $ifNull: ['$gameName', '$matchHistory.summoner.gameName'] },
          tagLine: { $ifNull: ['$tagLine', '$matchHistory.summoner.tagLine'] },
          riotId: { $ifNull: ['$riotId', '$matchHistory.summoner.riotId'] },
          matches: { $ifNull: ['$matchHistory.matches', []] }
        }
      },
      { $unwind: '$matches' },
      {
        $match: {
          'matches.matchId': { $type: 'string', $ne: '' }
        }
      },
      {
        $group: {
          _id: {
            matchId: '$matches.matchId',
            region: '$region'
          },
          gameName: { $first: '$gameName' },
          tagLine: { $first: '$tagLine' },
          riotId: { $first: '$riotId' }
        }
      }
    ];

    if (maxMatchIds !== null) {
      aggregation.push({ $limit: maxMatchIds });
    }

    const matchRows = await historyCollection.aggregate(aggregation).toArray();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let processedCount = 0;

    if (matchRows.length === 0) {
      sendEvent({
        status: 'completed',
        message: 'No match IDs found in matchHistories collection',
        timestamp: new Date().toISOString(),
        forceUpdate,
        scannedMatchIds: 0,
        delayMs,
        throttledRequests: 0,
        totalThrottleDelayMs: 0,
        saved: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        savedTimelines: [],
        updatedTimelines: [],
        skippedTimelines: [],
        failedTimelines: []
      });
      return res.end();
    }

    const summary = {
      scannedMatchIds: matchRows.length,
      delayMs,
      throttledRequests: 0,
      totalThrottleDelayMs: 0,
      saved: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      savedTimelines: [],
      updatedTimelines: [],
      skippedTimelines: [],
      failedTimelines: []
    };

    progressInterval = setInterval(() => {
      sendEvent({
        status: 'processing',
        timestamp: new Date().toISOString(),
        processingProgress: {
          documentsMatchIdsProcessed: processedCount,
          totalMatchIdsToProcess: matchRows.length,
          saved: summary.saved,
          updated: summary.updated,
          skipped: summary.skipped,
          failed: summary.failed,
          savedTimelinesCount: summary.savedTimelines.length,
          updatedTimelinesCount: summary.updatedTimelines.length,
          skippedTimelinesCount: summary.skippedTimelines.length,
          failedTimelinesCount: summary.failedTimelines.length,
          throttledRequests: summary.throttledRequests,
          totalThrottleDelayMs: summary.totalThrottleDelayMs
        }
      });
    }, progressIntervalMs);

    for (const row of matchRows) {
      const matchId = row?._id?.matchId;
      const rawRegion = String(row?._id?.region || 'americas');
      const region = rawRegion.toLowerCase();
      const gameName = row?.gameName || 'Unknown';
      const tagLine = row?.tagLine || 'Unknown';
      const riotId = row?.riotId || `${gameName}#${tagLine}`;

      if (!matchId) {
        summary.failed += 1;
        summary.failedTimelines.push({
          matchId: null,
          region,
          error: 'Missing matchId'
        });
        processedCount += 1;
        continue;
      }

      if (!['americas', 'asia', 'europe'].includes(region)) {
        summary.failed += 1;
        summary.failedTimelines.push({
          matchId,
          region,
          error: 'Unsupported routing region'
        });
        processedCount += 1;
        continue;
      }

      const filter = { matchId, region };

      try {
        const existingDocument = await timelineCollection.findOne(filter, { projection: { _id: 1 } });

        if (existingDocument && !forceUpdate) {
          summary.skipped += 1;
          summary.skippedTimelines.push({
            matchId,
            region,
            reason: 'Timeline already exists'
          });
          processedCount += 1;
          continue;
        }

        if (delayMs > 0) {
          await sleep(delayMs);
          summary.throttledRequests += 1;
          summary.totalThrottleDelayMs += delayMs;
        }

        const now = new Date();
        const timelineData = await fetchInitialFramePlayerPositions(matchId, region);

        // Keep the same schema used by the /timeline/save endpoint
        const documentToSave = {
          matchId,
          region,
          gameName,
          tagLine,
          riotId,
          frames: timelineData.frames,
          firstFrameTimestamp: timelineData.firstFrameTimestamp ?? null,
          updatedAt: now
        };

        await timelineCollection.updateOne(
          filter,
          {
            $set: documentToSave,
            $setOnInsert: { createdAt: now }
          },
          { upsert: true }
        );

        if (existingDocument) {
          summary.updated += 1;
          summary.updatedTimelines.push({ matchId, region, riotId });
        } else {
          summary.saved += 1;
          summary.savedTimelines.push({ matchId, region, riotId });
        }
      } catch (error) {
        summary.failed += 1;
        summary.failedTimelines.push({
          matchId,
          region,
          error: error.details || error.message || 'Failed to sync timeline'
        });
      }

      processedCount += 1;
    }

    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    sendEvent({
      status: 'completed',
      message: 'Timeline sync from matchHistories to matchTimelines completed',
      timestamp: new Date().toISOString(),
      forceUpdate,
      ...summary
    });
    res.end();
  } catch (error) {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }

    console.error('Error syncing timelines from match histories:', error);

    if (res.headersSent) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          status: 'error',
          timestamp: new Date().toISOString(),
          error: error.error || 'Failed to sync timelines from match histories',
          details: error.details || error.message
        })}\n\n`);
        res.end();
      }

      return;
    }

    res.status(error.status || 500).json({
      error: error.error || 'Failed to sync timelines from match histories',
      details: error.details || error.message
    });
  }
});

// Cleanup route: remove match history docs with unknown gameName
app.delete('/api/match-histories/cleanup-unknown-gamename', async (req, res) => {
  try {
    const collection = await getMatchHistoryCollection();
    const filter = {
      $or: [
        { gameName: { $regex: '^unknown$', $options: 'i' } },
        { 'matchHistory.summoner.gameName': { $regex: '^unknown$', $options: 'i' } }
      ]
    };

    const result = await collection.deleteMany(filter);
    const remaining = await collection.countDocuments({});

    res.status(200).json({
      message: `'Unknown' gameName documents removed: ${result.deletedCount || 0} from matchHistories`,
      deletedCount: result.deletedCount || 0,
      remainingDocuments: remaining
    });
  } catch (error) {
    console.error('Error cleaning unknown gameName documents:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to clean unknown gameName documents',
      details: error.details || error.message
    });
  }
});

// Aggregated CHAMPION_KILL events across all saved timelines
app.get('/api/heatmap/kill-events', async (req, res) => {
  try {
    const collection = await getTimelineCollection();

    const pipeline = [
      { $unwind: '$frames' },
      { $unwind: '$frames.events' },
      { $match: { 'frames.events.type': 'CHAMPION_KILL' } },
      {
        $project: {
          _id: 0,
          matchId: 1,
          position: '$frames.events.position',
          mapPosition: '$frames.events.mapPosition',
          victimChampion: '$frames.events.victimChampion',
          victimTeamId: '$frames.events.victimTeamId',
          killerChampion: '$frames.events.killerChampion',
          killerTeamId: '$frames.events.killerTeamId',
          timestamp: '$frames.events.timestamp'
        }
      }
    ];

    const events = await collection.aggregate(pipeline).toArray();
    const matchCount = await collection.countDocuments({});

    res.json({ events, total: events.length, matchCount });
  } catch (error) {
    console.error('Error fetching heatmap kill events:', error);
    res.status(error.status || 500).json({
      error: error.error || 'Failed to fetch kill events',
      details: error.details || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 League Vibe server running on http://localhost:${PORT}`);
  console.log(`📚 Champions API available at http://localhost:${PORT}/api/champions`);
  console.log(`🛡️ Items API available at http://localhost:${PORT}/api/items`);
  console.log(`👤 Summoner API available at http://localhost:${PORT}/api/summoner/:region/:gameName/:tagLine`);
  console.log(`📊 Match History API available at http://localhost:${PORT}/api/summoner/:region/:gameName/:tagLine/matches`);
  console.log(`💾 Match History Save API available at http://localhost:${PORT}/api/summoner/:region/:gameName/:tagLine/matches/save`);
  console.log(`🗂️ Match Details Batch Save API available at http://localhost:${PORT}/api/summoner/:region/:gameName/:tagLine/matches/save-details`);
  console.log(`🎯 Match Details API available at http://localhost:${PORT}/api/summoner/:region/:gameName/:tagLine/matches/:matchId`);
  console.log(`🧾 Match Details Save API available at http://localhost:${PORT}/api/summoner/:gameName/:tagLine/matches/:matchId/save`);
  console.log(`🧹 Match History Cleanup API available at http://localhost:${PORT}/api/match-histories/cleanup-unknown-gamename`);
  console.log(`📈 Heatmap Kill Events API available at http://localhost:${PORT}/api/heatmap/kill-events`);
  console.log(`🔁 Match History Sync API available at http://localhost:${PORT}/api/match-details/sync-match-histories`);
  console.log(`🗺️ Timeline Sync API available at http://localhost:${PORT}/api/match-histories/sync-timelines`);
  console.log('⚠️  use curl or Postman to test POST endpoints with JSON bodies');

  if (!RIOT_API_KEY || RIOT_API_KEY === 'YOUR_API_KEY_HERE') {
    console.warn('⚠️  WARNING: Riot API key not configured. Summoner and match APIs will not work.');
    console.warn('   Set the RIOT_API_KEY environment variable to enable full functionality.');
    console.warn('   Get your key at: https://developer.riotgames.com/');
  }

  if (!MONGODB_URI) {
    console.warn('⚠️  WARNING: MongoDB URI not configured. Match history save API will not work.');
    console.warn('   Set the MONGODB_URI environment variable to enable MongoDB persistence.');
  }
});