import { NextResponse } from 'next/server';
import { signUp } from '@/server/auth';

export async function POST(req: Request) {
  const { email, name, password } = await req.json();
  if (!email || !name || !password) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try {
    const user = await signUp(String(email).toLowerCase(), String(name), String(password));
    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 400 });
  }
}


