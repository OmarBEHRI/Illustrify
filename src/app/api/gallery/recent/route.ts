import { NextResponse } from 'next/server';
import { getAllVideos } from '@/server/db';

export async function GET() {
  const videos = await getAllVideos();
  return NextResponse.json({ videos: videos.slice(0, 12) });
}



