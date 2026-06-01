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
     * @param category A unique key for this type of warning (e.g. 'speeding', 'turn_1km', 'turn_200m', 'traffic_ahead')
     * @param message The text to speak
     * @param cooldownSeconds Minimum time before this category can be spoken again
     */
    const speakWarning = (category: string, message: string, cooldownSeconds: number = 10) => {
        if (!activeSettings.value.voiceWarnings) return;
        if (!window.speechSynthesis) return;

        // Check if this specific category is enabled
        const categories = activeSettings.value.voiceWarningCategories;
        if (categories && category in categories && !categories[category as keyof typeof categories]) {
            return;
        }

        const now = Date.now();
        const last = lastSpoken.get(category) || 0;

        if (now - last < cooldownSeconds * 1000) {
            return; // Still on cooldown
        }

        const utterance = new SpeechSynthesisUtterance(message);
        
        // Find preferred voice
        applyVoice(utterance);

        // Adjust rate and pitch for better sound
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
        lastSpoken.set(category, now);
    };

    /**
     * Applies the user's preferred voice to an utterance.
     */
    const applyVoice = (utterance: SpeechSynthesisUtterance) => {
        if (activeSettings.value.voiceLanguage) {
            const voice = availableVoices.value.find(v => v.voiceURI === activeSettings.value.voiceLanguage);
            if (voice) {
                utterance.voice = voice;
                return;
            }
        }
        // Default to Thai if available and no specific voice is selected
        const thaiVoice = availableVoices.value.find(v => v.lang.includes("th"));
        if (thaiVoice) {
            utterance.voice = thaiVoice;
        }
    };

    /**
     * Speaks a test message using the selected voice.
     * This is used by the settings UI to test voice output.
     */
    const testVoice = () => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel(); // Stop any ongoing speech
        
        const utterance = new SpeechSynthesisUtterance("This is a test voice message. If you hear this, your voice is working.");
        applyVoice(utterance);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    return {
        availableVoices,
        speakWarning,
        testVoice,
        loadVoices
    };
}
