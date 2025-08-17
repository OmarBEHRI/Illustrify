import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

// Flask server configuration
const FLASK_SERVER = process.env.FLASK_SERVER || 'http://127.0.0.1:5000';
const TIMEOUT_SECONDS = parseInt(process.env.FLASK_TIMEOUT || '300');

interface ImageGenResult {
  success: boolean;
  images: Buffer[];
  error?: string;
}

// Generate image using Flask server
async function generateImageWithFlask(prompt: string, seed?: number, steps: number = 20): Promise<Buffer | null> {
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
        width: 1024,
        height: 1024,
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

/**
 * Generate an image using Flask server
 */
export async function generateImage(prompt: string, seed?: number, quality: number = 20): Promise<ImageGenResult> {
  try {
    console.log(`[Flask] Generating image for: "${prompt.slice(0, 50)}..."`);

    const imageBuffer = await generateImageWithFlask(prompt, seed, quality);
    
    if (!imageBuffer) {
      return { success: false, images: [], error: 'Failed to generate image' };
    }
    
    console.log(`[Flask] Successfully generated image`);
    
    return { success: true, images: [imageBuffer] };

  } catch (error) {
    console.error('Image generation error:', error);
    return { 
      success: false, 
      images: [], 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Generate a single image for a scene
 */
export async function generateSceneImage(imageDescription: string, quality: number = 20): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    console.log(`[Flask] Generating single scene image: "${imageDescription.slice(0, 60)}..."`); 
    
    const result = await generateImage(imageDescription, undefined, quality);
    
    if (result.success && result.images.length > 0) {
      // Save the image and return URL
      const imageBuffer = result.images[0];
      const imageId = uuid();
      const imagePath = path.join(process.cwd(), 'public', 'assets', 'images', `${imageId}.png`);
      
      // Ensure images directory exists
      await fs.mkdir(path.dirname(imagePath), { recursive: true });
      
      // Save image to file
      await fs.writeFile(imagePath, imageBuffer);
      
      const imageUrl = `/assets/images/${imageId}.png`;
      console.log(`[Flask] Scene image saved: ${imageUrl}`);
      
      return { success: true, imageUrl };
    } else {
      return { success: false, error: result.error || 'Failed to generate image' };
    }
  } catch (error: any) {
    console.error('[Flask] Scene image generation failed:', error);
    return { success: false, error: error.message || 'Image generation failed' };
  }
}

/**
 * Generate multiple images for scenes
 */
export async function generateSceneImages(imageDescriptions: string[], quality: number = 20): Promise<{ success: boolean; images: Buffer[]; errors: string[] }> {
  const results: Buffer[] = [];
  const errors: string[] = [];
  
  console.log(`[Flask] Starting generation of ${imageDescriptions.length} scene images`);
  
  for (let i = 0; i < imageDescriptions.length; i++) {
    const description = imageDescriptions[i];
    console.log(`[Flask] Generating scene ${i + 1}/${imageDescriptions.length}: "${description.slice(0, 60)}..."`);
    
    const result = await generateImage(description, undefined, quality);
    
    if (result.success && result.images.length > 0) {
      results.push(result.images[0]); // Take first generated image
    } else {
      errors.push(`Scene ${i + 1}: ${result.error || 'Failed to generate image'}`);
      console.error(`Failed to generate scene ${i + 1}:`, result.error);
    }
  }
  
  return {
    success: results.length > 0,
    images: results,
    errors
  };
}

/**
 * Check if Flask server is available
 */
export async function checkFlaskHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${FLASK_SERVER}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * @deprecated Use checkFlaskHealth instead
 */
export async function checkComfyUIHealth(): Promise<boolean> {
  return checkFlaskHealth();
}