# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An anonymous Q&A bot for WhatsApp groups, written in TypeScript. Group members DM the bot a question; the bot posts it anonymously to the group; group members reply by quoting the bot's message, and the bot threads those replies back to the asker in DM (and the asker can reply again, continuing the thread). It connects to WhatsApp via [Baileys](https://github.com/WhiskeySockets/Baileys) (a WhatsApp Web client) and persists to SQLite via `better-sqlite3`.

## Commands

The scripts in `package.json` are the full toolchain:

```bash
npm run dev            # run in development mode (tsx, watches/compiles on the fly)
npm run build          # compile TypeScript to dist/ (tsc)
npm run type-check     # typecheck without emitting (tsc --noEmit) — what CI runs
npm start              # run the compiled build (node dist/index.js)
npm run clean          # remove dist/
npm run format         # format all files with Prettier
npm run format:check   # check formatting without modifying
npm run test           # run tests (vitest)
npm run test:watch     # run tests in watch mode
npm run get-group-id   # scan QR and list your WhatsApp groups' IDs (for setup)
```

The bot is interactive (logs a WhatsApp QR code to pair the account on first run) and must hold a live WebSocket connection to WhatsApp, so it cannot be meaningfully exercised headlessly. Type-checking, formatting, and building are the practical verification loop.

## Architecture

The entry point is `src/index.ts`: load config → init SQLite → `startClient` (Baileys socket) → `registerEventHandlers`. `src/bot/client.ts` owns the socket singleton, QR pairing, and auto-reconnect (it exits on logout). `src/bot/events.ts` routes incoming messages: group JIDs (`@g.us`) → `handlers/group.ts`, everything else (DMs) → `handlers/private.ts`. Only the configured `GROUP_ID` group is processed.

**Data flow / threading is the core to understand.** The bot only acts on _replies_ (messages that quote a previous message) plus DM commands. To resolve "this quoted message belongs to which question/reply thread," every message the bot posts is recorded in the `message_mappings` table: a row maps a `whatsapp_message_id` (the actual WhatsApp msg id) to exactly one internal `question_id` OR `reply_id` (enforced by a CHECK constraint). When a message arrives, `services/mapping.ts` `resolveMessageMapping` looks up the quoted message id to find the question (and the reply it was answering, if any), then a new reply is inserted with `parent_reply_id` pointing at the quoted reply to build the thread tree. Question and reply ids follow the pattern `Q1`, `Q1.1`, `Q1.1.1` (`QUESTION_ID_PREFIX` / `REPLY_ID_SEPARATOR` in `src/constants/messages.ts`).

- **DM → group (asking):** `/q <text>` posts a template question to the group, creates the DB row, and stores a mapping for the posted message so any group reply to it resolves back.
- **Group → DM (replying):** a quoted reply to a tracked message is stored, forwarded to the asker, and a mapping is created for the forwarded DM so the asker can reply to _that_ and continue the thread.
- **DM → group (answering):** the asker replies to the forwarded DM; it resolves through the mapping and is posted back to the group (quoted against the original group message) with its own mapping.

The private handler also handles the DM commands `/help`, `/repo`, `/q|/question`, and `/exit` (with optional exit message). The group handler additionally supports `/repo`.

**Sessions** (`src/bot/sessions.ts`) are an in-memory `Set<string>` of active asker JIDs — not persisted. A session starts when someone asks a question and ends on `/exit`. Whether a group reply is forwarded to the asker is gated on that asker's session still being active. Because it's in-memory, sessions reset on restart.

**DB layer** (`src/database/`) exposes a single shared `better-sqlite3` handle via `getDatabase()`; schema lives in `src/database/schema.ts` (tables: `users`, `questions`, `question_counters`, `replies`, `message_mappings`). `queries/` holds raw SQL per domain; `services/` holds business logic on top. WAL mode and foreign keys are enabled at init.

## Conventions

- **Result, not exceptions.** The data layer returns `Result<T, E>` (`{ success, data }` | `{ success: false, error }`) from `src/types/result.ts` (helpers `ok`/`err`, plus `unwrap`/`unwrapOr`). Callers check `.success` rather than throwing. Match this pattern for new DB/service functions.
- **Module system:** ESM with `module: nodenext`; relative imports must end in `.js` (e.g. `import { x } from '../types/index.js'`), not `.ts`. Source is compiled from `src/` to `dist/`.
- **Strict TS** is on, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (so `undefined` is not assignable to optional fields).
- **Message strings** are centralized in `src/constants/messages.ts` (`MESSAGES` + id-prefix constants) — put user-facing text there, not inline in handlers.
- Baileys types are loose; handlers receive `message: any` and inspect fields like `message.conversation`, `message.extendedTextMessage.text`, `message.imageMessage.caption`, and `contextInfo.stanzaId` for the quoted message id. `pushName` is the fallback sender name.
