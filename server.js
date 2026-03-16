const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Riot Data Dragon API base URL
const RIOT_DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

// Current patch version (you might want to fetch this dynamically)
const CURRENT_PATCH = '14.9.1';

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 League Vibe server running on http://localhost:${PORT}`);
  console.log(`📚 Champions API available at http://localhost:${PORT}/api/champions`);
});