/**
 * Utility script to get WhatsApp Group IDs
 * Run this before configuring the bot to find your group ID
 */

import wwebjs from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

const { Client, LocalAuth } = wwebjs;

console.log('WhatsApp Group ID Finder');
console.log('========================\n');

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: './.wwebjs_auth',
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('Scan this QR code with WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('\n✓ Authenticated successfully\n');
});

client.on('ready', async () => {
  console.log('✓ Client is ready\n');
  console.log('Fetching your groups...\n');

  try {
    const chats = await client.getChats();
    const groups = chats.filter((chat) => chat.isGroup);

    if (groups.length === 0) {
      console.log('No groups found. Make sure you are a member of at least one group.\n');
    } else {
      console.log(`Found ${groups.length} group(s):\n`);
      console.log('─'.repeat(80));

      for (const group of groups) {
        console.log(`\nGroup Name: ${group.name}`);
        console.log(`Group ID:   ${group.id._serialized}`);
        console.log('─'.repeat(80));
      }

      console.log('\nCopy the Group ID of your target group and paste it into your .env file:');
      console.log('GROUP_ID=<paste-group-id-here>\n');
    }
  } catch (error) {
    console.error('Error fetching groups:', error);
  }

  console.log('Press Ctrl+C to exit...');
});

client.on('auth_failure', (error) => {
  console.error('Authentication failed:', error);
  process.exit(1);
});

client.initialize();
