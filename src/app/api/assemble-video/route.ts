import { NextResponse } from 'next/server';
import pb, { pbHelpers } from '@/lib/pocketbase';
import { concatenateSegments } from '@/server/videoAssembly';
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
    
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }
    
    // Get the job
    const job = await pbHelpers.getJob(jobId);
    if (!job || job.user !== user.id) {
      return NextResponse.json({ error: 'Job not found or unauthorized' }, { status: 404 });
    }
    
    if (!job.video) {
      return NextResponse.json({ error: 'No video associated with job' }, { status: 400 });
    }
    
    // Get all scenes for the video
    const scenes = await pbHelpers.getVideoScenes(job.video);
    if (scenes.length === 0) {
      return NextResponse.json({ error: 'No scenes found for video' }, { status: 400 });
    }
    
    // Start assembly process
    setTimeout(async () => {
      try {
        console.log(`[Assemble Video API] Starting video assembly for job ${jobId}`);
        
        // Update job progress - starting assembly
        await pbHelpers.updateJob(jobId, {
          progress: {
            step: 'assembling',
            progress: 90,
            message: 'Starting video assembly...',
            sub_step: 'preparing',
            assembly_progress: {
              status: 'preparing',
              total_scenes: scenes.length,
              current_step: 'validating_scenes'
            },
            timestamp: new Date().toISOString()
          }
        });
        
        // Create paths for scene segments using video_url from database
        const publicRoot = path.join(process.cwd(), 'public');
        const segmentPaths: string[] = [];
        
        // Sort scenes by order and create segment paths
        const sortedScenes = scenes.sort((a, b) => a.scene_order - b.scene_order);
        
        for (const scene of sortedScenes) {
          if (!scene.video_url) {
            throw new Error(`Scene ${scene.scene_order} is missing video_url`);
          }
          
          // Build full path to scene video file
          const segmentPath = path.join(publicRoot, 'assets', 'temp', scene.video_url);
          
          // Verify the file exists
          try {
            await fs.access(segmentPath);
            segmentPaths.push(segmentPath);
            console.log(`[Assemble Video API] Scene ${scene.scene_order} video found: ${segmentPath}`);
          } catch (error) {
            throw new Error(`Scene ${scene.scene_order} video file not found: ${segmentPath}`);
          }
        }
        
        if (segmentPaths.length !== scenes.length) {
          throw new Error('Not all scene segments are available for assembly');
        }
        
        // Update progress - scenes validated
        await pbHelpers.updateJob(jobId, {
          progress: {
            step: 'assembling',
            progress: 92,
            message: `Validated ${segmentPaths.length} scene segments`,
            sub_step: 'validated',
            assembly_progress: {
              status: 'validated',
              total_scenes: scenes.length,
              current_step: 'concatenating_segments'
            },
            timestamp: new Date().toISOString()
          }
        });
        
        // Generate final video ID and path
        const finalVideoId = uuid();
        const outputPath = path.join(process.cwd(), 'public', 'assets', 'videos', `${finalVideoId}.mp4`);
        
        // Ensure videos directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        
        // Update progress - starting concatenation
        await pbHelpers.updateJob(jobId, {
          progress: {
            step: 'assembling',
            progress: 95,
            message: `Concatenating ${segmentPaths.length} video segments...`,
            sub_step: 'concatenating',
            assembly_progress: {
              status: 'concatenating',
              total_scenes: scenes.length,
              current_step: 'processing_video'
            },
            timestamp: new Date().toISOString()
          }
        });
        
        // Concatenate all segments into final video
        console.log(`[Assemble Video API] Concatenating ${segmentPaths.length} segments`);
        await concatenateSegments(segmentPaths, outputPath);
        
        const finalVideoUrl = `/assets/videos/${finalVideoId}.mp4`;
        
        // Update video record with final URL
        await pb.collection('videos').update(job.video!, {
          video_url: finalVideoUrl,
          status: 'completed'
        });
        
        // Update job as completed
        await pbHelpers.updateJob(jobId, {
          status: 'completed',
          progress: {
            step: 'video_ready',
            progress: 100,
            message: 'Video assembled successfully!',
            sub_step: 'completed',
            assembly_progress: {
              status: 'completed',
              total_scenes: scenes.length,
              current_step: 'finished'
            },
            finalVideoUrl: finalVideoUrl,
            video_ready: true,
            timestamp: new Date().toISOString()
          }
        });
        
        // Clean up temporary scene files
        try {
          for (const segmentPath of segmentPaths) {
            await fs.unlink(segmentPath);
          }
          console.log(`[Assemble Video API] Cleaned up ${segmentPaths.length} temporary files`);
        } catch (cleanupError) {
          console.warn('Failed to cleanup some temporary files:', cleanupError);
        }
        
        console.log(`[Assemble Video API] Video assembly completed for job ${jobId}: ${finalVideoUrl}`);
        
      } catch (error: any) {
        console.error(`[Assemble Video API] Error assembling video for job ${jobId}:`, error);
        await pbHelpers.updateJob(jobId, {
          status: 'failed',
          error_message: `Video assembly failed: ${error.message}`
        });
      }
    }, 1000);
    
    return NextResponse.json({ success: true, message: 'Video assembly started' });
    
  } catch (error: any) {
    console.error('Assemble Video API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}