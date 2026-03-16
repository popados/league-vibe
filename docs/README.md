# League Vibe Tracker

## Overview

This project is a lightweight League of Legends match history tracker and champion stats dashboard.

## Project Structure

- `src/` – Application source code (components, API helpers, utilities)
- `styles/` – Global styling
- `data/` – Mock data for local development and testing
- `server.js` – Node.js server for API endpoints

## How to Run

### Option 1: With Node.js Server (Recommended for Champions Data)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser to `http://localhost:3001`

The server will fetch real champion data from Riot's Data Dragon API and serve it to the application.

### Option 2: Static Files Only

1. Open `index.html` directly in your browser.
2. Note: Champions page will use mock data instead of real API data.

## API Endpoints

- `GET /api/champions` - Get all champions
- `GET /api/champions/:id` - Get specific champion details
- `GET /api/health` - Health check

## Testing

Run the API test script to verify the server is working:

```bash
node test-api.js
```

This will test the champions endpoint and display sample data.

## Notes

- This scaffold is designed for use with the Riot Games API (https://developer.riotgames.com/).
- For production use, move the API key to a server-side proxy or environment variable.
- For production use, move the API key to a server-side proxy or environment variable.
