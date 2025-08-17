import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

// ComfyUI server configuration
const COMFY_SERVER = process.env.COMFYUI_SERVER || 'http://127.0.0.1:8188';
const TIMEOUT_SECONDS = parseInt(process.env.COMFYUI_TIMEOUT || '300');
const POLL_INTERVAL = 1000; // 1 second

// Interface for workflow JSON
interface WorkflowJSON {
  [nodeId: string]: {
    inputs: Record<string, any>;
    class_type: string;
    _meta?: any;
    widgets_values?: any[];
  };
}

interface ImageGenResult {
  success: boolean;
  images: Buffer[];
  error?: string;
}

// Generate unique client ID
function generateClientId(): string {
  return `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Convert ComfyUI export format to API format
function convertWorkflowToAPIFormat(exportedWorkflow: any): WorkflowJSON {
  const apiWorkflow: WorkflowJSON = {};
  
  if (exportedWorkflow.nodes && Array.isArray(exportedWorkflow.nodes)) {
    for (const node of exportedWorkflow.nodes) {
      apiWorkflow[node.id.toString()] = {
        inputs: node.inputs || {},
        class_type: node.type,
        _meta: node._meta || { title: node.title },
        widgets_values: node.widgets_values
      };
    }
  }
  
  return apiWorkflow;
}

// Queue prompt to ComfyUI server
async function queuePrompt(workflow: WorkflowJSON, clientId: string): Promise<string | null> {
  try {
    const response = await fetch(`${COMFY_SERVER}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    });

    if (!response.ok) {
      console.error('Failed to queue prompt:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    return data.prompt_id || null;
  } catch (error) {
    console.error('Error queuing prompt:', error);
    return null;
  }
}

// Get job history/status from ComfyUI
async function getHistory(promptId: string): Promise<any> {
  try {
    const response = await fetch(`${COMFY_SERVER}/history/${promptId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Download image from ComfyUI
async function downloadImage(filename: string, subfolder: string, type: string): Promise<Buffer | null> {
  try {
    const params = new URLSearchParams({ filename, subfolder, type });
    const response = await fetch(`${COMFY_SERVER}/view?${params}`);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

// Poll for completion and retrieve images
async function waitForImages(promptId: string): Promise<Buffer[]> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < TIMEOUT_SECONDS * 1000) {
    const historyData = await getHistory(promptId);
    const history = historyData?.[promptId];
    
    if (history?.outputs) {
      const images: Buffer[] = [];
      
      // Look for images in any output node
      for (const [nodeId, output] of Object.entries(history.outputs)) {
        if (output && typeof output === 'object' && 'images' in output) {
          const nodeImages = (output as any).images;
          if (Array.isArray(nodeImages)) {
            for (const imgInfo of nodeImages) {
              const imgBuffer = await downloadImage(
                imgInfo.filename,
                imgInfo.subfolder,
                imgInfo.type
              );
              if (imgBuffer) images.push(imgBuffer);
            }
          }
        }
      }
      
      if (images.length > 0) return images;
    }
    
    // Optional progress logging
    if (history?.status?.current) {
      console.log(`[ComfyUI] Processing node: ${history.status.current}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
  
  throw new Error(`Image generation timed out after ${TIMEOUT_SECONDS} seconds`);
}

/**
 * Generate an image using ComfyUI workflow
 */
export async function generateImage(prompt: string, seed?: number, quality: number = 20): Promise<ImageGenResult> {
  try {
    // Load workflow template
    const workflowPath = path.join(process.cwd(), 'image-gen-worflows', 'Flux-KREA-Image-Gen.json');
    let workflow: WorkflowJSON;
    
    try {
      const workflowContent = await fs.readFile(workflowPath, 'utf8');
      const rawWorkflow = JSON.parse(workflowContent);
      
      // Convert from ComfyUI export format to API format if needed
      if (rawWorkflow.nodes && Array.isArray(rawWorkflow.nodes)) {
        workflow = convertWorkflowToAPIFormat(rawWorkflow);
      } else {
        workflow = rawWorkflow;
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
      return { success: false, images: [], error: 'Failed to load workflow template' };
    }

    // Set prompt, seed, and quality in workflow
    // Node 100 is the positive prompt (CLIPTextEncode)
    if (workflow['100']?.inputs) {
      workflow['100'].inputs.text = prompt;
    }
    
    // Node 137 is the KSampler with seed and steps in widgets_values
    if (workflow['137']?.widgets_values) {
      workflow['137'].widgets_values[0] = seed || Math.floor(Math.random() * 4294967296); // seed
      workflow['137'].widgets_values[2] = quality; // steps
    }

    // Generate and queue prompt
    const clientId = generateClientId();
    const promptId = await queuePrompt(workflow, clientId);
    
    if (!promptId) {
      return { success: false, images: [], error: 'Failed to queue image generation' };
    }

    console.log(`[ComfyUI] Queued prompt: ${promptId} for: "${prompt.slice(0, 50)}..."`);

    // Wait for completion and get images
    const images = await waitForImages(promptId);
    
    console.log(`[ComfyUI] Generated ${images.length} image(s) for prompt: ${promptId}`);
    
    return { success: true, images };

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
    console.log(`[ComfyUI] Generating single scene image: "${imageDescription.slice(0, 60)}..."`); 
    
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
      console.log(`[ComfyUI] Scene image saved: ${imageUrl}`);
      
      return { success: true, imageUrl };
    } else {
      return { success: false, error: result.error || 'Failed to generate image' };
    }
  } catch (error: any) {
    console.error('[ComfyUI] Scene image generation failed:', error);
    return { success: false, error: error.message || 'Image generation failed' };
  }
}

/**
 * Generate multiple images for scenes
 */
export async function generateSceneImages(imageDescriptions: string[], quality: number = 20): Promise<{ success: boolean; images: Buffer[]; errors: string[] }> {
  const results: Buffer[] = [];
  const errors: string[] = [];
  
  console.log(`[ComfyUI] Starting generation of ${imageDescriptions.length} scene images`);
  
  for (let i = 0; i < imageDescriptions.length; i++) {
    const description = imageDescriptions[i];
    console.log(`[ComfyUI] Generating scene ${i + 1}/${imageDescriptions.length}: "${description.slice(0, 60)}..."`);
    
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
 * Check if ComfyUI server is available
 */
export async function checkComfyUIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${COMFY_SERVER}/system_stats`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}