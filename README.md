# QA Bot for WhatsApp

A production-ready WhatsApp bot that enables anonymous Q&A in community groups. Members can privately message the bot with questions, which are then posted anonymously to the group. Replies are forwarded back to the original asker while maintaining anonymity.

## Features

- **Anonymous Questions**: Users send questions privately to the bot
- **Group Integration**: Questions are posted to a designated WhatsApp group
- **Reply Threading**: Hierarchical reply system with IDs (Q1, Q1.1, Q1.2.1, etc.)
- **Privacy**: Original asker's identity is never revealed to the group
- **Persistent Storage**: SQLite database with migration path to PostgreSQL
- **Type-Safe**: Built with strict TypeScript
- **Modular Architecture**: Clean separation of concerns for easy maintenance

## Architecture

```
src/
├── index.ts              # Main entry point
├── config/               # Configuration management
├── bot/
│   ├── client.ts         # WhatsApp client wrapper
│   ├── events.ts         # Event handler registration
│   └── handlers/
│       ├── private.ts    # Private message handler
│       └── group.ts      # Group message handler
├── database/
│   ├── database.ts       # Database initialization
│   ├── schema.ts         # Table schemas
│   └── queries/          # Database queries
│       ├── users.ts
│       ├── questions.ts
│       ├── replies.ts
│       └── mappings.ts
├── services/             # Business logic
│   ├── users.ts
│   ├── questions.ts
│   ├── replies.ts
│   └── mapping.ts
├── types/                # TypeScript type definitions
├── utils/                # Utility functions (logging)
└── constants/            # Message templates and constants
```

## Database Schema

### Users
Stores WhatsApp user IDs.

### Questions
- `question_id`: Public ID (Q1, Q2, etc.)
- `author_whatsapp_id`: Original asker
- `text`: Question content
- `group_message_id`: WhatsApp message ID in group
- `created_at`: Timestamp

### Replies
- `reply_id`: Hierarchical ID (Q1.1, Q1.2.1, etc.)
- `question_id`: Reference to question
- `parent_reply_id`: Reference to parent reply (null for direct replies)
- `group_message_id`: WhatsApp message ID in group
- `author_whatsapp_id`: Reply author
- `text`: Reply content
- `created_at`: Timestamp

### Message Mappings
Maps WhatsApp message IDs to internal question/reply IDs for resolving threads.

## Prerequisites

- Node.js 24 or higher
- npm
- WhatsApp account

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd qa-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration:
```bash
cp .env.example .env
```

4. Edit `.env` and configure:
```env
# Required: WhatsApp Group ID
GROUP_ID=<your-group-id>@g.us

# Optional: Customize paths
SESSION_PATH=./.wwebjs_auth
DATABASE_PATH=./qa-bot.db
LOG_LEVEL=info
```

### Finding Your Group ID

**Easy Method (Recommended):**

1. Run the group ID finder script:
```bash
npm run get-group-id
```

2. Scan the QR code with WhatsApp
3. The script will list all your groups with their IDs
4. Copy the desired Group ID to your `.env` file

**Manual Method:**

1. Temporarily set `GROUP_ID=dummy` in `.env`
2. Start the bot: `npm run dev`
3. Send a message in your target group
4. Check the logs for the group ID format: `<country_code><phone_number>-<timestamp>@g.us`
5. Copy this ID to your `.env` file and restart

## Usage

### Development Mode

```bash
npm run dev
```

On first run, a QR code will be displayed. Scan it with WhatsApp to authenticate.

### Production Mode

1. Build the project:
```bash
npm run build
```

2. Start the bot:
```bash
npm start
```

### Type Checking

```bash
npm run type-check
```

### Clean Build Artifacts

```bash
npm run clean
```

## How It Works

### Asking a Question

1. User sends a private message to the bot
2. Bot posts the question anonymously to the group with format:
```
━━━━━━━━━━━━━━━━━━
❓ Anonymous Question
ID: Q18
How do I deploy on Railway?
Reply to THIS message to answer.
━━━━━━━━━━━━━━━━━━
```
3. User receives confirmation with question ID

### Replying to Questions

1. Group member replies to the bot's message
2. Bot creates a reply record with hierarchical ID
3. Reply is forwarded to the original asker:
```
Anonymous reply to Q18
Q18.1 - Alice:
You can use Railway's CLI.
```

### Reply Threading

- Direct replies to questions: `Q1.1`, `Q1.2`, etc.
- Replies to replies: `Q1.1.1`, `Q1.1.2`, etc.
- Unlimited nesting depth

## Configuration

All configuration is managed through environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GROUP_ID` | WhatsApp group ID | - | Yes |
| `SESSION_PATH` | WhatsApp session storage | `./.wwebjs_auth` | No |
| `DATABASE_PATH` | SQLite database path | `./qa-bot.db` | No |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` | No |

## Logging

The bot uses structured logging with module prefixes:

- `[DB]` - Database operations
- `[WA]` - WhatsApp client events
- `[QUESTION]` - Question handling
- `[REPLY]` - Reply handling
- `[MAPPING]` - Message mapping resolution
- `[BOT]` - General bot operations

## Error Handling

- All operations return typed `Result<T, E>` for explicit error handling
- Errors are logged with context
- Users receive friendly error messages
- Bot continues running after errors

## Future Enhancements

The architecture supports these planned features:

- Moderator approval workflow
- Question editing and deletion
- Mark questions as solved
- Thread export functionality
- Web dashboard
- Statistics and analytics
- Custom commands
- Rate limiting
- User bans
- Admin roles

## Database Migration

To migrate from SQLite to PostgreSQL:

1. Update database queries to use a PostgreSQL client
2. Modify schema to use PostgreSQL-specific features
3. Update connection logic in `src/database/database.ts`
4. The query interface remains the same

## Development Guidelines

- **Type Safety**: Use strict TypeScript, no `any` types
- **Modularity**: Keep files focused and under ~50 lines per function
- **Error Handling**: Use `Result<T, E>` pattern, avoid try/catch everywhere
- **Logging**: Use appropriate log levels and module prefixes
- **Testing**: Write tests for business logic (not yet implemented)

## Troubleshooting

### QR Code Not Appearing
- Ensure no other WhatsApp Web sessions are active
- Delete `.wwebjs_auth` directory and restart

### Bot Not Responding
- Check `GROUP_ID` is correct
- Verify bot has been added to the group
- Check logs for errors

### Database Errors
- Ensure write permissions for database path
- Check disk space
- Verify SQLite is installed

## License

ISC

## Contributing

Contributions are welcome! Please follow the existing code style and architecture patterns.
