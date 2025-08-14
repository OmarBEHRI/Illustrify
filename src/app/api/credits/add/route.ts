import { NextResponse } from 'next/server';
import pb, { pbHelpers } from '@/lib/pocketbase';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const amountRaw = formData.get('amount');
    const amount = Number(amountRaw ?? 0);
    
    // Get auth token from cookie or header
    const authHeader = req.headers.get('Authorization');
    const cookieHeader = req.headers.get('Cookie');
    
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (cookieHeader) {
      // Extract PocketBase auth token from cookies
      const match = cookieHeader.match(/pb_auth=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Set auth token
    pb.authStore.save(token, null);
    
    if (!pb.authStore.isValid || !pb.authStore.model) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = pb.authStore.model;
    await pbHelpers.addCredits(user.id, isFinite(amount) ? amount : 0, `Added ${amount} credits`);
    
    return NextResponse.redirect(new URL('/profile', req.url));
  } catch (error: any) {
    console.error('Credits add error:', error);
    return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
  }
}


