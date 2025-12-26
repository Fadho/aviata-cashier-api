// test/createBetPlacedForPlayer.test.js
// Test request for createBetPlacedForPlayer endpoint

const axios = require('axios');

async function testCreateBetPlacedForPlayer() {
  try {
    const response = await axios.post('http://localhost:3006/v1/bet/player', {
      cashierId: '65a1b2c3d4e5f6a7b8c9d0e1',
      roundId: 'aviata-20251226-001',
      gameType: 'aviata',
      playerId: 'pilot1', // or username if string
      deviceId: '65a1b2c3d4e5f6a7b8c9d0e1',
      stake: 1000,
    });
    console.log('Status:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    } else {
      console.error('Request error:', error.message);
    }
  }
}

testCreateBetPlacedForPlayer();
