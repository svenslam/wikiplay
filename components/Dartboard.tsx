import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Category, GameState, DartCoordinates } from '../types';

interface DartboardProps {
  onHit: (category: Category) => void;
  gameState: GameState;
  setGameState: (state: GameState) => void;
}

const CATEGORIES = Object.values(Category);
const BOARD_RADIUS = 300; // Internal SVG units

const Dartboard: React.FC<DartboardProps> = ({ onHit, gameState, setGameState }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [darts, setDarts] = useState<DartCoordinates[]>([]);
  
  // Animation loop ref
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const speedRef = useRef<number>(0);

  // Colors for segments
  const colorScale = d3.scaleOrdinal<string>()
    .domain(CATEGORIES)
    .range([
        '#ef4444', // Red
        '#3b82f6', // Blue
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#8b5cf6', // Violet
        '#ec4899', // Pink
        '#06b6d4', // Cyan
        '#f97316'  // Orange
    ]);

  const pie = d3.pie<string>()
    .value(1)
    .sort(null);

  const arc = d3.arc<d3.PieArcDatum<string>>()
    .innerRadius(20)
    .outerRadius(BOARD_RADIUS);

  const arcs = pie(CATEGORIES);

  // Spin Logic
  const animate = useCallback((time: number) => {
    if (lastTimeRef.current !== 0) {
      // Rotate based on speed
      setRotation(prev => (prev + speedRef.current) % 360);
    }
    lastTimeRef.current = time;

    if (gameState === GameState.SPINNING) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState === GameState.SPINNING) {
      speedRef.current = 8; // High speed
      lastTimeRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Stop animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, animate]);

  // Handle Throw
  const handleThrow = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== GameState.SPINNING) return;

    // 1. Stop spinning
    setGameState(GameState.THROWN);
    
    // 2. Calculate Hit Position (Randomized for realism, user "aims" but there's spread)
    // We simulate a hit relative to the center of the board
    // Random radius (biased towards center slightly) and random angle
    const r = Math.sqrt(Math.random()) * (BOARD_RADIUS * 0.9); // 90% of radius max to stay on board
    const theta = Math.random() * 2 * Math.PI;
    
    const hitX = r * Math.cos(theta);
    const hitY = r * Math.sin(theta);
    
    // 3. Determine Category
    // We need to account for board rotation.
    // Board rotates clockwise.
    // SVG 0 degrees is usually 12 o'clock minus 90deg, but d3 arc starts at 12 o'clock (0 rad).
    // Let's normalize. 
    // Hit Angle in degrees (0 to 360, 0 at top)
    let hitAngleDeg = (Math.atan2(hitY, hitX) * 180 / Math.PI) + 90;
    if (hitAngleDeg < 0) hitAngleDeg += 360;

    // The board is rotated by `rotation`.
    // The effective angle on the board is (HitAngle - BoardRotation)
    let effectiveAngle = (hitAngleDeg - rotation) % 360;
    if (effectiveAngle < 0) effectiveAngle += 360;

    // Segment size
    const segmentSize = 360 / CATEGORIES.length;
    const index = Math.floor(effectiveAngle / segmentSize);
    // D3 pie generates arcs clockwise starting from 0 (top).
    // Our index 0 corresponds to the first slice.
    
    // Important: d3.pie default sort might mess order if not disabled. We disabled it.
    const hitCategory = CATEGORIES[index];

    // 4. Add visual dart
    setDarts([{ x: hitX, y: hitY, rotation: Math.random() * 30 - 15 }]);

    // 5. Callback after delay
    setTimeout(() => {
        onHit(hitCategory);
    }, 800);
  };

  return (
    <div className="relative w-full max-w-[600px] aspect-square mx-auto select-none touch-none">
        {/* The Board Container */}
        <div 
            ref={containerRef}
            className="w-full h-full relative cursor-crosshair filter drop-shadow-2xl"
            onClick={handleThrow}
        >
            <svg 
                ref={svgRef}
                viewBox={`-${BOARD_RADIUS + 20} -${BOARD_RADIUS + 20} ${(BOARD_RADIUS + 20) * 2} ${(BOARD_RADIUS + 20) * 2}`}
                className="w-full h-full"
                style={{ transform: `rotate(${rotation}deg)` }}
            >
                {/* Outer Rim */}
                <circle r={BOARD_RADIUS + 15} fill="#333" />
                <circle r={BOARD_RADIUS + 5} fill="#ddd" stroke="#999" strokeWidth="2"/>

                {/* Segments */}
                {arcs.map((d, i) => (
                    <g key={i}>
                        <path 
                            d={arc(d) || undefined} 
                            fill={colorScale(d.data)} 
                            stroke="#fff"
                            strokeWidth="2"
                        />
                        {/* Text Labels */}
                        <text
                            transform={`translate(${arc.centroid(d)}) rotate(${(d.startAngle + d.endAngle)/2 * 180/Math.PI})`}
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            fill="white"
                            fontSize="24"
                            fontWeight="bold"
                            className="pointer-events-none drop-shadow-md"
                            style={{ textShadow: '1px 1px 2px black' }}
                        >
                            {/* Shorten text for mobile/small slices if needed */}
                            {d.data.length > 10 ? d.data.substring(0, 8) + '..' : d.data}
                        </text>
                    </g>
                ))}
                
                {/* Bullseye */}
                <circle r={20} fill="#be123c" stroke="#fff" strokeWidth="2" />
            </svg>

            {/* Darts Overlay (Does NOT rotate with board) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                 {/* This container centers 0,0 */}
                 {darts.map((dart, i) => {
                     // Convert internal SVG coordinates to % for absolute positioning
                     // Board is from -320 to 320 internally
                     const size = (BOARD_RADIUS + 20) * 2;
                     const leftP = ((dart.x + (size/2)) / size) * 100;
                     const topP = ((dart.y + (size/2)) / size) * 100;
                     
                     return (
                         <div 
                            key={i}
                            className="absolute dart-animation"
                            style={{
                                left: `${leftP}%`,
                                top: `${topP}%`,
                                marginLeft: '-40px', // Half of dart image width
                                marginTop: '-80px', // Adjust to tip of dart
                                transformOrigin: '50% 100%' // Pivot at tip
                            }}
                         >
                            {/* CSS Dart */}
                            <div className="relative w-20 h-24 filter drop-shadow-lg" style={{ transform: `rotate(${45 + dart.rotation}deg)` }}>
                                <div className="absolute bottom-0 left-1/2 w-1 h-10 bg-gray-300 -translate-x-1/2"></div> {/* Tip */}
                                <div className="absolute bottom-6 left-1/2 w-4 h-12 bg-red-600 -translate-x-1/2 rounded-full"></div> {/* Barrel */}
                                <div className="absolute top-0 left-1/2 w-8 h-8 bg-black -translate-x-1/2 clip-path-polygon"></div> {/* Flight */}
                                {/* Simple SVG Dart Graphic */}
                                <svg width="80" height="100" viewBox="0 0 100 120" className="absolute -bottom-4 left-0">
                                    <path d="M50 120 L55 80 L65 30 L50 0 L35 30 L45 80 Z" fill="url(#grad1)" stroke="#333" />
                                    <path d="M50 0 L80 20 L50 40 L20 20 Z" fill="#b91c1c" />
                                    <defs>
                                        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" style={{stopColor:'rgb(50,50,50)', stopOpacity:1}} />
                                        <stop offset="50%" style={{stopColor:'rgb(200,200,200)', stopOpacity:1}} />
                                        <stop offset="100%" style={{stopColor:'rgb(50,50,50)', stopOpacity:1}} />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                         </div>
                     )
                 })}
            </div>
        </div>

        {gameState === GameState.IDLE && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 text-white px-6 py-3 rounded-full animate-bounce text-xl font-bold backdrop-blur-sm border border-white/20">
                Klik om te draaien!
              </div>
           </div>
        )}

        {gameState === GameState.SPINNING && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-red-600/80 text-white px-8 py-4 rounded-xl text-2xl font-black uppercase tracking-widest shadow-xl backdrop-blur-sm border-2 border-white animate-pulse">
                GOOI NU!
              </div>
           </div>
        )}
    </div>
  );
};

export default Dartboard;