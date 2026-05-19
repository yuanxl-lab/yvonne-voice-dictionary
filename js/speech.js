/* ═══════════════════════════════════════════
   Speech Engine — Web Speech API wrapper
   Bilingual English/Chinese TTS
   ═══════════════════════════════════════════ */

const SpeechEngine = (() => {
  const synth = window.speechSynthesis;
  let voices = [];
  let enVoice = null;
  let zhVoice = null;
  let currentUtterance = null;
  let speedRate = 1.0; // 0.7 = slow, 1.0 = normal, 1.3 = fast
  let onSpeakStart = null;
  let onSpeakEnd = null;

  // ── Initialize voices ──
  function init() {
    return new Promise((resolve) => {
      const loadVoices = () => {
        voices = synth.getVoices();
        enVoice = _pickBestVoice('en');
        zhVoice = _pickBestVoice('zh');
        resolve({ enVoice, zhVoice });
      };

      if (synth.getVoices().length > 0) {
        loadVoices();
      } else {
        synth.addEventListener('voiceschanged', loadVoices, { once: true });
        // Fallback timeout
        setTimeout(loadVoices, 2000);
      }
    });
  }

  // ── Pick best voice for a language ──
  function _pickBestVoice(lang) {
    if (!voices.length) return null;

    const langCode = lang === 'en' ? 'en' : 'zh';
    const candidates = voices.filter(v => v.lang.startsWith(langCode));

    if (!candidates.length) return null;

    // Prefer local (non-network) voices for offline support
    const local = candidates.filter(v => v.localService);
    // Prefer high-quality named voices
    const preferred = lang === 'en'
      ? ['Samantha', 'Alex', 'Karen', 'Daniel', 'Google US English']
      : ['Ting-Ting', 'Mei-Jia', 'Google 普通话', 'Lili'];

    for (const name of preferred) {
      const found = candidates.find(v => v.name.includes(name));
      if (found) return found;
    }

    return local[0] || candidates[0];
  }

  // ── Speak text ──
  function speak(text, lang = 'en', callbacks = {}) {
    stop(); // Stop any ongoing speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'en' ? 'en-US' : 'zh-CN';
    utterance.rate = speedRate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voice = lang === 'en' ? enVoice : zhVoice;
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      currentUtterance = utterance;
      if (callbacks.onStart) callbacks.onStart();
      if (onSpeakStart) onSpeakStart(lang);
    };

    utterance.onend = () => {
      currentUtterance = null;
      if (callbacks.onEnd) callbacks.onEnd();
      if (onSpeakEnd) onSpeakEnd(lang);
    };

    utterance.onerror = () => {
      currentUtterance = null;
      if (callbacks.onEnd) callbacks.onEnd();
      if (onSpeakEnd) onSpeakEnd(lang);
    };

    synth.speak(utterance);
    return utterance;
  }

  // ── Speak a sequence of items ──
  function speakSequence(items, index = 0, callbacks = {}) {
    if (index >= items.length) {
      if (callbacks.onAllEnd) callbacks.onAllEnd();
      return;
    }

    const item = items[index];
    speak(item.text, item.lang, {
      onStart: () => {
        if (callbacks.onItemStart) callbacks.onItemStart(index, item);
      },
      onEnd: () => {
        if (callbacks.onItemEnd) callbacks.onItemEnd(index, item);
        // Small pause between items
        setTimeout(() => {
          speakSequence(items, index + 1, callbacks);
        }, 400);
      }
    });
  }

  // ── Play all parts of a word entry ──
  function playAll(entry, callbacks = {}) {
    const examples = entry.examples || [entry.example];
    const exampleText = examples.filter(Boolean).join('. ');
    const items = [
      { text: entry.word, lang: 'en', label: 'word' },
      { text: entry.definition, lang: 'en', label: 'definition' },
      { text: exampleText, lang: 'en', label: 'example' },
      { text: entry.chinese_meaning + '。' + entry.chinese_context, lang: 'zh', label: 'chinese' }
    ];
    speakSequence(items, 0, callbacks);
  }

  // ── Stop speaking ──
  function stop() {
    synth.cancel();
    currentUtterance = null;
  }

  // ── Set speed ──
  function setSpeed(rate) {
    speedRate = rate;
    // Save to localStorage
    try { localStorage.setItem('vd_speed', rate.toString()); } catch (e) {}
  }

  // ── Get speed ──
  function getSpeed() {
    return speedRate;
  }

  // ── Load saved speed ──
  function loadSavedSpeed() {
    try {
      const saved = localStorage.getItem('vd_speed');
      if (saved) speedRate = parseFloat(saved);
    } catch (e) {}
    return speedRate;
  }

  // ── Check if currently speaking ──
  function isSpeaking() {
    return synth.speaking;
  }

  // ── Set global callbacks ──
  function onStateChange(startCb, endCb) {
    onSpeakStart = startCb;
    onSpeakEnd = endCb;
  }

  return {
    init,
    speak,
    speakSequence,
    playAll,
    stop,
    setSpeed,
    getSpeed,
    loadSavedSpeed,
    isSpeaking,
    onStateChange
  };
})();
