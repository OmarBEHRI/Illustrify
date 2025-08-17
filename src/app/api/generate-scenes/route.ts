import { NextResponse } from 'next/server';
import pb, { pbHelpers, Scene } from '@/lib/pocketbase';
import { directVideo } from '@/server/director';
import { generateSceneImage } from '@/server/imageGen';
import { generateSceneAudioWithCustomName } from '@/server/videoAssembly';
import { createVideoSegment } from '@/server/videoAssembly';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

function qualityCost(q: 'LOW'|'HIGH'|'MAX') { return q==='LOW'?0:q==='HIGH'?10:50; }

export async function POST(req: Request) {
  console.log('[Generate Scenes API] POST request received');
  
  try {
    // Get auth token from Authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('[Generate Scenes API] Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Generate Scenes API] Missing or invalid auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('[Generate Scenes API] Token extracted, length:', token.length);
    
    // Validate token by trying to refresh auth
    try {
      pb.authStore.save(token, null);
      await pb.collection('users').authRefresh();
      
      if (!pb.authStore.isValid || !pb.authStore.model) {
        console.log('[Generate Scenes API] Token validation failed - invalid or no model');
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      console.log('[Generate Scenes API] Auth validation successful');
    } catch (error) {
      console.error('[Generate Scenes API] Auth validation failed:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = pb.authStore.model;
    console.log('[Generate Scenes API] User authenticated:', user.id);
    
    const { story, style, quality, ttsEngine, voice } = await req.json();
    console.log('[Generate Scenes API] Request data:', { story: story?.slice(0, 50) + '...', style, quality, ttsEngine, voice });
    
    if (!story || !quality) {
      console.log('[Generate Scenes API] Missing required fields');
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
    
    // Default TTS settings if not provided
    const selectedTtsEngine = ttsEngine || 'kokoro';
    const selectedVoice = voice || 'af_heart';
    console.log('[Generate Scenes API] TTS settings:', { selectedTtsEngine, selectedVoice });
    
    const q = (String(quality).toUpperCase() as 'LOW'|'HIGH'|'MAX');
    const cost = qualityCost(q);
    console.log('[Generate Scenes API] Quality and cost:', { quality: q, cost });
    
    // Check and spend credits
    try {
      if (cost > 0) {
        console.log('[Generate Scenes API] Spending credits:', cost);
        await pbHelpers.spendCredits(user.id, cost);
        console.log('[Generate Scenes API] Credits spent successfully');
      } else {
        console.log('[Generate Scenes API] No credits needed for LOW quality');
      }
    } catch (error) {
      console.error('[Generate Scenes API] Credit spending failed:', error);
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    
    // Create job
    console.log('[Generate Scenes API] Creating job...');
    const job = await pbHelpers.createJob(user.id, { 
      story_input: story, 
      visual_style: style, 
      quality: q,
      input_type: 'text',
      tts_engine: selectedTtsEngine,
      voice: selectedVoice
    });
    console.log('[Generate Scenes API] Job created:', job.id);

    // Create video record for scenes
    console.log('[Generate Scenes API] Creating video record...');
    const videoTitle = (story as string).slice(0, 80) + '...';
    const video = await pbHelpers.saveVideo(
      user.id, 
      videoTitle, 
      '', // Empty URL initially
      q,
      story,
      style
    );
    console.log('[Generate Scenes API] Video record created:', video.id);

    // Start scene-by-scene generation pipeline
    console.log('[Generate Scenes API] Starting async scene generation pipeline');
    setTimeout(async () => {
      try {
        console.log('[Generate Scenes API] Updating job status to processing');
        await pbHelpers.updateJob(job.id, { 
          status: 'processing',
          video: video.id,
          progress: { step: 'scenes', progress: 10, message: 'Creating scenes...' }
        });
        console.log('[Generate Scenes API] Job status updated successfully');
        
        console.log(`[Generate Scenes API] Starting scene generation for job ${job.id}`);
        
        // Step 1: Generate scenes using director
        console.log('[Generate Scenes API] Calling directVideo function');
        const scenes = await directVideo(story, style);
        console.log('[Generate Scenes API] directVideo completed, scenes:', scenes?.length || 0);
        
        if (!scenes || scenes.length === 0) {
          console.log('[Generate Scenes API] No scenes generated, marking job as failed');
          await pbHelpers.updateJob(job.id, { 
            status: 'failed',
            error_message: 'Failed to generate scenes from story'
          });
          return;
        }

        console.log(`[Generate Scenes API] Generated ${scenes.length} scenes`);
        
        // Step 2: Generate each scene individually
        const videoId = uuid();
        console.log('[Generate Scenes API] Generated video ID:', videoId);
        const generatedScenes = [];
        
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          console.log(`[Generate Scenes API] Processing scene ${i + 1}/${scenes.length}: "${scene.imageDescription.slice(0, 50)}..."`);          
          
          // Update progress - starting scene
        const baseProgress = Math.round((i / scenes.length) * 80) + 10;
        await pbHelpers.updateJob(job.id, {
          progress: {
            step: 'generating_scenes',
            progress: baseProgress,
            message: `Starting scene ${i + 1} of ${scenes.length}`,
            current_scene: i + 1,
            total_scenes: scenes.length,
            sub_step: 'starting',
            scene_progress: {
              current: i + 1,
              total: scenes.length,
              status: 'starting',
              scene_id: null
            },
            completed_scenes: generatedScenes.length,
            timestamp: new Date().toISOString()
          }
        });
          
          try {
            
            // Update progress - generating image
            await pbHelpers.updateJob(job.id, {
              progress: {
                step: 'generating_scenes',
                progress: baseProgress + 10,
                message: `Generating image for scene ${i + 1} of ${scenes.length}`,
                current_scene: i + 1,
                total_scenes: scenes.length,
                sub_step: 'generating_image',
                scene_progress: {
                  current: i + 1,
                  total: scenes.length,
                  status: 'generating_image',
                  scene_id: null,
                  description: scene.imageDescription.slice(0, 100) + '...'
                },
                completed_scenes: generatedScenes.length,
                timestamp: new Date().toISOString()
              }
            });
            
            // Generate image for this scene
            console.log(`[Generate Scenes API] Generating image for scene ${i + 1}`);
            // Convert quality string to number: low=20, high=30, max=35
            const qualityValue = quality === 'high' ? 30 : quality === 'max' ? 35 : 20;
            const imageResult = await generateSceneImage(scene.imageDescription, qualityValue);
            console.log(`[Generate Scenes API] Image generation result for scene ${i + 1}:`, {
              success: imageResult.success,
              hasImageUrl: !!imageResult.imageUrl
            });
            
            if (!imageResult.success || !imageResult.imageUrl) {
              throw new Error(`Failed to generate image for scene ${i + 1}`);
            }
            
            // Update progress - generating audio
            await pbHelpers.updateJob(job.id, {
              progress: {
                step: 'generating_scenes',
                progress: baseProgress + 20,
                message: `Generating audio for scene ${i + 1} of ${scenes.length}`,
                current_scene: i + 1,
                total_scenes: scenes.length,
                sub_step: 'generating_audio',
                scene_progress: {
                  current: i + 1,
                  total: scenes.length,
                  status: 'generating_audio',
                  scene_id: null,
                  narration: scene.narration.slice(0, 100) + '...'
                },
                completed_scenes: generatedScenes.length,
                timestamp: new Date().toISOString()
              }
            });
            
            // Generate audio for this scene
            console.log(`[Generate Scenes API] Generating audio for scene ${i + 1}`);
            const audioResult = await generateSceneAudioWithCustomName(
              scene.narration,
              videoId,
              i,
              { ttsEngine: selectedTtsEngine, voice: selectedVoice }
            );
            console.log(`[Generate Scenes API] Audio generation result for scene ${i + 1}:`, {
              success: audioResult.success,
              hasUrl: !!audioResult.url,
              duration: audioResult.duration
            });
            
            if (!audioResult.success || !audioResult.url) {
              throw new Error(`Failed to generate audio for scene ${i + 1}`);
            }
            
            // Update progress - creating video segment
            await pbHelpers.updateJob(job.id, {
              progress: {
                step: 'generating_scenes',
                progress: baseProgress + 30,
                message: `Creating video segment for scene ${i + 1} of ${scenes.length}`,
                current_scene: i + 1,
                total_scenes: scenes.length,
                sub_step: 'creating_video',
                scene_progress: {
                  current: i + 1,
                  total: scenes.length,
                  status: 'creating_video',
                  scene_id: null
                },
                completed_scenes: generatedScenes.length,
                timestamp: new Date().toISOString()
              }
            });
            
            // Create video segment for this scene
            console.log(`[Generate Scenes API] Creating video segment for scene ${i + 1}`);
            const segmentPath = path.join(process.cwd(), 'public', 'assets', 'temp', `scene_${videoId}_${i}.mp4`);
            console.log(`[Generate Scenes API] Segment path for scene ${i + 1}:`, segmentPath);
            
            // Ensure temp directory exists
            console.log(`[Generate Scenes API] Creating temp directory for scene ${i + 1}`);
            await fs.mkdir(path.dirname(segmentPath), { recursive: true });
            
            console.log(`[Generate Scenes API] Calling createVideoSegment for scene ${i + 1}`);
            
            // Convert URLs to absolute file paths
            const imagePath = path.join(process.cwd(), 'public', imageResult.imageUrl.replace(/^\//, ''));
            const audioPath = path.join(process.cwd(), 'public', audioResult.url.replace(/^\//, ''));
            
            console.log(`[Generate Scenes API] Image path for scene ${i + 1}:`, imagePath);
            console.log(`[Generate Scenes API] Audio path for scene ${i + 1}:`, audioPath);
            
            // Get actual audio duration instead of using estimated
            let actualDuration = audioResult.duration || 3;
            try {
              const { getAudioDuration } = await import('@/server/videoAssembly');
              actualDuration = await getAudioDuration(audioPath);
              console.log(`[Generate Scenes API] Actual audio duration for scene ${i + 1}:`, actualDuration);
            } catch (durationError: any) {
              console.warn(`[Generate Scenes API] Failed to get actual duration for scene ${i + 1}, using estimated:`, durationError.message);
            }
            
            await createVideoSegment(
              imagePath,
              audioPath,
              actualDuration,
              segmentPath
            );
            console.log(`[Generate Scenes API] Video segment created successfully for scene ${i + 1}`);
            
            const sceneVideoUrl = `/assets/temp/scene_${videoId}_${i}.mp4`;
            console.log(`[Generate Scenes API] Scene video URL for scene ${i + 1}:`, sceneVideoUrl);
            
            // Save scene to database
            console.log(`[Generate Scenes API] Saving scene ${i + 1} to database`);
            // Use simple text values for image_url and audio_url since they're now text fields
            const imageFileName = path.basename(imageResult.imageUrl);
            const audioFileName = path.basename(audioResult.url);
            const videoFileName = path.basename(sceneVideoUrl);
            
            console.log(`[Generate Scenes API] Scene data for scene ${i + 1}:`, {
              scene_order: i,
              image_description: scene.imageDescription,
              narration: scene.narration,
              image_url: imageFileName,
              audio_url: audioFileName,
              video_url: videoFileName,
              duration: actualDuration
            });
            
            // Use the authenticated pb instance directly instead of pbHelpers
            const sceneRecord = await pb.collection('scenes').create({
              video: video.id,
              job: job.id,
              scene_order: i,
              image_description: scene.imageDescription,
              narration: scene.narration,
              image_url: imageFileName,
              audio_url: audioFileName,
              video_url: videoFileName,
              duration: actualDuration
            });
            console.log(`[Generate Scenes API] Scene ${i + 1} saved to database with ID:`, sceneRecord.id);
            
            generatedScenes.push({
              ...sceneRecord,
              video_url: sceneVideoUrl
            });
            console.log(`[Generate Scenes API] Added scene ${i + 1} to generatedScenes array`);
            
            // Update job with current scene progress
            const completedProgress = Math.round(((i + 1) / scenes.length) * 80) + 10;
            console.log(`[Generate Scenes API] Updating job progress for scene ${i + 1}`);
            await pbHelpers.updateJob(job.id, {
              progress: { 
                step: 'scene_completed', 
                progress: completedProgress, 
                message: `Scene ${i + 1} completed successfully`,
                current_scene: i + 1,
                total_scenes: scenes.length,
                sub_step: 'completed',
                scene_progress: {
                  current: i + 1,
                  total: scenes.length,
                  status: 'completed',
                  scene_id: sceneRecord.id,
                  duration: actualDuration
                },
                completed_scenes: generatedScenes.length,
                generatedScenes: generatedScenes,
                timestamp: new Date().toISOString()
              }
            });
            
            console.log(`[Generate Scenes API] Scene ${i + 1} completed successfully`);
            
          } catch (error: any) {
            console.error(`[Generate Scenes API] Error generating scene ${i + 1}:`, error);
            console.error(`[Generate Scenes API] Error stack for scene ${i + 1}:`, error.stack);
            await pbHelpers.updateJob(job.id, {
              status: 'failed',
              error_message: `Failed to generate scene ${i + 1}: ${error.message}`
            });
            return;
          }
        }
        
        // All scenes generated successfully
        await pbHelpers.updateJob(job.id, {
          status: 'completed',
          progress: { 
            step: 'scenes_ready', 
            progress: 100, 
            message: 'All scenes generated! Ready for video assembly.',
            current_scene: scenes.length,
            total_scenes: scenes.length,
            sub_step: 'all_completed',
            scene_progress: {
              current: scenes.length,
              total: scenes.length,
              status: 'all_completed',
              scene_id: null
            },
            completed_scenes: generatedScenes.length,
            generatedScenes: generatedScenes,
            totalScenes: scenes.length,
            scenes_ready: true,
            timestamp: new Date().toISOString()
          }
        });
        
        console.log(`[Generate Scenes API] All scenes generated for job ${job.id}`);
        
      } catch (e: any) {
        console.error(`[Generate Scenes API] Scene generation error for job ${job.id}:`, e);
        await pbHelpers.updateJob(job.id, { 
          status: 'failed',
          error_message: e.message || 'Unknown error occurred during scene generation'
        });
      }
    }, 1000);

    console.log('[Generate Scenes API] Returning success response with jobId:', job.id, 'videoId:', video.id);
    return NextResponse.json({ jobId: job.id, videoId: video.id });
  } catch (error: any) {
    console.error('[Generate Scenes API] Main catch block - error occurred:', error);
    console.error('[Generate Scenes API] Error stack:', error.stack);
    console.error('[Generate Scenes API] Error message:', error.message);
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
    
    // Get scenes if available
    let scenes: Scene[] = [];
    if (job.video) {
      try {
        const rawScenes = await pbHelpers.getVideoScenes(job.video);
        // Convert filename-only URLs to full URLs for the UI
        scenes = rawScenes.map(scene => ({
          ...scene,
          scene_number: scene.scene_order, // Map scene_order to scene_number for UI compatibility
          description: scene.image_description, // Map image_description to description for UI compatibility
          narration: scene.narration, // Include narration field for UI
          image_url: scene.image_url ? `/assets/images/${scene.image_url}` : undefined,
          audio_url: scene.audio_url ? `/assets/audio/${scene.audio_url}` : undefined,
          video_url: scene.video_url ? `/assets/temp/${scene.video_url}` : undefined,
          status: 'completed' // Mark as completed since they're in the database
        }));
      } catch (error) {
        console.error('Error fetching scenes:', error);
      }
    }
    
    return NextResponse.json({ 
      status: job.status, 
      progress: job.progress,
      error: job.error_message,
      scenes: scenes,
      videoId: job.video
    });
  } catch (error: any) {
    console.error('Get scenes job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}