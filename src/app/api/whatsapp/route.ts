import { NextRequest, NextResponse } from 'next/server';
import { makeWASocket, useMultiFileAuthState } from 'baileys';
let sockInstance: any = null;
let sockReady: Promise<any> | null = null;
let sockStatus: 'open' | 'connecting' | 'closed' = 'closed';

async function getWhatsAppSocket() {
    if (sockInstance && sockStatus === 'open') return sockInstance;
    if (sockReady) return sockReady;
    sockReady = (async () => {
        const { state, saveCreds } = await useMultiFileAuthState('baileys-auth-info');
        const sock = makeWASocket({ auth: state });
        sockStatus = 'connecting';
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', ({ qr, connection }) => {
            if (qr) console.log('Scan this QR in WhatsApp:', qr);
            if (connection === 'open') {
                sockStatus = 'open';
                console.log('WhatsApp Connected!');
            }
            if (connection === 'close') {
                sockStatus = 'closed';
                sockInstance = null;
                sockReady = null;
                console.log('WhatsApp connection closed.');
            }
        });
        // Wait for connection to be open
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout waiting for WhatsApp connection')), 15000);
            sock.ev.on('connection.update', ({ connection }) => {
                if (connection === 'open') {
                    clearTimeout(timeout);
                    resolve(true);
                }
                if (connection === 'close') {
                    clearTimeout(timeout);
                    reject(new Error('WhatsApp connection closed during init'));
                }
            });
        });
        sockInstance = sock;
        return sock;
    })();
    return sockReady;
}

export async function POST(req: NextRequest) {
    try {
        const { phone, message } = await req.json() as { phone?: string; message?: string };
        if (!phone || !message) {
            return NextResponse.json({ success: false, error: 'Phone and message required.' }, { status: 400 });
        }
        let sock;
        try {
            sock = await getWhatsAppSocket();
        } catch (err: any) {
            return NextResponse.json({ success: false, error: 'WhatsApp socket not connected: ' + err.message }, { status: 500 });
        }
        if (!sock || sockStatus !== 'open') {
            return NextResponse.json({ success: false, error: 'WhatsApp socket not connected.' }, { status: 500 });
        }
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