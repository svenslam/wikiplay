
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Shuffle, Trophy, Maximize2, BookOpen, BrainCircuit, ArrowLeft, X, RefreshCw, Share2, Volume2, StopCircle, Image as ImageIcon, CheckCircle, XCircle, ArrowDown } from 'lucide-react';

// --- 1. DEFINITIONS (Formerly types.js) ---

const Category = {
  HISTORY: 'Geschiedenis',
  SCIENCE: 'Wetenschap',
  NATURE: 'Natuur',
  SPORTS: 'Sport',
  ART: 'Kunst',
  TECH: 'Technologie',
  GEOGRAPHY: 'Geografie',
  ENTERTAINMENT: 'Entertainment',
};

const GameState = {
  IDLE: 'IDLE',
  SPINNING: 'SPINNING',
  THROWN: 'THROWN',
  FETCHING: 'FETCHING',
  SHOWING_CONTENT: 'SHOWING_CONTENT',
};

// --- 2. SERVICE LOGIC (Formerly geminiService.js) ---

// Safely retrieve API key or default to empty string to prevent ReferenceError
const apiKey = (typeof process !== "undefined" && process.env && process.env.API_KEY) ? process.env.API_KEY : "";

// Only initialize if we have a key
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const fetchTopicContent = async (category) => {
  if (!ai) {
    console.warn("API Key missing or invalid. Cannot fetch content.");
    return null;
  }

  try {
    const prompt = `
      Je bent de host van een kennis-app genaamd Wikiplay.
      De gebruiker heeft de categorie "${category}" gekozen.

      Genereer een JSON object met twee onderdelen:
      1. 'fact': Een interessant, minder bekend Wikipedia-weetje over dit onderwerp.
         - Begin de tekst ALTIJD met: "- ${category} - \n\nWist je dat..."
         - Houd het beknopt (max 3-4 zinnen).
         - Schrijf in het Nederlands.
      
      2. 'quiz': Een uitdagende multiple-choice vraag die gaat over de bredere context of achtergrond van dit specifieke onderwerp.
         - BELANGRIJK: Het antwoord mag NIET letterlijk in de tekst van 'fact' staan. De gebruiker moet nadenken of algemene kennis gebruiken.
         - Het moet wel direct gerelateerd zijn aan het onderwerp van het weetje.
         - 3 opties.
         - 1 correct antwoord.
         - Een korte uitleg.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fact: { type: Type.STRING },
            quiz: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Array van precies 3 opties"
                },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          },
          required: ["fact", "quiz"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Gemini Content Error:", error);
    return null;
  }
};

const fetchTriviaImage = async (textContext) => {
  if (!ai) return null;
  
  try {
    // Shorten context if too long
    const cleanContext = textContext.replace(/^-.*?Wist je dat/i, '').substring(0, 300);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: `Een sfeervolle, artistieke illustratie (digitaal schilderij) die past bij dit weetje: "${cleanContext}". Geen tekst in de afbeelding.` }
        ]
      },
      config: {
        imageConfig: {
            aspectRatio: "16:9",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini API Error (Image):", error);
    return null;
  }
};

const fetchTriviaAudio = async (text) => {
    if (!ai) return null;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Fenrir' }, 
              },
          },
        },
      });
  
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio || null;
    } catch (error) {
      console.error("Gemini API Error (Audio):", error);
      return null;
    }
};

// --- 3. COMPONENTS ---

// Helper to decode PCM
const decode = (base64) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};
  
const decodeAudioData = async (
    data,
    ctx,
    sampleRate = 24000,
    numChannels = 1,
) => {
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

const FactModal = ({ 
    category, 
    fact, 
    quizData,
    imageUrl, 
    audioBase64, 
    isOpen, 
    onClose, 
    isLoading,
    isAssetsLoading,
    onAnswerQuiz,
    initialView = 'fact'
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [quizResult, setQuizResult] = useState(null); // 'correct' | 'wrong' | null
  
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const scrollRef = useRef(null);
  const quizSectionRef = useRef(null);

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

  // Handle scroll to quiz if requested
  useEffect(() => {
    if (isOpen && !isLoading && quizData && initialView === 'quiz' && quizSectionRef.current) {
        // Small delay to ensure layout is ready
        setTimeout(() => {
            quizSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
  }, [isOpen, isLoading, quizData, initialView]);

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
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({sampleRate: 24000});
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

  const handleOptionClick = (option) => {
    if (quizResult !== null) return; // Prevent multi-click

    setSelectedOption(option);
    const isCorrect = option === quizData?.correctAnswer;
    setQuizResult(isCorrect ? 'correct' : 'wrong');
    onAnswerQuiz(isCorrect);
  };

  if (!isOpen) return null;

  const formatFactText = (text) => {
    if (!text) return "";
    // Remove the "- Category -" part for the body text
    const parts = text.split('\n\n');
    return (
        <React.Fragment>
            {parts.map((part, i) => (
                <p key={i} className={`mb-3 ${i === 0 ? 'font-bold text-amber-800' : 'text-gray-800'}`}>
                    {part}
                </p>
            ))}
        </React.Fragment>
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
                    <div className="flex items-center gap-4 opacity-50" ref={quizSectionRef}>
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
                                title: `Wikiplay: ${category}`,
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

// --- APP COMPONENT ---

const CATEGORIES = Object.values(Category);

const App = () => {
  const [gameState, setGameState] = useState(GameState.IDLE);
  const [currentCategory, setCurrentCategory] = useState(null);
  
  // Content Data
  const [currentFact, setCurrentFact] = useState(null);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [initialModalView, setInitialModalView] = useState('fact');
  const [isAssetsLoading, setIsAssetsLoading] = useState(false);
  
  // Ambient Mode State
  const [isAmbientMode, setIsAmbientMode] = useState(false);

  // Scoreboard
  const [scores, setScores] = useState(() => {
    const initial = {};
    CATEGORIES.forEach(c => initial[c] = { correct: 0, wrong: 0 });
    return initial;
  });

  const handleCategorySelect = async (category, view = 'fact') => {
    // Reset States
    setCurrentFact(null);
    setCurrentQuiz(null);
    setCurrentImage(null);
    setCurrentAudio(null);
    setIsAssetsLoading(false);
    
    // Exit ambient mode if entering a new topic
    setIsAmbientMode(false);

    setCurrentCategory(category);
    setInitialModalView(view);
    setGameState(GameState.FETCHING);
    setModalOpen(true);
    
    // Fetch combined content
    const content = await fetchTopicContent(category);
    
    if (content) {
        setCurrentFact(content.fact);
        setCurrentQuiz(content.quiz);
        setGameState(GameState.SHOWING_CONTENT);
        
        // Start background loading of assets
        setIsAssetsLoading(true);
        Promise.all([
            fetchTriviaImage(content.fact),
            fetchTriviaAudio(content.fact)
        ]).then(([img, audio]) => {
            setCurrentImage(img);
            setCurrentAudio(audio);
            setIsAssetsLoading(false);
        });
    } else {
        // Fallback
        setCurrentFact(`Excuses, we konden geen informatie vinden over ${category}. Probeer het nog eens.`);
        setGameState(GameState.SHOWING_CONTENT);
    }
  };

  const handleRandom = () => {
      const randomCat = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      handleCategorySelect(randomCat, 'fact');
  };

  const handleQuizAnswer = (isCorrect) => {
    if (!currentCategory) return;
    
    setScores(prev => ({
        ...prev,
        [currentCategory]: {
            correct: prev[currentCategory].correct + (isCorrect ? 1 : 0),
            wrong: prev[currentCategory].wrong + (isCorrect ? 0 : 1)
        }
    }));
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setGameState(GameState.IDLE);
  };

  // Helper for grid colors
  const getCategoryColor = (cat) => {
    switch(cat) {
        case Category.HISTORY: return 'bg-red-700 border-red-900';
        case Category.SCIENCE: return 'bg-blue-700 border-blue-900';
        case Category.NATURE: return 'bg-emerald-700 border-emerald-900';
        case Category.SPORTS: return 'bg-orange-600 border-orange-800';
        case Category.ART: return 'bg-purple-700 border-purple-900';
        case Category.TECH: return 'bg-cyan-700 border-cyan-900';
        case Category.GEOGRAPHY: return 'bg-yellow-600 border-yellow-800';
        case Category.ENTERTAINMENT: return 'bg-pink-600 border-pink-800';
        default: return 'bg-gray-700';
    }
  };

  return (
    <div className="min-h-screen wood-bg flex flex-col relative pb-8 transition-all">
      
      {/* AMBIENT MODE OVERLAY */}
      {isAmbientMode && currentImage && (
        <div className="fixed inset-0 z-40 bg-black animate-fade-in">
            <img 
                src={currentImage} 
                alt="Fullscreen Atmosphere" 
                className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none"></div>
            
            {/* Ambient Controls */}
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-50">
                <button 
                    onClick={() => setIsAmbientMode(false)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/20 transition-all font-bold group"
                >
                    <ArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                    Terug naar Home
                </button>

                {currentFact && (
                     <div className="hidden md:block max-w-lg bg-black/40 backdrop-blur-md p-4 rounded-xl border border-white/10 text-white/90 text-sm">
                        <p className="line-clamp-3 italic">"{currentFact.split('\n\n')[1] || currentFact}"</p>
                     </div>
                )}
            </div>
            
            <div className="absolute bottom-32 left-0 right-0 text-center pointer-events-none px-4">
                 <h2 className="text-4xl md:text-6xl font-[Lobster] text-white/90 drop-shadow-2xl tracking-wider">
                    {currentCategory}
                 </h2>
            </div>
        </div>
      )}

      {/* Header */}
      {!isAmbientMode && (
        <header className="p-4 bg-black/60 backdrop-blur-md sticky top-0 z-30 border-b border-white/10 shadow-lg">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center border-2 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                        <span className="text-xl">🎯</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-[Lobster] text-amber-400 drop-shadow-sm tracking-wide">Wikiplay</h1>
                </div>
                
                <div className="flex gap-2">
                    {currentImage && (
                        <button
                            onClick={() => setIsAmbientMode(true)}
                            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-full border border-gray-600 transition"
                            title="Sfeermodus"
                        >
                            <Maximize2 size={18} />
                            <span className="hidden sm:inline text-sm">Sfeer</span>
                        </button>
                    )}

                    <button 
                        onClick={handleRandom}
                        className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-2 px-6 rounded-full shadow-lg transform transition hover:scale-105 active:scale-95"
                    >
                        <Shuffle size={20} />
                        <span className="hidden sm:inline">Verras me!</span>
                    </button>
                </div>
            </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 max-w-6xl mx-auto p-4 md:p-8 w-full ${isAmbientMode ? 'hidden' : 'block'}`}>
        
        {/* Intro Text */}
        <div className="text-center mb-8">
            <h2 className="text-white text-xl md:text-2xl font-semibold mb-2">Kies je categorie</h2>
            <p className="text-gray-400">Lees een weetje of start direct een quiz.</p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {CATEGORIES.map((cat) => (
                <div 
                    key={cat} 
                    className={`group relative rounded-xl overflow-hidden shadow-2xl transition-all hover:-translate-y-2 hover:shadow-amber-500/20 border-b-4 flex flex-col ${getCategoryColor(cat)}`}
                >
                    {/* Main Category Area - Visual */}
                    <div className="p-5 flex-1 bg-gradient-to-br from-white/10 to-transparent flex flex-col justify-between min-h-[120px]">
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-xl tracking-wide shadow-black drop-shadow-md text-white">{cat}</h3>
                            
                            {/* Score badge */}
                            {(scores[cat].correct > 0 || scores[cat].wrong > 0) && (
                                <div className="flex gap-1 text-[10px] font-mono bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm border border-white/10">
                                    <span className="text-green-400 font-bold">{scores[cat].correct}</span>
                                    <span className="text-gray-400">/</span>
                                    <span className="text-red-400 font-bold">{scores[cat].wrong}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="grid grid-cols-2 divide-x divide-black/20 bg-black/20 backdrop-blur-sm border-t border-white/10">
                        <button 
                            onClick={() => handleCategorySelect(cat, 'fact')}
                            className="flex items-center justify-center gap-2 py-3 hover:bg-white/20 transition-colors text-white/90 hover:text-white text-sm font-bold"
                        >
                            <BookOpen size={16} /> Weetje
                        </button>
                        <button 
                            onClick={() => handleCategorySelect(cat, 'quiz')}
                            className="flex items-center justify-center gap-2 py-3 hover:bg-white/20 transition-colors text-white/90 hover:text-white text-sm font-bold"
                        >
                            <BrainCircuit size={16} /> Quiz
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {/* Scoreboard Summary */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-2">
                <Trophy className="text-yellow-400" />
                <h3 className="text-xl font-bold text-white">Jouw Scorebord</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {CATEGORIES.map(cat => {
                     const total = scores[cat].correct + scores[cat].wrong;
                     if (total === 0) return null;
                     
                     return (
                         <div key={cat} className="flex flex-col p-2 bg-white/5 rounded-lg">
                             <span className="text-xs text-gray-400 uppercase truncate font-bold mb-1">{cat}</span>
                             <div className="flex justify-between items-center text-xs mb-1">
                                <span className="text-green-400">{scores[cat].correct} V</span>
                                <span className="text-red-400">{scores[cat].wrong} X</span>
                             </div>
                             {/* Mini bar */}
                             <div className="h-1.5 w-full bg-gray-700 mt-1 rounded-full overflow-hidden flex">
                                 <div style={{width: `${(scores[cat].correct / total) * 100}%`}} className="bg-green-500 h-full" />
                                 <div style={{width: `${(scores[cat].wrong / total) * 100}%`}} className="bg-red-500 h-full" />
                             </div>
                         </div>
                     )
                })}
                {Object.values(scores).every(s => s.correct === 0 && s.wrong === 0) && (
                    <p className="text-gray-500 text-sm col-span-full italic text-center py-2">Nog geen scores. Kies een onderwerp om te beginnen!</p>
                )}
            </div>
        </div>

      </main>

      {/* Modals & Overlays */}
      <FactModal 
        isOpen={modalOpen}
        onClose={handleCloseModal}
        category={currentCategory}
        fact={currentFact}
        quizData={currentQuiz}
        imageUrl={currentImage}
        audioBase64={currentAudio}
        isLoading={gameState === GameState.FETCHING}
        isAssetsLoading={isAssetsLoading}
        onAnswerQuiz={handleQuizAnswer}
        initialView={initialModalView}
      />
    </div>
  );
};

// --- MOUNTING ---

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
    