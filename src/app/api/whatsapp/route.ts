import { NextRequest, NextResponse } from 'next/server';
import { makeWASocket, useMultiFileAuthState } from 'baileys';

let sockInstance: any = null;
let sockReady: Promise<any> | null = null;
let sockStatus: 'open' | 'connecting' | 'closed' = 'closed';
let connectingPromise: Promise<any> | null = null;

async function waitForWhatsAppConnected(sock: any, timeout = 30000) {
    if (sock?.user) return; // already connected and authenticated!
    if (!connectingPromise) {
        connectingPromise = new Promise<void>((resolve, reject) => {
            let done = false;
            sock.ev.on('connection.update', (u: any) => {
                if (done) return;
                if (u.connection === 'open') {
                    done = true; resolve();
                }
                if (u.connection === 'close') {
                    done = true; reject(new Error('WhatsApp connection closed'));
                }
            });
            setTimeout(() => {
                if (done) return;
                done = true;
                reject(new Error('Timeout waiting for WhatsApp connection'));
            }, timeout);
        });
    }
    return connectingPromise;
}

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
                connectingPromise = null;
                console.log('WhatsApp connection closed.');
            }
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
            await waitForWhatsAppConnected(sock, 30000);
        } catch (err: any) {
            return NextResponse.json({
                success: false,
                error: 'WhatsApp socket not connected: ' + err.message +
                    ' - If this is your first time, please scan the QR code in the backend terminal by making any WhatsApp API request, or run `node whatsapp-qr.mjs` and scan using WhatsApp App.'
            }, { status: 500 });
        }
        if (!sock || sockStatus !== 'open') {
            return NextResponse.json({
                success: false,
                error: 'WhatsApp socket not connected. If this is your first time, please scan the QR code in the backend terminal by making any WhatsApp API request, or run `node whatsapp-qr.mjs` and scan using WhatsApp App.'
            }, { status: 500 });
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