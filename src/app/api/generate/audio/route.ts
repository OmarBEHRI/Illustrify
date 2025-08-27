import { NextResponse } from 'next/server';
import { saveBufferToPublic } from '@/server/storage';
import { pbHelpers } from '@/lib/pocketbase';
import pb from '@/lib/pocketbase';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    // Get user authentication
    const cookieStore = cookies();
    const authCookie = cookieStore.get('pb_auth');
    
    if (!authCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Set auth in PocketBase
    pb.authStore.loadFromCookie(authCookie.value);
    const user = pb.authStore.model;
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the most common public sample voice unless overridden
    const { text, voiceId = '21m00Tcm4TlvDq8ikWAM', modelId = 'eleven_multilingual_v2' } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || process.env.ELEVENLABS_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 });
    }

    // Use non-streaming endpoint for reliability; return full MP3
    const outputFormat = 'mp3_44100_128';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      let details: any = null;
      try { details = await res.json(); } catch { try { details = await res.text(); } catch { details = null; } }
      return NextResponse.json({ error: 'TTS failed', details }, { status: res.status });
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const saved = await saveBufferToPublic(buffer, 'audio', 'mp3');
    
    // Save to PocketBase audio collection
    try {
      await pbHelpers.saveAudio(user.id, text, saved.filename, voiceId);
    } catch (pbError) {
      console.error('Failed to save audio to PocketBase:', pbError);
      // Continue anyway, don't fail the request
    }
    
    return NextResponse.json({ success: true, url: saved.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}


