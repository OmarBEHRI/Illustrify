const fs = require('fs');
const path = require('path');

// Kokoro TTS voices to generate previews for
const voices = [
  // American Female Voices
  { id: 'af_alloy', name: 'Alloy (Female)' },
  { id: 'af_bella', name: 'Bella (Female)' },
  { id: 'af_heart', name: 'Heart (Female)' },
  { id: 'af_nova', name: 'Nova (Female)' },
  { id: 'af_sarah', name: 'Sarah (Female)' },
  // American Male Voices
  { id: 'am_adam', name: 'Adam (Male)' },
  { id: 'am_echo', name: 'Echo (Male)' },
  { id: 'am_liam', name: 'Liam (Male)' },
  { id: 'am_michael', name: 'Michael (Male)' },
  { id: 'am_onyx', name: 'Onyx (Male)' }
];

const KOKORO_TTS_URL = 'http://localhost:8880/v1/audio/speech';
const PREVIEW_TEXT = 'Hello, this is a voice preview for text to speech generation.';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'voice-previews');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateVoicePreview(voice) {
  const fileName = `${voice.id}.wav`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  
  console.log(`Generating preview for ${voice.name} (${voice.id})...`);
  
  try {
    // Check if server is available
    const healthCheck = await fetch('http://localhost:8880/v1/audio/voices');
    if (!healthCheck.ok) {
      throw new Error('Kokoro TTS server not available');
    }
    
    // Prepare request for Kokoro TTS API
    const kokoroRequest = {
      model: 'kokoro',
      input: PREVIEW_TEXT,
      voice: voice.id,
      response_format: 'wav',
      download_format: 'wav',
      speed: 1,
      stream: false,
      return_download_link: false,
      lang_code: 'a', // American English
      volume_multiplier: 1,
      normalization_options: {
        normalize: true,
        unit_normalization: false,
        url_normalization: true,
        email_normalization: true,
        optional_pluralization_normalization: true,
        phone_normalization: true,
        replace_remaining_symbols: true
      }
    };
    
    const response = await fetch(KOKORO_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(kokoroRequest),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const audioArrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);
    fs.writeFileSync(filePath, audioBuffer);
    
    console.log(`✅ Generated preview for ${voice.name}: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to generate preview for ${voice.name}:`, error.message);
    
    // Create a fallback silent audio file
    const silentAudio = Buffer.alloc(1024, 0);
    fs.writeFileSync(filePath, silentAudio);
    console.log(`📝 Created fallback silent audio for ${voice.name}`);
    return false;
  }
}

async function generateAllPreviews() {
  console.log('🎵 Starting Kokoro TTS voice preview generation...');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  
  let successCount = 0;
  let totalCount = voices.length;
  
  for (const voice of voices) {
    const success = await generateVoicePreview(voice);
    if (success) successCount++;
    
    // Add a small delay between requests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n🎉 Voice preview generation complete!`);
  console.log(`✅ Successfully generated: ${successCount}/${totalCount} previews`);
  
  if (successCount < totalCount) {
    console.log(`\n⚠️  Note: Some previews failed to generate. Make sure the Kokoro TTS server is running at ${KOKORO_TTS_URL}`);
    console.log(`   Fallback silent audio files were created for failed voices.`);
  }
}

// Run the script
generateAllPreviews().catch(console.error);