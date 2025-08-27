import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import pb, { pbHelpers, Animation } from '@/lib/pocketbase';
import { Agent, request as undiciRequest } from 'undici';

// Configure API route timeout to 20 minutes
export const maxDuration = 1200; // 20 minutes in seconds
// Ensure this route runs on the Node.js runtime (not Edge)
export const runtime = 'nodejs';
// Disable static optimization/caching for long-running requests
export const dynamic = 'force-dynamic';

interface AnimateImageRequest {
  image?: string; // base64 image
  sourceImage?: string; // alternate key
  prompt?: string; // Optional prompt, defaults to empty string
  negative_prompt?: string;
  width?: number;
  height?: number;
  length?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  frame_rate?: number;
}

interface FlaskResponse {
  success: boolean;
  videos?: Array<{
    video: string;
    format: string;
  }>;
  frames?: Array<{
    image: string;
    format: string;
  }>;
  parameters?: any;
  error?: string;
}

async function animateImageWithFlask(params: {
  image: string;
  prompt?: string; // Optional prompt
  negative_prompt?: string;
  width?: number;
  height?: number;
  length?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  frame_rate?: number;
}): Promise<Buffer> {
  // Extend undici timeouts to allow long-running generation before response headers are sent
  const agent = new Agent({
    headersTimeout: 20 * 60 * 1000, // 20 minutes
    bodyTimeout: 20 * 60 * 1000, // 20 minutes
    keepAliveTimeout: 70_000,
  });

  try {
    const { statusCode, body } = await undiciRequest('http://127.0.0.1:5000/image-to-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      dispatcher: agent,
      headersTimeout: 20 * 60 * 1000,
      bodyTimeout: 20 * 60 * 1000,
    });

    if (statusCode < 200 || statusCode >= 300) {
      const text = await body.text();
      let error = 'Flask server error';
      try {
        const parsed = JSON.parse(text);
        error = parsed?.error || error;
      } catch {}
      throw new Error(error);
    }

    const text = await body.text();
    console.log('Flask response text:', text.substring(0, 500) + '...');
    
    let data: FlaskResponse;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error('Failed to parse Flask response:', text.substring(0, 1000));
      throw new Error('Invalid JSON from Flask server');
    }

    console.log('Parsed Flask response:', {
      success: data.success,
      videosCount: data.videos?.length || 0,
      framesCount: data.frames?.length || 0,
      hasError: !!data.error
    });

    if (!data.success) {
      throw new Error(data.error || 'Video generation failed');
    }

    // Return the first video if available, otherwise return first frame
    if (data.videos && data.videos.length > 0) {
      console.log('Returning video data, format:', data.videos[0].format);
      return Buffer.from(data.videos[0].video, 'base64');
    } else if (data.frames && data.frames.length > 0) {
      console.log('Returning frame data as fallback, format:', data.frames[0].format);
      return Buffer.from(data.frames[0].image, 'base64');
    }

    console.error('No video or frames in response:', data);
    throw new Error('No video or frames generated');
  } catch (error) {
    console.error('Flask API error:', error);
    throw error;
  } finally {
    // Close the agent to free sockets after each request
    agent.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: AnimateImageRequest = await request.json();

    // Authenticate PocketBase from cookies or Authorization header
    const cookieStore = cookies();
    const authCookie = cookieStore.get('pb_auth');
    const rawCookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

    // Clear any previous auth to avoid leakage between requests in dev
    pb.authStore.clear();

    let userId: string | undefined;

    // 1) Try cookie-based auth first
    if (rawCookieHeader || authCookie?.value) {
      try {
        if (rawCookieHeader) {
          pb.authStore.loadFromCookie(rawCookieHeader);
        } else if (authCookie?.value) {
          pb.authStore.loadFromCookie(`pb_auth=${authCookie.value}`);
        }
        try {
          const authData = await pb.collection('users').authRefresh();
          userId = authData?.record?.id;
        } catch {}
      } catch {
        pb.authStore.clear();
      }
    }

    // 2) Fallback: try Bearer token from Authorization header
    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      const tokenFromHeader = authHeader.slice(7).trim();
      if (tokenFromHeader) {
        try {
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

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Extract and validate parameters
    const {
      image,
      sourceImage,
      prompt = '', // Default to empty string if not provided
      negative_prompt,
      width = 480,
      height = 832,
      length = 81,
      steps = 6,
      cfg = 1.0,
      seed,
      frame_rate = 32,
    } = body;

    // Handle different image source keys
    const imageData = image || sourceImage;

    if (!imageData) {
      return NextResponse.json(
        { success: false, error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Prompt is now optional - empty string is allowed

    // Call Flask API (long-running)
    const videoBuffer = await animateImageWithFlask({
      image: imageData,
      prompt,
      negative_prompt,
      width,
      height,
      length,
      steps,
      cfg,
      seed,
      frame_rate,
    });

    // Save video to PocketBase animations collection
    try {
      // Convert buffer to File object
      const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
      const videoFile = new File([videoBlob], `animation_${Date.now()}.mp4`, {
        type: 'video/mp4',
      });

      const animationRecord = await pbHelpers.saveAnimation(
        userId,
        prompt,
        videoFile
      );

      return NextResponse.json({
        success: true,
        video: {
          id: animationRecord.id,
          url: pb.files.getUrl(animationRecord, animationRecord.animation),
          prompt,
          parameters: {
            width,
            height,
            length,
            steps,
            cfg,
            seed,
            frame_rate,
          },
        },
      });
    } catch (saveError) {
      const errAny = saveError as any;
      console.error('Failed to save video:', errAny?.message || errAny, errAny?.response?.data || errAny?.data || '');

      // Return the video data even if saving fails
      const videoBase64 = videoBuffer.toString('base64');
      return NextResponse.json({
        success: true,
        video: {
          data: videoBase64,
          format: 'mp4',
          prompt,
          parameters: {
            width,
            height,
            length,
            steps,
            cfg,
            seed,
            frame_rate,
          },
        },
        warning: 'Video generated but not saved to database',
        errorDetails: errAny?.response?.data || errAny?.data || undefined,
      });
    }
  } catch (error) {
    console.error('Image-to-video generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}