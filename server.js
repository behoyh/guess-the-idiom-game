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
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://idiom-game-201723471626.us-central1.run.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });


  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ["GET", "POST", "OPTIONS"]
    }
  });

  io.on('connection', (socket) => {
    // Create a TV room (spectator mode)
    socket.on('createTVRoom', () => {
      const roomCode = nanoid(6);
      rooms.set(roomCode, {
        host: socket.id,
        players: [], // No host player in TV mode
        state: 'waiting',
        isPlayerMode: false,
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

    // Create a player room
    socket.on('createRoom', (hostName) => {
      const roomCode = nanoid(6);
      rooms.set(roomCode, {
        host: socket.id,
        players: [{ id: socket.id, name: hostName, score: 0 }],
        state: 'waiting',
        isPlayerMode: true,
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
      // require 3 players minimum
      const hasEnoughPlayers = room.players.length >= 3;
      if (hasEnoughPlayers) {
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
        expectedSubmissions = room.players.length
        if (!room.isPlayerMode) {
          // TV does not count as a player
          expectedSubmissions = expectedSubmissions - 1;
        }

        // Check if all players have submitted
        if (room.submissions.size === expectedSubmissions) {
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

          room.timer = setTimeout(() => {
            if (room.state === 'submitting') {
              startVotingPhase(room, roomCode, io);
            }
          }, 30000);
        }
      }
    });

    // Submit vote
    socket.on('submitVote', ({ roomCode, votedForId }) => {
      const room = rooms.get(roomCode);
      if (room && room.state === 'voting') {
        // Find the answer this player is voting for
        const votedAnswer = Array.from(room.submissions.entries())
          .find(([playerId]) => playerId === votedForId);

        room.timer = setTimeout(() => {

        }, 30000);

        if (votedAnswer &&
          votedAnswer[0] !== socket.id &&
          !Array.from(room.votes.keys()).includes(socket.id)) {
          room.votes.set(socket.id, votedForId);
        }

        const expectedVotes = room.players.length - 1;
        if (!room.isPlayerMode) {
          // TV does not count as a player
          expectedVotes = expectedVotes - 1; 
        }
        if (room.votes.size === expectedVotes || room.timer.ela) {
          // Calculate scores
          const correctAnswer = room.idioms[room.currentRound];
          room.players.forEach(player => {
            const playerSubmission = room.submissions.get(player.id);

            // Points for submitting the correct answer
            if (playerSubmission === correctAnswer) {
              player.score += 1000;
            }

            // Points for fooling others (only if answer is not correct)
            if (playerSubmission !== correctAnswer) {
              const fooledCount = Array.from(room.votes.values())
                .filter(vote => vote === player.id)
                .length;
              player.score += fooledCount * 500;
            }
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
