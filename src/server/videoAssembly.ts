import { directVideo, Scene } from './director';
import { generateSceneImages } from './imageGen';
import { saveBufferToPublic, saveBufferWithCustomName } from './storage';
import path from 'path';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuid } from 'uuid';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import fsSync from 'fs';

// Prefer environment variable for FFmpeg path
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(path.resolve(process.env.FFMPEG_PATH));
  console.log('[VideoAssembly] Using FFmpeg from env:', process.env.FFMPEG_PATH);
} else if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);
  console.log('[VideoAssembly] Using FFmpeg from ffmpeg-static');
} else {
  console.error('[VideoAssembly] No FFmpeg binary found!');
}

try {
  if (process.env.FFPROBE_PATH) {
    const resolvedPath = path.resolve(process.env.FFPROBE_PATH);
    if (fsSync.existsSync(resolvedPath)) {
      ffmpeg.setFfprobePath(resolvedPath);
      console.log('[VideoAssembly] Using FFprobe from env:', resolvedPath);
    } else {
      console.error('[VideoAssembly] FFPROBE_PATH is set but file does not exist:', resolvedPath);
    }
  } else {
    const platform = process.platform;
    const arch = process.arch;
    const extension = platform === 'win32' ? '.exe' : '';

    const norm = (p: string) => p.replace(/\\/g, '/');
    const unique = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

    const candidates: string[] = [];

    // Prefer project root node_modules
    candidates.push(
      path.join(
        process.cwd(),
        'node_modules',
        'ffprobe-static',
        'bin',
        platform,
        arch,
        `ffprobe${extension}`
      )
    );

    // package.json-resolved node_modules path
    const pkgCandidate = path.join(
      process.cwd(),
      'node_modules',
      'ffprobe-static',
      'package.json'
    );
    if (fsSync.existsSync(pkgCandidate)) {
      const ffprobeDir = path.dirname(pkgCandidate);
      candidates.push(
        path.join(ffprobeDir, 'bin', platform, arch, `ffprobe${extension}`)
      );
    }

    // Walk up from __dirname
    let walkDir = __dirname;
    for (let i = 0; i < 6; i++) {
      candidates.push(
        path.join(
          walkDir,
          'node_modules',
          'ffprobe-static',
          'bin',
          platform,
          arch,
          `ffprobe${extension}`
        )
      );
      walkDir = path.dirname(walkDir);
    }

    // Last candidate from ffprobe-static
    if (ffprobeStatic && (ffprobeStatic as any).path) {
      candidates.push(path.resolve((ffprobeStatic as any).path));
    }

    // Filter out .next paths (cross-platform)
    const filtered = unique(
      candidates.filter((p) => {
        const np = norm(p);
        return p && !np.includes('/.next/');
      })
    );

    let selected: string | null = null;
    for (const c of filtered) {
      if (fsSync.existsSync(c)) {
        selected = c;
        break;
      }
    }

    if (!selected) {
      for (const c of unique(candidates)) {
        if (fsSync.existsSync(c)) {
          selected = c;
          break;
        }
      }
    }

    if (selected) {
      ffmpeg.setFfprobePath(selected);
      console.log('[VideoAssembly] Using FFprobe from:', selected);
    } else {
      console.error(
        '[VideoAssembly] Could not find a valid ffprobe binary. Tried candidates:',
        filtered
      );
    }
  }
} catch (error: any) {
  console.error('[VideoAssembly] Error setting ffprobe path:', error?.message || error);
}

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
  details?: {
    scenes: Scene[];
    imageUrls: string[];
    audioUrls: string[];
    errors: string[];
  };
}

/**
 * Generate audio for a single scene narration
 */
async function generateSceneAudio(narration: string, voiceId: string = 'JBFqnCBsd6RMkjVDRZzb'): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'ELEVENLABS_API_KEY not configured' };
    }

    const outputFormat = 'mp3_44100_128';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: narration,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      return { success: false, error: `TTS API failed with status ${res.status}` };
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const saved = await saveBufferToPublic(buffer, 'audio', 'mp3');
    
    return { success: true, url: saved.url };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown audio generation error' };
  }
}

/**
 * Create a video segment from an image with zoom animation and audio
 */
async function createVideoSegment(imagePath: string, audioPath: string, duration: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const FPS = 25;
    const WIDTH = 1920;
    const HEIGHT = 1080;
    const totalDuration = duration + 1; // narration + 1 sec silence
    const totalFrames = Math.round(totalDuration * FPS);
    const startZoom = 1.0;
    const endZoom = 1.2;

    // Smooth zoom using time-based increment and full coverage scaling
    const zoomFilter = [
      // Scale to fully cover the frame while keeping aspect ratio
      `scale=iw*max(${WIDTH}/iw\\,${HEIGHT}/ih):ih*max(${WIDTH}/iw\\,${HEIGHT}/ih)`,
      // Crop to exactly WIDTHxHEIGHT so no borders remain
      `crop=${WIDTH}:${HEIGHT}`,
      // Smooth zoom over time
      `zoompan=z='${startZoom} + (${endZoom}-${startZoom})*on/${totalFrames}':d=${totalFrames}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`
    ].join(',');

    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop', '1'])
      .input(audioPath)
      .input('anullsrc=r=48000:cl=stereo')
      .inputFormat('lavfi')
      .inputOptions(['-t', '1'])
      .complexFilter([
        `[0:v]${zoomFilter}[v]`,
        `[1:a][2:a]concat=n=2:v=0:a=1[a]`
      ])
      .map('[v]')
      .map('[a]')
      .outputOptions([
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        `-r`, `${FPS}`,
        '-c:a', 'aac',
        '-ar', '48000',
        '-ac', '2',
        '-b:a', '192k',
        `-t`, `${totalDuration}`
      ])
      .output(outputPath)
      .on('end', () => {
        console.log(`[VideoAssembly] Segment created: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`[VideoAssembly] Error creating segment: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

/**
 * Concatenate video segments into final video
 */
async function concatenateSegments(segmentPaths: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(process.cwd(), 'temp');
    const concatListPath = path.join(tempDir, 'concat_list.txt');
    
    // Ensure temp directory exists
    if (!require('fs').existsSync(tempDir)) {
      require('fs').mkdirSync(tempDir, { recursive: true });
    }
    
    // Create concat list file
    const concatList = segmentPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    require('fs').writeFileSync(concatListPath, concatList);
    
    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(outputPath)
      .on('end', () => {
        console.log(`[VideoAssembly] Final video created: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`[VideoAssembly] Error concatenating segments: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

/**
 * Generate audio for a single scene with custom naming
 */
async function generateSceneAudioWithCustomName(narration: string, videoId: string, sceneIndex: number, voiceId: string = 'JBFqnCBsd6RMkjVDRZzb'): Promise<{ success: boolean; url?: string; error?: string; duration?: number }> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'ELEVENLABS_API_KEY not configured' };
    }

    const outputFormat = 'mp3_44100_128';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: narration,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      return { success: false, error: `TTS API failed with status ${res.status}` };
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const saved = await saveBufferWithCustomName(buffer, 'audio', 'mp3', videoId, sceneIndex);
    
    // Estimate duration based on text length (rough approximation: ~150 words per minute)
    const wordCount = narration.split(' ').length;
    const estimatedDuration = Math.max(2, Math.ceil((wordCount / 150) * 60)); // Minimum 2 seconds
    
    return { success: true, url: saved.url, duration: estimatedDuration };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown audio generation error' };
  }
}

/**
 * Function to get actual audio duration using ffprobe
 */
export function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration;
        resolve(duration || 0); // Return exact duration, not rounded
      }
    });
  });
}

/**
 * Generate multiple audio files for scenes with custom naming
 */
async function generateScenesAudio(scenes: Scene[], videoId: string): Promise<{ audioUrls: string[]; errors: string[]; audioDurations: number[] }> {
  const audioUrls: string[] = [];
  const errors: string[] = [];
  const audioDurations: number[] = [];

  console.log(`[VideoAssembly] Generating audio for ${scenes.length} scenes for video ${videoId}`);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    console.log(`[VideoAssembly] Generating audio for scene ${i}: "${scene.narration.slice(0, 50)}..."`);
    
    const result = await generateSceneAudioWithCustomName(scene.narration, videoId, i);
    
    if (result.success && result.url) {
      audioUrls.push(result.url);
      
      // Get actual audio duration instead of estimating
      try {
        const audioPath = path.join(process.cwd(), 'public', result.url.replace(/^\//, ''));
        const actualDuration = await getAudioDuration(audioPath);
        audioDurations.push(actualDuration);
      } catch (durationError: any) {
        console.warn(`Failed to get duration for scene ${i}, using estimated duration:`, durationError.message);
        audioDurations.push(result.duration || 3); // Fallback to estimated duration
      }
    } else {
      errors.push(`Scene ${i} audio: ${result.error || 'Failed to generate audio'}`);
      console.error(`Failed to generate audio for scene ${i}:`, result.error);
    }
  }

  return { audioUrls, errors, audioDurations };
}

/**
 * Save images to public storage with video ID and scene order
 */
async function saveSceneImages(imageBuffers: Buffer[], videoId: string): Promise<{ imageUrls: string[]; errors: string[] }> {
  const imageUrls: string[] = [];
  const errors: string[] = [];

  console.log(`[VideoAssembly] Saving ${imageBuffers.length} scene images for video ${videoId}`);

  for (let i = 0; i < imageBuffers.length; i++) {
    try {
      const saved = await saveBufferWithCustomName(imageBuffers[i], 'images', 'png', videoId, i);
      imageUrls.push(saved.url);
      console.log(`[VideoAssembly] Saved scene ${i} image: ${saved.url}`);
    } catch (error: any) {
      errors.push(`Scene ${i} image save: ${error.message}`);
      console.error(`Failed to save scene ${i} image:`, error);
    }
  }

  return { imageUrls, errors };
}

/**
 * Create video assembly using FFmpeg with zoom animations
 */
async function assembleVideo(imageUrls: string[], audioUrls: string[], audioDurations: number[], videoId: string): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  try {
    console.log(`[VideoAssembly] Assembling video ${videoId} with ${imageUrls.length} images and ${audioUrls.length} audio files`);
    
    if (imageUrls.length !== audioUrls.length || audioUrls.length !== audioDurations.length) {
      return { success: false, error: 'Mismatch between images, audio files, and durations' };
    }

    // Ensure videos directory exists
    const publicRoot = path.join(process.cwd(), 'public');
    const videosDir = path.join(publicRoot, 'assets', 'videos');
    await fs.mkdir(videosDir, { recursive: true });

    const outputPath = path.join(videosDir, `${videoId}.mp4`);
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Convert URLs to local file paths
      const localImagePaths: string[] = [];
      const localAudioPaths: string[] = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        const audioUrl = audioUrls[i];
        
        // Convert URLs to local file paths
        const imagePath = path.join(publicRoot, imageUrl.replace(/^\//, ''));
        const audioPath = path.join(publicRoot, audioUrl.replace(/^\//, ''));
        
        localImagePaths.push(imagePath);
        localAudioPaths.push(audioPath);
      }

      // Get actual audio durations instead of using estimates
      const actualDurations: number[] = [];
      for (const audioPath of localAudioPaths) {
        const duration = await getAudioDuration(audioPath);
        actualDurations.push(duration);
        console.log(`[VideoAssembly] Audio duration for ${audioPath}: ${duration}s`);
      }

      // Create video segments using actual durations and improved naming
      const segmentPaths: string[] = [];
      
      for (let i = 0; i < localImagePaths.length; i++) {
        const segmentPath = path.join(tempDir, `scene_${i}.mp4`);
        segmentPaths.push(segmentPath);
        
        await createVideoSegment(localImagePaths[i], localAudioPaths[i], actualDurations[i], segmentPath);
        console.log(`[VideoAssembly] Created segment ${i}: ${segmentPath}`);
      }

      // Concatenate all segments into final video using file-based concatenation
      await concatenateSegments(segmentPaths, outputPath);
      
      // Clean up temp files
      for (const segmentPath of segmentPaths) {
        try {
          await fs.unlink(segmentPath);
        } catch (err) {
          console.warn(`Could not delete temp file ${segmentPath}:`, err);
        }
      }
      
      // Clean up concat list file
      const concatListPath = path.join(tempDir, 'concat_list.txt');
      try {
        await fs.unlink(concatListPath);
      } catch (err) {
        console.warn('Could not delete concat list file:', err);
      }
      
      try {
        await fs.rmdir(tempDir);
      } catch (err) {
        console.warn('Could not remove temp directory:', err);
      }
      
      const videoUrl = `/assets/videos/${videoId}.mp4`;
      console.log(`[VideoAssembly] Video assembly completed: ${videoUrl}`);
      return { success: true, videoUrl };
      
    } catch (error: any) {
      // Clean up temp directory on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp directory:', cleanupError);
      }
      throw error;
    }
    
  } catch (error: any) {
    console.error('[VideoAssembly] Video assembly failed:', error);
    return { success: false, error: error.message || 'Video assembly failed' };
  }
}

/**
 * Main function to generate a complete video from story input
 */
export async function generateVideo(inputText: string, visualStyle: string): Promise<VideoGenerationResult> {
  const errors: string[] = [];
  const videoId = uuid(); // Generate unique video ID
  
  try {
    console.log(`[VideoAssembly] Starting video generation ${videoId} for story: "${inputText.slice(0, 100)}..."`);
    
    // Step 1: Generate scenes using director
    console.log('[VideoAssembly] Step 1: Generating scenes with director...');
    const scenes = await directVideo(inputText, visualStyle);
    
    if (!scenes || scenes.length === 0) {
      return { success: false, error: 'Failed to generate scenes from story' };
    }
    
    console.log(`[VideoAssembly] Generated ${scenes.length} scenes`);
    
    // Step 2: Generate images for all scenes
    console.log('[VideoAssembly] Step 2: Generating images for scenes...');
    const imageDescriptions = scenes.map(scene => scene.imageDescription);
    const imageResult = await generateSceneImages(imageDescriptions);
    
    if (!imageResult.success || imageResult.images.length === 0) {
      return {
        success: false,
        error: 'Failed to generate images for scenes',
        details: { scenes, imageUrls: [], audioUrls: [], errors: imageResult.errors }
      };
    }
    
    // Step 3: Save images with video ID and scene order
    console.log('[VideoAssembly] Step 3: Saving scene images...');
    const { imageUrls, errors: imageErrors } = await saveSceneImages(imageResult.images, videoId);
    errors.push(...imageErrors);
    
    // Step 4: Generate audio for all scenes with video ID and scene order
    console.log('[VideoAssembly] Step 4: Generating audio for scenes...');
    const { audioUrls, errors: audioErrors, audioDurations } = await generateScenesAudio(scenes, videoId);
    errors.push(...audioErrors);
    
    // Step 5: Assemble final video with zoom animations
    console.log('[VideoAssembly] Step 5: Assembling final video with zoom animations...');
    const videoResult = await assembleVideo(imageUrls, audioUrls, audioDurations, videoId);
    
    if (!videoResult.success) {
      return {
        success: false,
        error: videoResult.error || 'Video assembly failed',
        details: { scenes, imageUrls, audioUrls, errors }
      };
    }
    
    console.log(`[VideoAssembly] Video generation completed successfully: ${videoResult.videoUrl}`);
    
    return {
      success: true,
      videoUrl: videoResult.videoUrl,
      details: { scenes, imageUrls, audioUrls, errors }
    };
    
  } catch (error: any) {
    console.error('[VideoAssembly] Video generation failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown video generation error',
      details: { scenes: [], imageUrls: [], audioUrls: [], errors: [error.message] }
    };
  }
}