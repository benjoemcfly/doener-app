/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, setOrderPaymentRef } from '@/lib/payments';

export const runtime = 'nodejs';

function required(name: string, value: string | undefined | null): string {
  if (!value) throw new Error(`Missing ENV ${name}`);
  return value;
}

type PayrexxGateway = {
  id?: number | string;
  link?: string;
};

type PayrexxGatewayResponse = {
  data?: PayrexxGateway[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { orderId?: string };
    const orderId = body.orderId;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'order not found' }, { status: 404 });
    }
    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'already_paid' }, { status: 409 });
    }

    const INSTANCE = required(
      'PAYREXX_INSTANCE',
      process.env.PAYREXX_INSTANCE
    );
    const API_KEY = required('PAYREXX_API_KEY', process.env.PAYREXX_API_KEY);
    const APP_BASE_URL = required('APP_BASE_URL', process.env.APP_BASE_URL);

    const amount = Math.max(1, Math.round(order.total_cents)); // in Rappen/Cent

    const params = new URLSearchParams();
    params.set('amount', String(amount));
    params.set('currency', order.currency || 'CHF');
    params.set('referenceId', order.id);
    params.set('purpose', `Bestellung ${order.id}`);
    params.set(
      'successRedirectUrl',
      `${APP_BASE_URL}/checkout/success?order=${order.id}`
    );
    params.set(
      'failedRedirectUrl',
      `${APP_BASE_URL}/checkout/failed?order=${order.id}`
    );
    params.set(
      'cancelRedirectUrl',
      `${APP_BASE_URL}/checkout/cancel?order=${order.id}`
    );
    // Nur TWINT für den Start
    params.append('paymentMethods[]', 'twint');

    const res = await fetch(
      `https://api.payrexx.com/v1.0/Gateway?instance=${encodeURIComponent(
        INSTANCE
      )}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('Payrexx Gateway error', res.status, text);
      return NextResponse.json({ error: 'gateway_failed' }, { status: 502 });
    }

    const gwResponse = (await res.json()) as PayrexxGatewayResponse;
    const gw = gwResponse.data && gwResponse.data[0];

    const redirectUrl = gw?.link;
    const gatewayId = gw?.id != null ? String(gw.id) : undefined;

    if (!redirectUrl || !gatewayId) {
      console.error('Unexpected Payrexx response', gwResponse);
      return NextResponse.json(
        { error: 'invalid_gateway_response' },
        { status: 502 }
      );
    }

    await setOrderPaymentRef(order.id, gatewayId);

    return NextResponse.json({ redirectUrl });
  } catch (err) {
    console.error('Payrexx session error', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
