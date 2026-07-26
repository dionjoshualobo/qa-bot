# QA Bot for WhatsApp

Anonymous Q&A bot for WhatsApp groups. Members DM the bot with questions, questions get posted anonymously to the group, replies are forwarded back.

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/dionjoshualobo/qa-bot.git
cd qa-bot
npm install
```

### 2. Find your Group ID

```bash
npm run get-group-id
```

Scan the QR code with WhatsApp. The script lists all your groups with their IDs. Copy the one you need.

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
GROUP_ID=120363429246773855@g.us   # paste your group ID here
SESSION_PATH=./.baileys_auth
DATABASE_PATH=./qa-bot.db
LOG_LEVEL=info
```

### 4. Run

```bash
npm run dev
```

On first run, scan the QR code. The bot will be the account from which the QR code was scanned. After that, session persists in `.baileys_auth/`.

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show usage instructions |
| `/q <question>` or `/question <question>` | Post a question anonymously to the group |
| `/exit` | Stop receiving replies in DM |

## How It Works

1. Someone DMs bot: `/q What time is the meeting?`
2. Bot posts anonymously to group:
   ```
   ━━━━━━━━━━━━━━━━━━
   ❓ Anonymous Question
   ID: Q1
   What time is the meeting?
   Reply to THIS message to answer.
   ━━━━━━━━━━━━━━━━━━
   ```
3. Someone replies in group → bot DMs the reply to the asker
4. Asker replies to that DM → bot posts to group
5. Repeat

## Reply Threading

```
Q1 (question)
├── Q1.1 (first reply)
│   ├── Q1.1.1 (reply to reply)
│   └── Q1.1.2
└── Q1.2
    └── Q1.2.1
```

## Deployment

Single Node.js process. No microservices needed.

- **VPS** (Hetzner, DigitalOcean): run with PM2
- **Docker**: containerize and deploy
- **Railway/Fly.io**: works if no scale-to-zero

**Don't use**: Lambda, Cloud Run, Vercel — serverless kills the WhatsApp WebSocket.

## Project Structure

```
src/
├── index.ts                  # Entry point
├── config/                   # Env var loading
├── bot/
│   ├── client.ts             # Baileys socket setup
│   ├── events.ts             # Message routing
│   ├── sessions.ts           # Active session tracking
│   └── handlers/
│       ├── private.ts        # DM handler (/q, /help, /exit)
│       └── group.ts          # Group reply handler
├── database/
│   ├── database.ts           # SQLite init
│   ├── schema.ts             # Table definitions
│   └── queries/              # DB queries
├── services/                 # Business logic
├── types/                    # TypeScript types
├── utils/                    # Logger
└── constants/                # Message templates
```

## Scripts

```bash
npm run dev           # Start in development mode
npm run build         # Compile TypeScript
npm start             # Start compiled version
npm run type-check    # Check types without building
npm run clean         # Remove build artifacts
npm run get-group-id  # List your WhatsApp groups
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GROUP_ID` | WhatsApp group ID (`@g.us`) | Yes |
| `SESSION_PATH` | Auth session storage | No |
| `DATABASE_PATH` | SQLite database path | No |
| `LOG_LEVEL` | debug/info/warn/error | No |

## Troubleshooting

**QR code not appearing**
- Delete `.baileys_auth/` and restart

**Bot not responding in group**
- Check `GROUP_ID` is correct
- Bot must be a member of the group

**Database errors**
- Check write permissions
- Verify disk space

## License

ISC
