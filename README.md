
<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD036 -->
<!-- markdownlint-disable MD041 -->
<div id="top-of-doc"></div>

# League Vibe | League of Legends Dashboard

[My Github](https://github.com/popados) | [Jump to End](#end-of-doc)

***
## League of Legends Match History & Champion Stats Tracker

A modern web application that provides League of Legends match history, champion statistics, and item data using the official Riot Games API.

***

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- A free Riot Games API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
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
   ```
   http://localhost:3000
   ```

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

```
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

***

## 🎮 Features

- **Champion Database**: Complete League of Legends champion information
- **Item Browser**: Filter items by cost, map, and tags
- **Summoner Search**: Look up players by Riot ID (GameName#Tag)
- **Match History**: View recent matches with detailed statistics
- **Responsive Design**: Works on desktop and mobile devices

***

## 📝 Development Notes

### DayNum | 3/16/2026 - Environment Setup Complete

- ✅ Added dotenv support for environment variables
- ✅ Created .env file template
- ✅ Updated README with setup instructions
- ✅ Added API key configuration guide

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
  
