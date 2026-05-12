import { NextRequest, NextResponse } from 'next/server';
import { makeWASocket, useMultiFileAuthState } from 'baileys';
let sockInstance: any = null;
async function initWhatsApp() {
    if (sockInstance) return sockInstance;
    const { state, saveCreds } = await useMultiFileAuthState('baileys-auth-info');
    const sock = makeWASocket({ auth: state });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', ({ qr, connection }) => {
        if (qr) console.log('Scan this QR in WhatsApp:', qr);
        if (connection === 'open') console.log('WhatsApp Connected!');
    });
    sockInstance = sock;
    return sock;
}
export async function POST(req: NextRequest) {
    try {
        const { phone, message } = await req.json() as { phone?: string; message?: string };
        if (!phone || !message) {
            return NextResponse.json({ success: false, error: 'Phone and message required.' }, { status: 400 });
        }
        const sock = await initWhatsApp();
        const jidResult = await sock.onWhatsApp(`${phone}@s.whatsapp.net`);
        if (!jidResult[0]?.exists) {
            return NextResponse.json({ success: false, error: 'Phone number is not on WhatsApp or invalid.' }, { status: 400 });
        }
        await sock.sendMessage(jidResult[0].jid, { text: message });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}