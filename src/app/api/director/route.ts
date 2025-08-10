import { NextResponse } from 'next/server';
import { directVideo } from '@/server/director';

export async function POST(req: Request) {
  try {
    const { story, style } = await req.json();
    if (!story || !style) return NextResponse.json({ error: 'story and style are required' }, { status: 400 });
    const scenes = await directVideo(String(story), String(style));
    return NextResponse.json({ success: true, scenes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}



