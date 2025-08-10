import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/db';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json(null, { status: 200 });
  return NextResponse.json({ id: user.id, email: user.email, name: user.name, credits: user.credits });
}



