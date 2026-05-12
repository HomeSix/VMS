console.log('Script started...');

import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, initAuthCreds } from 'baileys';
import QRCode from 'qrcode';
import fs from 'fs';

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys-auth-info');
  // Migrate old creds if needed (Baileys v7+ LID system)
  if (!state.creds.lid) {
    Object.assign(state.creds, { ...initAuthCreds(true), ...state.creds });
    await fs.promises.writeFile('baileys-auth-info/creds.json', JSON.stringify(state.creds, null, 2));
  }
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async ({ qr, connection }) => {
    if (qr) {
      console.clear();
      console.log("Scan this QR code with WhatsApp (Linked Devices > Link Device):");
      console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
    }
    if (connection === 'open') {
      console.log('\u2705 WhatsApp Connected!');
      process.exit(0);
    }
    if (connection === 'close') {
      console.log('\u274c Connection closed. You may need to retry.');
      process.exit(1);
    }
  });
}
main();
