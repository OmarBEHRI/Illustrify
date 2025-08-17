import { NextResponse } from 'next/server';
import { saveBufferToPublic } from '@/server/storage';
import fs from 'fs/promises';
import path from 'path';

// ComfyUI server configuration
const COMFY_SERVER = 'http://127.0.0.1:8188';
const TIMEOUT_SECONDS = 300;
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
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
  
  throw new Error(`Image generation timed out after ${TIMEOUT_SECONDS} seconds`);
}

export async function POST(request: Request) {
  try {
    const { prompt, seed } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Failed to load workflow template' }, { status: 500 });
    }

    // Set prompt and seed in workflow
    // Node 100 is the positive prompt (CLIPTextEncode)
    if (workflow['100']?.inputs) {
      workflow['100'].inputs.text = prompt;
    }
    
    // Node 137 is the KSampler with seed in widgets_values
    if (workflow['137']?.widgets_values) {
      workflow['137'].widgets_values[0] = seed || Math.floor(Math.random() * 4294967296); // seed
    }

    // Generate and queue prompt
    const clientId = generateClientId();
    const promptId = await queuePrompt(workflow, clientId);
    
    if (!promptId) {
      return NextResponse.json({ error: 'Failed to queue image generation' }, { status: 500 });
    }

    // Wait for completion and get images
    const images = await waitForImages(promptId);
    
    if (images.length === 0) {
      return NextResponse.json({ error: 'No images generated' }, { status: 500 });
    }

    // Persist first image and return URL
    const saved = await saveBufferToPublic(images[0], 'images', 'png');
    return NextResponse.json({ success: true, promptId, url: saved.url, totalImages: images.length });

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
    const response = await fetch(`${COMFY_SERVER}/system_stats`, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    const isHealthy = response.ok;
    return NextResponse.json({ 
      status: isHealthy ? 'healthy' : 'unhealthy',
      comfyServer: COMFY_SERVER 
    });
  } catch {
    return NextResponse.json({ 
      status: 'unhealthy', 
      comfyServer: COMFY_SERVER 
    }, { status: 503 });
  }
}