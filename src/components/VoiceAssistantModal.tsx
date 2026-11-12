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
  Bot,
  User,
  ArrowRight,
  TrendingUp,
  Trash2,
  Edit,
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';
import { AICommandResponse } from '../types';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  inputMode?: 'voice' | 'typed';
  response?: AICommandResponse;
  error?: string;
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  autoExecute?: boolean;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  autoExecute = false,
}) => {
  const { processAICommand, speakText, profile, products } = useDukan();
  const [inputText, setInputText] = useState(initialQuery);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Namaste! I am your DUKAN AI Assistant. You can speak or type commands like: "Add 2 kg Tata Salt to my inventory", "Sold 2 Amul Milk cash", or "Which items are running low on stock?".',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, processing]);

  // Sync initialQuery when modal opens with a new query
  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setInputText(initialQuery);
        if (autoExecute) {
          handleExecuteCommand(initialQuery);
        }
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialQuery]);

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
          console.warn('Speech recognition status:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setErrorMsg('Microphone permission was denied. Please allow microphone access or type your command.');
          } else if (event.error !== 'no-speech') {
            setErrorMsg(`Voice input: ${event.error}. You can also type commands directly.`);
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
      setErrorMsg('Voice recognition is not supported in this browser. Please type your command below.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setErrorMsg(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Error starting voice recognition:', err);
      }
    }
  };

  // Main command submission function
  const handleExecuteCommand = async (commandToRun?: string, mode: 'voice' | 'typed' = 'typed') => {
    // Prevent duplicate submissions
    if (processing) return;

    const textToExecute = (typeof commandToRun === 'string' ? commandToRun : inputText).trim();
    if (!textToExecute) return;

    // Stop microphone if currently listening
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      setIsListening(false);
    }

    // Add user message to chat immediately
    const userMsgId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToExecute,
      inputMode: mode,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setTranscript('');
    setProcessing(true);
    setErrorMsg(null);

    try {
      // Call Gemini 3.0 / 3.8 Flash API via server endpoint
      const res = await processAICommand(textToExecute);

      // Add Gemini assistant response to chat
      const aiMsgId = `ai-${Date.now()}`;
      const aiMessage: ChatMessage = {
        id: aiMsgId,
        sender: 'assistant',
        text: res.speechResponse || 'Action completed successfully.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        response: res,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('Failed to execute AI command:', err);
      const friendlyError = err.message || 'Gemini could not process the command. Please check your command and try again.';
      setErrorMsg(friendlyError);

      const errorChatMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Sorry, I encountered an issue: ${friendlyError}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: friendlyError,
      };
      setMessages((prev) => [...prev, errorChatMsg]);
    } finally {
      setProcessing(false);
    }
  };

  const sampleCommands = [
    'Show me products that need restocking',
    'Add 2 kg Tata Salt to my inventory',
    'Sold 2 Amul Milk and 1 Bread cash',
    'Which items are running low on stock?',
    'Ramesh took 5 kg Atta on Udhaar (Khata)',
    'Update Sugar stock to 40 kg',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-[82vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-950">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Dukan Voice & AI Assistant
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30">
                  Gemini 3.0 Flash
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Voice & Text retail assistant • Natural language POS & Inventory
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

        {/* Scrollable Chat Interface */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-950/40">
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
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 space-y-2.5 shadow-sm text-sm ${
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
                    {msg.sender === 'user' ? (msg.inputMode === 'voice' ? 'You (Voice)' : 'You (Shopkeeper)') : 'DUKAN AI'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Text */}
                <p className="text-sm font-normal leading-relaxed whitespace-pre-line">
                  {msg.text}
                </p>

                {/* Structured Gemini Action Result Cards */}
                {msg.response && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    {/* Replay audio button */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {msg.response.intent.replace('_', ' ')}
                      </span>

                      <button
                        onClick={() => speakText(msg.response?.speechResponse || msg.text)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 flex items-center gap-1 text-[11px] transition-colors"
                        title="Listen to AI voice reply"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Voice Audio</span>
                      </button>
                    </div>

                    {/* ADD PRODUCT CARD */}
                    {msg.response.intent === 'ADD_PRODUCT' && msg.response.productData && (
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-emerald-300">
                          <span className="flex items-center gap-1.5">
                            <PackagePlus className="w-4 h-4 text-emerald-400" />
                            Inventory Added / Updated
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            {msg.response.productData.category || 'Groceries'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Product Name</span>
                            <span className="font-semibold text-white text-xs">{msg.response.productData.name}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Quantity</span>
                            <span className="font-semibold text-emerald-300 text-xs">
                              {msg.response.productData.stockQuantity} {msg.response.productData.unit || 'pcs'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Selling Price</span>
                            <span className="font-semibold text-white text-xs">
                              {profile?.currency || '₹'}{msg.response.productData.sellingPrice}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Estimated Cost</span>
                            <span className="font-semibold text-slate-300 text-xs">
                              {profile?.currency || '₹'}{msg.response.productData.costPrice}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RECORD SALE CARD */}
                    {msg.response.intent === 'RECORD_SALE' && msg.response.saleData && (
                      <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-500/40 text-xs space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-teal-300">
                          <span className="flex items-center gap-1.5">
                            <ShoppingCart className="w-4 h-4 text-teal-400" />
                            Sale Recorded & Stock Deducted
                          </span>
                          <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 uppercase font-mono text-[10px]">
                            {msg.response.saleData.paymentMode} ({msg.response.saleData.paymentStatus})
                          </span>
                        </div>
                        <div className="text-slate-300">
                          <span className="text-slate-400">Customer: </span>
                          <span className="font-semibold text-white">{msg.response.saleData.customerName || 'Walk-in'}</span>
                        </div>
                        <div className="space-y-1 pt-1 border-t border-slate-800">
                          {msg.response.saleData.items?.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-slate-300">
                              <span>• {it.quantity} {it.unit || 'unit'} of {it.productName}</span>
                              <span className="font-mono text-emerald-400 font-semibold">
                                {profile?.currency || '₹'}{(it.quantity * (it.unitPrice || 0)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* UPDATE PRODUCT CARD */}
                    {msg.response.intent === 'UPDATE_PRODUCT' && msg.response.updateData && (
                      <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-blue-300">
                          <Edit className="w-4 h-4" />
                          <span>Product Updated</span>
                        </div>
                        <p className="text-slate-300">
                          {msg.response.updateData.productName}:{' '}
                          {msg.response.updateData.stockQuantity !== undefined && (
                            <span className="text-blue-300">Stock updated ({msg.response.updateData.stockQuantity}) </span>
                          )}
                          {msg.response.updateData.newSellingPrice !== undefined && (
                            <span className="text-emerald-300">New price {profile?.currency || '₹'}{msg.response.updateData.newSellingPrice}</span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* QUERY INFO CARD */}
                    {msg.response.queryAnswer && (
                      <div className="p-3 rounded-xl bg-slate-850 bg-slate-800/60 border border-slate-700/60 text-xs space-y-1">
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Store Insight</span>
                        </span>
                        <p className="text-slate-300 whitespace-pre-line leading-relaxed">
                          {msg.response.queryAnswer}
                        </p>
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

          {/* Loading Indicator while Gemini is processing */}
          {processing && (
            <div className="flex gap-3 justify-start animate-in fade-in">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0 mt-1">
                <RotateCcw className="w-4 h-4 animate-spin text-emerald-400" />
              </div>
              <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl rounded-bl-none p-4 max-w-[80%] space-y-2 shadow-lg">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>Gemini is analyzing your command...</span>
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                  <span className="text-xs text-slate-400 pl-2">Updating store data & inventory...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Live Audio Transcript Preview (when microphone is listening) */}
        {isListening && (
          <div className="px-4 py-2.5 bg-emerald-950/40 border-t border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <span className="font-semibold">Listening:</span>
              <span className="italic">{transcript || 'Speak now... (e.g. "Add 2 kg Tata Salt")'}</span>
            </div>
            <button
              onClick={() => handleExecuteCommand(transcript, 'voice')}
              disabled={!transcript.trim() || processing}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] disabled:opacity-50"
            >
              Send Voice
            </button>
          </div>
        )}

        {/* Error notification banner if any */}
        {errorMsg && (
          <div className="px-4 py-2 bg-rose-950/50 border-t border-rose-700/50 flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2 truncate">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-[11px] underline hover:text-white shrink-0 pl-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800/80 overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-500 font-semibold shrink-0">Suggestions:</span>
          {sampleCommands.map((cmd, idx) => (
            <button
              key={idx}
              disabled={processing}
              onClick={() => {
                setInputText(cmd);
                handleExecuteCommand(cmd);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-[11px] whitespace-nowrap transition-colors shrink-0 disabled:opacity-50"
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
              handleExecuteCommand();
            }}
            className="flex items-center gap-2"
          >
            {/* Microphone Toggle Button */}
            <button
              type="button"
              onClick={toggleListening}
              disabled={processing}
              title={isListening ? 'Stop Listening' : 'Speak with Microphone'}
              className={`p-2.5 sm:p-3 rounded-xl transition-all duration-200 flex items-center justify-center shrink-0 shadow-md ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700'
              }`}
            >
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* Command Text Input */}
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder='Type: e.g. "Add 2 kg Tata Salt to my inventory" or "Sold 2 milk cash"...'
                className="w-full px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                disabled={processing}
              />
            </div>

            {/* Connected Send Button */}
            <button
              type="submit"
              disabled={processing || !inputText.trim()}
              className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all shrink-0 active:scale-95"
            >
              {processing ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Thinking...</span>
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
