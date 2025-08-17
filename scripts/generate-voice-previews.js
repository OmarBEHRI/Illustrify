const fs = require('fs');
const path = require('path');
const https = require('https');

// Voice configurations for ElevenLabs TTS
const voices = [
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel (Female)',
    description: 'Warm, friendly female voice',
    gender: 'female',
    fileName: 'rachel',
    sampleText: 'Hello! I\'m Rachel, your friendly AI voice assistant. I can help you create natural-sounding speech from any text.'
  },
  {
    id: '29vD33N1CtxCmqQRPOHJ',
    name: 'Drew (Male)',
    description: 'Clear, professional male voice',
    gender: 'male',
    fileName: 'drew',
    sampleText: 'Hi there! I\'m Drew, and I specialize in clear, professional narration. Perfect for business presentations and educational content.'
  },
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam (Male)',
    description: 'Deep, authoritative male voice',
    gender: 'male',
    fileName: 'adam',
    sampleText: 'Greetings! I\'m Adam, your authoritative voice for serious content. I excel at delivering impactful messages with confidence.'
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella (Female)',
    description: 'Soft, expressive female voice',
    gender: 'female',
    fileName: 'bella',
    sampleText: 'Welcome! I\'m Bella, and I love bringing stories to life with my expressive and gentle voice. Let me help you create something beautiful.'
  },
  {
    id: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie (Male)',
    description: 'Smooth, conversational male voice',
    gender: 'male',
    fileName: 'charlie',
    sampleText: 'Hello! I\'m Charlie, your conversational companion. I specialize in natural, friendly dialogue that feels like talking to a friend.'
  },
  {
    id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte (Female)',
    description: 'Energetic, youthful female voice',
    gender: 'female',
    fileName: 'charlotte',
    sampleText: 'Hey everyone! I\'m Charlotte, and I bring energy and enthusiasm to every project. Perfect for dynamic and engaging content!'
  }
];

// API endpoint configuration
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://localhost:3000/api/generate/audio';

// Create public/voice-previews directory if it doesn't exist
const publicDir = path.join(__dirname, '..', 'public');
const voicePreviewsDir = path.join(publicDir, 'voice-previews');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(voicePreviewsDir)) {
  fs.mkdirSync(voicePreviewsDir, { recursive: true });
}

// Function to generate audio using ElevenLabs TTS via API
async function generateVoicePreview(voice) {
  try {
    console.log(`Generating preview for ${voice.name} (${voice.id})...`);
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: voice.sampleText,
        voiceId: voice.id
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.url) {
      // Download the audio file from the returned URL
      const audioResponse = await fetch(data.url);
      const audioBuffer = await audioResponse.arrayBuffer();
      
      // Save to local public folder
      const fileName = `${voice.fileName}.wav`;
      const filePath = path.join(voicePreviewsDir, fileName);
      
      fs.writeFileSync(filePath, Buffer.from(audioBuffer));
      console.log(`✅ Generated preview for ${voice.name}: ${fileName}`);
      
      return { success: true, fileName };
    } else {
      throw new Error(data.error || 'Failed to generate audio');
    }
  } catch (error) {
    console.error(`❌ Error generating preview for ${voice.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Function to create a fallback silent audio file
function createFallbackAudio(voice) {
  const fileName = `${voice.fileName}.wav`;
  const filePath = path.join(voicePreviewsDir, fileName);
  
  // Create a minimal WAV file header for a silent 1-second audio
  const sampleRate = 44100;
  const duration = 1; // 1 second
  const numSamples = sampleRate * duration;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = numSamples * blockAlign;
  const fileSize = 36 + dataSize;
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM format size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Silent audio data (all zeros)
  buffer.fill(0, 44);
  
  fs.writeFileSync(filePath, buffer);
  console.log(`📁 Created fallback silent audio: ${fileName}`);
}

// Main function to generate all voice previews
async function generateAllPreviews() {
  console.log('🎵 Starting voice preview generation...');
  console.log(`📁 Output directory: ${voicePreviewsDir}`);
  console.log(`🌐 Flask server: ${FLASK_SERVER_URL}`);
  console.log('');
  
  const results = [];
  
  for (const voice of voices) {
    const result = await generateVoicePreview(voice);
    results.push({ voice: voice.name, ...result });
    
    // Add a small delay between requests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('');
  console.log('📊 Generation Summary:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${voices.length}`);
  if (successful.length > 0) {
    successful.forEach(r => console.log(`   - ${r.voice}`));
  }
  
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${voices.length}`);
    failed.forEach(r => console.log(`   - ${r.voice}: ${r.error}`));
    
    console.log('');
    console.log('🔧 Creating fallback files for failed generations...');
    failed.forEach(r => {
      const voice = voices.find(v => v.name === r.voice);
      if (voice) {
        createFallbackAudio(voice);
      }
    });
  }
  
  console.log('');
  console.log('🎉 Voice preview generation completed!');
  console.log(`📁 Files saved to: ${voicePreviewsDir}`);
}

// Check if API server is running
async function checkAPIServer() {
  try {
    const response = await fetch(API_ENDPOINT.replace('/api/generate/audio', '/api/health'), { method: 'GET' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Run the script
async function main() {
  console.log('🔍 Checking API server availability...');
  
  const serverAvailable = await checkAPIServer();
  
  if (!serverAvailable) {
    console.log('⚠️  API server is not available. Creating fallback files only.');
    console.log('');
    
    voices.forEach(voice => {
      createFallbackAudio(voice);
    });
    
    console.log('');
    console.log('📝 Note: To generate actual voice previews, ensure your API server is running at:');
    console.log(`   ${API_ENDPOINT}`);
    console.log('   Then run this script again.');
  } else {
    await generateAllPreviews();
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = { generateAllPreviews, voices };