import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Since we're using client-side auth with PocketBase, 
  // we just need to redirect back to the profile page
  // The actual sign out will be handled on the client side
  return NextResponse.redirect(new URL('/profile', req.url));
}