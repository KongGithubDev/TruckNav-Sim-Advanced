export function useVoiceWarnings() {
    const { activeSettings } = useSettings();
    const availableVoices = ref<SpeechSynthesisVoice[]>([]);
    
    // Track last spoken times to avoid spamming
    const lastSpoken = new Map<string, number>();

    const loadVoices = () => {
        availableVoices.value = window.speechSynthesis.getVoices();
    };

    onMounted(() => {
        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    });

    /**
     * Speaks a warning message.
     * @param category A unique key for this type of warning (e.g. 'speed_limit')
     * @param message The text to speak
     * @param cooldownSeconds Minimum time before this category can be spoken again
     */
    const speakWarning = (category: string, message: string, cooldownSeconds: number = 10) => {
        if (!activeSettings.value.voiceWarnings) return;
        if (!window.speechSynthesis) return;

        const now = Date.now();
        const last = lastSpoken.get(category) || 0;

        if (now - last < cooldownSeconds * 1000) {
            return; // Still on cooldown
        }

        const utterance = new SpeechSynthesisUtterance(message);
        
        // Find preferred voice
        if (activeSettings.value.voiceLanguage) {
            const voice = availableVoices.value.find(v => v.voiceURI === activeSettings.value.voiceLanguage);
            if (voice) {
                utterance.voice = voice;
            }
        } else {
            // Default to Thai if available and no specific voice is selected, since user requested Siri Thai
            const thaiVoice = availableVoices.value.find(v => v.lang.includes("th"));
            if (thaiVoice) {
                utterance.voice = thaiVoice;
            }
        }

        // Adjust rate and pitch for better sound
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
        lastSpoken.set(category, now);
    };

    return {
        availableVoices,
        speakWarning,
        loadVoices
    };
}
