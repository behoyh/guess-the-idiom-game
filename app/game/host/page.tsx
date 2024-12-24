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

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('createRoom', playerName);
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
    if (socket && players.length >= 2) {
      socket.emit('startGame', roomCode);
    }
  };

  const renderGameState = () => {
    switch (gameState) {
      case 'waiting':
        return (
          <div className="space-y-4">
            <div className="bg-gray-100 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Room Code:</h2>
              <p className="text-3xl font-bold text-purple-600">{roomCode}</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-2">Players:</h2>
              <ul className="space-y-2">
                {players.map((player) => (
                  <li key={player.id} className="bg-white p-3 rounded-lg shadow">
                    {player.name}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={startGame}
              disabled={players.length < 2}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <p className="text-lg">Waiting for players to submit their answers...</p>
          </div>
        );

      case 'voting':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Submitted Answers:</h2>
            <ul className="space-y-2">
              {answers.map((answer, index) => (
                <li key={index} className="bg-white p-3 rounded-lg shadow">
                  {answer.answer}
                </li>
              ))}
            </ul>
            <p className="text-lg">Players are voting...</p>
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