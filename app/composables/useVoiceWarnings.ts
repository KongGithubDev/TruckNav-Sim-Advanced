export function useVoiceWarnings() {
    const { activeSettings, settings } = useSettings();
    const { t } = useTranslations();
    const availableVoices = ref<SpeechSynthesisVoice[]>([]);
    
    // Track last spoken times to avoid spamming
    const lastSpoken = new Map<string, number>();

    const LOCALE_TO_LANG: Record<string, string> = {
        en: "en-US",
        de: "de-DE",
        th: "th-TH",
    };

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
        
        // Find preferred voice and set language for proper pronunciation
        applyVoice(utterance);

        // Set the language to match the selected voice (or fall back to app locale)
        // This ensures Thai voices speak Thai, English voices speak English, etc.
        if (utterance.voice) {
            utterance.lang = utterance.voice.lang;
        } else {
            utterance.lang = LOCALE_TO_LANG[settings.value.locale] || "en-US";
        }

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
        // Default to a voice matching the current locale if available
        const localeLang = LOCALE_TO_LANG[settings.value.locale] || "en-US";
        const localeVoice = availableVoices.value.find(v => v.lang.startsWith(localeLang));
        if (localeVoice) {
            utterance.voice = localeVoice;
            return;
        }
        // Fallback to Thai if available
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
        
        const testMessage = t('warnings.testVoice');
        const utterance = new SpeechSynthesisUtterance(testMessage);
        applyVoice(utterance);
        // Use voice's language for proper pronunciation
        if (utterance.voice) {
            utterance.lang = utterance.voice.lang;
        } else {
            utterance.lang = LOCALE_TO_LANG[settings.value.locale] || "en-US";
        }
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
