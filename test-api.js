#!/usr/bin/env node

// Test script for all League Vibe API endpoints
const fetch = require('node-fetch');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

async function testHealth() {
  try {
    console.log('🏥 Testing health endpoint...');
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    console.log(`✅ Health check: ${data.status} at ${data.timestamp}`);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
}

async function testChampionsAPI() {
  try {
    console.log('\n⚔️ Testing champions API...');
    const response = await fetch(`${BASE_URL}/api/champions`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const champions = await response.json();
    console.log(`✅ Champions API successful!`);
    console.log(`📊 Received ${champions.length} champions`);

    if (champions.length > 0) {
      const sample = champions[0];
      console.log(`🎯 Sample: ${sample.name} (${sample.title})`);
      console.log(`🏷️ Tags: ${sample.tags.join(', ')}`);
      console.log(`❤️ HP: ${sample.stats.hp}`);
    }

  } catch (error) {
    console.error('❌ Champions API failed:', error.message);
  }
}

async function testItemsAPI() {
  try {
    console.log('\n🛡️ Testing items API...');
    const response = await fetch(`${BASE_URL}/api/items`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const items = await response.json();
    console.log(`✅ Items API successful!`);
    console.log(`📊 Received ${items.length} items`);

    if (items.length > 0) {
      const sample = items[0];
      console.log(`🎯 Sample: ${sample.name}`);
      console.log(`💰 Cost: ${sample.gold.total} gold`);
      console.log(`🏷️ Tags: ${sample.tags.join(', ')}`);
    }

  } catch (error) {
    console.error('❌ Items API failed:', error.message);
  }
}

async function testSummonerAPI() {
  try {
    console.log('\n👤 Testing summoner API (requires RIOT_API_KEY)...');
    const response = await fetch(`${BASE_URL}/api/summoner/na/Doublelift/NA1`);
    const data = await response.json();

    if (response.status === 500 && data.error === 'Riot API key not configured') {
      console.log('⚠️ API key not configured - this is expected for testing');
      console.log('💡 Set RIOT_API_KEY environment variable to test summoner API');
      console.log('💡 Example search: GameName="Doublelift", Tag="NA1", Region="na"');
    } else if (response.ok) {
      console.log(`✅ Summoner API successful!`);
      console.log(`🎯 Found: ${data.riotId} (Level ${data.summonerLevel})`);
      console.log(`🏷️ Region: ${data.region}`);
    } else {
      console.log(`❌ Summoner API error: ${data.error}`);
    }

  } catch (error) {
    console.error('❌ Summoner API failed:', error.message);
  }
}

async function testMatchHistoryAPI() {
  try {
    console.log('\n📊 Testing match history API (requires RIOT_API_KEY)...');
    const response = await fetch(`${BASE_URL}/api/summoner/na/Doublelift/NA1/matches?count=3`);
    const data = await response.json();

    if (response.status === 500 && data.error === 'Riot API key not configured') {
      console.log('⚠️ API key not configured - this is expected for testing');
      console.log('💡 Set RIOT_API_KEY environment variable to test match history API');
    } else if (response.ok) {
      console.log(`✅ Match History API successful!`);
      console.log(`📊 Found ${data.matches.length} matches for ${data.summoner.riotId}`);
      if (data.matches.length > 0) {
        const sample = data.matches[0];
        console.log(`🎯 Latest match: ${sample.participant.championName} (${sample.participant.kills}/${sample.participant.deaths}/${sample.participant.assists})`);
      }
    } else {
      console.log(`❌ Match History API error: ${data.error}`);
    }

  } catch (error) {
    console.error('❌ Match History API failed:', error.message);
  }
}

async function testHeatmapAPI() {
  try {
    console.log('\n🔥 Testing heatmap kill-events API...');
    const response = await fetch(`${BASE_URL}/api/heatmap/kill-events`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details || data.error || `HTTP ${response.status}`);
    }

    console.log('✅ Heatmap API successful!');
    console.log(`📊 Events returned: ${data.total ?? 0}`);
    console.log(`🗂️ Matches scanned: ${data.matchCount ?? 0}`);

    const sample = Array.isArray(data.events) ? data.events[0] : null;
    if (sample) {
      console.log(`🎯 Sample event: ${sample.killerChampion || 'Unknown'} -> ${sample.victimChampion || 'Unknown'}`);
    }
  } catch (error) {
    console.error('❌ Heatmap API failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🧪 Testing all League Vibe API endpoints...\n');

  await testHealth();
  await testChampionsAPI();
  await testItemsAPI();
  await testSummonerAPI();
  await testMatchHistoryAPI();
  await testHeatmapAPI();

  console.log('\n🎉 Testing complete!');
  console.log('\n📝 API Key Setup:');
  console.log('   1. Get a Riot API key from: https://developer.riotgames.com/');
  console.log('   2. Set environment variable: export RIOT_API_KEY=your_key_here');
  console.log('   3. Restart the server to enable summoner/match APIs');
}

runAllTests();