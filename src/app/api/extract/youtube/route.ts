import { NextResponse } from 'next/server';

// Simple placeholder: extract title/id and fake a transcript prompt.
export async function POST(req: Request) {
  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: 'No url' }, { status: 400 });
  const text = `Story adapted from YouTube video at ${url}. Summarized narrative version for video generation.`;
  return NextResponse.json({ text });
}


