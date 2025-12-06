import React, { useState, useRef, useEffect } from 'react';
import { RadioStation } from '../types';
import { Play, Pause, Radio, Volume2, SkipForward, AlertCircle } from 'lucide-react';

// Using reliable streams primarily for Dutch audience given the language of the app
const STATIONS: RadioStation[] = [
  { name: "Sky Radio", genre: "Non-stop Hits", url: "https://www.mp3stream.nl/skyradio/mp3" },
  { name: "Radio 10", genre: "Greatest Hits", url: "https://www.mp3stream.nl/radio10/mp3" },
  { name: "Qmusic", genre: "Top 40", url: "https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_live_96.mp3" },
  { name: "NPO Radio 2", genre: "Variatie", url: "https://icecast.omroep.nl/radio2-bb-mp3" },
  { name: "Arrow Classic Rock", genre: "Rock", url: "https://stream.arrow.nl/arrow" },
  { name: "Sublime", genre: "Soul & Jazz", url: "https://stream.sublime.nl/sublime" },
  { name: "Lofi Hip Hop", genre: "Chill", url: "https://stream.zeno.fm/0r0xa854rp8uv" },
  { name: "NPO Klassiek", genre: "Klassiek", url: "https://icecast.omroep.nl/radio4-bb-mp3" },
];

const RadioPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStationIndex, setCurrentStationIndex] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    // Reset error state when station changes or play intent changes
    if (isPlaying) {
      setError(false);
    }

    if (audioRef.current) {
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.error("Playback prevented:", err);
            // Autoplay policy or immediate error. 
            // We don't stop strictly here to allow buffering, 
            // but standard errors are caught by onError.
            if (err.name === 'NotAllowedError') {
                 setIsPlaying(false);
            }
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentStationIndex]);

  const togglePlay = () => {
    if (error) {
        // If retrieving from error, reset and try playing
        setError(false);
        if (audioRef.current) {
            audioRef.current.load();
        }
    }
    setIsPlaying(!isPlaying);
  };

  const nextStation = () => {
    setError(false);
    setIsPlaying(true); // Auto-start next station
    setCurrentStationIndex((prev) => (prev + 1) % STATIONS.length);
  };

  const handleError = () => {
      console.warn("Stream failed to load/play");
      setIsPlaying(false); // Stop playback to prevent infinite loops
      setError(true);
  };

  const station = STATIONS[currentStationIndex];

  return (
    <div className="bg-gray-900 border-t-2 border-amber-700 p-4 fixed bottom-0 left-0 right-0 z-50 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300">
      <audio 
        ref={audioRef} 
        src={station.url} 
        onError={handleError}
        // Removed crossOrigin="anonymous" to fix playback for streams without CORS headers
      />
      
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className={`p-2 rounded-full transition-colors duration-300 ${
            error ? 'bg-red-500' : isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-700'
        }`}>
            {error ? <AlertCircle size={24} /> : <Radio size={24} />}
        </div>
        <div>
          <h3 className={`font-bold text-sm md:text-base ${error ? 'text-red-400' : 'text-amber-400'}`}>
            {error ? "Stream fout" : station.name}
          </h3>
          <p className="text-xs text-gray-400 uppercase tracking-wider">
            {error ? "Probeer een andere" : station.genre}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-2 border border-gray-700">
            <button 
                onClick={togglePlay}
                className="hover:text-amber-400 transition-colors p-1"
                aria-label={isPlaying ? "Pauzeren" : "Afspelen"}
            >
                {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
            </button>
            <button 
                onClick={nextStation}
                className="hover:text-amber-400 transition-colors ml-2 p-1"
                aria-label="Volgende zender"
            >
                <SkipForward size={24} />
            </button>
        </div>

        <div className="flex items-center gap-2 hidden sm:flex">
            <Volume2 size={18} className="text-gray-400" />
            <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
            />
        </div>
      </div>
    </div>
  );
};

export default RadioPlayer;