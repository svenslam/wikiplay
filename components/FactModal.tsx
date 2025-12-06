
import React, { useEffect, useState, useRef } from 'react';
import { Category, QuizData } from '../types';
import { X, RefreshCw, Share2, Volume2, StopCircle, Image as ImageIcon, CheckCircle, XCircle, BrainCircuit, ArrowDown } from 'lucide-react';

interface FactModalProps {
  category: Category | null;
  fact: string | null;
  quizData: QuizData | null;
  imageUrl: string | null;
  audioBase64: string | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  isAssetsLoading: boolean;
  onAnswerQuiz: (isCorrect: boolean) => void;
}

// Helper to decode PCM
const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};
  
const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number = 24000,
    numChannels: number = 1,
): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
};

const FactModal: React.FC<FactModalProps> = ({ 
    category, 
    fact, 
    quizData,
    imageUrl, 
    audioBase64, 
    isOpen, 
    onClose, 
    isLoading,
    isAssetsLoading,
    onAnswerQuiz
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<'correct' | 'wrong' | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset quiz state when modal opens
  useEffect(() => {
    if (isOpen) {
        setSelectedOption(null);
        setQuizResult(null);
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
    } else {
        stopAudio();
    }
  }, [isOpen]);

  // Cleanup
  useEffect(() => {
    return () => stopAudio();
  }, []);

  const playAudio = async () => {
    if (!audioBase64) return;
    
    try {
        stopAudio();
        setIsPlaying(true);

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        }
        
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        const audioData = decode(audioBase64);
        const buffer = await decodeAudioData(audioData, audioContextRef.current);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        
        source.onended = () => setIsPlaying(false);
        
        source.start();
        sourceNodeRef.current = source;
    } catch (e) {
        console.error("Audio playback error", e);
        setIsPlaying(false);
    }
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) {}
        sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleOptionClick = (option: string) => {
    if (quizResult !== null) return; // Prevent multi-click

    setSelectedOption(option);
    const isCorrect = option === quizData?.correctAnswer;
    setQuizResult(isCorrect ? 'correct' : 'wrong');
    onAnswerQuiz(isCorrect);
  };

  if (!isOpen) return null;

  const formatFactText = (text: string) => {
    if (!text) return "";
    // Remove the "- Category -" part for the body text if preferred, 
    // or just style the first line differently.
    const parts = text.split('\n\n');
    return (
        <>
            {parts.map((part, i) => (
                <p key={i} className={`mb-3 ${i === 0 ? 'font-bold text-amber-800' : 'text-gray-800'}`}>
                    {part}
                </p>
            ))}
        </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white text-gray-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden transform transition-all scale-100 border-4 border-amber-500 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="p-3 flex justify-between items-center text-white shrink-0 bg-gradient-to-r from-amber-500 to-orange-600">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-[Lobster] tracking-wide truncate ml-2">
                {isLoading ? 'Laden...' : category}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        <div ref={scrollRef} className="overflow-y-auto overflow-x-hidden flex-1 p-0 scroll-smooth">
            {/* Image Area */}
            <div className="w-full h-48 sm:h-56 bg-gray-200 relative shrink-0">
                {isLoading ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 gap-3">
                        <RefreshCw className="animate-spin text-amber-500" size={32} />
                        <span className="text-gray-500 text-sm font-medium">
                            Kennis ophalen...
                        </span>
                    </div>
                ) : imageUrl ? (
                    <img 
                        src={imageUrl} 
                        alt="Onderwerp" 
                        className="w-full h-full object-cover animate-fade-in"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-400 gap-2">
                         {isAssetsLoading ? (
                             <div className="flex flex-col items-center animate-pulse">
                                <ImageIcon size={32} />
                                <span className="text-xs mt-1">Schilderij maken...</span>
                             </div>
                        ) : (
                            <ImageIcon size={40} />
                        )}
                    </div>
                )}
                
                {/* Audio Button Overlay */}
                {!isLoading && audioBase64 && (
                    <button 
                        onClick={isPlaying ? stopAudio : playAudio}
                        className={`absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full font-bold shadow-lg transition-all transform hover:scale-105 ${
                            isPlaying 
                            ? "bg-red-500 text-white" 
                            : "bg-white text-amber-700"
                        }`}
                    >
                        {isPlaying ? <StopCircle size={20} /> : <Volume2 size={20} />}
                        <span className="text-sm">{isPlaying ? "Stop" : "Lees voor"}</span>
                    </button>
                )}
            </div>

            <div className="p-6 space-y-8">
                {/* 1. THE FACT */}
                <div className="animate-fade-in-up">
                    {isLoading ? (
                        <div className="space-y-4 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    ) : (
                        <div className="text-lg leading-relaxed border-l-4 border-amber-300 pl-4">
                            {formatFactText(fact || "")}
                        </div>
                    )}
                </div>

                {/* Separator */}
                {!isLoading && (
                    <div className="flex items-center gap-4 opacity-50">
                        <div className="h-px bg-gray-300 flex-1"></div>
                        <ArrowDown size={16} className="text-gray-400" />
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Quiz</span>
                        <div className="h-px bg-gray-300 flex-1"></div>
                    </div>
                )}

                {/* 2. THE QUIZ */}
                {!isLoading && quizData && (
                    <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 animate-fade-in-up delay-100">
                        <div className="flex items-center gap-2 mb-4 text-indigo-700">
                            <BrainCircuit size={20} />
                            <span className="font-bold text-sm uppercase">Test je kennis</span>
                        </div>
                        
                        <h3 className="text-lg font-bold text-gray-900 mb-4 leading-tight">
                            {quizData.question}
                        </h3>
                        
                        <div className="space-y-3">
                            {quizData.options.map((option, idx) => {
                                let btnClass = "w-full p-3 text-left rounded-lg border-2 transition-all font-medium relative text-sm md:text-base ";
                                
                                if (quizResult === null) {
                                    btnClass += "bg-white border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 text-gray-700";
                                } else {
                                    if (option === quizData.correctAnswer) {
                                        btnClass += "border-green-500 bg-green-50 text-green-900";
                                    } else if (option === selectedOption && option !== quizData.correctAnswer) {
                                        btnClass += "border-red-500 bg-red-50 text-red-900 opacity-70";
                                    } else {
                                        btnClass += "border-transparent bg-gray-100 text-gray-400";
                                    }
                                }

                                return (
                                    <button 
                                        key={idx}
                                        onClick={() => handleOptionClick(option)}
                                        disabled={quizResult !== null}
                                        className={btnClass}
                                    >
                                        <span className="mr-6 block">{option}</span>
                                        {quizResult !== null && option === quizData.correctAnswer && (
                                            <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600" size={18}/>
                                        )}
                                        {quizResult !== null && option === selectedOption && option !== quizData.correctAnswer && (
                                            <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-red-600" size={18}/>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                        
                        {quizResult !== null && (
                            <div className={`mt-4 p-3 rounded-lg text-sm border ${quizResult === 'correct' ? 'bg-green-100 border-green-200 text-green-800' : 'bg-red-50 border-red-100 text-red-900'}`}>
                                <p className="font-bold mb-1">
                                    {quizResult === 'correct' ? '🎉 Goed gezien!' : 'Helaas, dat klopt niet helemaal.'}
                                </p>
                                <p className="opacity-90">{quizData.explanation}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        
        {/* Footer actions */}
        {!isLoading && (
             <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between gap-3 shrink-0">
                <button 
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-100 text-gray-700 font-medium transition"
                    onClick={() => {
                        if (navigator.share) {
                            navigator.share({
                                title: `WikiDart: ${category}`,
                                text: `${fact}\n\nQuizvraag: ${quizData?.question}`,
                                url: window.location.href
                            }).catch(console.error);
                        } else {
                            navigator.clipboard.writeText(`${fact}\n\nQuiz: ${quizData?.question}` || '');
                            alert("Tekst gekopieerd!");
                        }
                    }}
                >
                    <Share2 size={16} /> Delen
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default FactModal;
