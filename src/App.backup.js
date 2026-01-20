import React, { useState, useEffect, useRef } from 'react';
import { Zap, Trophy, Coins, Play, Info, Copy, Check } from 'lucide-react';

const API_BASE_URL = 'https://invaders-api.fiatdenier.com/api';

const SpaceInvadersTournament = () => {
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [leaderboard, setLeaderboard] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [invoice, setInvoice] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [sessionToken, setSessionToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [gameData, setGameData] = useState({
    startTime: null,
    shotsFired: 0,
    hits: 0
  });
  
  const canvasRef = useRef(null);
  const gameLoopRef = useRef(null);
  const paymentCheckRef = useRef(null);
  const audioContextRef = useRef(null);
  
  const gameObjectsRef = useRef({
    player: { x: 375, y: 550, width: 40, height: 20, speed: 6 },
    invaders: [],
    bullets: [],
    enemyBullets: [],
    barriers: [],
    invaderDirection: 1,
    invaderSpeed: 1,
    invaderDropDistance: 20,
    lastEnemyShot: 0,
    animationFrame: 0,
    keys: {}
  });

  useEffect(() => {
    fetchLeaderboard();
    fetchPotAmount();
    const interval = setInterval(() => {
      fetchLeaderboard();
      fetchPotAmount();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (gameState === 'playing') {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
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
      if (e.key === ' ' && gameState === 'playing') {
        shoot();
        e.preventDefault();
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

  const playSound = (frequency, duration) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  };

  const initGame = () => {
    initInvaders();
    initBarriers();
    setLives(3);
    gameObjectsRef.current.player.x = 375;
  };

  const initInvaders = () => {
    const invaders = [];
    const types = [30, 20, 20, 10, 10];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 11; col++) {
        invaders.push({
          x: col * 60 + 70,
          y: row * 40 + 60,
          width: 32,
          height: 24,
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
    for (let i = 0; i < 4; i++) {
      const baseX = 100 + i * 200;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 10; col++) {
          barriers.push({
            x: baseX + col * 6,
            y: 480 + row * 6,
            width: 6,
            height: 6,
            alive: true
          });
        }
      }
    }
    gameObjectsRef.current.barriers = barriers;
  };

  const shoot = () => {
    const { player, bullets } = gameObjectsRef.current;
    if (bullets.filter(b => b.fromPlayer).length < 1) {
      bullets.push({
        x: player.x + player.width / 2 - 2,
        y: player.y,
        width: 3,
        height: 12,
        speed: 8,
        fromPlayer: true
      });
      setGameData(prev => ({ ...prev, shotsFired: prev.shotsFired + 1 }));
      playSound(800, 0.1);
    }
  };

  const update = () => {
    const game = gameObjectsRef.current;
    game.animationFrame++;
    
    if (game.keys['ArrowLeft'] && game.player.x > 0) {
      game.player.x -= game.player.speed;
    }
    if (game.keys['ArrowRight'] && game.player.x < 760) {
      game.player.x += game.player.speed;
    }

    game.bullets = game.bullets.filter(bullet => {
      bullet.y += bullet.fromPlayer ? -bullet.speed : bullet.speed;
      return bullet.y > -20 && bullet.y < 620;
    });

    const aliveInvaders = game.invaders.filter(inv => inv.alive);
    
    if (game.animationFrame % 30 === 0 && aliveInvaders.length > 0) {
      let hitEdge = false;
      aliveInvaders.forEach(inv => {
        inv.x += game.invaderDirection * game.invaderSpeed * 10;
        if (inv.x <= 10 || inv.x >= 750) hitEdge = true;
      });
      
      if (hitEdge) {
        game.invaderDirection *= -1;
        aliveInvaders.forEach(inv => {
          inv.y += game.invaderDropDistance;
          if (inv.y > 520) {
            setLives(0);
          }
        });
      }
      playSound(200 - aliveInvaders.length, 0.05);
    }

    const now = Date.now();
    if (now - game.lastEnemyShot > Math.max(500, 1500 - level * 100)) {
      if (aliveInvaders.length > 0) {
        const shooter = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)];
        game.bullets.push({
          x: shooter.x + shooter.width / 2 - 2,
          y: shooter.y + shooter.height,
          width: 3,
          height: 12,
          speed: 4,
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
          playSound(1000, 0.15);
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

      if (!bullet.fromPlayer) {
        if (bullet.x < game.player.x + game.player.width &&
            bullet.x + bullet.width > game.player.x &&
            bullet.y < game.player.y + game.player.height &&
            bullet.y + bullet.height > game.player.y) {
          game.bullets.splice(bIndex, 1);
          setLives(l => l - 1);
          playSound(100, 0.3);
        }
      }
    });

    if (aliveInvaders.length === 0) {
      setScore(s => s + 1000);
      setLevel(l => l + 1);
      initInvaders();
      initBarriers();
      playSound(1500, 0.5);
    }
  };

  const render = (ctx) => {
    const game = gameObjectsRef.current;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 800, 600);

    ctx.fillStyle = '#0f0';
    ctx.fillRect(game.player.x, game.player.y, game.player.width, game.player.height);
    ctx.fillRect(game.player.x + 5, game.player.y - 8, 30, 8);
    ctx.fillRect(game.player.x + 15, game.player.y - 12, 10, 4);

    const invaderSprites = [
      [[0,1,1,1,1,0], [1,0,1,1,0,1], [1,1,1,1,1,1], [0,1,0,0,1,0]],
      [[0,0,1,1,0,0], [0,1,1,1,1,0], [1,1,1,1,1,1], [1,0,1,1,0,1]],
      [[1,1,0,0,1,1], [0,1,1,1,1,0], [1,1,1,1,1,1], [0,1,0,0,1,0]]
    ];

    game.invaders.forEach(invader => {
      if (invader.alive) {
        const spriteType = invader.type % 3;
        const sprite = invaderSprites[spriteType];
        const frame = Math.floor(game.animationFrame / 20) % 2;
        
        ctx.fillStyle = invader.type === 0 ? '#ff0' : invader.type < 3 ? '#0ff' : '#f0f';
        sprite.forEach((row, y) => {
          row.forEach((pixel, x) => {
            if (pixel) {
              ctx.fillRect(
                invader.x + x * 5 + (frame * 2),
                invader.y + y * 5,
                5, 5
              );
            }
          });
        });
      }
    });

    ctx.fillStyle = '#0f0';
    game.barriers.forEach(barrier => {
      if (barrier.alive) {
        ctx.fillRect(barrier.x, barrier.y, barrier.width, barrier.height);
      }
    });

    game.bullets.forEach(bullet => {
      ctx.fillStyle = bullet.fromPlayer ? '#fff' : '#f00';
      ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`SCORE: ${score}`, 10, 25);
    ctx.fillText(`LEVEL: ${level}`, 350, 25);
    
    for (let i = 0; i < lives; i++) {
      ctx.fillStyle = '#0f0';
      ctx.fillRect(680 + i * 35, 8, 30, 15);
    }
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
    gameObjectsRef.current.invaders = [];
    gameObjectsRef.current.bullets = [];
    gameObjectsRef.current.barriers = [];
  };

  const startGame = () => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setGameData({ startTime: Date.now(), shotsFired: 0, hits: 0 });
    gameObjectsRef.current.player = { x: 375, y: 550, width: 40, height: 20, speed: 6 };
    gameObjectsRef.current.invaders = [];
    gameObjectsRef.current.bullets = [];
    gameObjectsRef.current.barriers = [];
    setGameState('playing');
  };

  useEffect(() => {
    if (lives === 0 && gameState === 'playing') {
      endGame();
    }
  }, [lives]);

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
        setGameState('menu');
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-black to-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 flex items-center justify-center gap-3">
            <Zap className="text-yellow-400" size={48} />
            SPACE INVADERS TOURNAMENT
            <Zap className="text-yellow-400" size={48} />
          </h1>
          <div className="flex items-center justify-center gap-6 text-2xl mt-4">
            <div className="flex items-center gap-2 bg-yellow-500/20 px-6 py-2 rounded-lg">
              <Coins className="text-yellow-400" />
              <span className="font-mono">{potAmount.toLocaleString()} sats</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-gray-900 rounded-lg p-6 border-2 border-purple-500">
              {gameState === 'menu' && (
                <div className="text-center space-y-6">
                  <div className="bg-black rounded-lg p-8 border border-purple-500">
                    <Play size={64} className="mx-auto mb-4 text-green-400" />
                    <h2 className="text-3xl font-bold mb-4">Ready to Play?</h2>
                    <p className="text-gray-400 mb-6">Pay 1000 sats via Lightning to enter</p>
                    
                    <input
                      type="text"
                      placeholder="Your name (optional)"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full max-w-xs px-4 py-2 bg-gray-800 border border-purple-500 rounded mb-4 text-white"
                    />
                    
                    <button
                      onClick={createPayment}
                      className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-3 px-8 rounded-lg text-xl"
                    >
                      Pay & Play ⚡
                    </button>
                  </div>

                  <div className="bg-black/50 rounded-lg p-6 border border-purple-500/50 text-left">
                    <div className="flex items-center gap-2 mb-4">
                      <Info className="text-blue-400" />
                      <h3 className="text-xl font-bold">How to Play</h3>
                    </div>
                    <ul className="space-y-2 text-gray-300">
                      <li>• Arrow keys to move • Spacebar to shoot</li>
                      <li>• Destroy all invaders before they reach you</li>
                      <li>• 3 lives • Shields protect you • Multiple levels!</li>
                      <li>• Top 3 scores win! 🥇 50% • 🥈 30% • 🥉 20%</li>
                    </ul>
                  </div>
                </div>
              )}

              {gameState === 'playing' && (
                <div>
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    className="w-full border-2 border-purple-500 rounded bg-black"
                  />
                  <p className="text-center mt-4 text-gray-400">Arrow Keys = Move • Spacebar = Shoot</p>
                </div>
              )}

              {gameState === 'gameover' && (
                <div className="text-center space-y-6">
                  <div className="bg-black rounded-lg p-8 border border-red-500">
                    <h2 className="text-4xl font-bold mb-4 text-red-400">Game Over!</h2>
                    <p className="text-3xl mb-2">Final Score: {score}</p>
                    <p className="text-xl mb-2">Level Reached: {level}</p>
                    <p className="text-gray-400 mb-6">
                      Accuracy: {gameData.shotsFired > 0 ? Math.round((gameData.hits / gameData.shotsFired) * 100) : 0}%
                    </p>
                    <div className="space-x-4">
                      <button
                        onClick={submitScore}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg"
                      >
                        Submit Score
                      </button>
                      <button
                        onClick={() => setGameState('menu')}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg"
                      >
                        Back to Menu
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {gameState === 'payment' && (
                <div className="text-center space-y-6">
                  <div className="bg-black rounded-lg p-8 border border-yellow-500">
                    <Zap size={64} className="mx-auto mb-4 text-yellow-400 animate-pulse" />
                    <h2 className="text-3xl font-bold mb-4">Pay to Play</h2>
                    <p className="text-gray-400 mb-6">Pay this Lightning invoice to start playing</p>
                    
                    {invoice && (
                      <div className="space-y-4">
                        <div className="bg-gray-800 p-3 rounded border border-yellow-500 break-all font-mono text-xs max-h-32 overflow-y-auto">
                          {invoice.paymentRequest}
                        </div>
                        
                        <button
                          onClick={copyInvoice}
                          className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-6 rounded flex items-center gap-2 mx-auto"
                        >
                          {copied ? <Check size={20} /> : <Copy size={20} />}
                          {copied ? 'Copied!' : 'Copy Invoice'}
                        </button>

                        <div className="text-sm text-gray-400 space-y-1">
                          <p>Amount: {invoice.amount} sats</p>
                          <p className="animate-pulse">⚡ Waiting for payment...</p>
                        </div>
                        
                        <button
                          onClick={() => {
                            clearInterval(paymentCheckRef.current);
                            setGameState('menu');
                          }}
                          className="text-gray-400 hover:text-white text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="bg-gray-900 rounded-lg p-6 border-2 border-purple-500">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="text-yellow-400" size={32} />
                <h2 className="text-2xl font-bold">Leaderboard</h2>
              </div>
              
              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No scores yet. Be the first!</p>
                ) : (
                  leaderboard.map((entry, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded ${
                        index === 0 ? 'bg-yellow-500/20 border border-yellow-500' :
                        index === 1 ? 'bg-gray-500/20 border border-gray-400' :
                        index === 2 ? 'bg-orange-500/20 border border-orange-500' :
                        'bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold w-8">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                        </span>
                        <div>
                          <div className="font-bold">{entry.playerName}</div>
                          <div className="text-sm text-gray-400">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-xl font-mono font-bold">{entry.score}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-purple-500">
                <h3 className="font-bold mb-2">Prize Distribution</h3>
                <div className="space-y-1 text-sm text-gray-400">
                  <div>🥇 1st: {Math.floor(potAmount * 0.5).toLocaleString()} sats (50%)</div>
                  <div>🥈 2nd: {Math.floor(potAmount * 0.3).toLocaleString()} sats (30%)</div>
                  <div>🥉 3rd: {Math.floor(potAmount * 0.2).toLocaleString()} sats (20%)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpaceInvadersTournament;