import os
import httpx
from gtts import gTTS
from media.config import ELEVEN_LABS_API_KEY

def generate_voiceover(text: str, output_path: str) -> bool:
    # Check if ELEVEN_LABS_API_KEY is not set or placeholder
    is_placeholder = ELEVEN_LABS_API_KEY.startswith("YOUR_") or "placeholder" in ELEVEN_LABS_API_KEY.lower() if ELEVEN_LABS_API_KEY else True
    
    if not ELEVEN_LABS_API_KEY or is_placeholder:
        print("Using gTTS fallback for voiceover generation...")
        try:
            tts = gTTS(text=text, lang='en')
            tts.save(output_path)
            return True
        except Exception as e:
            print(f"gTTS fallback failed: {e}")
            return False
            
    voice_id = "pNInz6obpgq5paqqC7yk"  # Adam voice
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVEN_LABS_API_KEY
    }
    data = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.5
        }
    }
    
    try:
        with httpx.Client() as client:
            res = client.post(url, json=data, headers=headers, timeout=60.0)
            if res.status_code == 200:
                with open(output_path, "wb") as f:
                    f.write(res.content)
                return True
            else:
                print(f"ElevenLabs API failed with status {res.status_code}: {res.text}. Falling back to gTTS...")
                tts = gTTS(text=text, lang='en')
                tts.save(output_path)
                return True
    except Exception as e:
        print(f"ElevenLabs request exception: {e}. Falling back to gTTS...")
        try:
            tts = gTTS(text=text, lang='en')
            tts.save(output_path)
            return True
        except Exception as fallback_err:
            print(f"gTTS fallback also failed: {fallback_err}")
            return False
