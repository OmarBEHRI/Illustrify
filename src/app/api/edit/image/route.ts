import { NextResponse } from 'next/server';
import { saveBufferToPublic } from '@/server/storage';
import { pbHelpers } from '@/lib/pocketbase';
import { cookies } from 'next/headers';
import pb from '@/lib/pocketbase';

export const runtime = 'nodejs';

const FLASK_SERVER = 'http://127.0.0.1:5000';

function extractUserIdFromToken(token?: string | null): string | undefined {
  if (!token) return undefined;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return undefined;
    const json = Buffer.from(parts[1], 'base64').toString('utf-8');
    const payload = JSON.parse(json);
    return payload?.id || payload?.record?.id || payload?.sub;
  } catch {
    return undefined;
  }
}

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch source image: ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuf);
  return buf.toString('base64');
}

async function editImageWithFlask(imageB64: string, prompt: string, steps: number = 20) {
  const response = await fetch(`${FLASK_SERVER}/edit-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageB64, prompt, steps })
  });
  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    console.error('Failed to edit image:', response.status, txt);
    return null;
  }
  const data = await response.json();
  if (data.success && data.images && data.images.length > 0) {
    return Buffer.from(data.images[0].image, 'base64');
  }
  return null;
}

export async function POST(request: Request) {
  try {
    // Auth: same as image generation route
    const cookieStore = cookies();
    const authCookie = cookieStore.get('pb_auth');
    const rawCookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

    pb.authStore.clear();

    let userId: string | undefined;
    let activeToken: string | undefined;

    if (rawCookieHeader || authCookie?.value) {
      try {
        if (rawCookieHeader) pb.authStore.loadFromCookie(rawCookieHeader);
        else if (authCookie?.value) pb.authStore.loadFromCookie(`pb_auth=${authCookie.value}`);
        activeToken = pb.authStore.token || undefined;
        try {
          const authData = await pb.collection('users').authRefresh();
          userId = authData?.record?.id;
        } catch {}
      } catch {
        pb.authStore.clear();
      }
    }

    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      const tokenFromHeader = authHeader.slice(7).trim();
      if (tokenFromHeader) {
        try {
          activeToken = tokenFromHeader;
          pb.authStore.save(tokenFromHeader as any, null as any);
          try {
            const authData = await pb.collection('users').authRefresh();
            userId = authData?.record?.id;
          } catch {}
        } catch {
          pb.authStore.clear();
        }
      }
    }

    if (!userId && activeToken) {
      const extracted = extractUserIdFromToken(activeToken);
      if (extracted) {
        userId = extracted;
        if (!pb.authStore.token) pb.authStore.save(activeToken as any, null as any);
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Accept multiple payload shapes for better compatibility
    const body = await request.json().catch(() => ({}));
    const prompt: string | undefined = body?.prompt;
    const steps: number = (body?.steps ?? body?.num_inference_steps ?? 20) as number;
    const imageFromClient: string | undefined = body?.image ?? body?.sourceImage;
    const sourceUrl: string | undefined = body?.sourceUrl ?? body?.source_url ?? body?.url;

    if (!prompt || String(prompt).trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let imageB64: string | null = null;
    if (typeof imageFromClient === 'string' && imageFromClient.length > 0) {
      imageB64 = imageFromClient.includes(',') ? imageFromClient.split(',')[1] : imageFromClient;
    } else if (typeof sourceUrl === 'string' && sourceUrl.length > 0) {
      imageB64 = await fetchAsBase64(sourceUrl);
    } else {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const imageBuffer = await editImageWithFlask(imageB64!, prompt, steps || 20);
    if (!imageBuffer) {
      return NextResponse.json({ error: 'Failed to edit image' }, { status: 500 });
    }

    const saved = await saveBufferToPublic(imageBuffer, 'images', 'png');

    try {
      const imageFile = new File([imageBuffer], `edited_${Date.now()}.png`, { type: 'image/png' });
      await pbHelpers.saveImage(userId, prompt, imageFile, 'edit');
    } catch (pbError) {
      console.error('Failed to save edited image to PocketBase:', pbError);
    }

    return NextResponse.json({ success: true, url: saved.url, totalImages: 1 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}