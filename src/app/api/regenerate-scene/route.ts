import { NextResponse } from 'next/server';
import pb, { pbHelpers } from '@/lib/pocketbase';
import { generateSceneImage } from '@/server/imageGen';
import { generateSceneAudioWithCustomName, createVideoSegment } from '@/server/videoAssembly';
import { v4 as uuid } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

export async function POST(req: Request) {
  try {
    // Get auth token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Validate token by trying to refresh auth
    try {
      pb.authStore.save(token, null);
      await pb.collection('users').authRefresh();
      
      if (!pb.authStore.isValid || !pb.authStore.model) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    } catch (error) {
      console.error('Auth validation failed:', error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = pb.authStore.model;
    
    const { sceneId, jobId, ttsEngine, voice, quality } = await req.json();
    if (!sceneId || !jobId) {
      return NextResponse.json({ error: 'Missing sceneId or jobId' }, { status: 400 });
    }
    
    // Get the scene and job
    const job = await pbHelpers.getJob(jobId);
    if (!job || job.user !== user.id) {
      return NextResponse.json({ error: 'Job not found or unauthorized' }, { status: 404 });
    }
    
    const scene = await pb.collection('scenes').getOne(sceneId);
    if (!scene || scene.job !== jobId) {
      return NextResponse.json({ error: 'Scene not found or unauthorized' }, { status: 404 });
    }
    
    // Default TTS settings
    const selectedTtsEngine = ttsEngine || 'kokoro';
    const selectedVoice = voice || 'af_heart';
    
      // Get videoId from job
    const videoId = job.video;
    
    // Start regeneration process
    setTimeout(async () => {
      try {
        console.log(`[Regenerate Scene API] Starting regeneration for scene ${sceneId}`);
        
        // Update progress - starting regeneration
        await pbHelpers.updateJob(jobId, {
          progress: {
            ...job.progress,
            message: `Starting regeneration of scene ${scene.scene_order + 1}...`,
            regeneratingScene: sceneId,
            scene_progress: {
              current: scene.scene_order + 1,
              total: 1,
              status: 'regenerating',
              scene_id: sceneId
            }
          }
        });
        
        // Generate new image
        console.log(`[Regenerate Scene API] Generating new image for scene ${scene.scene_order + 1}`);
        await pbHelpers.updateJob(jobId, {
          progress: {
            ...job.progress,
            message: `Generating new image for scene ${scene.scene_order + 1}...`,
            regeneratingScene: sceneId,
            scene_progress: {
              current: scene.scene_order + 1,
              total: 1,
              status: 'generating_image',
              scene_id: sceneId
            }
          }
        });
        // Convert quality string to number: low=20, high=30, max=35
        const qualityValue = quality === 'high' ? 30 : quality === 'max' ? 35 : 20;
        const imageResult = await generateSceneImage(scene.image_description, qualityValue);
        
        if (!imageResult.success || !imageResult.imageUrl) {
          throw new Error('Failed to generate new image');
        }
        
        // Generate new audio
        console.log(`[Regenerate Scene API] Generating new audio for scene ${scene.scene_order + 1}`);
        await pbHelpers.updateJob(jobId, {
          progress: {
            ...job.progress,
            message: `Generating new audio for scene ${scene.scene_order + 1}...`,
            regeneratingScene: sceneId,
            scene_progress: {
              current: scene.scene_order + 1,
              total: 1,
              status: 'generating_audio',
              scene_id: sceneId
            }
          }
        });
        const audioResult = await generateSceneAudioWithCustomName(
           scene.narration,
           videoId,
           scene.scene_order,
           { ttsEngine: selectedTtsEngine, voice: selectedVoice }
         );
        
        if (!audioResult.success || !audioResult.url) {
          throw new Error('Failed to generate new audio');
        }
        
        // Create new video segment
        console.log(`[Regenerate Scene API] Creating new video segment for scene ${scene.scene_order + 1}`);
        await pbHelpers.updateJob(jobId, {
          progress: {
            ...job.progress,
            message: `Creating video segment for scene ${scene.scene_order + 1}...`,
            regeneratingScene: sceneId,
            scene_progress: {
              current: scene.scene_order + 1,
              total: 1,
              status: 'creating_video',
              scene_id: sceneId
            }
          }
        });
        const segmentPath = path.join(process.cwd(), 'public', 'assets', 'temp', `scene_${videoId}_${scene.scene_order}.mp4`);
        
        // Ensure temp directory exists
        await fs.mkdir(path.dirname(segmentPath), { recursive: true });
        
        // Convert URLs to absolute file paths
        const imagePath = path.join(process.cwd(), 'public', imageResult.imageUrl.replace(/^\//, ''));
        const audioPath = path.join(process.cwd(), 'public', audioResult.url.replace(/^\//, ''));
        
        await createVideoSegment(
          imagePath,
          audioPath,
          audioResult.duration || 3,
          segmentPath
        );
        
        // Update scene in database
        const videoFileName = `scene_${videoId}_${scene.scene_order}.mp4`;
        // Store only filenames in database (consistent with generate-scenes)
        const imageFileName = path.basename(imageResult.imageUrl);
        const audioFileName = path.basename(audioResult.url);
        
        await pb.collection('scenes').update(sceneId, {
          image_url: imageFileName,
          audio_url: audioFileName,
          video_url: videoFileName,
          duration: audioResult.duration || 3
        });
        
        // Update job progress
        const updatedScenes = await pbHelpers.getVideoScenes(job.video!);
        // Convert database filenames to full URLs for UI consistency
        const scenesWithVideoUrls = updatedScenes.map((s) => ({
          ...s,
          scene_number: s.scene_order,
          description: s.image_description,
          narration: s.narration,
          image_url: s.image_url ? `/assets/images/${s.image_url}` : undefined,
          audio_url: s.audio_url ? `/assets/audio/${s.audio_url}` : undefined,
          video_url: s.video_url ? `/assets/temp/${s.video_url}` : undefined,
          status: 'completed'
        }));
        
        await pbHelpers.updateJob(jobId, {
          progress: {
        ...job.progress,
            message: `Scene ${scene.scene_order + 1} regenerated successfully`,
            generatedScenes: scenesWithVideoUrls,
            regeneratingScene: null,
            scene_progress: {
              current: scene.scene_order + 1,
              total: updatedScenes.length,
              status: 'regeneration_completed',
              scene_id: sceneId
            }
          }
        });
        
        console.log(`[Regenerate Scene API] Scene ${scene.scene_order + 1} regenerated successfully`);
        
      } catch (error: any) {
        console.error(`[Regenerate Scene API] Error regenerating scene ${sceneId}:`, error);
        await pbHelpers.updateJob(jobId, {
          progress: {
        ...job.progress,
            message: `Failed to regenerate scene ${scene.scene_order + 1}: ${error.message}`,
            regeneratingScene: null
          }
        });
      }
    }, 1000);
    
    return NextResponse.json({ success: true, message: 'Scene regeneration started' });
    
  } catch (error: any) {
    console.error('Regenerate Scene API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}