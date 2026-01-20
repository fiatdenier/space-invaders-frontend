import React, { useState, useEffect, useRef } from 'react';
import { Zap, Trophy, Coins, Maximize2, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import AdminPanel from './Admin'; 

const API_BASE_URL = 'https://invaders-api.fiatdenier.com/api';

const SpaceInvadersTournament = () => {
	
  const [gameState, setGameState] = useState('intro');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [leaderboard, setLeaderboard] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [invoice, setInvoice] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [sessionToken, setSessionToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gameData, setGameData] = useState({ startTime: null, shotsFired: 0, hits: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);  // ADD HERE
  const [testMode, setTestMode] = useState(false);
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const paymentCheckRef = useRef(null);
  const audioContextRef = useRef(null);
  const starsRef = useRef([]);
  
  const startTestGame = (testToken) => {
  setSessionToken(testToken);
  setPlayerName('Test Player');
  setTestMode(true);
  setShowAdmin(false);
  startGame();
};
  
  const gameObjectsRef = useRef({
    player: { x: 0, y: 0, width: 80, height: 50, speed: 8, exploding: false, explosionFrame: 0 },
    invaders: [],
    bullets: [],
    enemyBullets: [],
    barriers: [],
    invaderDirection: 1,
    invaderSpeed: 1,
    lastEnemyShot: 0,
    animationFrame: 0,
    keys: {},
	mobileInput: { left: false, right: false, shoot: false }
	
  });

  useEffect(() => {
    fetchLeaderboard();
    fetchPotAmount();
    const interval = setInterval(() => {
      fetchLeaderboard();
      fetchPotAmount();
    }, 10000);
    
    for (let i = 0; i < 200; i++) {
      starsRef.current.push({
        x: Math.random() * 1400,
        y: Math.random() * 900,
        size: Math.random() * 3,
        speed: Math.random() * 0.8 + 0.2,
        brightness: Math.random()
      });
    }
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gameState === 'playing') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      canvas.width = 1400;
      canvas.height = 900;
      
      if (gameObjectsRef.current.invaders.length === 0) {
        initGame();
        setGameData(prev => ({ ...prev, startTime: Date.now() }));
      }

      const gameLoop = () => {
        update();
        render(ctx);
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      };

      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return () => {
        if (gameLoopRef.current) {
          cancelAnimationFrame(gameLoopRef.current);
        }
      };
    }
  }, [gameState, lives]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      gameObjectsRef.current.keys[e.key] = true;
      if (e.key === ' ' && gameState === 'playing' && !gameObjectsRef.current.player.exploding) {
        shoot();
        e.preventDefault();
      }
      if (e.key === 'Enter' && gameState === 'intro') {
        setGameState('menu');
      }
    };

    const handleKeyUp = (e) => {
      gameObjectsRef.current.keys[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  useEffect(() => {
    if (lives === 0 && gameState === 'playing') {
      endGame();
    }
  }, [lives]);
  
    useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
    }, []);

	useEffect(() => {
	  const handleKeyPress = (e) => {
		if (e.ctrlKey && e.shiftKey && e.key === 'A') {
		  setShowAdmin(!showAdmin);
		}
	  };
	  window.addEventListener('keydown', handleKeyPress);
	  return () => window.removeEventListener('keydown', handleKeyPress);
	}, [showAdmin]);


  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const playSound = (type) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    switch(type) {
      case 'shoot':
        oscillator.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1);
        break;
      case 'hit':
        oscillator.frequency.value = 1400;
        gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.15);
        break;
      case 'explode':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.6);
        gainNode.gain.setValueAtTime(0.6, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.6);
        break;
      case 'march':
        oscillator.frequency.value = 120 + (55 - gameObjectsRef.current.invaders.filter(i => i.alive).length) * 2;
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.08);
        break;
    }
  };

  const initGame = () => {
    const canvas = canvasRef.current;
    initInvaders();
    initBarriers();
    setLives(3);
    gameObjectsRef.current.player.x = canvas.width / 2 - 40;
    gameObjectsRef.current.player.y = canvas.height - 120;
    gameObjectsRef.current.player.exploding = false;
  };

  const initInvaders = () => {
    const invaders = [];
    const types = [40, 30, 30, 20, 10];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 11; col++) {
        invaders.push({
          x: col * 100 + 150,
          y: row * 70 + 80,
          width: 64,
          height: 48,
          alive: true,
          type: row,
          points: types[row]
        });
      }
    }
    gameObjectsRef.current.invaders = invaders;
    gameObjectsRef.current.invaderSpeed = 1 + (level * 0.3);
  };

  const initBarriers = () => {
    const barriers = [];
    const canvas = canvasRef.current;
    for (let i = 0; i < 4; i++) {
      const baseX = 200 + i * 320;
      const baseY = canvas.height - 220;
      
      // Create dome/arch shape
      const domePattern = [
        [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
        [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1],
        [1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1]
      ];
      
      domePattern.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell) {
            barriers.push({
              x: baseX + colIndex * 8,
              y: baseY + rowIndex * 8,
              width: 8,
              height: 8,
              alive: true
            });
          }
        });
      });
    }
    gameObjectsRef.current.barriers = barriers;
  };

  const shoot = () => {
    const { player, bullets } = gameObjectsRef.current;
    if (bullets.filter(b => b.fromPlayer).length < 1) {
      bullets.push({
        x: player.x + player.width / 2 - 3,
        y: player.y,
        width: 6,
        height: 24,
        speed: 14,
        fromPlayer: true
      });
      setGameData(prev => ({ ...prev, shotsFired: prev.shotsFired + 1 }));
      playSound('shoot');
    }
  };

  const update = () => {
    const game = gameObjectsRef.current;
    const canvas = canvasRef.current;
    game.animationFrame++;
    
    // Animate stars
    starsRef.current.forEach(star => {
      star.y += star.speed;
      star.brightness = 0.3 + Math.sin(game.animationFrame / 30 + star.x) * 0.3;
      if (star.y > canvas.height) {
        star.y = 0;
        star.x = Math.random() * canvas.width;
      }
    });
    
    if (game.player.exploding) {
      game.player.explosionFrame++;
      if (game.player.explosionFrame > 40) {
        game.player.exploding = false;
        game.player.explosionFrame = 0;
        setLives(l => l - 1);
      }
      return;
    }
    
    if (game.keys['ArrowLeft'] || game.mobileInput.left) {
      if (game.player.x > 0) game.player.x -= game.player.speed;
    }
    if (game.keys['ArrowRight'] || game.mobileInput.right) {
      if (game.player.x < canvas.width - game.player.width) game.player.x += game.player.speed;
    }

    game.bullets = game.bullets.filter(bullet => {
      bullet.y += bullet.fromPlayer ? -bullet.speed : bullet.speed;
      return bullet.y > -30 && bullet.y < canvas.height + 30;
    });

    const aliveInvaders = game.invaders.filter(inv => inv.alive);
    
    if (game.animationFrame % 30 === 0 && aliveInvaders.length > 0) {
      let hitEdge = false;
      aliveInvaders.forEach(inv => {
        inv.x += game.invaderDirection * game.invaderSpeed * 18;
        if (inv.x <= 30 || inv.x >= canvas.width - 100) hitEdge = true;
      });
      
      if (hitEdge) {
        game.invaderDirection *= -1;
        aliveInvaders.forEach(inv => {
          inv.y += 35;
          if (inv.y > canvas.height - 180) {
            setLives(0);
          }
        });
      }
      playSound('march');
    }

    const now = Date.now();
    if (now - game.lastEnemyShot > Math.max(350, 1000 - level * 80)) {
      if (aliveInvaders.length > 0) {
        const shooter = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)];
        game.bullets.push({
          x: shooter.x + shooter.width / 2 - 3,
          y: shooter.y + shooter.height,
          width: 6,
          height: 24,
          speed: 7,
          fromPlayer: false
        });
        game.lastEnemyShot = now;
      }
    }

    game.bullets.forEach((bullet, bIndex) => {
      game.invaders.forEach((invader) => {
        if (invader.alive && bullet.fromPlayer &&
            bullet.x < invader.x + invader.width &&
            bullet.x + bullet.width > invader.x &&
            bullet.y < invader.y + invader.height &&
            bullet.y + bullet.height > invader.y) {
          invader.alive = false;
          game.bullets.splice(bIndex, 1);
          setScore(s => s + invader.points);
          setGameData(prev => ({ ...prev, hits: prev.hits + 1 }));
          playSound('hit');
        }
      });

      game.barriers.forEach((barrier) => {
        if (barrier.alive &&
            bullet.x < barrier.x + barrier.width &&
            bullet.x + bullet.width > barrier.x &&
            bullet.y < barrier.y + barrier.height &&
            bullet.y + bullet.height > barrier.y) {
          barrier.alive = false;
          game.bullets.splice(bIndex, 1);
        }
      });

      if (!bullet.fromPlayer && !game.player.exploding) {
        if (bullet.x < game.player.x + game.player.width &&
            bullet.x + bullet.width > game.player.x &&
            bullet.y < game.player.y + game.player.height &&
            bullet.y + bullet.height > game.player.y) {
          game.bullets.splice(bIndex, 1);
          game.player.exploding = true;
          game.player.explosionFrame = 0;
          playSound('explode');
        }
      }
    });

    if (aliveInvaders.length === 0) {
      setScore(s => s + 1000);
      setLevel(l => l + 1);
      initInvaders();
      initBarriers();
    }
  };

  const drawAlien = (ctx, x, y, type, frame) => {
    // Much larger, more detailed alien sprites with animated legs
    const sprites = {
      0: [ // Squid - top row
        [
          '    ████████    ',
          '  ████████████  ',
          '████████████████',
          '██  ██████  ████',
          '████████████████',
          '  ██  ████  ██  ',
          '  ██      ██    ',
          '    ██  ██      '
        ],
        [
          '    ████████    ',
          '  ████████████  ',
          '████████████████',
          '██  ██████  ████',
          '████████████████',
          '  ██  ████  ██  ',
          '    ██    ██    ',
          '  ██        ██  '
        ]
      ],
      1: [ // Crab - middle rows
        [
          '  ██      ██    ',
          '    ██  ██      ',
          '  ████████████  ',
          '██████████████  ',
          '████████████████',
          '██████████████  ',
          '██  ████████  ██',
          '    ██    ██    '
        ],
        [
          '  ██      ██    ',
          '██  ██  ██  ██  ',
          '██████████████  ',
          '████  ████  ████',
          '████████████████',
          '  ████████████  ',
          '  ██      ██    ',
          '██  ██  ██  ██  '
        ]
      ],
      2: [ // Octopus - bottom rows
        [
          '    ████████    ',
          '  ████████████  ',
          '████████████████',
          '████  ████  ████',
          '████████████████',
          '  ██  ██████    ',
          '██  ██    ██  ██',
          '  ██        ██  '
        ],
        [
          '    ████████    ',
          '  ████████████  ',
          '████████████████',
          '████  ████  ████',
          '████████████████',
          '    ██  ██  ██  ',
          '  ██  ██  ██  ██',
          '██          ██  '
        ]
      ]
    };
    
    const alienType = type >= 3 ? 2 : type;
    const sprite = sprites[alienType][frame % 2];
    const colors = ['#ffff00', '#00ffff', '#ff00ff'];
    const glowColors = ['rgba(255,255,0,0.5)', 'rgba(0,255,255,0.5)', 'rgba(255,0,255,0.5)'];
    
    // Draw glow effect
    //ctx.shadowBlur = 15;
    //ctx.shadowColor = glowColors[alienType];
    
    ctx.fillStyle = colors[alienType];
    sprite.forEach((row, rowIndex) => {
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        if (row[colIndex] === '█') {
          ctx.fillRect(x + colIndex * 4, y + rowIndex * 6, 4, 6);
        }
      }
    });
    
    //ctx.shadowBlur = 0;
  };

  const render = (ctx) => {
    const game = gameObjectsRef.current;
    const canvas = canvasRef.current;
    
    // Deep space background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    // Animated stars with twinkle
    starsRef.current.forEach(star => {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
      if (star.size > 1.5) {
        ctx.fillStyle = `rgba(200, 200, 255, ${star.brightness * 0.5})`;
        ctx.fillRect(star.x - 1, star.y, 1, 1);
        ctx.fillRect(star.x + star.size, star.y, 1, 1);
      }
    });

    // Draw invaders with animation
    const frame = Math.floor(game.animationFrame / 15);
    game.invaders.forEach(invader => {
      if (invader.alive) {
        drawAlien(ctx, invader.x, invader.y, invader.type, frame);
      }
    });

    // Draw barriers with glow
    //ctx.shadowBlur = 10;
    //ctx.shadowColor = '#00ff00';
    ctx.fillStyle = '#00ff00';
    game.barriers.forEach(barrier => {
      if (barrier.alive) {
        ctx.fillRect(barrier.x, barrier.y, barrier.width, barrier.height);
      }
    });
    //ctx.shadowBlur = 0;

    // Draw bullets with glow
    game.bullets.forEach(bullet => {
      if (bullet.fromPlayer) {
        //ctx.shadowBlur = 15;
        //ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
      } else {
        //ctx.shadowBlur = 15;
        //ctx.shadowColor = '#ff0000';
        ctx.fillStyle = '#ff0000';
      }
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });
    //ctx.shadowBlur = 0;

    // Draw player or explosion
    if (game.player.exploding) {
      const exp = game.player.explosionFrame;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const dist = exp * 3;
        const colors = ['#ffff00', '#ff8800', '#ff0000'];
        ctx.fillStyle = colors[exp % 3];
        //ctx.shadowBlur = 20;
        //ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(
          game.player.x + 40 + Math.cos(angle) * dist,
          game.player.y + 25 + Math.sin(angle) * dist,
          12, 12
        );
      }
      //ctx.shadowBlur = 0;
    } else {
      // Draw detailed ship with glow
      //ctx.shadowBlur = 20;
      //ctx.shadowColor = '#00ff00';
      ctx.fillStyle = '#00ff00';
      
      // Main body
      ctx.fillRect(game.player.x + 10, game.player.y + 30, 60, 20);
      // Cockpit
      ctx.fillRect(game.player.x + 25, game.player.y + 15, 30, 15);
      ctx.fillStyle = '#00dd00';
      ctx.fillRect(game.player.x + 30, game.player.y + 18, 20, 8);
      // Wings
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(game.player.x, game.player.y + 35, 15, 15);
      ctx.fillRect(game.player.x + 65, game.player.y + 35, 15, 15);
      // Cannon
      ctx.fillRect(game.player.x + 37, game.player.y, 6, 30);
      //ctx.shadowBlur = 0;
    }

    // UI with retro glow
    //ctx.shadowBlur = 15;
    //ctx.shadowColor = '#00ff00';
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 36px "Press Start 2P", monospace';
    ctx.fillText(`SCORE ${score}`, 30, 50);
    
    //ctx.shadowColor = '#ffff00';
    //ctx.fillStyle = '#ffff00';
    ctx.fillText(`LEVEL ${level}`, canvas.width / 2 - 120, 50);
    
    // Lives with glow
    ctx.shadowColor = '#00ff00';
    ctx.fillStyle = '#00ff00';
    for (let i = 0; i < lives; i++) {
      ctx.fillRect(canvas.width - 250 + i * 60, 20, 50, 30);
    }
    //ctx.shadowBlur = 0;
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/leaderboard`);
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchPotAmount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/pot`);
      const data = await response.json();
      setPotAmount(data.amount || 0);
    } catch (error) {
      console.error('Error fetching pot:', error);
    }
  };

  const createPayment = async () => {
    try {
      setGameState('payment');
      const response = await fetch(`${API_BASE_URL}/payment/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: playerName || 'Anonymous' })
      });
      
      const data = await response.json();
      setSessionToken(data.sessionToken);
      setInvoice(data.invoice);
      pollPaymentStatus(data.invoice.paymentHash);
    } catch (error) {
      console.error('Error creating payment:', error);
      alert('Failed to create payment. Please try again.');
      setGameState('menu');
    }
  };

  const pollPaymentStatus = (paymentHash) => {
    paymentCheckRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/payment/status/${paymentHash}`);
        const data = await response.json();
        
        if (data.paid) {
          clearInterval(paymentCheckRef.current);
          startGame();
        }
      } catch (error) {
        console.error('Error checking payment:', error);
      }
    }, 2000);
  };

  const copyInvoice = () => {
    navigator.clipboard.writeText(invoice.paymentRequest);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const endGame = () => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    setGameState('gameover');
  };

  const startGame = () => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setGameData({ startTime: Date.now(), shotsFired: 0, hits: 0 });
    gameObjectsRef.current.invaders = [];
    gameObjectsRef.current.bullets = [];
    gameObjectsRef.current.barriers = [];
    setGameState('playing');
  };
  
  useEffect(() => {
	  const handleKeyPress = (e) => {
		if (e.ctrlKey && e.shiftKey && e.key === 'A') {
		  setShowAdmin(!showAdmin);
		}
	  };
	  window.addEventListener('keydown', handleKeyPress);
	  return () => window.removeEventListener('keydown', handleKeyPress);
	}, [showAdmin]);

  const submitScore = async () => {
    try {
      const playTime = Date.now() - gameData.startTime;
      const response = await fetch(`${API_BASE_URL}/score/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          playerName: playerName || 'Anonymous',
          score,
          gameData: {
            playTime,
            shotsFired: gameData.shotsFired,
            hits: gameData.hits
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`Score submitted! Your rank: #${data.rank}`);
        fetchLeaderboard();
        fetchPotAmount();
        setGameState('intro');
        setScore(0);
        setSessionToken(null);
      } else {
        const error = await response.json();
        alert(`Failed to submit score: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting score:', error);
      alert('Failed to submit score. Please try again.');
    }
  };
  
  const handleMobileControl = (control, active) => {
  gameObjectsRef.current.mobileInput[control] = active;
  if (control === 'shoot' && active && gameState === 'playing') {
    shoot();
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-black text-white overflow-hidden font-['Press_Start_2P']">
      {/* Admin Panel Toggle - Add this */}
    {showAdmin ? (
      <AdminPanel onStartTestGame={startTestGame} />
    ) : (
      <>
        {/* Your existing game UI here */}
	  <button
        onClick={toggleFullscreen}
        className="fixed top-4 right-4 z-50 bg-purple-600 hover:bg-purple-700 p-3 rounded-lg shadow-lg shadow-purple-500/50"
      >
        <Maximize2 size={24} />
      </button>
	  
	  <button
          onClick={() => setShowAdmin(true)}
          className="fixed bottom-4 left-4 z-50 bg-gray-800 hover:bg-gray-700 p-2 rounded text-xs"
          title="Admin Panel (Ctrl+Shift+A)"
        >
          ADMIN
        </button>

      {gameState === 'intro' && (
        <div className="min-h-screen flex flex-col items-center justify-center bg-black p-8 relative overflow-hidden">
          {/* Animated background stars */}
          <div className="absolute inset-0 opacity-30">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`
                }}
              />
            ))}
          </div>

          <h1 className="text-7xl md:text-9xl font-bold mb-8 relative z-10">
            <span className="text-white glow" style={{textShadow: '0 0 20px #fff, 0 0 40px #fff, 0 0 60px #fff'}}>
              SPACE
            </span>
            <br />
            <span className="text-green-400 glow-green animate-glow" style={{textShadow: '0 0 20px #0f0, 0 0 40px #0f0, 0 0 80px #0f0'}}>
              INVADERS
            </span>
          </h1>
          
          <div className="space-y-12 my-16 text-2xl font-['Press_Start_2P'] relative z-10">
		  
  {/* Squid Alien */}
		  <div className="flex items-center gap-12">
			<svg width="80" height="80" viewBox="0 0 16 16" className="shadow-lg shadow-yellow-400/50" style={{imageRendering: 'pixelated'}}>
			  <rect x="4" y="2" width="8" height="2" fill="#ffff00"/>
			  <rect x="2" y="4" width="12" height="2" fill="#ffff00"/>
			  <rect x="0" y="6" width="16" height="2" fill="#ffff00"/>
			  <rect x="0" y="8" width="2" height="2" fill="#ffff00"/>
			  <rect x="4" y="8" width="2" height="2" fill="#ffff00"/>
			  <rect x="10" y="8" width="2" height="2" fill="#ffff00"/>
			  <rect x="14" y="8" width="2" height="2" fill="#ffff00"/>
			  <rect x="0" y="10" width="16" height="2" fill="#ffff00"/>
			  <rect x="2" y="12" width="2" height="2" fill="#ffff00"/>
			  <rect x="6" y="12" width="2" height="2" fill="#ffff00"/>
			  <rect x="8" y="12" width="2" height="2" fill="#ffff00"/>
			  <rect x="12" y="12" width="2" height="2" fill="#ffff00"/>
			  <rect x="2" y="14" width="2" height="2" fill="#ffff00"/>
			  <rect x="12" y="14" width="2" height="2" fill="#ffff00"/>
			  <filter id="glow-yellow">
				<feGaussianBlur stdDeviation="3" result="coloredBlur"/>
				<feMerge>
				  <feMergeNode in="coloredBlur"/>
				  <feMergeNode in="SourceGraphic"/>
				</feMerge>
			  </filter>
			  <rect x="0" y="0" width="16" height="16" fill="none" filter="url(#glow-yellow)"/>
			</svg>
			<span className="text-yellow-400 glow-yellow">= 10 PTS</span>
		  </div>

		  {/* Crab Alien */}
		  <div className="flex items-center gap-12">
			<svg width="80" height="80" viewBox="0 0 16 16" className="shadow-lg shadow-cyan-400/50" style={{imageRendering: 'pixelated'}}>
			  <rect x="2" y="0" width="2" height="2" fill="#00ffff"/>
			  <rect x="12" y="0" width="2" height="2" fill="#00ffff"/>
			  <rect x="4" y="2" width="2" height="2" fill="#00ffff"/>
			  <rect x="10" y="2" width="2" height="2" fill="#00ffff"/>
			  <rect x="2" y="4" width="12" height="2" fill="#00ffff"/>
			  <rect x="0" y="6" width="16" height="2" fill="#00ffff"/>
			  <rect x="0" y="8" width="16" height="2" fill="#00ffff"/>
			  <rect x="0" y="10" width="2" height="2" fill="#00ffff"/>
			  <rect x="2" y="10" width="2" height="2" fill="#00ffff"/>
			  <rect x="6" y="10" width="4" height="2" fill="#00ffff"/>
			  <rect x="12" y="10" width="2" height="2" fill="#00ffff"/>
			  <rect x="14" y="10" width="2" height="2" fill="#00ffff"/>
			  <rect x="0" y="12" width="2" height="2" fill="#00ffff"/>
			  <rect x="6" y="12" width="2" height="2" fill="#00ffff"/>
			  <rect x="8" y="12" width="2" height="2" fill="#00ffff"/>
			  <rect x="14" y="12" width="2" height="2" fill="#00ffff"/>
			</svg>
			<span className="text-cyan-400" style={{textShadow: '0 0 20px #0ff, 0 0 40px #0ff'}}>= 20 PTS</span>
		  </div>

		  {/* Octopus Alien */}
		  <div className="flex items-center gap-12">
			<svg width="80" height="80" viewBox="0 0 16 16" className="shadow-lg shadow-fuchsia-400/50" style={{imageRendering: 'pixelated'}}>
			  <rect x="4" y="0" width="8" height="2" fill="#ff00ff"/>
			  <rect x="2" y="2" width="12" height="2" fill="#ff00ff"/>
			  <rect x="0" y="4" width="16" height="2" fill="#ff00ff"/>
			  <rect x="0" y="6" width="4" height="2" fill="#ff00ff"/>
			  <rect x="6" y="6" width="4" height="2" fill="#ff00ff"/>
			  <rect x="12" y="6" width="4" height="2" fill="#ff00ff"/>
			  <rect x="0" y="8" width="16" height="2" fill="#ff00ff"/>
			  <rect x="2" y="10" width="2" height="2" fill="#ff00ff"/>
			  <rect x="6" y="10" width="2" height="2" fill="#ff00ff"/>
			  <rect x="8" y="10" width="2" height="2" fill="#ff00ff"/>
			  <rect x="12" y="10" width="2" height="2" fill="#ff00ff"/>
			  <rect x="0" y="12" width="2" height="2" fill="#ff00ff"/>
			  <rect x="4" y="12" width="2" height="2" fill="#ff00ff"/>
			  <rect x="10" y="12" width="2" height="2" fill="#ff00ff"/>
			  <rect x="14" y="12" width="2" height="2" fill="#ff00ff"/>
			</svg>
			<span className="text-fuchsia-400" style={{textShadow: '0 0 20px #f0f, 0 0 40px #f0f'}}>= 30 PTS</span>
		  </div>

		  {/* UFO */}
		  <div className="flex items-center gap-12">
			<svg width="80" height="80" viewBox="0 0 16 16" className="shadow-lg shadow-red-500/50" style={{imageRendering: 'pixelated'}}>
			  <rect x="6" y="0" width="4" height="2" fill="#ff0000"/>
			  <rect x="4" y="2" width="8" height="2" fill="#ff0000"/>
			  <rect x="2" y="4" width="12" height="2" fill="#ff0000"/>
			  <rect x="0" y="6" width="16" height="2" fill="#ff0000"/>
			  <rect x="0" y="8" width="2" height="2" fill="#ff0000"/>
			  <rect x="4" y="8" width="2" height="2" fill="#ff0000"/>
			  <rect x="10" y="8" width="2" height="2" fill="#ff0000"/>
			  <rect x="14" y="8" width="2" height="2" fill="#ff0000"/>
			  <rect x="4" y="4" width="2" height="2" fill="#ffffff"/>
			  <rect x="10" y="4" width="2" height="2" fill="#ffffff"/>
			</svg>
			<span className="text-red-500" style={{textShadow: '0 0 20px #f00, 0 0 40px #f00'}}>= ??? PTS</span>
		  </div>
		</div>
		  
          
          <button
            onClick={() => setGameState('menu')}
            className="text-3xl font-['Press_Start_2P'] text-white animate-pulse mt-12 border-4 border-white px-12 py-6 hover:bg-white hover:text-black transition-all relative z-10 shadow-lg shadow-white/50"
            style={{textShadow: '0 0 10px #fff'}}
          >
            PLAY SPACE INVADERS
          </button>
          
          <div className="mt-20 flex items-center gap-6 relative z-10">
            <Coins className="text-yellow-400" size={48} />
            <span className="text-4xl font-['Press_Start_2P'] text-yellow-400 glow-yellow">
              {potAmount.toLocaleString()} SATS
            </span>
          </div>
          
          <p className="mt-8 text-green-400 text-xl font-['Press_Start_2P'] animate-pulse">
            PRESS ENTER OR CLICK BUTTON
          </p>
        </div>
      )}

      {gameState === 'menu' && (
        <div className="min-h-screen flex items-center justify-center bg-black p-8">
          <div className="max-w-5xl w-full mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="bg-gray-900 rounded-lg p-10 border-4 border-purple-500 shadow-2xl shadow-purple-500/50">
                <h2 className="text-5xl font-bold mb-8 text-green-400 font-['Press_Start_2P'] glow-green">
                  READY?
                </h2>
                <p className="text-xl text-gray-400 mb-8 font-['Press_Start_2P']">
                  PAY 1000 SATS
                </p>
                
                <input
                  type="text"
                  placeholder="NAME"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-6 py-4 bg-black border-4 border-green-400 rounded mb-8 text-white text-xl font-['Press_Start_2P'] shadow-lg shadow-green-400/30"
                />
                
                <button
                  onClick={createPayment}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-5 px-8 rounded-lg text-2xl flex items-center justify-center gap-4 font-['Press_Start_2P'] shadow-2xl shadow-yellow-500/50"
                >
                  <Zap size={36} />
                  PAY & PLAY
                </button>
              </div>

              <div className="bg-gray-900 rounded-lg p-10 border-4 border-purple-500 shadow-2xl shadow-purple-500/50">
                <div className="flex items-center gap-3 mb-8">
                  <Trophy className="text-yellow-400" size={40} />
                  <h2 className="text-4xl font-bold font-['Press_Start_2P']">TOP 5</h2>
                </div>
                
                <div className="space-y-3">
                  {leaderboard.slice(0, 5).length === 0 ? (
                    <p className="text-gray-500 text-center py-12 font-['Press_Start_2P'] text-sm">
                      NO SCORES YET
                    </p>
                  ) : (
                    leaderboard.slice(0, 5).map((entry, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-4 rounded ${
                          index === 0 ? 'bg-yellow-500/20 border-4 border-yellow-500 shadow-lg shadow-yellow-500/30' :
                          index === 1 ? 'bg-gray-500/20 border-4 border-gray-400 shadow-lg shadow-gray-400/30' :
                          index === 2 ? 'bg-orange-500/20 border-4 border-orange-500 shadow-lg shadow-orange-500/30' :
                          'bg-gray-800/50 border-2 border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-4xl font-bold w-16">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                          </span>
                          <span className="font-bold text-lg font-['Press_Start_2P']">{entry.playerName}</span>
                        </div>
                        <span className="text-2xl font-mono font-bold text-green-400 glow-green">{entry.score}</span>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="mt-8 pt-6 border-t-4 border-purple-500">
                  <p className="text-yellow-400 font-['Press_Start_2P'] text-sm mb-3">PRIZES:</p>
                  <div className="space-y-2 text-sm font-['Press_Start_2P']">
                    <div>🥇 50% = {Math.floor(potAmount * 0.5).toLocaleString()} SATS</div>
                    <div>🥈 30% = {Math.floor(potAmount * 0.3).toLocaleString()} SATS</div>
                    <div>🥉 20% = {Math.floor(potAmount * 0.2).toLocaleString()} SATS</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
		  <div className="flex flex-col items-center justify-center min-h-screen bg-black p-2">
			<canvas
			  ref={canvasRef}
			  className="border-4 border-green-500 rounded"
			  style={{maxWidth: '100%', maxHeight: '80vh'}}
			/>
			
			{/* ADD THIS MOBILE CONTROLS SECTION */}
			{isMobile && (
			  <div className="fixed bottom-4 left-0 right-0 flex justify-between px-4 z-50">
				<div className="flex gap-2">
				  <button
					onTouchStart={() => handleMobileControl('left', true)}
					onTouchEnd={() => handleMobileControl('left', false)}
					className="bg-green-600 p-6 rounded-full active:bg-green-700"
				  >
					<ChevronLeft size={32} />
				  </button>
				  <button
					onTouchStart={() => handleMobileControl('right', true)}
					onTouchEnd={() => handleMobileControl('right', false)}
					className="bg-green-600 p-6 rounded-full active:bg-green-700"
				  >
					<ChevronRight size={32} />
				  </button>
				</div>
				<button
				  onTouchStart={() => handleMobileControl('shoot', true)}
				  onTouchEnd={() => handleMobileControl('shoot', false)}
				  className="bg-red-600 p-6 rounded-full active:bg-red-700 text-xl font-bold"
				>
				  FIRE
				</button>
			  </div>
			)}
		  </div>
		)}

      {gameState === 'gameover' && (
        <div className="min-h-screen flex items-center justify-center bg-black">
          <div className="bg-gray-900 rounded-lg p-16 border-4 border-red-500 max-w-3xl shadow-2xl shadow-red-500/50">
            <h2 className="text-7xl font-bold mb-8 text-red-400 text-center font-['Press_Start_2P'] glow animate-glow">
              GAME OVER
            </h2>
            <p className="text-6xl mb-6 text-center font-['Press_Start_2P'] text-white glow">
              {score}
            </p>
            <p className="text-3xl mb-3 text-center font-['Press_Start_2P'] text-gray-400">
              LEVEL {level}
            </p>
            <p className="text-xl mb-12 text-center text-gray-400 font-['Press_Start_2P']">
              ACC: {gameData.shotsFired > 0 ? Math.round((gameData.hits / gameData.shotsFired) * 100) : 0}%
            </p>
            <div className="flex gap-6 justify-center flex-wrap">
              <button
                onClick={submitScore}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-5 px-12 rounded-lg text-2xl font-['Press_Start_2P'] shadow-lg shadow-green-600/50"
              >
                SUBMIT
              </button>
              <button
                onClick={() => setGameState('intro')}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-5 px-12 rounded-lg text-2xl font-['Press_Start_2P'] shadow-lg shadow-gray-600/50"
              >
                MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {gameState === 'payment' && (
        <div className="min-h-screen flex items-center justify-center bg-black p-8">
          <div className="bg-gray-900 rounded-lg p-16 border-4 border-yellow-500 max-w-3xl shadow-2xl shadow-yellow-500/50">
            <Zap size={120} className="mx-auto mb-8 text-yellow-400 animate-pulse" style={{filter: 'drop-shadow(0 0 30px rgba(255,255,0,0.8))'}} />
            <h2 className="text-6xl font-bold mb-8 text-center font-['Press_Start_2P'] glow-yellow">
              PAY TO PLAY
            </h2>
            <p className="text-2xl text-gray-400 mb-10 text-center font-['Press_Start_2P']">
              SCAN INVOICE
            </p>
            
            {invoice && (
              <div className="space-y-8">
                <div className="bg-black p-6 rounded border-4 border-yellow-500 break-all font-mono text-base max-h-48 overflow-y-auto shadow-inner">
                  {invoice.paymentRequest}
                </div>
                
                <button
                  onClick={copyInvoice}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-10 rounded text-2xl flex items-center justify-center gap-4 font-['Press_Start_2P'] shadow-lg shadow-yellow-500/50"
                >
                  {copied ? <Check size={28} /> : <Copy size={28} />}
                  {copied ? 'COPIED!' : 'COPY'}
                </button>

                <div className="text-center text-2xl font-['Press_Start_2P']">
                  <p className="text-gray-400 mb-4">{invoice.amount} SATS</p>
                  <p className="text-yellow-400 animate-pulse glow-yellow">
                    ⚡ WAITING...
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    clearInterval(paymentCheckRef.current);
                    setGameState('intro');
                  }}
                  className="w-full text-gray-400 hover:text-white font-['Press_Start_2P'] text-lg"
                >
                  CANCEL
                </button>
              </div>
            )}
          </div>
        </div>
      )}		
	  </>
     )}
    </div>
  );
};

export default SpaceInvadersTournament;