import { NextResponse } from 'next/server';
import { getAudioDuration } from '@/server/videoAssembly';
import path from 'path';
import fs from 'fs/promises';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import fsSync from 'fs';

// Ensure ffmpeg binary path is set robustly (avoid Next bundling .next vendor-chunks)
function resolveFfmpegBinary(): string | null {
  try {
    const isWin = process.platform === 'win32';
    const ffmpegFile = isWin ? 'ffmpeg.exe' : 'ffmpeg';

    const candidates: string[] = [];

    // 1) Explicit env var wins
    if (process.env.FFMPEG_PATH) {
      candidates.push(path.resolve(process.env.FFMPEG_PATH));
    }

    // 2) Direct node_modules path - ffmpeg-static places binary directly in root
    candidates.push(path.resolve(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegFile));

    // 3) Walk up from __dirname to locate node_modules/ffmpeg-static/ffmpeg(.exe)
    try {
      let dir = __dirname;
      for (let i = 0; i < 6; i++) {
        const p = path.resolve(dir, 'node_modules', 'ffmpeg-static', ffmpegFile);
        candidates.push(p);
        const parent = path.resolve(dir, '..');
        if (parent === dir) break;
        dir = parent;
      }
    } catch {}

    // 4) Value exported by ffmpeg-static import (filter if in .next bundled path)
    if (ffmpegStatic && typeof ffmpegStatic === 'string') {
      candidates.push(ffmpegStatic);
    }

    // 5) Common install locations (very last resorts)
    if (!isWin) {
      candidates.push('/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg');
    }

    // Filter out any paths inside .next where the binary won't exist
    const filtered = candidates.filter(Boolean).filter(p => !p.includes(`${path.sep}.next${path.sep}`));

    console.log('[Test Assembly] FFmpeg candidates (filtered):', filtered);

    for (const c of filtered) {
      try {
        if (fsSync.existsSync(c)) {
          console.log('[Test Assembly] FFmpeg binary found at:', c);
          return c;
        }
      } catch {}
    }

    // As an absolute last resort, allow .next path only if it actually exists
    console.log('[Test Assembly] No filtered FFmpeg found, trying all candidates:', candidates);
    for (const c of candidates) {
      try {
        if (fsSync.existsSync(c)) {
          console.log('[Test Assembly] FFmpeg binary found (fallback) at:', c);
          return c;
        }
      } catch {}
    }

    console.error('[Test Assembly] No FFmpeg binary found in any candidate path');
    return null;
  } catch (e) {
    console.error('[Test Assembly] Error in resolveFfmpegBinary:', e);
    return null;
  }
}

function ensureFfmpegConfigured() {
  try {
    const sel = resolveFfmpegBinary();
    if (sel) {
      ffmpeg.setFfmpegPath(sel);
      console.log('[Test Assembly] Using ffmpeg from:', sel);
    }
  } catch (e) {
    // noop
  }
}

// Set up ffmpeg binary early
const selectedFfmpeg = resolveFfmpegBinary();
if (selectedFfmpeg) {
  ffmpeg.setFfmpegPath(selectedFfmpeg);
  console.log('[Test Assembly] Using ffmpeg from:', selectedFfmpeg);
} else {
  // Fallback to what ffmpeg-static provided (may fail if bundled path is invalid)
  ffmpeg.setFfmpegPath((ffmpegStatic as unknown as string) || 'ffmpeg');
  console.warn('[Test Assembly] Failed to resolve ffmpeg path robustly; falling back');
}

try {
  const platform = process.platform;
  const arch = process.arch;
  const extension = platform === 'win32' ? '.exe' : '';

  const norm = (p: string) => p.replace(/\\/g, '/');
  const unique = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

  const candidates: string[] = [];

  if (process.env.FFPROBE_PATH) {
    candidates.push(path.resolve(process.env.FFPROBE_PATH));
  }

  candidates.push(
    path.join(process.cwd(), 'node_modules', 'ffprobe-static', 'bin', platform, arch, `ffprobe${extension}`)
  );

  const pkgCandidate = path.join(process.cwd(), 'node_modules', 'ffprobe-static', 'package.json');
  if (fsSync.existsSync(pkgCandidate)) {
    const ffprobeDir = path.dirname(pkgCandidate);
    candidates.push(path.join(ffprobeDir, 'bin', platform, arch, `ffprobe${extension}`));
  }

  let walkDir = __dirname;
  for (let i = 0; i < 6; i++) {
    candidates.push(
      path.join(walkDir, 'node_modules', 'ffprobe-static', 'bin', platform, arch, `ffprobe${extension}`)
    );
    walkDir = path.dirname(walkDir);
  }

  if (ffprobeStatic && (ffprobeStatic as any).path) {
    candidates.push(path.resolve((ffprobeStatic as any).path));
  }

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
    console.log('[Test Assembly] Using ffprobe from:', selected);
  } else {
    console.error('[Test Assembly] Could not find a valid ffprobe binary. Tried candidates:', filtered);
  }
} catch (error: any) {
  console.error('[Test Assembly] Error setting ffprobe path:', error?.message || error);
}

// Internal assembly function that reuses videoAssembly logic but accepts pre-existing files
async function testAssembleVideo(imageUrls: string[], audioUrls: string[], videoId: string): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  try {
    console.log(`[Test Assembly] Testing video assembly with ${imageUrls.length} images and ${audioUrls.length} audio files`);
    
    if (imageUrls.length !== audioUrls.length) {
      return { success: false, error: 'Mismatch between images and audio files' };
    }

    // Ensure videos directory exists
    const publicRoot = path.join(process.cwd(), 'public');
    const videosDir = path.join(publicRoot, 'assets', 'videos');
    await fs.mkdir(videosDir, { recursive: true });

    const outputPath = path.join(videosDir, `test_${videoId}.mp4`);
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Convert URLs to local file paths and get durations
    const localImagePaths: string[] = [];
    const localAudioPaths: string[] = [];
    const actualDurations: number[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const audioUrl = audioUrls[i];
      
      // Convert URLs to local file paths
      const imagePath = path.join(publicRoot, imageUrl.replace(/^\//, ''));
      const audioPath = path.join(publicRoot, audioUrl.replace(/^\//, ''));
      
      // Verify files exist
      try {
        await fs.access(imagePath);
        await fs.access(audioPath);
      } catch (error) {
        return { success: false, error: `File not found: ${imagePath} or ${audioPath}` };
      }
      
      localImagePaths.push(imagePath);
      localAudioPaths.push(audioPath);
      
      // Get actual audio duration
      const duration = await getAudioDuration(audioPath);
      actualDurations.push(duration);
      console.log(`[Test Assembly] Audio duration for ${audioPath}: ${duration}s`);
    }

    // Create video segments
    const segmentPaths: string[] = [];
    
    for (let i = 0; i < localImagePaths.length; i++) {
      const segmentPath = path.join(tempDir, `test_scene_${i}.mp4`);
      segmentPaths.push(segmentPath);
      
      await createVideoSegment(localImagePaths[i], localAudioPaths[i], actualDurations[i], segmentPath);
      console.log(`[Test Assembly] Created test segment ${i}: ${segmentPath}`);
    }

    // Concatenate all segments into final video
    await concatenateSegments(segmentPaths, outputPath);
    
    // Clean up temp files
    for (const segmentPath of segmentPaths) {
      try {
        await fs.unlink(segmentPath);
      } catch (err) {
        console.warn(`Could not delete temp file ${segmentPath}:`, err);
      }
    }
    
    const videoUrl = `/assets/videos/test_${videoId}.mp4`;
    console.log(`[Test Assembly] Successfully created test video: ${videoUrl}`);
    
    return { success: true, videoUrl };
    
  } catch (error: any) {
    console.error('[Test Assembly] Video assembly failed:', error);
    return { success: false, error: error.message };
  }
}

// Reused functions from videoAssembly.ts
async function createVideoSegment(imagePath: string, audioPath: string, duration: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ensureFfmpegConfigured();
    const FPS = 25;
    const WIDTH = 1920;
    const HEIGHT = 1080;
    const totalDuration = duration + 1; // narration + 1 sec silence
    const totalFrames = Math.round(totalDuration * FPS);
    const startZoom = 1.0;
    const endZoom = 1.2;

    const zoomFilter = [
      `scale=iw*max(${WIDTH}/iw\\,${HEIGHT}/ih):ih*max(${WIDTH}/iw\\,${HEIGHT}/ih)`,
      `crop=${WIDTH}:${HEIGHT}`,
      `zoompan=z='${startZoom} + (${endZoom}-${startZoom})*on/${totalFrames}':x='(iw-ow*z)/2':y='(ih-oh*z)/2':d=${totalFrames}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`
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
      .on('start', (cmd) => console.log(`[Test Assembly] FFmpeg command: ${cmd}`))
      .on('progress', (progress) => console.log(`[Test Assembly] Segment progress: ${Math.round(progress.percent || 0)}%`))
      .on('end', () => {
        console.log(`[Test Assembly] Segment created successfully: ${outputPath}`);
        resolve();
      })
      .on('error', (error) => {
        console.error(`[Test Assembly] Segment creation failed:`, error);
        reject(error);
      })
      .run();
  });
}

async function concatenateSegments(segmentPaths: string[], outputPath: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    console.log(`[Test Assembly] Concatenating ${segmentPaths.length} segments into: ${outputPath}`);
    ensureFfmpegConfigured();
    try {
      const tempDir = path.dirname(segmentPaths[0]);
      const concatListPath = path.join(tempDir, 'test_concat_list.txt');
      const concatList = segmentPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
      await fs.writeFile(concatListPath, concatList);
      
      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-c copy',
          '-avoid_negative_ts make_zero'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log(`[Test Assembly] Concat FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          console.log(`[Test Assembly] Concat progress: ${Math.round(progress.percent || 0)}%`);
        })
        .on('end', async () => {
          console.log(`[Test Assembly] Video concatenation completed: ${outputPath}`);
          try {
            await fs.unlink(concatListPath);
          } catch (err) {
            console.warn(`Could not delete concat list file:`, err);
          }
          resolve();
        })
        .on('error', (error) => {
          console.error(`[Test Assembly] Video concatenation failed:`, error);
          reject(error);
        })
        .run();
    } catch (error) {
      reject(error);
    }
  });
}

export async function POST(request: Request) {
  try {
    let testId: string | null = null;

    // Only attempt to parse JSON when content-type indicates JSON
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const data = await request.json();
        if (data && typeof data === 'object') {
          testId = (data as any).testId ?? null;
        }
      } catch {
        // Ignore JSON parse errors; we'll fallback to query string
      }
    }

    // Fallback to query param when JSON body is invalid/absent or not JSON
    if (!testId) {
      const url = new URL(request.url);
      testId = url.searchParams.get('testId');
    }

    if (!testId) {
      return NextResponse.json({ error: 'testId is required' }, { status: 400 });
    }

    // Use the specific files mentioned by the user
    const imageUrls = [
      `/assets/images/${testId}_scene_000.png`,
      `/assets/images/${testId}_scene_001.png`
    ];
    
    const audioUrls = [
      `/assets/audio/${testId}_scene_000.mp3`,
      `/assets/audio/${testId}_scene_001.mp3`
    ];

    console.log(`[Test Assembly API] Starting test assembly for ID: ${testId}`);
    console.log(`[Test Assembly API] Images: ${imageUrls.join(', ')}`);
    console.log(`[Test Assembly API] Audio: ${audioUrls.join(', ')}`);

    const result = await testAssembleVideo(imageUrls, audioUrls, testId);
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        videoUrl: result.videoUrl,
        message: 'Video assembly test completed successfully' 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[Test Assembly API] Error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Unknown error occurred' 
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const testId = url.searchParams.get('testId');

    if (!testId) {
      return NextResponse.json({ 
        status: 'Test Assembly API is ready',
        description: 'POST with testId in JSON body or GET with ?testId=... to test video assembly with existing files'
      });
    }

    const imageUrls = [
      `/assets/images/${testId}_scene_000.png`,
      `/assets/images/${testId}_scene_001.png`
    ];

    const audioUrls = [
      `/assets/audio/${testId}_scene_000.mp3`,
      `/assets/audio/${testId}_scene_001.mp3`
    ];

    console.log(`[Test Assembly API][GET] Starting test assembly for ID: ${testId}`);
    const result = await testAssembleVideo(imageUrls, audioUrls, testId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        videoUrl: result.videoUrl,
        message: 'Video assembly test completed successfully'
      });
    }

    return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  } catch (error: any) {
    console.error('[Test Assembly API][GET] Error:', error);
    return NextResponse.json({ error: error?.message || 'Unknown error occurred' }, { status: 500 });
  }
}