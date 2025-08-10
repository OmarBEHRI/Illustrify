import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { createUser, findUserByEmail, findUserById, setCurrentUser } from './db';

export async function signUp(email: string, name: string, password: string) {
  const hash = await bcrypt.hash(password, 10);
  const user = await createUser(email, name, hash);
  await setCurrentUser(user.id);
  return user;
}

export async function signIn(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, user.hash);
  if (!ok) throw new Error('Invalid credentials');
  await setCurrentUser(user.id);
  return user;
}

export async function getCurrentUser() {
  const id = cookies().get('uid')?.value;
  if (!id) return null;
  return await findUserById(id);
}


