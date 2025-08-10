import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { v4 as uuid } from 'uuid';
import path from 'node:path';
import { cookies } from 'next/headers';

type User = { id: string; email: string; name: string; hash: string; credits: number };
type Video = { id: string; userId: string; title: string; url: string; quality: 'LOW'|'MEDIUM'|'MAX'; createdAt: number };
type Job = { id: string; userId: string; status: 'queued'|'processing'|'done'|'error'; url?: string; payload?: any };
type Data = { users: User[]; videos: Video[]; jobs: Job[] };

const dbFile = path.join(process.cwd(), 'db.json');
const adapter = new JSONFile<Data>(dbFile);
const db = new Low<Data>(adapter, { users: [], videos: [], jobs: [] });

export async function initDb() {
  await db.read();
  db.data ||= { users: [], videos: [], jobs: [] };
  await db.write();
}

export async function createUser(email: string, name: string, hash: string) {
  await initDb();
  const existing = db.data!.users.find(u => u.email === email);
  if (existing) return existing;
  const user = { id: uuid(), email, name, hash, credits: 100 };
  db.data!.users.push(user);
  await db.write();
  return user;
}

export async function findUserByEmail(email: string) {
  await initDb();
  return db.data!.users.find(u => u.email === email) || null;
}

export async function findUserById(id: string) {
  await initDb();
  return db.data!.users.find(u => u.id === id) || null;
}

export async function getCurrentUser() {
  await initDb();
  const cookieStore = cookies();
  const id = cookieStore.get('uid')?.value;
  if (!id) return null;
  return db.data!.users.find(u => u.id === id) || null;
}

export async function setCurrentUser(id: string) {
  cookies().set('uid', id, { httpOnly: false, sameSite: 'lax' });
}

export async function addCredits(userId: string, amount: number) {
  await initDb();
  const user = db.data!.users.find(u => u.id === userId);
  if (!user) return;
  user.credits += amount;
  await db.write();
}

export async function spendCredits(userId: string, amount: number) {
  await initDb();
  const user = db.data!.users.find(u => u.id === userId);
  if (!user) throw new Error('No user');
  if (user.credits < amount) throw new Error('Insufficient credits');
  user.credits -= amount;
  await db.write();
}

export async function createJob(userId: string, payload: any) {
  await initDb();
  const job: Job = { id: uuid(), userId, status: 'queued', payload };
  db.data!.jobs.push(job);
  await db.write();
  return job;
}

export async function updateJob(id: string, patch: Partial<Job>) {
  await initDb();
  const job = db.data!.jobs.find(j => j.id === id);
  if (!job) return null;
  Object.assign(job, patch);
  await db.write();
  return job;
}

export async function getJob(id: string) {
  await initDb();
  return db.data!.jobs.find(j => j.id === id) || null;
}

export async function saveVideo(userId: string, title: string, url: string, quality: 'LOW'|'MEDIUM'|'MAX') {
  await initDb();
  const video: Video = { id: uuid(), userId, title, url, quality, createdAt: Date.now() };
  db.data!.videos.push(video);
  await db.write();
  return video;
}

export async function getAllVideos() {
  await initDb();
  return db.data!.videos.sort((a,b)=>b.createdAt-a.createdAt);
}

export async function getUserVideos(userId: string) {
  await initDb();
  return db.data!.videos.filter(v => v.userId === userId).sort((a,b)=>b.createdAt-a.createdAt);
}


