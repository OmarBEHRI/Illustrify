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
    
    const { sceneId, jobId, ttsEngine, voice } = await req.json();
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
    
    // Start regeneration process
    setTimeout(async () => {
      try {
        console.log(`[Regenerate Scene API] Starting regeneration for scene ${sceneId}`);
        
        // Update job progress
        await pbHelpers.updateJob(jobId, {
          progress_data: {
            ...job.progress_data,
            message: `Regenerating scene ${scene.scene_order + 1}...`,
            regeneratingScene: scene.scene_order
          }
        });
        
        // Generate new image
        console.log(`[Regenerate Scene API] Generating new image for scene ${scene.scene_order + 1}`);
        const imageResult = await generateSceneImage(scene.image_description);
        
        if (!imageResult.success || !imageResult.imageUrl) {
          throw new Error('Failed to generate new image');
        }
        
        // Generate new audio
        console.log(`[Regenerate Scene API] Generating new audio for scene ${scene.scene_order + 1}`);
        const videoId = uuid();
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
        const segmentPath = path.join(process.cwd(), 'public', 'assets', 'temp', `scene_${videoId}_${scene.scene_order}.mp4`);
        
        // Ensure temp directory exists
        await fs.mkdir(path.dirname(segmentPath), { recursive: true });
        
        await createVideoSegment(
          imageResult.imageUrl,
          audioResult.url,
          audioResult.duration || 3,
          segmentPath
        );
        
        const sceneVideoUrl = `/assets/temp/scene_${videoId}_${scene.scene_order}.mp4`;
        
        // Update scene in database
        await pb.collection('scenes').update(sceneId, {
          image_url: imageResult.imageUrl,
          audio_url: audioResult.url,
          duration: audioResult.duration || 3
        });
        
        // Update job progress
        const updatedScenes = await pbHelpers.getVideoScenes(job.video!);
        const scenesWithVideoUrls = updatedScenes.map((s, index) => ({
          ...s,
          video_url: s.id === sceneId ? sceneVideoUrl : `/assets/temp/scene_${videoId}_${index}.mp4`
        }));
        
        await pbHelpers.updateJob(jobId, {
          progress_data: {
            ...job.progress_data,
            message: `Scene ${scene.scene_order + 1} regenerated successfully`,
            generatedScenes: scenesWithVideoUrls,
            regeneratingScene: null
          }
        });
        
        console.log(`[Regenerate Scene API] Scene ${scene.scene_order + 1} regenerated successfully`);
        
      } catch (error: any) {
        console.error(`[Regenerate Scene API] Error regenerating scene ${sceneId}:`, error);
        await pbHelpers.updateJob(jobId, {
          progress_data: {
            ...job.progress_data,
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