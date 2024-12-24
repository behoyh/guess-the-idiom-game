import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Game state
const rooms = new Map();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server);

  io.on('connection', (socket) => {
    // Create a new room
    socket.on('createRoom', (hostName) => {
      const roomCode = nanoid(6);
      rooms.set(roomCode, {
        host: socket.id,
        players: [{ id: socket.id, name: hostName, score: 0 }],
        state: 'waiting',
        currentRound: 0,
        submissions: new Map(),
        votes: new Map(),
        idioms: [
          "It's raining cats and dogs",
          "Break a leg",
          "Piece of cake",
          "Hit the nail on the head",
          "Spill the beans",
          "Cost an arm and a leg",
          "Under the weather",
          "Bite off more than you can chew",
          "Beat around the bush",
          "Pull someone's leg"
        ]
      });
      socket.join(roomCode);
      socket.emit('roomCreated', roomCode);
    });

    // Join a room
    socket.on('joinRoom', ({ roomCode, playerName }) => {
      console.log(rooms);
      console.log("code"+roomCode);
      const room = rooms.get(roomCode);
      if (room && room.state === 'waiting') {
        socket.join(roomCode);
        room.players.push({
          id: socket.id,
          name: playerName,
          score: 0
        });
        io.to(roomCode).emit('playerJoined', room.players);
      } else {
        socket.emit('error', 'Room not found or game in progress');
      }
    });

    // Start game
    socket.on('startGame', (roomCode) => {
      const room = rooms.get(roomCode);
      if (room && socket.id === room.host) {
        room.state = 'submitting';
        room.currentRound = 0;
        const currentIdiom = room.idioms[room.currentRound];
        io.to(roomCode).emit('gameStarted', {
          currentIdiom,
          players: room.players
        });
      }
    });

    // Submit answer
    socket.on('submitAnswer', ({ roomCode, answer }) => {
      const room = rooms.get(roomCode);
      if (room && room.state === 'submitting') {
        room.submissions.set(socket.id, answer);

        // Check if all players have submitted
        if (room.submissions.size === room.players.length) {
          room.state = 'voting';
          const answers = Array.from(room.submissions.entries()).map(([playerId, answer]) => ({
            playerId,
            answer
          }));
          // Shuffle answers
          for (let i = answers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [answers[i], answers[j]] = [answers[j], answers[i]];
          }
          io.to(roomCode).emit('startVoting', answers);
        }
      }
    });

    // Submit vote
    socket.on('submitVote', ({ roomCode, votedForId }) => {
      const room = rooms.get(roomCode);
      if (room && room.state === 'voting') {
        room.votes.set(socket.id, votedForId);

        // Check if all players have voted
        if (room.votes.size === room.players.length) {
          // Calculate scores
          const correctAnswer = room.idioms[room.currentRound];
          room.players.forEach(player => {
            // Points for correct votes
            if (room.votes.get(player.id) === correctAnswer) {
              player.score += 1000;
            }
            // Points for fooling others
            room.votes.forEach(votedForId => {
              if (votedForId === player.id && votedForId !== correctAnswer) {
                player.score += 500;
              }
            });
          });

          // Clear submissions and votes for next round
          room.submissions.clear();
          room.votes.clear();

          // Move to next round or end game
          room.currentRound++;
          if (room.currentRound < room.idioms.length) {
            room.state = 'submitting';
            io.to(roomCode).emit('roundEnd', {
              scores: room.players,
              nextRound: room.idioms[room.currentRound]
            });
          } else {
            room.state = 'gameOver';
            io.to(roomCode).emit('gameOver', room.players);
          }
        }
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      rooms.forEach((room, roomCode) => {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          room.players.splice(playerIndex, 1);
          if (room.players.length === 0) {
            rooms.delete(roomCode);
          } else if (socket.id === room.host) {
            room.host = room.players[0].id;
          }
          io.to(roomCode).emit('playerLeft', room.players);
        }
      });
    });
  });

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
});