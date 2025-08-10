import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // Basic redirect from bare /signin to keep things tidy if needed in future
  return NextResponse.next();
}

export const config = {
  matcher: ['/generate', '/gallery', '/profile']
};


