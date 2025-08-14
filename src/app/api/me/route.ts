import { NextResponse } from 'next/server';
import pb from '@/lib/pocketbase';

export async function GET(req: Request) {
  try {
    // Get auth token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(null, { status: 200 });
    }

    const token = authHeader.substring(7);
    
    // Set the auth token in PocketBase
    pb.authStore.save(token, null);
    
    // Try to get current user
    if (pb.authStore.isValid) {
      const user = pb.authStore.model;
      if (user) {
        return NextResponse.json({ 
          id: user.id, 
          email: user.email, 
          name: user.name, 
          credits: user.credits 
        });
      }
    }
    
    return NextResponse.json(null, { status: 200 });
  } catch (error) {
    return NextResponse.json(null, { status: 200 });
  }
}



