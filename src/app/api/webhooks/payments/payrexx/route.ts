// src/app/api/webhooks/payments/payrexx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { markOrderFailed, markOrderPaid } from '@/lib/payments';

export const runtime = 'nodejs';

// Optional: Wenn du später eine HMAC-Signatur prüfen willst, kannst du hier
// PAYREXX_WEBHOOK_SECRET o.ä. verwenden.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Beispielhafte Struktur, Payrexx kann leicht variieren:
    // {
    //   "event": "transaction.succeeded",
    //   "data": {
    //      "id": 123,
    //      "referenceId": "ORDER123",
    //      "status": "confirmed"
    //   }
    // }
    const event = body?.event as string | undefined;
    const data = body?.data ?? body?.transaction ?? body?.gateway ?? {};

    const referenceId: string | undefined = data.referenceId || data.reference_id;
    const transactionId: string | undefined = data.id
      ? String(data.id)
      : undefined;
    const status: string | undefined = data.status;

    if (!referenceId) {
      // Kein Bezug zu einer Order – nichts zu tun
      return NextResponse.json({ ok: true });
    }

    // Hier könntest du optional eine Signatur prüfen:
    // const signature = req.headers.get('x-signature') ...
    // verifySignature(signature, rawBody, process.env.PAYREXX_WEBHOOK_SECRET)

    const success =
      (event && event.includes('succeeded')) ||
      status === 'confirmed' ||
      status === 'authorized';

    if (success) {
      await markOrderPaid(referenceId, transactionId || 'payrexx');
    } else if (status === 'error' || event?.includes('failed')) {
      await markOrderFailed(referenceId, transactionId || null);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Payrexx webhook error', err);
    // 200 zurückgeben, damit Payrexx nicht endlos spammt; deine Logik muss idempotent sein.
    return NextResponse.json({ ok: true });
  }
}
