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
  HelpCircle,
  PackagePlus,
  ShoppingCart,
  RotateCcw,
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';
import { AICommandResponse } from '../types';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const { processAICommand, speakText, profile, products } = useDukan();
  const [inputText, setInputText] = useState(initialQuery);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<AICommandResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition if available in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Indian English / Hindi / Hinglish friendly

        recognition.onstart = () => {
          setIsListening(true);
          setErrorMsg(null);
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
          setInputText(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setErrorMsg('Microphone permission was denied. Please allow microphone in browser or type your command below.');
          } else {
            setErrorMsg(`Voice input error: ${event.error}. You can also type commands directly.`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setErrorMsg('Voice recognition is not supported in this browser. Please use text commands.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setInputText('');
      setErrorMsg(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Error starting recognition:', err);
      }
    }
  };

  const handleExecuteCommand = async (commandToRun?: string) => {
    const textToExecute = (commandToRun || inputText).trim();
    if (!textToExecute) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setProcessing(true);
    setErrorMsg(null);
    try {
      const res = await processAICommand(textToExecute);
      setLastResponse(res);
      setInputText('');
      setTranscript('');
    } catch (err: any) {
      console.error('Failed to execute AI command:', err);
      setErrorMsg(err.message || 'Gemini could not process the command. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const sampleCommands = [
    'Sold 2 Amul Milk and 1 Bread cash',
    'Ramesh took 5 kg Atta on Udhaar (Khata)',
    'Add 25 packets Parle-G at ₹10 selling, cost ₹8',
    'Update Sugar stock to 40 kg',
    'Which items are running low on stock?',
    'What was my total profit today?',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Dukan Voice & AI Assistant
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  Gemini 3.8 Flash
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Speak or type natural shopkeeper commands in English or Hinglish
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Big Voice Visualizer Card */}
          <div className="relative flex flex-col items-center justify-center p-8 rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-slate-700/60 shadow-inner">
            <div className="relative mb-4">
              {/* Outer pulsing ring when listening */}
              {isListening && (
                <>
                  <div className="absolute inset-0 -m-4 rounded-full bg-emerald-500/20 animate-ping" />
                  <div className="absolute inset-0 -m-8 rounded-full bg-emerald-500/10 animate-pulse" />
                </>
              )}

              <button
                onClick={toggleListening}
                disabled={processing}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-500 text-white scale-110 shadow-rose-900/50'
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950/60 hover:scale-105 active:scale-95'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-9 h-9 animate-bounce" />
                ) : (
                  <Mic className="w-9 h-9" />
                )}
              </button>
            </div>

            <p className="text-sm font-semibold text-slate-200 mb-1">
              {isListening ? 'Listening to your voice...' : 'Tap the microphone to speak'}
            </p>
            <p className="text-xs text-slate-400 text-center max-w-sm">
              {isListening
                ? 'Speak naturally (e.g., "Sold 2 milk cash" or "Add 10 packets biscuit")'
                : 'Click mic or type your command below'}
            </p>

            {/* Live Audio Waves Simulation */}
            {isListening && (
              <div className="flex items-center gap-1.5 mt-4">
                <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-pulse" />
                <span className="w-1.5 h-8 bg-emerald-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-6 bg-emerald-400 rounded-full animate-pulse" />
                <span className="w-1.5 h-10 bg-emerald-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-5 bg-emerald-400 rounded-full animate-pulse" />
              </div>
            )}

            {/* Live Transcript Bubble */}
            {transcript && (
              <div className="mt-4 px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-emerald-300 text-sm italic font-medium animate-in fade-in">
                "{transcript}"
              </div>
            )}
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-900/30 border border-rose-700/60 flex items-start gap-3 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* AI Execution Result Display */}
          {lastResponse && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-slate-200 text-sm space-y-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold text-emerald-400 text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Intent: {lastResponse.intent.replace('_', ' ')}
                </span>
                <button
                  onClick={() => speakText(lastResponse.speechResponse)}
                  className="p-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 flex items-center gap-1 text-xs"
                  title="Replay Voice Reply"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Replay</span>
                </button>
              </div>

              {/* Spoken reply */}
              <p className="text-white font-medium bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                "{lastResponse.speechResponse}"
              </p>

              {/* Specific details */}
              {lastResponse.intent === 'RECORD_SALE' && lastResponse.saleData && (
                <div className="text-xs text-slate-300 space-y-1 bg-slate-900/40 p-2.5 rounded-lg">
                  <p className="font-semibold text-emerald-300">
                    Sale Recorded & Inventory Updated:
                  </p>
                  <p>Customer: {lastResponse.saleData.customerName || 'Walk-in'}</p>
                  <p>Payment: {lastResponse.saleData.paymentMode?.toUpperCase()} ({lastResponse.saleData.paymentStatus})</p>
                  <ul className="list-disc list-inside text-slate-300 pl-1 mt-1">
                    {lastResponse.saleData.items?.map((it, idx) => (
                      <li key={idx}>
                        {it.quantity} {it.unit || 'unit'} of {it.productName}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lastResponse.intent === 'ADD_PRODUCT' && lastResponse.productData && (
                <div className="text-xs text-slate-300 bg-slate-900/40 p-2.5 rounded-lg">
                  <p className="font-semibold text-emerald-300">New Product Added to Inventory:</p>
                  <p>
                    {lastResponse.productData.name} - Stock: {lastResponse.productData.stockQuantity} {lastResponse.productData.unit || 'pcs'} @ {profile?.currency || '₹'}{lastResponse.productData.sellingPrice}
                  </p>
                </div>
              )}

              {lastResponse.queryAnswer && (
                <div className="text-xs text-slate-300 bg-slate-900/40 p-2.5 rounded-lg">
                  <p className="font-semibold text-emerald-300">Insight:</p>
                  <p className="whitespace-pre-line">{lastResponse.queryAnswer}</p>
                </div>
              )}
            </div>
          )}

          {/* Quick Command Suggestions */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Try saying or clicking:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sampleCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputText(cmd);
                    handleExecuteCommand(cmd);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-xs text-slate-300 hover:text-white border border-slate-700/60 transition-colors text-left"
                >
                  "{cmd}"
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Text Command Input Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteCommand();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Or type here: e.g. Sold 3 milk and 2 soaps to Ramesh..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                disabled={processing}
              />
            </div>

            <button
              type="submit"
              disabled={processing || !inputText.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-medium text-sm flex items-center gap-2 shadow-md shadow-emerald-950 transition-all shrink-0 active:scale-95"
            >
              {processing ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span>Thinking...</span>
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
