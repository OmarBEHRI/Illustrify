import { NextResponse } from 'next/server';
import { saveBufferToPublic } from '@/server/storage';

// Flask server configuration
const FLASK_SERVER = 'http://127.0.0.1:5000';
const TIMEOUT_SECONDS = 300;

// Generate image using Flask server
async function generateImageWithFlask(prompt: string, seed?: number, steps: number = 20, width: number = 1024, height: number = 1024): Promise<Buffer | null> {
  try {
    const response = await fetch(`${FLASK_SERVER}/generate-flux`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        positive_prompt: prompt,
        negative_prompt: "blurry, low quality, distorted",
        steps: steps,
        cfg: 1.0,
        seed: seed || Math.floor(Math.random() * 4294967296),
        width: width,
        height: height,
        unet_model: "flux1-krea-dev-Q5_1.gguf",
        clip_model1: "clip_l.safetensors",
        clip_model2: "t5xxl_fp8_e4m3fn.safetensors",
        vae_model: "ae.safetensors"
      }),
    });

    if (!response.ok) {
      console.error('Failed to generate image:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.image_path) {
      // Download the generated image from Flask server
      const imageResponse = await fetch(`${FLASK_SERVER}/image/${data.image_path}`);
      if (imageResponse.ok) {
        return Buffer.from(await imageResponse.arrayBuffer());
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error generating image:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
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