/**
 * Utility script to get WhatsApp Group IDs
 * Run this before configuring the bot to find your group ID
 */

import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

console.log('WhatsApp Group ID Finder');
console.log('========================\n');

const { state, saveCreds } = await useMultiFileAuthState('./.baileys_auth');
const { version } = await fetchLatestBaileysVersion();

const sock = makeWASocket({
  version,
  auth: state,
  printQRInTerminal: false,
  logger: pino({ level: 'silent' }),
});

sock.ev.on('connection.update', (update) => {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    console.log('Scan this QR code with WhatsApp:\n');
    qrcode.generate(qr, { small: true });
  }

  if (connection === 'close') {
    const reason = lastDisconnect?.error?.output?.statusCode;
    if (reason === DisconnectReason.loggedOut) {
      console.log('\nLogged out. Delete .baileys_auth and try again.');
      process.exit(1);
    } else {
      console.log('\nConnection closed. Reconnecting...');
    }
  }

  if (connection === 'open') {
    console.log('\n✓ Connected successfully\n');
    listGroups();
  }
});

sock.ev.on('creds.update', saveCreds);

async function listGroups() {
  try {
    const groups = await sock.groupFetchAllParticipating();
    const groupList = Object.values(groups);

    if (groupList.length === 0) {
      console.log('No groups found. Make sure you are a member of at least one group.\n');
    } else {
      console.log(`Found ${groupList.length} group(s):\n`);
      console.log('─'.repeat(60));

      for (const group of groupList) {
        console.log(`\nGroup Name: ${group.subject}`);
        console.log(`Group ID:   ${group.id}`);
        console.log('─'.repeat(60));
      }

      console.log('\nCopy the Group ID of your target group and paste it into your .env file:');
      console.log('GROUP_ID=<paste-group-id-here>\n');
    }
  } catch (error) {
    console.error('Error fetching groups:', error);
  }

  console.log('Press Ctrl+C to exit...');
}
