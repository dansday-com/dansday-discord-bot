# Goblox Bot System

A Discord bot system that separates self-bot monitoring from official bot forwarding for better security and maintainability.

## Architecture

### Self-Bot (`self-bot/`)
- **Purpose**: Monitors source Discord servers for new messages
- **Technology**: `discord.js-selfbot-v13`
- **Functionality**: 
  - Listens to configured source channels
  - Processes messages and sends data to official bot
  - Handles historical message fetching

### Official Bot (`official-bot/`)
- **Purpose**: Forwards messages to target channels and welcomes new users
- **Technology**: `discord.js` (official bot)
- **Functionality**:
  - Receives message data from self-bot
  - Forwards messages to target channels with role mentions
  - Welcomes new users with random messages

## Project Structure

```
goblox-bot/
├── main.js                 # Launcher script
├── package.json           # Root package.json
├── shared-config.js       # Shared configuration
├── logger.js              # Shared logger utility
├── utils.js               # Shared utilities
├── self-bot/
│   ├── main.js           # Self-bot entry point
│   ├── package.json      # Self-bot dependencies
│   └── components/
│       └── forwarder.js  # Message monitoring component
└── official-bot/
    ├── main.js           # Official bot entry point
    ├── package.json      # Official bot dependencies
    └── components/
        ├── forwarder.js  # Message forwarding component
        └── welcomer.js   # User welcoming component
```

## Setup

1. **Install dependencies**:
   ```bash
   npm run install:all
   ```

2. **Configure tokens**:
   - Edit `shared-config.js`
   - Set `SELF_BOT_TOKEN` (your self-bot token)
   - Set `OFFICIAL_BOT_TOKEN` (your official bot token)

3. **Configure communication**:
   - Set `COMMUNICATION.WEBHOOK_URL` in `shared-config.js` to your website endpoint

## Usage

### Start both bots:
```bash
npm start
```

### Start individual bots:
```bash
npm run start:selfbot    # Self-bot only
npm run start:official   # Official bot only
```

### Development mode (with auto-restart):
```bash
npm run dev
```

## Communication Method

### Webhook Communication
- Self-bot sends message data via HTTP POST to your website (`goblox.dansday.com/api/webhook`)
- Official bot runs a webhook server to receive the data
- Real-time communication for instant message forwarding
- Configured in `shared-config.js` with `COMMUNICATION.WEBHOOK_URL`

## Configuration

All configuration is centralized in `shared-config.js`:

- **Source Channels**: Configure which channels to monitor
- **Target Channels**: Configure where to forward messages
- **Role Mentions**: Configure role mentions for each group
- **Welcome Messages**: Configure welcome message templates
- **Excluded Users**: Configure users to exclude from forwarding

## Security Benefits

1. **Separation of Concerns**: Self-bot only monitors, official bot only forwards
2. **Token Isolation**: Self-bot and official bot use different tokens
3. **Reduced Risk**: Official bot doesn't need access to source servers
4. **Better Logging**: Clear separation of monitoring vs forwarding logs

## Components

Each feature is organized as a component for easy maintenance:

- **Forwarder Component**: Handles message processing and forwarding
- **Welcomer Component**: Handles new user welcoming
- **Logger Component**: Centralized logging system

## Troubleshooting

1. **Self-bot not receiving messages**: Check source channel IDs and permissions
2. **Official bot not forwarding**: Check target channel IDs and bot permissions
3. **Communication issues**: Verify webhook URL or shared storage path
4. **Token issues**: Ensure tokens are valid and have proper permissions
