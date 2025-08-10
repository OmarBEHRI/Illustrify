import { NextResponse } from 'next/server';
import { createJob, getCurrentUser, getJob, saveVideo, spendCredits, updateJob } from '@/server/db';
import { generateVideo } from '@/server/videoAssembly';

function qualityCost(q: 'LOW'|'MEDIUM'|'MAX') { return q==='LOW'?0:q==='MEDIUM'?10:50; }

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { story, style, quality } = await req.json();
  if (!story || !quality) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const q = (String(quality).toUpperCase() as 'LOW'|'MEDIUM'|'MAX');
  const cost = qualityCost(q);
  try {
    if (cost > 0) await spendCredits(user.id, cost);
  } catch {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }
  const job = await createJob(user.id, { story, style, quality: q });

  // Start real video generation pipeline
  setTimeout(async () => {
    try {
      await updateJob(job.id, { status: 'processing' });
      
      console.log(`[Generate API] Starting video generation for job ${job.id}`);
      const result = await generateVideo(story, style);
      
      if (result.success && result.videoUrl) {
        const videoTitle = (story as string).slice(0, 80) + '...';
        await saveVideo(user.id, videoTitle, result.videoUrl, q);
        await updateJob(job.id, { status: 'done', url: result.videoUrl });
        console.log(`[Generate API] Video generation completed for job ${job.id}: ${result.videoUrl}`);
      } else {
        console.error(`[Generate API] Video generation failed for job ${job.id}:`, result.error);
        await updateJob(job.id, { status: 'error' });
      }
    } catch (e: any) {
      console.error(`[Generate API] Video generation error for job ${job.id}:`, e);
      await updateJob(job.id, { status: 'error' });
    }
  }, 1000);

  return NextResponse.json({ jobId: job.id });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 });
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ status: job.status, url: job.url ?? null });
}


