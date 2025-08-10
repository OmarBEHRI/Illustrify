import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { default: pdf } = await import('pdf-parse');
  const form = await req.formData();
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file' }, { status: 400 });
  }
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  const data = await pdf(buf);
  const text = data.text.trim().replace(/\s+\n/g, '\n');
  return NextResponse.json({ text });
}


