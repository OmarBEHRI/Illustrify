import { NextResponse } from 'next/server';
import { pbHelpers } from '@/lib/pocketbase';

export async function POST(req: Request) {
  const { email, name, password } = await req.json();
  if (!email || !name || !password) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  
  try {
    const user = await pbHelpers.signUp(String(email).toLowerCase(), String(name), String(password));
    return NextResponse.json({ 
      id: user.id, 
      email: user.email, 
      name: user.name,
      credits: user.credits 
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 400 });
  }
}


