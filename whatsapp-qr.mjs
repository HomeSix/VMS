
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, initAuthCreds, DisconnectReason } from '@whiskeysockets/baileys';
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
  const phoneNumber = "601136376608"; // replace with your WhatsApp number (E.164, no +, no spaces)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (connection == "connecting" || !!qr) {
      try {
        const pairingCode = await sock.requestPairingCode(phoneNumber);
        console.log("Your WhatsApp Pairing Code:", pairingCode);
        // Enter this code into WhatsApp to pair
      } catch (e) {
        console.error("Failed to get pairing code:", e);
      }
    }
    if (connection === 'close') {
      if ((lastDisconnect?.error)?.output?.statusCode === DisconnectReason.restartRequired) {
        // Optionally restart logic here
        console.log('Restart required.');
      } else {
        console.log('\u274c Connection closed. You may need to retry.');
        process.exit(1);
      }
    }
    if (connection === 'open') {
      console.log('\u2705 WhatsApp Connected!');
      process.exit(0);
    }
  });
  sock.ev.on("creds.update", saveCreds);
}
main();
