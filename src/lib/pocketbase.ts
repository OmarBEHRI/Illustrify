import PocketBase from 'pocketbase';

// Types for our collections
export interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
  avatar?: string;
  created: string;
  updated: string;
}

export interface Video {
  id: string;
  user: string;
  title: string;
  story_input: string;
  visual_style: string;
  quality: 'LOW' | 'HIGH' | 'MAX';
  video_url: string;
  thumbnail_url?: string;
  duration?: number;
  file_size?: number;
  status: 'processing' | 'completed' | 'failed';
  created: string;
  updated: string;
}

export interface GenerationJob {
  id: string;
  user: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  story_input: string;
  visual_style: string;
  quality: 'LOW' | 'HIGH' | 'MAX';
  input_type: 'text' | 'pdf' | 'youtube';
  video?: string;
  error_message?: string;
  progress_data?: any;
  created: string;
  updated: string;
}

export interface Scene {
  id: string;
  video: string;
  job: string;
  scene_order: number;
  image_description: string;
  narration: string;
  image_url?: string;
  audio_url?: string;
  video_url?: string;
  duration?: number;
  created: string;
}

export interface CreditTransaction {
  id: string;
  user: string;
  type: 'purchase' | 'spend' | 'refund' | 'bonus';
  amount: number;
  description: string;
  job?: string;
  payment_reference?: string;
  created: string;
}

// Create PocketBase instance
const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090');

// Enable auto cancellation for duplicate requests
pb.autoCancellation(false);

export default pb;

// Helper functions for common operations
export const pbHelpers = {
  // Auth helpers
  async signUp(email: string, name: string, password: string): Promise<User> {
    const userData = {
      email,
      name,
      password,
      passwordConfirm: password,
      credits: 100, // Default credits
    };
    
    const record = await pb.collection('users').create(userData);
    await pb.collection('users').authWithPassword(email, password);
    return record as unknown as User;
  },

  async signIn(email: string, password: string): Promise<User> {
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData.record as unknown as User;
  },

  signOut() {
    pb.authStore.clear();
  },

  getCurrentUser(): User | null {
    return pb.authStore.model as User | null;
  },

  isAuthenticated(): boolean {
    return pb.authStore.isValid;
  },

  // Credit helpers
  async addCredits(userId: string, amount: number, description: string = 'Credits added'): Promise<void> {
    // Create transaction record
    await pb.collection('credit_transactions').create({
      user: userId,
      type: 'purchase',
      amount: amount,
      description: description,
    });

    // Update user credits
    const user = await pb.collection('users').getOne(userId);
    await pb.collection('users').update(userId, {
      credits: user.credits + amount,
    });
  },

  async spendCredits(userId: string, amount: number, jobId?: string): Promise<void> {
    const user = await pb.collection('users').getOne(userId);
    if (user.credits < amount) {
      throw new Error('Insufficient credits');
    }

    // Create transaction record
    await pb.collection('credit_transactions').create({
      user: userId,
      type: 'spend',
      amount: -amount,
      description: `Credits spent on video generation`,
      job: jobId,
    });

    // Update user credits
    await pb.collection('users').update(userId, {
      credits: user.credits - amount,
    });
  },

  // Job helpers
  async createJob(userId: string, payload: {
    story_input: string;
    visual_style: string;
    quality: 'LOW' | 'HIGH' | 'MAX';
    input_type: 'text' | 'pdf' | 'youtube';
    tts_engine?: string;
    voice?: string;
  }): Promise<GenerationJob> {
    const jobData = {
      user: userId,
      status: 'queued',
      ...payload,
    };
    
    const record = await pb.collection('generation_jobs').create(jobData);
    return record as unknown as GenerationJob;
  },

  async updateJob(jobId: string, updates: Partial<GenerationJob>): Promise<GenerationJob> {
    const record = await pb.collection('generation_jobs').update(jobId, updates);
    return record as GenerationJob;
  },

  async getJob(jobId: string): Promise<GenerationJob | null> {
    try {
      const record = await pb.collection('generation_jobs').getOne(jobId);
      return record as GenerationJob;
    } catch {
      return null;
    }
  },

  // Video helpers
  async saveVideo(userId: string, title: string, videoUrl: string, quality: 'LOW' | 'HIGH' | 'MAX', storyInput: string, visualStyle: string): Promise<Video> {
    const videoData = {
      user: userId,
      title,
      story_input: storyInput,
      visual_style: visualStyle,
      quality,
      video_url: videoUrl,
      status: 'completed',
    };
    
    const record = await pb.collection('videos').create(videoData);
    return record as Video;
  },

  async getUserVideos(userId: string): Promise<Video[]> {
    const records = await pb.collection('videos').getFullList({
      filter: `user = "${userId}"`,
      sort: '-created',
    });
    return records as Video[];
  },

  async getAllVideos(): Promise<Video[]> {
    const records = await pb.collection('videos').getFullList({
      sort: '-created',
      expand: 'user',
    });
    return records as Video[];
  },

  // Scene helpers
  async createScene(videoId: string, jobId: string, sceneData: {
    scene_order: number;
    image_description: string;
    narration: string;
    image_url?: string;
    audio_url?: string;
    duration?: number;
  }): Promise<Scene> {
    const data = {
      video: videoId,
      job: jobId,
      ...sceneData,
    };
    
    const record = await pb.collection('scenes').create(data);
    return record as Scene;
  },

  async getVideoScenes(videoId: string): Promise<Scene[]> {
    const records = await pb.collection('scenes').getFullList({
      filter: `video = "${videoId}"`,
      sort: 'scene_order',
    });
    return records as Scene[];
  },

  async updateScene(sceneId: string, updates: Partial<Scene>): Promise<Scene> {
    const record = await pb.collection('scenes').update(sceneId, updates);
    return record as Scene;
  },

  async getJobScenes(jobId: string): Promise<Scene[]> {
    const records = await pb.collection('scenes').getFullList({
      filter: `job = "${jobId}"`,
      sort: 'scene_order',
    });
    return records as Scene[];
  },
};