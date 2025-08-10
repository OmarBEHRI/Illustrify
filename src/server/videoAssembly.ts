import { directVideo, Scene } from './director';
import { generateSceneImages } from './imageGen';
import { saveBufferToPublic } from './storage';
import path from 'path';
import fs from 'fs/promises';

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
 * Generate multiple audio files for scenes
 */
async function generateScenesAudio(scenes: Scene[]): Promise<{ audioUrls: string[]; errors: string[] }> {
  const audioUrls: string[] = [];
  const errors: string[] = [];

  console.log(`[VideoAssembly] Generating audio for ${scenes.length} scenes`);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    console.log(`[VideoAssembly] Generating audio for scene ${i + 1}: "${scene.narration.slice(0, 50)}..."`);
    
    const result = await generateSceneAudio(scene.narration);
    
    if (result.success && result.url) {
      audioUrls.push(result.url);
    } else {
      errors.push(`Scene ${i + 1} audio: ${result.error || 'Failed to generate audio'}`);
      console.error(`Failed to generate audio for scene ${i + 1}:`, result.error);
    }
  }

  return { audioUrls, errors };
}

/**
 * Save images to public storage and return URLs
 */
async function saveSceneImages(imageBuffers: Buffer[]): Promise<{ imageUrls: string[]; errors: string[] }> {
  const imageUrls: string[] = [];
  const errors: string[] = [];

  console.log(`[VideoAssembly] Saving ${imageBuffers.length} scene images`);

  for (let i = 0; i < imageBuffers.length; i++) {
    try {
      const saved = await saveBufferToPublic(imageBuffers[i], 'images', 'png');
      imageUrls.push(saved.url);
      console.log(`[VideoAssembly] Saved scene ${i + 1} image: ${saved.url}`);
    } catch (error: any) {
      errors.push(`Scene ${i + 1} image save: ${error.message}`);
      console.error(`Failed to save scene ${i + 1} image:`, error);
    }
  }

  return { imageUrls, errors };
}

/**
 * Create a simple video assembly using FFmpeg (placeholder for now)
 * For now, this returns a mock video URL since we don't have FFmpeg integration yet
 */
async function assembleVideo(imageUrls: string[], audioUrls: string[]): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  try {
    console.log(`[VideoAssembly] Assembling video with ${imageUrls.length} images and ${audioUrls.length} audio files`);
    
    // TODO: Implement actual FFmpeg video assembly
    // For now, return a placeholder video URL
    // This would involve:
    // 1. Download images and audio files locally
    // 2. Use FFmpeg to create video with image slides and audio overlay
    // 3. Apply transitions, pan/zoom effects
    // 4. Save final video and return URL
    
    // Placeholder implementation - return a mock video
    const mockVideoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    
    console.log(`[VideoAssembly] Video assembly completed (mock): ${mockVideoUrl}`);
    return { success: true, videoUrl: mockVideoUrl };
    
  } catch (error: any) {
    return { success: false, error: error.message || 'Video assembly failed' };
  }
}

/**
 * Main function to generate a complete video from story input
 */
export async function generateVideo(inputText: string, visualStyle: string): Promise<VideoGenerationResult> {
  const errors: string[] = [];
  
  try {
    console.log(`[VideoAssembly] Starting video generation for story: "${inputText.slice(0, 100)}..."`);
    
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
    
    // Step 3: Save images and get URLs
    console.log('[VideoAssembly] Step 3: Saving scene images...');
    const { imageUrls, errors: imageErrors } = await saveSceneImages(imageResult.images);
    errors.push(...imageErrors);
    
    // Step 4: Generate audio for all scenes
    console.log('[VideoAssembly] Step 4: Generating audio for scenes...');
    const { audioUrls, errors: audioErrors } = await generateScenesAudio(scenes);
    errors.push(...audioErrors);
    
    // Step 5: Assemble final video
    console.log('[VideoAssembly] Step 5: Assembling final video...');
    const videoResult = await assembleVideo(imageUrls, audioUrls);
    
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