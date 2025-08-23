import { NextResponse } from 'next/server';
import { saveBufferToPublic } from '@/server/storage';
import { pbHelpers } from '@/lib/pocketbase';
import { cookies } from 'next/headers';
import pb from '@/lib/pocketbase';

// Ensure Node.js runtime for Buffer/File support
export const runtime = 'nodejs';

// Flask server configuration
const FLASK_SERVER = 'http://127.0.0.1:5000';
const TIMEOUT_SECONDS = 300;

// Helper: try to extract userId from a PocketBase JWT without verifying signature
function extractUserIdFromToken(token?: string | null): string | undefined {
  if (!token) return undefined;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return undefined;
    const json = Buffer.from(parts[1], 'base64').toString('utf-8');
    const payload = JSON.parse(json);
    // PocketBase tokens typically include the record id in `id`
    return payload?.id || payload?.record?.id || payload?.sub;
  } catch {
    return undefined;
  }
}

// Generate image using Flask server
async function generateImageWithFlask(prompt: string, seed?: number, steps: number = 20, width: number = 1024, height: number = 1024): Promise<Buffer | null> {
  try {
    const response = await fetch(`${FLASK_SERVER}/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        negative_prompt: "blurry, low quality, distorted",
        steps: steps,
        cfg: 1.0,
        seed: seed || Math.floor(Math.random() * 4294967296),
        width: width,
        height: height
      }),
    });

    if (!response.ok) {
      console.error('Failed to generate image:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.images && data.images.length > 0) {
      // Convert base64 image to Buffer
      const base64Image = data.images[0].image;
      return Buffer.from(base64Image, 'base64');
    }
    
    return null;
  } catch (error) {
    console.error('Error generating image:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    console.log('🔐 API Debug - Starting authentication check');
    
    // Get user from PocketBase auth store via cookies
    const cookieStore = cookies();
    const authCookie = cookieStore.get('pb_auth');
    const rawCookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    
    console.log('🔐 API Debug - pb_auth cookie exists:', !!authCookie);
    console.log('🔐 API Debug - Authorization header present:', !!authHeader);

    // Always start clean to avoid cross-request leakage in dev
    pb.authStore.clear();

    let userId: string | undefined;
    let activeToken: string | undefined;

    // 1) Try cookie-based auth first (consistent with other routes)
    if (rawCookieHeader || authCookie?.value) {
      try {
        console.log('🔐 API Debug - Trying cookie-based auth via pb.authStore.loadFromCookie');
        // Prefer the raw Cookie header to pass all cookies (domains, attrs ignored by PocketBase)
        if (rawCookieHeader) {
          pb.authStore.loadFromCookie(rawCookieHeader);
        } else if (authCookie?.value) {
          // loadFromCookie also accepts a single cookie pair
          pb.authStore.loadFromCookie(`pb_auth=${authCookie.value}`);
        }
        console.log('🔐 API Debug - After loadFromCookie isValid:', pb.authStore.isValid);
        activeToken = pb.authStore.token || undefined;
        try {
          const authData = await pb.collection('users').authRefresh();
          userId = authData?.record?.id;
          console.log('🔐 API Debug - Cookie-based authRefresh success:', !!userId);
        } catch (e) {
          console.warn('🔐 API Debug - Cookie-based authRefresh failed, will consider token-only fallback');
        }
      } catch (e) {
        console.warn('🔐 API Debug - Cookie-based auth failed, will try header fallback:', e);
        pb.authStore.clear();
      }
    }

    // 2) Fallback: try Bearer token from Authorization header
    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      const tokenFromHeader = authHeader.slice(7).trim();
      if (tokenFromHeader) {
        try {
          console.log('🔐 API Debug - Trying header-based auth with Bearer token');
          activeToken = tokenFromHeader;
          // Save token only; model will be populated by authRefresh
          pb.authStore.save(tokenFromHeader as any, null as any);
          console.log('🔐 API Debug - After save(token) isValid:', pb.authStore.isValid);
          try {
            const authData = await pb.collection('users').authRefresh();
            userId = authData?.record?.id;
            console.log('🔐 API Debug - Header-based authRefresh success:', !!userId);
          } catch (e) {
            console.error('🔐 API Debug - Header-based authRefresh failed, will attempt JWT decode fallback');
          }
        } catch (e) {
          console.error('🔐 API Debug - Header-based auth failed:', e);
          pb.authStore.clear();
        }
      }
    }

    // 3) Final fallback: if we have a token but failed authRefresh, try to parse user id from JWT
    if (!userId && activeToken) {
      const extracted = extractUserIdFromToken(activeToken);
      if (extracted) {
        userId = extracted;
        console.warn('🔐 API Debug - Using userId extracted from JWT payload as fallback');
        // Ensure pb has the token to authorize collection writes
        if (!pb.authStore.token) {
          pb.authStore.save(activeToken as any, null as any);
        }
      }
    }

    if (!userId) {
      console.log('🔐 API Debug - Authentication failed (no valid userId)');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log('🔐 API Debug - Authentication successful, userId:', userId);

    const { prompt, seed, steps, width, height } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log(`[Flask] Generating image for prompt: "${prompt.slice(0, 50)}..."`); 

    // Generate image using Flask server
    const imageBuffer = await generateImageWithFlask(prompt, seed, steps || 20, width || 1024, height || 1024);
    
    if (!imageBuffer) {
      return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
    }

    // Persist image and return URL
    const saved = await saveBufferToPublic(imageBuffer, 'images', 'png');
    
    console.log(`[Flask] Image generated and saved: ${saved.url}`);

    // Save to PocketBase gen_images collection
    try {
      // Create a File object from the buffer
      const imageFile = new File([imageBuffer], `generated_${Date.now()}.png`, { type: 'image/png' });
      
      await pbHelpers.saveImage(userId, prompt, imageFile, 'generation');
      console.log(`[PocketBase] Image saved to gen_images collection`);
    } catch (pbError) {
      console.error('Failed to save to PocketBase:', pbError);
      // Don't fail the request if PocketBase save fails
    }
    
    return NextResponse.json({ 
      success: true, 
      url: saved.url, 
      totalImages: 1 
    });

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
}

// Health check endpoint
export async function GET() {
  try {
    const response = await fetch(`${FLASK_SERVER}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    const isHealthy = response.ok;
    return NextResponse.json({ 
      status: isHealthy ? 'healthy' : 'unhealthy',
      flaskServer: FLASK_SERVER 
    });
  } catch {
    return NextResponse.json({ 
      status: 'unhealthy', 
      flaskServer: FLASK_SERVER 
    }, { status: 503 });
  }
}