import { NextResponse } from 'next/server';
import { addCredits, getCurrentUser } from '@/server/db';

export async function POST(req: Request) {
  const formData = await req.formData();
  const amountRaw = formData.get('amount');
  const amount = Number(amountRaw ?? 0);
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await addCredits(user.id, isFinite(amount) ? amount : 0);
  return NextResponse.redirect(new URL('/profile', req.url));
}


