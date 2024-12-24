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

export default function JoinGame() {
  const searchParams = useSearchParams();
  const roomCode = searchParams.get('code') || '';
  const playerName = searchParams.get('name') || '';

  const [socket, setSocket] = useState<Socket | null>(null);
  const [error, setError] = useState<string>('');
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentIdiom, setCurrentIdiom] = useState<string>('');
  const [answer, setAnswer] = useState<string>('');
  const [answers, setAnswers] = useState<{playerId: string, answer: string}[]>([]);
  const [scores, setScores] = useState<Player[]>([]);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('joinRoom', { roomCode, playerName });
    });

    newSocket.on('error', (message: string) => {
      setError(message);
    });

    newSocket.on('playerJoined', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
      setError('');
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
  }, [roomCode, playerName]);

  const submitAnswer = () => {
    if (socket && answer.trim()) {
      socket.emit('submitAnswer', { roomCode, answer: answer.trim() });
    }
  };

  const submitVote = (votedForId: string) => {
    if (socket) {
      socket.emit('submitVote', { roomCode, votedForId });
    }
  };

  const renderGameState = () => {
    if (error) {
      return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      );
    }

    switch (gameState) {
      case 'waiting':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Waiting for host to start the game...</h2>
            <div>
              <h3 className="text-lg font-medium mb-2">Players in room:</h3>
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

      case 'submitting':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Current Idiom:</h2>
            <p className="text-xl bg-white p-4 rounded-lg shadow">{currentIdiom}</p>
            
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
                onClick={submitAnswer}
                disabled={!answer.trim()}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Answer
              </button>
            </div>
          </div>
        );

      case 'voting':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Vote for the correct answer:</h2>
            <ul className="space-y-2">
              {answers.map((answer, index) => (
                <li key={index}>
                  <button
                    onClick={() => submitVote(answer.playerId)}
                    className="w-full text-left p-4 bg-white rounded-lg shadow hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    {answer.answer}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );

      case 'results':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Current Scores:</h2>
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
