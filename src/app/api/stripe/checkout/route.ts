import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createCheckoutSession } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe não configurado. Adicione STRIPE_SECRET_KEY no .env.local' }, { status: 503 });
  }

  try {
    const url = await createCheckoutSession(session.user.id ?? '', session.user.email ?? '');
    if (!url) return NextResponse.json({ error: 'Erro ao criar sessão de checkout.' }, { status: 500 });
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Erro no Stripe.' }, { status: 500 });
  }
}
