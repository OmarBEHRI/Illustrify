import { NextResponse } from 'next/server';
import { pbHelpers } from '@/lib/pocketbase';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  
  try {
    const user = await pbHelpers.signIn(String(email).toLowerCase(), String(password));
    return NextResponse.json({ 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      credits: user.credits 
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
}


