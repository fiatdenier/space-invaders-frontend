import React, { useState, useEffect } from 'react';
import { Shield, Trash2, RefreshCw, Trophy, Users, DollarSign, PlayCircle } from 'lucide-react';

const API_BASE_URL = 'https://invaders-api.fiatdenier.com/api';

const AdminPanel = ({ onStartTestGame }) => {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [potAmount, setPotAmount] = useState(0);
  const [stats, setStats] = useState({ totalPlayers: 0 });
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if admin key is saved in sessionStorage
    const savedKey = sessionStorage.getItem('adminKey');
    if (savedKey) {
      setAdminKey(savedKey);
      setIsAuthenticated(true);
      fetchData();
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);
  

  const fetchData = async () => {
    try {
      const [leaderboardRes, potRes] = await Promise.all([
        fetch(`${API_BASE_URL}/leaderboard`),
        fetch(`${API_BASE_URL}/pot`)
      ]);
      
      const leaderboardData = await leaderboardRes.json();
      const potData = await potRes.json();
      
      setLeaderboard(leaderboardData.leaderboard || []);
      setStats({ totalPlayers: leaderboardData.totalPlayers || 0 });
      setPotAmount(potData.amount || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    // Simple check - in production, verify against backend
    if (adminKey.length > 0) {
      sessionStorage.setItem('adminKey', adminKey);
      setIsAuthenticated(true);
      setMessage('');
    } else {
      setMessage('Please enter admin key');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminKey');
    setIsAuthenticated(false);
    setAdminKey('');
  };

  const handleResetTournament = async () => {
    if (!window.confirm('Are you sure you want to reset the entire tournament? This will delete all scores and reset the pot.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey })
      });

      if (response.ok) {
        setMessage('Tournament reset successfully!');
        fetchData();
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleDistributePrizes = async () => {
    if (!window.confirm('Distribute prizes to top 3 players?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/distribute-prizes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(`Prizes distributed! Total: ${data.totalDistributed} sats`);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleTestGame = () => {
    // Generate a test session token
    const testToken = 'test-session-' + Date.now();
    sessionStorage.setItem('testGameToken', testToken);
    
    // Call the parent callback to start game
    if (onStartTestGame) {
      onStartTestGame(testToken);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full border-2 border-green-500">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="text-green-400" size={40} />
            <h1 className="text-3xl font-bold text-white">Admin Login</h1>
          </div>
          
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Admin Key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border-2 border-green-400 rounded mb-4 text-white"
            />
            
            {message && (
              <p className="text-red-400 text-sm mb-4">{message}</p>
            )}
            
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded"
            >
              Login
            </button>
          </form>
          
          <p className="text-gray-400 text-sm mt-4">
            Enter your admin key from the .env file
          </p>
        </div>
      </div>
    );
  }

  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="text-green-400" size={40} />
            <h1 className="text-4xl font-bold">Admin Panel</h1>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
          >
            Logout
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="bg-blue-600 p-4 rounded mb-6">
            {message}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-yellow-500">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="text-yellow-400" size={32} />
              <h3 className="text-xl font-bold">Prize Pot</h3>
            </div>
            <p className="text-4xl font-bold text-yellow-400">
              {potAmount.toLocaleString()} sats
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-500">
            <div className="flex items-center gap-3 mb-2">
              <Users className="text-green-400" size={32} />
              <h3 className="text-xl font-bold">Total Players</h3>
            </div>
            <p className="text-4xl font-bold text-green-400">
              {stats.totalPlayers}
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border-2 border-purple-500">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="text-purple-400" size={32} />
              <h3 className="text-xl font-bold">Top Score</h3>
            </div>
            <p className="text-4xl font-bold text-purple-400">
              {leaderboard[0]?.score || 0}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={handleTestGame}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3"
          >
            <PlayCircle size={24} />
            Test Game (No Payment)
          </button>

          <button
            onClick={fetchData}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3"
          >
            <RefreshCw size={24} />
            Refresh Data
          </button>

          <button
            onClick={handleResetTournament}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3"
          >
            <Trash2 size={24} />
            Reset Tournament
          </button>
        </div>

        {/* Prize Distribution */}
        {topThree.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8 border-2 border-yellow-500">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
              <Trophy className="text-yellow-400" size={32} />
              Prize Distribution
            </h2>
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-3 bg-yellow-500/20 rounded">
                <span>🥇 1st: {topThree[0]?.playerName}</span>
                <span className="font-bold">{Math.floor(potAmount * 0.5).toLocaleString()} sats (50%)</span>
              </div>
              {topThree[1] && (
                <div className="flex items-center justify-between p-3 bg-gray-500/20 rounded">
                  <span>🥈 2nd: {topThree[1]?.playerName}</span>
                  <span className="font-bold">{Math.floor(potAmount * 0.3).toLocaleString()} sats (30%)</span>
                </div>
              )}
              {topThree[2] && (
                <div className="flex items-center justify-between p-3 bg-orange-500/20 rounded">
                  <span>🥉 3rd: {topThree[2]?.playerName}</span>
                  <span className="font-bold">{Math.floor(potAmount * 0.2).toLocaleString()} sats (20%)</span>
                </div>
              )}
            </div>
            <button
              onClick={handleDistributePrizes}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-3 rounded"
            >
              Distribute Prizes
            </button>
          </div>
        )}

        {/* Full Leaderboard */}
        <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-500">
          <h2 className="text-2xl font-bold mb-4">Full Leaderboard</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {leaderboard.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No scores yet</p>
            ) : (
              leaderboard.map((entry, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded ${
                    index === 0 ? 'bg-yellow-500/20 border-2 border-yellow-500' :
                    index === 1 ? 'bg-gray-500/20 border-2 border-gray-400' :
                    index === 2 ? 'bg-orange-500/20 border-2 border-orange-500' :
                    'bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold w-12">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </span>
                    <div>
                      <p className="font-bold">{entry.playerName}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-green-400">
                    {entry.score}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;