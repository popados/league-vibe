const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Riot Data Dragon API base URL
const RIOT_DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

// Riot API base URLs
const RIOT_API_BASE = 'https://REGION.api.riotgames.com';
const AMERICAS_API_BASE = 'https://americas.api.riotgames.com';

// Current patch version (you might want to fetch this dynamically)
const CURRENT_PATCH = '14.9.1';

// Riot API Key (should be set as environment variable)
const RIOT_API_KEY = process.env.RIOT_API_KEY || 'your_riot_api_key_here';

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
    const { count = 10 } = req.query; // Default to 10 matches, can be overridden

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
      throw new Error(`Failed to fetch account: ${accountResponse.status}`);
    }

    const accountData = await accountResponse.json();
    const puuid = accountData.puuid;

    // Get routing value for match history
    var routing = ROUTING_MAP[region.toLowerCase()];
    const matchlistUrl = `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;

    const matchlistResponse = await fetch(matchlistUrl, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      }
    });

    if (!matchlistResponse.ok) {
      throw new Error(`Failed to fetch match list: ${matchlistResponse.status}`);
    }

    const matchIds = await matchlistResponse.json();

    // Get detailed match information for each match
    const matches = [];
    for (const matchId of matchIds) {
      try {
        const matchUrl = `https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
        const matchResponse = await fetch(matchUrl, {
          headers: {
            'X-Riot-Token': RIOT_API_KEY
          }
        });

        if (matchResponse.ok) {
          const matchData = await matchResponse.json();

          // Find the participant data for this summoner
          const participant = matchData.info.participants.find(p => p.puuid === puuid);
          if (participant) {
            const matchInfo = {
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
              teams: matchData.info.teams
            };
            matches.push(matchInfo);
          }
        }
      } catch (matchError) {
        console.warn(`Failed to fetch match ${matchId}:`, matchError.message);
        // Continue with other matches
      }
    }

    res.json({
      summoner: {
        name: accountData.gameName,
        riotId: `${accountData.gameName}#${accountData.tagLine}`,
        gameName: accountData.gameName,
        tagLine: accountData.tagLine,
        puuid: accountData.puuid,
        region: region.toUpperCase()
      },
      matches: matches
    });

  } catch (error) {
    console.error('Error fetching match history:', error);
    res.status(500).json({
      error: 'Failed to fetch match history',
      details: error.message
    });
  }
});

// Endpoint to get specific match details by match ID
app.get('/api/summoner/:gameName/:tagLine/matches/:matchId', async (req, res) => {
  try {
    const { gameName, tagLine, matchId } = req.params;
    const { region = 'americas' } = req.query; // Default to americas routing

    if (!RIOT_API_KEY || RIOT_API_KEY === 'YOUR_API_KEY_HERE') {
      return res.status(500).json({
        error: 'Riot API key not configured',
        details: 'Please set the RIOT_API_KEY environment variable'
      });
    }

    // Validate region routing
    if (!['americas', 'asia', 'europe'].includes(region.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid region',
        details: 'Supported regions: americas, asia, europe'
      });
    }

    // Fetch match details from Riot API
    const matchUrl = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;

    const matchResponse = await fetch(matchUrl, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      }
    });

    if (!matchResponse.ok) {
      if (matchResponse.status === 404) {
        return res.status(404).json({
          error: 'Match not found',
          details: `Match ID "${matchId}" not found`
        });
      }
      throw new Error(`Failed to fetch match: ${matchResponse.status}`);
    }

    const matchData = await matchResponse.json();

    // Transform and organize the data for the frontend
    const transformedMatch = {
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
              summonerName: participant.summonerName,
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

    res.json(transformedMatch);

  } catch (error) {
    console.error('Error fetching match details:', error);
    res.status(500).json({
      error: 'Failed to fetch match details',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 League Vibe server running on http://localhost:${PORT}`);
  console.log(`📚 Champions API available at http://localhost:${PORT}/api/champions`);
  console.log(`🛡️ Items API available at http://localhost:${PORT}/api/items`);
  console.log(`👤 Summoner API available at http://localhost:${PORT}/api/summoner/:region/:gameName/:tagLine`);
  console.log(`📊 Match History API available at http://localhost:${PORT}/api/summoner/:region/:gameName/:tagLine/matches`);
  console.log(`🎯 Match Details API available at http://localhost:${PORT}/api/summoner/:region/:gameName/:tagLine/matches/:matchId`);

  if (!RIOT_API_KEY || RIOT_API_KEY === 'YOUR_API_KEY_HERE') {
    console.warn('⚠️  WARNING: Riot API key not configured. Summoner and match APIs will not work.');
    console.warn('   Set the RIOT_API_KEY environment variable to enable full functionality.');
    console.warn('   Get your key at: https://developer.riotgames.com/');
  }
});