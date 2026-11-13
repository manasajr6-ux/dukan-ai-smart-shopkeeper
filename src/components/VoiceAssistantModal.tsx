import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  X,
  Sparkles,
  Volume2,
  CheckCircle2,
  AlertCircle,
  PackagePlus,
  ShoppingCart,
  RotateCcw,
  Bot,
  User,
  TrendingUp,
  Edit,
  Languages,
  Check,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';
import { AICommandResponse, AssistantLanguage } from '../types';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  recognizedText?: string;
  language?: AssistantLanguage;
  timestamp: string;
  inputMode?: 'voice' | 'typed';
  response?: AICommandResponse;
  actionStatus?: 'pending' | 'confirming' | 'confirmed' | 'cancelled';
  error?: string;
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  autoExecute?: boolean;
}

const LANGUAGE_CONFIG: Record<
  AssistantLanguage,
  {
    code: AssistantLanguage;
    nativeLabel: string;
    englishLabel: string;
    sttLocale: string;
    welcome: string;
    placeholder: string;
    listeningHint: string;
    samples: string[];
  }
> = {
  kn: {
    code: 'kn',
    nativeLabel: 'ಕನ್ನಡ',
    englishLabel: 'Kannada',
    sttLocale: 'kn-IN',
    welcome:
      'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ DUKAN AI ಸಹಾಯಕ. ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ: "ಎರಡು ಕೆಜಿ ಅಕ್ಕಿ ಸ್ಟಾಕ್ಗೆ ಸೇರಿಸು", "ಎರಡು ಪ್ಯಾಕೆಟ್ ಉಪ್ಪು ಮಾರಾಟ ಆಯಿತು", ಅಥವಾ "ಇವತ್ತು ಎಷ್ಟು ಸೇಲ್ ಆಗಿದೆ?"',
    placeholder: 'ಕನ್ನಡದಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ...',
    listeningHint: 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದೆ... ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ',
    samples: [
      'ಎರಡು ಕೆಜಿ ಅಕ್ಕಿ ಸ್ಟಾಕ್ಗೆ ಸೇರಿಸು',
      'ಎರಡು ಪ್ಯಾಕೆಟ್ ಉಪ್ಪು ಮಾರಾಟ ಆಯಿತು',
      'ಇವತ್ತು ಎಷ್ಟು ಸೇಲ್ ಆಗಿದೆ?',
      'ಯಾವ ವಸ್ತುಗಳ ಸ್ಟಾಕ್ ಕಡಿಮೆ ಇದೆ?',
      'ಅಕ್ಕಿ ಸ್ಟಾಕ್ ಎಷ್ಟಿದೆ?',
      'ಹಾಲಿನ ಬೆಲೆ ಎಷ್ಟು?',
    ],
  },
  hi: {
    code: 'hi',
    nativeLabel: 'हिन्दी',
    englishLabel: 'Hindi',
    sttLocale: 'hi-IN',
    welcome:
      'नमस्ते! मैं आपका DUKAN AI असिस्टेंट हूँ। हिंदी में बोलें या लिखें: "दो किलो चावल स्टॉक में जोड़ो", "दो पैकेट नमक बेच दिया", या "आज कितनी बिक्री हुई?"',
    placeholder: 'हिंदी में लिखें या माइक दबाकर बोलें...',
    listeningHint: 'सुन रहा हूँ... हिंदी में बोलें',
    samples: [
      'दो किलो चावल स्टॉक में जोड़ो',
      'दो पैकेट नमक बेच दिया',
      'आज कितनी बिक्री हुई?',
      'कौन से सामान का स्टॉक कम है?',
      'चावल का कितना स्टॉक बचा है?',
      'दूध की कीमत क्या है?',
    ],
  },
  en: {
    code: 'en',
    nativeLabel: 'English',
    englishLabel: 'English',
    sttLocale: 'en-IN',
    welcome:
      'Namaste! I am your DUKAN AI Assistant. Speak or type in English, Hindi, or Kannada — e.g. "Add 2 kg rice to inventory", "Sold 2 packets of salt", "Show today\'s sales", or "Which products are low in stock?"',
    placeholder: 'Type command or tap mic to speak (English / हिन्दी / ಕನ್ನಡ)...',
    listeningHint: 'Listening... Speak your command clearly',
    samples: [
      'Add 2 kg rice to inventory',
      'Sold 2 packets of salt',
      "Show today's sales",
      'Which products are low in stock?',
      'Show me products that need restocking',
      'Check stock of Amul Milk',
    ],
  },
};

function isMutatingIntent(intent?: AICommandResponse['intent']): boolean {
  return (
    intent === 'RECORD_SALE' ||
    intent === 'ADD_PRODUCT' ||
    intent === 'UPDATE_PRODUCT' ||
    intent === 'DELETE_PRODUCT'
  );
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  autoExecute = false,
}) => {
  const {
    interpretAICommand,
    executeAICommandResult,
    speakText,
    assistantLanguage,
    setAssistantLanguage,
    profile,
    products,
  } = useDukan();

  const langCfg = LANGUAGE_CONFIG[assistantLanguage];

  const [inputText, setInputText] = useState(initialQuery);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastInputMode, setLastInputMode] = useState<'voice' | 'typed'>('typed');
  const [processing, setProcessing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: langCfg.welcome,
      language: assistantLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track confirmed message IDs in a ref as well to guarantee zero duplicate executions
  const executedMessageIdsRef = useRef<Set<string>>(new Set());
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, processing]);

  // Stop listening if modal closes
  useEffect(() => {
    if (!isOpen && isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
  }, [isOpen, isListening]);

  // Sync initialQuery when modal opens with a query from Dashboard
  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setInputText(initialQuery);
        if (autoExecute) {
          handleInterpretCommand(initialQuery, 'typed');
        }
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialQuery]);

  // Initialize or update SpeechRecognition whenever assistantLanguage changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      recognitionRef.current = null;
      return;
    }

    setSpeechSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = LANGUAGE_CONFIG[assistantLanguage].sttLocale;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMsg(null);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);
      setInputText(currentTranscript);
      setLastInputMode('voice');
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition status:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setErrorMsg(
          assistantLanguage === 'kn'
            ? 'ಮೈಕ್ರೋಫೋನ್ ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಅನುಮತಿ ನೀಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.'
            : assistantLanguage === 'hi'
            ? 'माइक्रोफोन की अनुमति नहीं है। कृपया अनुमति दें या नीचे टाइप करें।'
            : 'Microphone permission denied. Please allow mic access or type your command below.'
        );
      } else if (event.error === 'language-not-supported') {
        setErrorMsg(
          `Your browser/device speech recognition does not support ${LANGUAGE_CONFIG[assistantLanguage].englishLabel} (${LANGUAGE_CONFIG[assistantLanguage].sttLocale}). You can still type commands in ${LANGUAGE_CONFIG[assistantLanguage].nativeLabel}!`
        );
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setErrorMsg(`Voice recognition notice (${event.error}). You can review/type your command below.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    };
  }, [assistantLanguage]);

  const handleLanguageSwitch = (newLang: AssistantLanguage) => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
    setAssistantLanguage(newLang);
    setErrorMsg(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `lang-${Date.now()}`,
        sender: 'assistant',
        text: LANGUAGE_CONFIG[newLang].welcome,
        language: newLang,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      setErrorMsg(
        assistantLanguage === 'kn'
          ? 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಕೆಳಗೆ ಟೈಪ್ ಮಾಡಿ.'
          : assistantLanguage === 'hi'
          ? 'इस ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। कृपया नीचे टाइप करें।'
          : 'Browser speech recognition is unavailable on this device/browser. Please type your command in the box below.'
      );
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      setTranscript('');
      setErrorMsg(null);
      try {
        recognitionRef.current.lang = LANGUAGE_CONFIG[assistantLanguage].sttLocale;
        recognitionRef.current.start();
      } catch (err: any) {
        console.warn('Error starting voice recognition:', err);
        setErrorMsg('Could not start microphone. Please check browser mic permissions or type directly.');
      }
    }
  };

  // Step 1: Send recognized or typed command to Gemini for structured interpretation
  const handleInterpretCommand = async (
    commandToRun?: string,
    modeOverride?: 'voice' | 'typed'
  ) => {
    if (processing) return;

    const textToExecute = (typeof commandToRun === 'string' ? commandToRun : inputText).trim();
    if (!textToExecute) return;

    const mode = modeOverride || lastInputMode;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToExecute,
      inputMode: mode,
      language: assistantLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setTranscript('');
    setLastInputMode('typed');
    setProcessing(true);
    setErrorMsg(null);

    try {
      const res = await interpretAICommand(textToExecute, assistantLanguage);
      const needsConfirmation = isMutatingIntent(res.intent);

      const aiMsgId = `ai-${Date.now()}`;
      const aiMessage: ChatMessage = {
        id: aiMsgId,
        sender: 'assistant',
        text: res.speechResponse || 'Command analyzed.',
        recognizedText: textToExecute,
        language: res.language || assistantLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        response: res,
        actionStatus: needsConfirmation ? 'pending' : undefined,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Speak read-only query/conversational answers automatically;
      // for mutating operations, speak preview/prompt or after confirmation
      if (!needsConfirmation && res.speechResponse) {
        speakText(res.speechResponse, res.language || assistantLanguage);
      }
    } catch (err: any) {
      console.error('Failed to interpret AI command:', err);
      const friendlyError =
        err.message || 'Could not interpret the command. Please check and try again.';
      setErrorMsg(friendlyError);

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `Error: ${friendlyError}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          error: friendlyError,
        },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  // Step 2: Confirm & Execute an interpreted mutating command (with duplicate guard)
  const handleConfirmAction = async (msgId: string) => {
    if (executedMessageIdsRef.current.has(msgId)) return;
    const targetMsg = messages.find((m) => m.id === msgId);
    if (!targetMsg?.response || targetMsg.actionStatus !== 'pending') return;

    executedMessageIdsRef.current.add(msgId);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionStatus: 'confirming' } : m))
    );

    try {
      const execResult = await executeAICommandResult(targetMsg.response);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                actionStatus: 'confirmed',
                text: execResult.summary || m.text,
              }
            : m
        )
      );
    } catch (err: any) {
      executedMessageIdsRef.current.delete(msgId);
      setErrorMsg(err.message || 'Failed to execute confirmed operation.');
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, actionStatus: 'pending' } : m))
      );
    }
  };

  // Cancel or Edit recognized command before executing
  const handleEditRecognizedCommand = (msgId: string, originalText: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionStatus: 'cancelled' } : m))
    );
    setInputText(originalText);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCancelAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionStatus: 'cancelled' } : m))
    );
  };

  // Allow user to override matched product on a pending sale item before confirming
  const handleOverrideSaleItemProduct = (msgId: string, itemIdx: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.response?.saleData?.items) return m;
        const updatedItems = m.response.saleData.items.map((it, idx) =>
          idx === itemIdx
            ? {
                ...it,
                matchedProductId: prod.id,
                productName: prod.name,
                unit: prod.unit,
                unitPrice: prod.sellingPrice,
              }
            : it
        );
        return {
          ...m,
          response: {
            ...m.response,
            isAmbiguous: false,
            ambiguityReason: undefined,
            saleData: {
              ...m.response.saleData,
              items: updatedItems,
            },
          },
        };
      })
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[92vh] sm:h-[85vh]">
        {/* Header with Prominent Language Selector */}
        <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-emerald-950">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    LUMORA Dukaan Voice & AI Assistant
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-semibold border border-cyan-500/30">
                    {langCfg.nativeLabel} ({langCfg.sttLocale})
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Multilingual Voice & Text POS • ಕನ್ನಡ • हिन्दी • English
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Beginner-Friendly Language Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 p-2 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 px-1.5">
              <Languages className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold">Language:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial justify-end">
              {(['kn', 'hi', 'en'] as AssistantLanguage[]).map((code) => {
                const cfg = LANGUAGE_CONFIG[code];
                const active = assistantLanguage === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleLanguageSwitch(code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      active
                        ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span>{cfg.nativeLabel}</span>
                    {code !== 'en' && (
                      <span className="text-[10px] opacity-80 hidden sm:inline">({cfg.englishLabel})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable Chat Interface */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-950/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 space-y-2.5 shadow-sm text-sm ${
                  msg.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : msg.error
                    ? 'bg-rose-950/40 border border-rose-700/50 text-rose-200 rounded-bl-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-4 text-[11px] opacity-75">
                  <span className="font-semibold">
                    {msg.sender === 'user'
                      ? msg.inputMode === 'voice'
                        ? 'You (Voice)'
                        : 'You (Shopkeeper)'
                      : 'DUKAN AI'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Recognized Text Banner for Important Operations */}
                {msg.recognizedText && msg.response && isMutatingIntent(msg.response.intent) && (
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-cyan-400 font-bold">
                      <span>Recognized Command</span>
                      {msg.response.interpretedCommand && (
                        <span className="text-slate-400 font-normal normal-case">
                          {msg.response.interpretedCommand}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-medium">"{msg.recognizedText}"</p>
                  </div>
                )}

                {/* Assistant / User Message Text */}
                <p className="text-sm font-normal leading-relaxed whitespace-pre-line">
                  {msg.text}
                </p>

                {/* Structured Gemini Action Cards & Confirmation Controls */}
                {msg.response && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {msg.response.intent.replace('_', ' ')}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          speakText(
                            msg.response?.speechResponse || msg.text,
                            msg.language || assistantLanguage
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 flex items-center gap-1 text-[11px] transition-colors"
                        title="Listen to AI voice reply"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Speak Reply</span>
                      </button>
                    </div>

                    {/* Ambiguity / Stock Warning Banner */}
                    {msg.response.isAmbiguous && msg.actionStatus === 'pending' && (
                      <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          {msg.response.ambiguityReason ||
                            'Please verify product selection and quantities carefully before confirming.'}
                        </span>
                      </div>
                    )}

                    {/* ADD PRODUCT PREVIEW */}
                    {msg.response.intent === 'ADD_PRODUCT' && msg.response.productData && (
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-emerald-300">
                          <span className="flex items-center gap-1.5">
                            <PackagePlus className="w-4 h-4 text-emerald-400" />
                            {msg.actionStatus === 'confirmed'
                              ? 'Inventory Updated'
                              : 'Preview: Add Product to Inventory'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            {msg.response.productData.category || 'Groceries'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Product</span>
                            <span className="font-semibold text-white">{msg.response.productData.name}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Quantity</span>
                            <span className="font-semibold text-emerald-300">
                              {msg.response.productData.stockQuantity} {msg.response.productData.unit || 'pcs'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Selling Price</span>
                            <span className="font-semibold text-white">
                              {profile?.currency || '₹'}{msg.response.productData.sellingPrice}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Cost Price</span>
                            <span className="font-semibold text-slate-300">
                              {profile?.currency || '₹'}{msg.response.productData.costPrice}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RECORD SALE PREVIEW (with Product Override Selector when pending) */}
                    {msg.response.intent === 'RECORD_SALE' && msg.response.saleData && (
                      <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 text-xs space-y-2">
                        <div className="flex items-center justify-between font-bold text-cyan-300">
                          <span className="flex items-center gap-1.5">
                            <ShoppingCart className="w-4 h-4 text-cyan-400" />
                            {msg.actionStatus === 'confirmed'
                              ? 'Sale Recorded & Stock Deducted'
                              : 'Preview: Record Sale'}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 uppercase font-mono text-[10px]">
                            {msg.response.saleData.paymentMode || 'cash'}
                          </span>
                        </div>

                        <div className="space-y-2 pt-1 border-t border-slate-800">
                          {msg.response.saleData.items?.map((it, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex justify-between text-slate-200 font-medium">
                                <span>
                                  • {it.quantity} {it.unit || 'unit'} × {it.productName}
                                </span>
                                <span className="font-mono text-emerald-400 font-bold">
                                  {profile?.currency || '₹'}
                                  {(it.quantity * (it.unitPrice || 0)).toFixed(2)}
                                </span>
                              </div>
                              {msg.actionStatus === 'pending' && products.length > 0 && (
                                <select
                                  value={it.matchedProductId || ''}
                                  onChange={(e) =>
                                    handleOverrideSaleItemProduct(msg.id, idx, e.target.value)
                                  }
                                  className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                >
                                  <option value="" disabled>
                                    Verify / change matched product...
                                  </option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.stockQuantity} {p.unit} in stock • {profile?.currency || '₹'}
                                      {p.sellingPrice})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* UPDATE PRODUCT PREVIEW */}
                    {msg.response.intent === 'UPDATE_PRODUCT' && msg.response.updateData && (
                      <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-blue-300">
                          <Edit className="w-4 h-4" />
                          <span>
                            {msg.actionStatus === 'confirmed' ? 'Product Updated' : 'Preview: Update Product'}
                          </span>
                        </div>
                        <p className="text-slate-300">
                          {msg.response.updateData.productName}:{' '}
                          {msg.response.updateData.stockQuantity !== undefined && (
                            <span className="text-blue-300">
                              Stock ({msg.response.updateData.stockAdjustmentType || 'set'}:{' '}
                              {msg.response.updateData.stockQuantity}){' '}
                            </span>
                          )}
                          {msg.response.updateData.newSellingPrice !== undefined && (
                            <span className="text-emerald-300">
                              Price {profile?.currency || '₹'}{msg.response.updateData.newSellingPrice}
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* QUERY INFO CARD */}
                    {msg.response.queryAnswer && (
                      <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs space-y-1">
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Store Information</span>
                        </span>
                        <p className="text-slate-200 whitespace-pre-line leading-relaxed">
                          {msg.response.queryAnswer}
                        </p>
                      </div>
                    )}

                    {/* CONFIRM / EDIT / CANCEL ACTION BAR FOR MUTATING OPERATIONS */}
                    {isMutatingIntent(msg.response.intent) && (
                      <div className="pt-1">
                        {msg.actionStatus === 'pending' && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleConfirmAction(msg.id)}
                              className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                            >
                              <Check className="w-4 h-4" />
                              <span>Confirm & Save</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleEditRecognizedCommand(msg.id, msg.recognizedText || '')
                              }
                              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Correct</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelAction(msg.id)}
                              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 font-semibold text-xs transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {msg.actionStatus === 'confirming' && (
                          <div className="text-xs text-cyan-300 font-semibold flex items-center gap-2 py-1">
                            <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving transaction...</span>
                          </div>
                        )}

                        {msg.actionStatus === 'confirmed' && (
                          <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 py-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Confirmed & Saved to Inventory / Sales</span>
                          </div>
                        )}

                        {msg.actionStatus === 'cancelled' && (
                          <div className="text-xs text-slate-400 italic py-1">
                            Cancelled — No changes were saved.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {/* Processing Indicator */}
          {processing && (
            <div className="flex gap-3 justify-start animate-in fade-in">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0 mt-1">
                <RotateCcw className="w-4 h-4 animate-spin text-emerald-400" />
              </div>
              <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl rounded-bl-none p-4 max-w-[80%] space-y-2 shadow-lg">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>Gemini is interpreting ({langCfg.nativeLabel})...</span>
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Live Voice Recognition Preview */}
        {isListening && (
          <div className="px-4 py-2.5 bg-emerald-950/50 border-t border-emerald-500/30 flex items-center justify-between gap-2 text-xs text-emerald-200 animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="font-bold shrink-0">{langCfg.nativeLabel}:</span>
              <span className="italic truncate">{transcript || langCfg.listeningHint}</span>
            </div>
            <button
              type="button"
              onClick={() => handleInterpretCommand(transcript, 'voice')}
              disabled={!transcript.trim() || processing}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] disabled:opacity-50 shrink-0"
            >
              Review Command
            </button>
          </div>
        )}

        {/* Error / Mic Support Banner */}
        {errorMsg && (
          <div className="px-4 py-2 bg-rose-950/50 border-t border-rose-700/50 flex items-center justify-between text-xs text-rose-200">
            <div className="flex items-center gap-2 truncate">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-[11px] underline hover:text-white shrink-0 pl-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Localized Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800/80 overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-cyan-400 font-semibold shrink-0">
            {langCfg.nativeLabel} Examples:
          </span>
          {langCfg.samples.map((cmd, idx) => (
            <button
              key={idx}
              type="button"
              disabled={processing}
              onClick={() => {
                setInputText(cmd);
                handleInterpretCommand(cmd, 'typed');
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/60 text-[11px] whitespace-nowrap transition-colors shrink-0 disabled:opacity-50"
            >
              "{cmd}"
            </button>
          ))}
        </div>

        {/* Text & Voice Command Input Footer */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleInterpretCommand(inputText, lastInputMode);
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleListening}
              disabled={processing}
              title={
                speechSupported
                  ? isListening
                    ? 'Stop Listening'
                    : `Speak in ${langCfg.nativeLabel} (${langCfg.sttLocale})`
                  : 'Microphone not supported on this browser'
              }
              className={`p-2.5 sm:p-3 rounded-xl transition-all duration-200 flex items-center justify-center shrink-0 shadow-md ${
                !speechSupported
                  ? 'bg-slate-800/50 text-slate-500 border border-slate-800'
                  : isListening
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setLastInputMode('typed');
                }}
                placeholder={langCfg.placeholder}
                className="w-full px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                disabled={processing}
              />
            </div>

            <button
              type="submit"
              disabled={processing || !inputText.trim()}
              className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all shrink-0 active:scale-95"
            >
              {processing ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Analyzing...</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
