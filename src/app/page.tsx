'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const router = useRouter();

  const createRoom = () => {
    if (playerName.trim()) {
      router.push(`/game/host?name=${encodeURIComponent(playerName)}`);
    }
  };

  const joinRoom = () => {
    if (playerName.trim() && roomCode.trim()) {
      router.push(`/game/join?code=${roomCode}&name=${encodeURIComponent(playerName)}`);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Guess the Idiom</h1>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Your Name
            </label>
            <input
              type="text"
              id="name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 p-2"
              placeholder="Enter your name"
            />
          </div>

          <div className="flex flex-col space-y-4">
            <button
              onClick={createRoom}
              disabled={!playerName.trim()}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create New Room
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or join existing</span>
              </div>
            </div>

            <div>
              <label htmlFor="room" className="block text-sm font-medium text-gray-700">
                Room Code
              </label>
              <input
                type="text"
                id="room"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 p-2"
                placeholder="Enter room code"
                maxLength={6}
              />
            </div>

            <button
              onClick={joinRoom}
              disabled={!playerName.trim() || !roomCode.trim()}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
