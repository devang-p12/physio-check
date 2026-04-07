class TTS {
  private voices: SpeechSynthesisVoice[] = [];
  private isSpeaking = false;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices() {
    this.voices = window.speechSynthesis.getVoices();
  }

  speak(text: string, force: boolean = true) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // If not forcing and currently speaking, skip
    if (!force && window.speechSynthesis.speaking) return;

    if (force) {
      window.speechSynthesis.cancel();
    }

    const utt = new SpeechSynthesisUtterance(text);
    
    // Try to find a premium/natural English voice
    const preferredVoice = this.voices.find(v => 
      v.name.includes("Google US English") || 
      v.name.includes("Samantha") || 
      v.name.includes("Premium") || 
      v.name.includes("Natural") ||
      (v.name.includes("English") && v.name.includes("UK"))
    ) || this.voices.find(v => v.lang.startsWith('en'));

    if (preferredVoice) {
      utt.voice = preferredVoice;
    }

    utt.rate = 0.95; // Slightly slower for better clarity
    utt.pitch = 1.0;
    utt.volume = 1.0;

    utt.onstart = () => { this.isSpeaking = true; };
    utt.onend = () => { this.isSpeaking = false; };
    utt.onerror = () => { this.isSpeaking = false; };

    window.speechSynthesis.speak(utt);
  }

  cancel() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }
}

export const tts = new TTS();
