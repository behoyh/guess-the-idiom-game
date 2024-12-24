'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

type Player = {
  id: string;
  name: string;
  score: number;
};

type GameState = 'waiting' | 'submitting' | 'voting' | 'results' | 'gameOver';

export default function HostGame() {
  const searchParams = useSearchParams();
  const playerName = searchParams.get('name') || '';

  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [currentIdiom, setCurrentIdiom] = useState<string>('');
  const [answers, setAnswers] = useState<{ playerId: string, answer: string }[]>([]);
  const [scores, setScores] = useState<Player[]>([]);
  const [answer, setAnswer] = useState<string>('');
  const [isPlayerMode, setIsPlayerMode] = useState<boolean>(false);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      if (isPlayerMode) {
        newSocket.emit('createRoom', playerName);
      } else {
        newSocket.emit('createTVRoom');
      }
    });

    newSocket.on('roomCreated', (code: string) => {
      setRoomCode(code);
    });

    newSocket.on('playerJoined', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    newSocket.on('playerLeft', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    newSocket.on('gameStarted', ({ currentIdiom: idiom, players: gamePlayers }) => {
      setGameState('submitting');
      setCurrentIdiom(idiom);
      setPlayers(gamePlayers);
    });

    newSocket.on('startVoting', (submittedAnswers) => {
      setGameState('voting');
      setAnswers(submittedAnswers);
    });

    newSocket.on('roundEnd', ({ scores: roundScores, nextRound }) => {
      setScores(roundScores);
      setGameState('results');
      setAnswer('');
      setTimeout(() => {
        setCurrentIdiom(nextRound);
        setGameState('submitting');
      }, 5000);
    });

    newSocket.on('gameOver', (finalScores) => {
      setScores(finalScores);
      setGameState('gameOver');
    });

    return () => {
      newSocket.close();
    };
  }, [playerName]);

  const startGame = () => {
    if (socket && ((isPlayerMode && players.length >= 2) || (!isPlayerMode && players.length >= 1))) {
      socket.emit('startGame', roomCode);
    }
  };

  const createPlayerRoom = () => {
    if (socket) {
      setIsPlayerMode(true);
      socket.emit('createRoom', playerName);
    }
  };

  const renderGameState = () => {
    switch (gameState) {
      case 'waiting':
        return (
          <div className="space-y-6">
            <div className="bg-gray-100 p-6 rounded-lg text-center">
              <div className="mb-4">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  isPlayerMode ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {isPlayerMode ? 'Player Mode' : 'TV Mode'}
                </span>
              </div>
              <h2 className="text-xl font-semibold mb-2">Room Code:</h2>
              <p className="text-4xl font-bold text-purple-600">{roomCode}</p>
              <p className="mt-2 text-gray-600">
                {isPlayerMode 
                  ? "Share this code with other players to join"
                  : "Join at guess-the-idiom.com"}
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-semibold">Players:</h2>
                <span className="text-sm text-gray-600">
                  {isPlayerMode 
                    ? `${players.length} of 2 minimum players`
                    : `${players.length} of 1 minimum players`}
                </span>
              </div>
              {players.length > 0 ? (
                <ul className="space-y-2">
                  {players.map((player) => (
                    <li key={player.id} className="bg-white p-3 rounded-lg shadow">
                      {player.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center p-6 bg-gray-50 rounded-lg text-gray-500">
                  Waiting for players to join...
                </div>
              )}
            </div>

            {!isPlayerMode && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 text-center mb-3">
                  Want to play instead of just watching?
                </p>
                <button
                  onClick={createPlayerRoom}
                  className="w-full py-2 px-4 border border-purple-600 rounded-md shadow-sm text-sm font-medium text-purple-600 bg-white hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  Switch to Player Mode
                </button>
              </div>
            )}

            <button
              onClick={startGame}
              disabled={(isPlayerMode && players.length < 2) || (!isPlayerMode && players.length < 1)}
              className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Game
            </button>
          </div>
        );

      case 'submitting':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Current Idiom:</h2>
            <p className="text-xl bg-white p-4 rounded-lg shadow">{currentIdiom}</p>
            
            {isPlayerMode && (
              <div className="space-y-2">
                <label htmlFor="answer" className="block text-sm font-medium text-gray-700">
                  Your Answer:
                </label>
                <textarea
                  id="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:border-purple-500 focus:ring-purple-500"
                  rows={3}
                  placeholder="Enter your answer..."
                />
                <button
                  onClick={() => {
                    if (socket && answer.trim()) {
                      socket.emit('submitAnswer', { roomCode, answer: answer.trim() });
                    }
                  }}
                  disabled={!answer.trim()}
                  className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Answer
                </button>
              </div>
            )}
            
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Waiting for answers from:</h3>
              <ul className="space-y-2">
                {players.map((player) => (
                  <li key={player.id} className="bg-white p-3 rounded-lg shadow">
                    {player.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      case 'voting':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">
              {isPlayerMode ? "Vote for the correct answer:" : "Players are voting..."}
            </h2>
            <ul className="space-y-2">
              {answers.map((answer, index) => (
                <li key={index}>
                  {isPlayerMode ? (
                    <button
                      onClick={() => {
                        if (socket) {
                          socket.emit('submitVote', { roomCode, votedForId: answer.playerId });
                        }
                      }}
                      className="w-full text-left p-4 bg-white rounded-lg shadow hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      {answer.answer}
                    </button>
                  ) : (
                    <div className="w-full p-4 bg-white rounded-lg shadow">
                      {answer.answer}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );

      case 'results':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Scores:</h2>
            <ul className="space-y-2">
              {scores.sort((a, b) => b.score - a.score).map((player) => (
                <li key={player.id} className="bg-white p-3 rounded-lg shadow flex justify-between">
                  <span>{player.name}</span>
                  <span className="font-bold">{player.score}</span>
                </li>
              ))}
            </ul>
          </div>
        );

      case 'gameOver':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-center">Game Over!</h2>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4">Final Scores:</h3>
              <ul className="space-y-3">
                {scores.sort((a, b) => b.score - a.score).map((player, index) => (
                  <li key={player.id} className="flex justify-between items-center">
                    <div className="flex items-center">
                      {index === 0 && <span className="text-2xl mr-2">👑</span>}
                      <span className={index === 0 ? 'font-bold' : ''}>{player.name}</span>
                    </div>
                    <span className="font-bold">{player.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-8">Guess the Idiom</h1>
        {renderGameState()}
      </div>
    </main>
  );
}
