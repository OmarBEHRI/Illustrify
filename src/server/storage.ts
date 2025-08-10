import fs from 'fs/promises';
import path from 'path';

function getPublicDir(): string {
  return path.join(process.cwd(), 'public');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveBufferToPublic(buffer: Buffer, subdir: string, extension: string): Promise<{ filePath: string; url: string }>{
  const publicRoot = getPublicDir();
  const dir = path.join(publicRoot, 'assets', subdir);
  await ensureDir(dir);
  const fileName = `${randomId()}.${extension.replace(/^\./, '')}`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);
  const url = `/assets/${subdir}/${fileName}`;
  return { filePath, url };
}



