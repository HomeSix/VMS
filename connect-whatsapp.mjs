import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';

(async () => {
  // Use a folder for auth info (for demo only; in production, see Baileys docs for optimal auth state management)
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();

  // Replace with your WhatsApp phone number (E.164 format, no '+', no spaces)
  const phoneNumber = '601136376608'; 

  const sock = makeWASocket({
    version,
    auth: state,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    // Display the QR in terminal if QR method is required
    if (qr) {
      console.log(await QRCode.toString(qr, { type: 'terminal' }));
    }
    // Try to use the pairing code method as well when possible
    if (connection == 'connecting' || !!qr) {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log('Your WhatsApp Pairing Code:', code);
      } catch (e) {
        console.error('Failed to get pairing code:', e?.message || e);
      }
    }
    // Handle disconnects properly (forcibly disconnected after QR scan is normal)
    if (connection === 'close' && (lastDisconnect?.error)?.output?.statusCode === DisconnectReason.restartRequired) {
      console.log('Restart required, socket is now useless. Restarting logic needed.');
      // Optionally implement reconnection logic here
    }
  });

  // Save credentials upon update
  sock.ev.on('creds.update', saveCreds);
})();
