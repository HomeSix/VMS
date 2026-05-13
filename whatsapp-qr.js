console.log('Script started...');

const { makeWASocket, useMultiFileAuthState } = require('baileys');
const QRCode = require('qrcode');

// Make sure to have Node.js >= 17
async function main() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys-auth-info');
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async ({ qr, connection }) => {
    if (qr) {
      // Print QR as ASCII
      console.clear();
      console.log("Scan this QR code with WhatsApp (Linked Devices > Link Device):");
      console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
    }
    if (connection === 'open') {
      console.log('✅ WhatsApp Connected!');
      process.exit(0);
    }
    if (connection === 'close') {
      console.log('❌ Connection closed. You may need to retry.');
      process.exit(1);
    }
  });
}
main();