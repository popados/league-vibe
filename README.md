<!-- markdownlint-disable MD031 -->
<!-- markdownlint-disable MD032 -->
<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD036 -->
<!-- markdownlint-disable MD041 -->
<div id="top-of-doc"></div>

# League Vibe | League of Legends Dashboard

[My Github](https://github.com/popados) | [Jump to End](#end-of-doc)

***

## League of Legends Match History & Champion Stats Tracker

A modern web application that provides League of Legends match history, champion statistics, and item data using the official Riot Games API.

Using node/javascript, css, and html.

This site searches for a player and displays their most recent matches. When clicking on a match a more detailed pane shows both teams.

***

## Debug Field

Use the debug object from the champion-stats API response as a health check for your data pipeline.

Call the endpoint

```bash
GET /api/summoner/:region/:gameName/:tagLine/champion-stats
Example:
```

```bash
curl "http://localhost:3001/api/summoner/na1/YourGameName/YourTag/champion-stats"
```
Look at these top-level debug fields first
- `debug.matchedDocuments`: total match docs found in matchDetails for this puuid
- `debug.matchedParticipants`: docs where summoner participant was actually found
- `debug.missingParticipants`: docs where participant lookup failed
Quick rule:

If matchedDocuments > 0 and matchedParticipants = 0, your participant path/data shape is wrong for those docs.
Validate champion ID coverage
- debug.matchesWithChampionId
- debug.matchesMissingChampionId
- debug.matchIdsWithChampionId
- debug.matchIdsMissingChampionId

Quick rule:

If matchesMissingChampionId > 0, inspect those match IDs first.
Drill into per-match records

Each item in debug.matches has:
- matchId
- puuid
- championId
- championName
- hasParticipant
- hasChampionId

Use this to answer:

“Did this match include the summoner?” → hasParticipant
“Was champion resolved?” → hasChampionId
“Which champ was linked?” → championId, championName

Cross-check champion stats consistency

Sum of all games across championStats should match debug.matchedParticipants.

If not, some extracted participant rows are malformed or filtered out.
Fast troubleshooting patterns

missingParticipants > 0 and missingParticipantMatchIds populated:
those docs likely use a different participant layout or corrupted payload

hasParticipant = true but hasChampionId = false:
participant exists but missing championId in saved match detail

matchIdsMissingChampionId empty but UI still says no picks:
frontend rendering/filtering issue, not backend extraction

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A free Riot Games API key

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/popados/league-vibe
   cd league-vibe
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up your Riot API Key**

   ```bash
   # Get your free API key from Riot Developer Portal
   # https://developer.riotgames.com/

   # Copy the example environment file
   cp .env.example .env

   # Edit .env and replace with your actual API key
   # RIOT_API_KEY=RGAPI-your-actual-key-here
   ```

4. **Start the development server**

   ```bash
   npm start
   ```

5. **Open your browser**

   `http://localhost:3001`

***

## 🔑 Riot API Key Setup

### Step 1: Get Your API Key

1. Visit [Riot Developer Portal](https://developer.riotgames.com/)
2. Sign in with your Riot account
3. Create a new project/application
4. Copy your API key

### Step 2: Configure Environment

1. Copy the `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace the placeholder:
   ```env
   RIOT_API_KEY=RGAPI-your-actual-key-here
   ```

### Step 3: Verify Setup

Run the test script to verify your API key works:
```bash
npm test
```

***

## 📋 Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server (same as start)
- `npm test` - Run API endpoint tests

***

## 🏗️ Project Structure

``` fs
league-vibe/
├── server.js          # Express server with Riot API integration
├── src/
│   ├── main.js        # Application entry point
│   └── components/    # UI components
├── styles/            # CSS stylesheets
├── img/               # Static images
├── .env               # Environment variables (create from .env.example)
└── test-api.js        # API testing script
```

***

## 🔧 API Endpoints

- `GET /api/health` - Server health check
- `GET /api/champions` - Get all champions data
- `GET /api/items` - Get all items data
- `GET /api/summoner/:region/:gameName/:tag` - Get summoner info
- `GET /api/summoner/:region/:gameName/:tag/matches` - Get match history
- `POST /api/summoner/:region/:gameName/:tag/matches/save` - Save hosted match history JSON to MongoDB
- `GET /api/summoner/:gameName/:tag/matches/:matchId` - Get match details
- `POST /api/summoner/:gameName/:tag/matches/:matchId/save` - Save match details JSON to MongoDB

### MongoDB Save Route

Set `MONGODB_URI` in your environment before calling the save route. Optional settings: `MONGODB_DB_NAME` and `MONGODB_MATCH_HISTORY_COLLECTION`.

Example request:

```json
POST /api/summoner/na/Doublelift/NA1/matches/save
{
   "count": 10
}
```

The server fetches the same match-history JSON exposed by the GET endpoint and upserts it into MongoDB using the summoner region and PUUID.

***

## 🎮 Features

- **Champion Database**: Complete League of Legends champion information
- **Item Browser**: Filter items by cost, map, and tags
- **Summoner Search**: Look up players by Riot ID (GameName#Tag)
- **Match History**: View recent matches with detailed statistics
- **Responsive Design**: Works on desktop and mobile devices

***

## 📝 Development Notes

### 001 | 3/16/2026 | Monday - Environment Setup Complete

- ✅ Added dotenv support for environment variables
- ✅ Created .env file template
- ✅ Updated README with setup instructions
- ✅ Added API key configuration guide

***

### 002 | 3/16/2026 - Monday | API Endpoint Creation

Finished:
- Added styling
- Match History
- Champs
- Items
- Details(win/loss, KDA, items)
- Summoner Profile
- Search Summoner

TODO:
- Database Ingress [x]
- API Validation [x]
- Schema [x]
- Models [x]
- API POST GET DELETE [x]

***

### 003 | 3/17/2026 - Tuesday | Match History and Map View

Checklist:
- Database connected [x]
- API POST GET methods [x]
- Schema [x]
- Validation
- Count selection for match history [x]
- Check database for duplicates [x]

***

### 004 | 3/22/2026 - Sunday | Styling and Tweaks

Styling:
- Champion Stats [x]
  - Add option for all champions in database
  - Color bars to represent win/loss
- Map View 
  - Position/Team Zone 
- Match History
  - Duration [x]
  - Date [x]
  - Wider card?
  - Select a title

***

### 005 | 3/24/2026 - Tuesday | Heat Map and Styling

TODO:
- Batch save for matches
  - Search all summoners in a game
    - List Matches
    - Save Matches
  - Schema Format
- Aggregate data for heatmap
  - Save timeline data
    - look for death events
      - Map them
- Styling
  - All pages are similar
  - Refactor
- API
  - Refactor
    - Seperate function files
    - API endpoints files
    - Validate

**Constants & helpers**

`MONGODB_TIMELINE_COLLECTION` env var (defaults to matchTimelines)

`getTimelineCollection() `— returns the Mongo collection handle, same pattern as the other getters

`countTotalDeathsInTimeline(matchId?)` — aggregation pipeline that unwinds all frames, counts the events array on each (which only contains `CHAMPION_KILL` events), and sums them. Pass a matchId to scope to one match, or omit for the full collection total.

**POST route —**

```bash
POST /api/summoner/:gameName/:tagLine/matches/:matchId/timeline/save
```
Accepts an optional `{ timeline }` body; if omitted, fetches live from Riot via `fetchInitialFramePlayerPositions`

Upserts the document (keyed on matchId + region) with all frames including events

Returns `totalDeaths` (scoped to that matchId) in every response, including when the save is skipped because the document already exists

***

Batch save data from the server using the match history provided and pulling timeline data??

search every puuid from the match details collection and saves the match history list to the match history collection

***

[Jump to Top](#top-of-doc)

<div id="end-of-doc"></div>

<details>
<summary>
Notes :
</summary>
- Server runs on port 3001 by default
- Static files served from root directory
- CORS enabled for frontend requests
- API key required for summoner/match endpoints
</details>
