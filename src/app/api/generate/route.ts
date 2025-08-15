import { NextResponse } from 'next/server';
import pb, { pbHelpers } from '@/lib/pocketbase';
import { generateVideo } from '@/server/videoAssembly';

function qualityCost(q: 'LOW'|'HIGH'|'MAX') { return q==='LOW'?0:q==='HIGH'?10:50; }

export async function POST(req: Request) {
  try {
    // Get auth token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    pb.authStore.save(token, null);
    
    if (!pb.authStore.isValid || !pb.authStore.model) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = pb.authStore.model;
    
    const { story, style, quality, ttsEngine, voice } = await req.json();
    if (!story || !quality) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    
    // Default TTS settings if not provided
    const selectedTtsEngine = ttsEngine || 'kokoro';
    const selectedVoice = voice || 'af_heart';
    
    const q = (String(quality).toUpperCase() as 'LOW'|'HIGH'|'MAX');
    const cost = qualityCost(q);
    
    // Check and spend credits
    try {
      if (cost > 0) {
        await pbHelpers.spendCredits(user.id, cost);
      }
    } catch {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    
    // Create job
    const job = await pbHelpers.createJob(user.id, { 
      story_input: story, 
      visual_style: style, 
      quality: q,
      input_type: 'text',
      tts_engine: selectedTtsEngine,
      voice: selectedVoice
    });

    // Start video generation pipeline
    setTimeout(async () => {
      try {
        await pbHelpers.updateJob(job.id, { 
          status: 'processing',
          progress_data: { step: 'extracting', progress: 10, message: 'Starting generation...' }
        });
        
        console.log(`[Generate API] Starting video generation for job ${job.id}`);
        
        // Update progress during generation
        await pbHelpers.updateJob(job.id, { 
          progress_data: { step: 'scenes', progress: 25, message: 'Creating scenes...' }
        });
        
        const result = await generateVideo(story, style, {
          ttsEngine: selectedTtsEngine,
          voice: selectedVoice
        });
        
        if (result.success && result.videoUrl) {
          const videoTitle = (story as string).slice(0, 80) + '...';
          
          // Save video
          const video = await pbHelpers.saveVideo(
            user.id, 
            videoTitle, 
            result.videoUrl, 
            q,
            story,
            style
          );
          
          // Update job as completed
          await pbHelpers.updateJob(job.id, { 
            status: 'completed', 
            video: video.id,
            progress_data: { step: 'done', progress: 100, message: 'Video generated successfully!' }
          });
          
          console.log(`[Generate API] Video generation completed for job ${job.id}: ${result.videoUrl}`);
        } else {
          console.error(`[Generate API] Video generation failed for job ${job.id}:`, result.error);
          await pbHelpers.updateJob(job.id, { 
            status: 'failed',
            error_message: result.error || 'Video generation failed'
          });
        }
      } catch (e: any) {
        console.error(`[Generate API] Video generation error for job ${job.id}:`, e);
        await pbHelpers.updateJob(job.id, { 
          status: 'failed',
          error_message: e.message || 'Unknown error occurred'
        });
      }
    }, 1000);

    return NextResponse.json({ jobId: job.id });
  } catch (error: any) {
    console.error('Generate API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 });
    
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    pb.authStore.save(token, null);
    
    const job = await pbHelpers.getJob(id);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    // Get video URL if job is completed
    let videoUrl = null;
    if (job.status === 'completed' && job.video) {
      try {
        const video = await pb.collection('videos').getOne(job.video);
        videoUrl = video.video_url;
      } catch (error) {
        console.error('Error fetching video:', error);
      }
    }
    
    return NextResponse.json({ 
      status: job.status, 
      url: videoUrl,
      progress: job.progress_data,
      error: job.error_message
    });
  } catch (error: any) {
    console.error('Get job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


