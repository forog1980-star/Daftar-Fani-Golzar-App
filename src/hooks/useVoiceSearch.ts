import { useCallback, useEffect, useRef, useState } from 'react';

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface BrowserSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionResultList {
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}

interface BrowserSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: BrowserSpeechRecognition, ev: Event) => void) | null;
  onend: ((this: BrowserSpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: BrowserSpeechRecognition, ev: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: BrowserSpeechRecognition, ev: BrowserSpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mapSpeechErrorToPersian(errorCode: string): string {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'دسترسی به میکروفون مجاز نیست. لطفاً مجوز میکروفون مرورگر را فعال کنید.';
    case 'no-speech':
      return 'صدایی دریافت نشد. لطفاً دوباره روی میکروفون بزنید و نام پروژه را بیان کنید.';
    case 'audio-capture':
      return 'میکروفون در این دستگاه شناسایی نشد یا در دسترس نیست.';
    case 'network':
      return 'سرویس تشخیص گفتار مرورگر در این لحظه به اتصال شبکه نیاز دارد.';
    case 'aborted':
      return '';
    default:
      return 'خطا در دریافت ورودی صوتی. لطفاً دوباره تلاش کنید.';
  }
}

interface UseVoiceSearchOptions {
  lang?: string;
  onTranscript: (text: string) => void;
}

export function useVoiceSearch({ lang = 'fa-IR', onTranscript }: UseVoiceSearchOptions) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const isSupported = Boolean(getSpeechRecognitionCtor());

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors if already ended
      }
    }
    setIsListening(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('مرورگر شما از ورودی صوتی (میکروفون) پشتیبانی نمی‌کند.');
      return;
    }

    setError(null);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event) => {
        let combined = '';
        for (let i = 0; i < event.results.length; i += 1) {
          const item = event.results[i];
          if (item && item[0]?.transcript) {
            combined += item[0].transcript;
          }
        }
        const cleaned = combined.trim();
        if (cleaned) {
          onTranscriptRef.current(cleaned);
        }
      };

      recognition.onerror = (event) => {
        const message = mapSpeechErrorToPersian(event.error);
        if (message) {
          setError(message);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setError('امکان فعال‌سازی میکروفون وجود ندارد. لطفاً مجوز دسترسی را بررسی کنید.');
      setIsListening(false);
    }
  }, [lang]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore unmount cleanup errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    toggleListening,
    clearError,
  };
}
