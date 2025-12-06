
import React, { useState } from 'react';
import FactModal from './components/FactModal';
import { Category, GameState, ScoreBoard, QuizData } from './types';
import { fetchTopicContent, fetchTriviaImage, fetchTriviaAudio } from './services/geminiService';
import { Shuffle, Trophy, Maximize2, BookOpen, BrainCircuit, ArrowLeft } from 'lucide-react';

const CATEGORIES = Object.values(Category) as Category[];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.IDLE);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  
  // Content Data
  const [currentFact, setCurrentFact] = useState<string | null>(null);
  const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [initialModalView, setInitialModalView] = useState<'fact' | 'quiz'>('fact');
  const [isAssetsLoading, setIsAssetsLoading] = useState(false);
  
  // Ambient Mode State
  const [isAmbientMode, setIsAmbientMode] = useState(false);

  // Scoreboard: { Category: { correct: 0, wrong: 0 } }
  const [scores, setScores] = useState<ScoreBoard>(() => {
    const initial: any = {};
    CATEGORIES.forEach(c => initial[c] = { correct: 0, wrong: 0 });
    return initial;
  });

  const handleCategorySelect = async (category: Category, view: 'fact' | 'quiz' = 'fact') => {
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

  const handleQuizAnswer = (isCorrect: boolean) => {
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
  const getCategoryColor = (cat: Category) => {
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

export default App;
