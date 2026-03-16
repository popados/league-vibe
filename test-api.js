#!/usr/bin/env node

// Simple test script to verify the champions API
const fetch = require('node-fetch');

async function testChampionsAPI() {
  try {
    console.log('Testing champions API...');
    const response = await fetch('http://localhost:3001/api/champions');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const champions = await response.json();
    console.log(`✅ API test successful!`);
    console.log(`📊 Received ${champions.length} champions`);

    if (champions.length > 0) {
      const sample = champions[0];
      console.log(`🎯 Sample champion: ${sample.name} (${sample.title})`);
      console.log(`🏷️ Tags: ${sample.tags.join(', ')}`);
      console.log(`❤️ HP: ${sample.stats.hp}`);
    }

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.log('💡 Make sure the server is running with: npm start');
  }
}

testChampionsAPI();