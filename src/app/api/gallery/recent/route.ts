import { NextResponse } from 'next/server';
import { pbHelpers } from '@/lib/pocketbase';

export async function GET() {
  try {
    const videos = await pbHelpers.getAllVideos();
    return NextResponse.json({ videos: videos.slice(0, 12) });
  } catch (error: any) {
    console.error('Gallery API error:', error);
    return NextResponse.json({ videos: [] });
  }
}



