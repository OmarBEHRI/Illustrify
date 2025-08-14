import { NextRequest, NextResponse } from 'next/server';
import pb from '@/lib/pocketbase';

interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

interface KokoroTTSRequest {
  model: string;
  input: string;
  voice: string;
  response_format: string;
  download_format: string;
  speed: number;
  stream: boolean;
  return_download_link: boolean;
  lang_code: string;
  volume_multiplier: number;
  normalization_options: {
    normalize: boolean;
    unit_normalization: boolean;
    url_normalization: boolean;
    email_normalization: boolean;
    optional_pluralization_normalization: boolean;
    phone_normalization: boolean;
    replace_remaining_symbols: boolean;
  };
}

const KOKORO_TTS_URL = 'http://localhost:8880/v1/audio/speech';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Server-side TTS API called');
    
    // Get auth token from Authorization header
    const authHeader = request.headers.get('Authorization');
    console.log('📋 Auth Header:', authHeader ? authHeader.substring(0, 20) + '...' : 'None');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid Authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('🔑 Extracted token:', token.substring(0, 20) + '...');
    
    // Set the auth token in PocketBase and validate it
    pb.authStore.save(token, null);
    console.log('💾 Token saved to PB auth store');
    
    let user;
    try {
      // Validate the token by making a request to get user data
      console.log('🔍 Validating token by fetching user data...');
      const authData = await pb.collection('users').authRefresh();
      user = authData.record;
      console.log('✅ Token validation successful, user:', user.id);
    } catch (error) {
      console.log('❌ Token validation failed:', error);
      pb.authStore.clear();
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }
    
    if (!user) {
      console.log('❌ No user data after validation');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('✅ Authentication successful for user:', user.id);

    const { text, voice = 'af_heart', speed = 1 }: TTSRequest = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Prepare request for Kokoro TTS API
    const kokoroRequest: KokoroTTSRequest = {
      model: 'kokoro',
      input: text,
      voice: voice,
      response_format: 'mp3',
      download_format: 'mp3',
      speed: speed,
      stream: false,
      return_download_link: false,
      lang_code: 'a', // 'a' for American English based on server error message
      volume_multiplier: 1,
      normalization_options: {
        normalize: true,
        unit_normalization: false,
        url_normalization: true,
        email_normalization: true,
        optional_pluralization_normalization: true,
        phone_normalization: true,
        replace_remaining_symbols: true
      }
    };
    
    console.log('🎯 Sending request to Kokoro TTS:', JSON.stringify(kokoroRequest, null, 2));

    // Call Kokoro TTS API
    console.log('📡 Calling Kokoro TTS API at:', KOKORO_TTS_URL);
    const response = await fetch(KOKORO_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(kokoroRequest),
    });

    console.log('📡 Kokoro TTS API Response Status:', response.status);
    console.log('📡 Kokoro TTS API Response Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error('❌ Kokoro TTS API error:', response.status, response.statusText);
      try {
        const errorText = await response.text();
        console.error('❌ Kokoro TTS API error body:', errorText);
      } catch (e) {
        console.error('❌ Could not read error response body');
      }
      return NextResponse.json(
        { error: 'Failed to generate audio' },
        { status: 500 }
      );
    }

    // Get the audio data
    console.log('🎵 Successfully received audio data from Kokoro TTS');
    const audioBuffer = await response.arrayBuffer();
    console.log('🎵 Audio buffer size:', audioBuffer.byteLength, 'bytes');

    // Return the audio file
    console.log('✅ Returning audio file to client');
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename="generated_audio.mp3"',
      },
    });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}