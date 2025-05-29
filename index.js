const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { Hand } = require('pokersolver');
const { v4: uuidv4 } = require('uuid');

const FRONTEND_URL = 'https://poker-clone-fronted-9.onrender.com'; 

const app = express();
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

const suits = ['♠️', '♥️', '♦️', '♣️'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(rank + suit);
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

const rooms = {};

function addBot(room) {
  if (room.players.some(p => p.isBot)) return;
  room.players.push({
    id: 'bot-' + uuidv4(),
    playerId: 'bot-' + uuidv4(),
    name: 'Bot',
    chips: 1000,
    cards: [],
    folded: false,
    currentBet: 0,
    isAllIn: false,
    isBot: true,
  });
  console.log(`Bot added to room ${room.id}`);
}

async function botAction(room, bot) {
  if (room.round === 'waiting' || bot.folded || bot.isAllIn) return;

  await new Promise(r => setTimeout(r, 1500)); // Delay for realism

  const strongRanks = ['10', 'J', 'Q', 'K', 'A'];
  const hasStrongCard = bot.cards.some(card => strongRanks.some(r => card.startsWith(r)));

  if (!hasStrongCard) {
    bot.folded = true;
    bot.currentBet = 0;
    io.to(room.id).emit('chatMessage', { sender: 'Bot', message: 'Bot folds' });
    console.log(`Bot folds in room ${room.id}`);
  } else {
    const callAmount = room.currentBet - bot.currentBet;
    if (callAmount > bot.chips) {
      room.pot += bot.chips;
      bot.currentBet += bot.chips;
      bot.chips = 0;
      bot.isAllIn = true;
      io.to(room.id).emit('chatMessage', { sender: 'Bot', message: 'Bot calls all-in' });
      console.log(`Bot calls all-in in room ${room.id}`);
    } else {
      const raiseChance = Math.random();
      if (raiseChance < 0.5) {
        bot.chips -= callAmount;
        bot.currentBet += callAmount;
        room.pot += callAmount;
        io.to(room.id).emit('chatMessage', { sender: 'Bot', message: 'Bot calls' });
        console.log(`Bot calls in room ${room.id}`);
      } else {
        let raiseAmount = room.currentBet + 50;
        if (raiseAmount > bot.chips + bot.currentBet) raiseAmount = bot.chips + bot.currentBet;
        const diff = raiseAmount - bot.currentBet;
        bot.chips -= diff;
        bot.currentBet = raiseAmount;
        room.currentBet = raiseAmount;
        room.pot += diff;
        io.to(room.id).emit('chatMessage', { sender: 'Bot', message: `Bot raises to ${raiseAmount}` });
        console.log(`Bot raises to ${raiseAmount} in room ${room.id}`);
      }
    }
  }

  advanceTurn(room);
  io.to(room.id).emit('roomData', room);
}

function advanceTurn(room) {
  if (!room || room.players.length === 0) return;

  for (let i = 0; i < room.players.length; i++) {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    const current = room.players[room.currentPlayerIndex];
    if (!current.folded && !current.isAllIn) {
      if (current.isBot) {
        botAction(room, current);
      } else {
        io.to(current.id).emit('yourTurn');
      }
      return;
    }
  }

  console.log(`No active players left to take turn in room ${room.id}`);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinRoom', ({ roomId, playerName, playerId }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        id: roomId,
        hostPlayerId: null,
        players: [],
        deck: [],
        board: [],
        round: 'waiting',
        pot: 0,
        currentBet: 0,
        currentPlayerIndex: 0,
      };
      console.log(`Created room ${roomId}`);
    }

    const room = rooms[roomId];

    let player = room.players.find(p => p.playerId === playerId);

    if (player) {
      player.id = socket.id;
      player.name = playerName;
      console.log(`Player ${player.name} reconnected to room ${roomId}`);
    } else {
      player = {
        id: socket.id,
        playerId,
        name: playerName,
        chips: 1000,
        cards: [],
        folded: false,
        currentBet: 0,
        isAllIn: false,
      };
      room.players.push(player);
      console.log(`New player ${playerName} joined room ${roomId}`);
    }

    if (!room.hostPlayerId) {
      room.hostPlayerId = playerId;
      console.log(`Host assigned: ${playerName} (${playerId}) in room ${roomId}`);
    }

    if (room.players.filter(p => !p.isBot).length < 2) {
      addBot(room);
    }

    io.to(roomId).emit('roomData', room);
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    const host = room?.players.find(p => p.playerId === room.hostPlayerId);
    if (!room || socket.id !== host?.id) return;

    room.deck = createDeck();
    shuffle(room.deck);
    room.board = [];
    room.round = 'pre-flop';
    room.pot = 0;
    room.currentBet = 0;
    room.currentPlayerIndex = 0;

    room.players.forEach(p => {
      p.cards = [room.deck.pop(), room.deck.pop()];
      p.folded = false;
      p.currentBet = 0;
      p.isAllIn = false;
    });

    room.players.forEach(p => {
      if (!p.isBot) io.to(p.id).emit('dealCards', p.cards);
    });

    io.to(room.id).emit('roundStage', room.round);
    io.to(room.id).emit('roomData', room);

    const currentPlayer = room.players[room.currentPlayerIndex];
    if (currentPlayer.isBot) botAction(room, currentPlayer);
    else io.to(currentPlayer.id).emit('yourTurn');
  });

  socket.on('playerAction', ({ roomId, action, raiseAmount }) => {
    const room = rooms[roomId];
    if (!room || room.round === 'waiting') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (room.players[room.currentPlayerIndex].id !== player.id) {
      io.to(player.id).emit('invalidAction', 'Not your turn');
      return;
    }

    switch (action) {
      case 'fold':
        player.folded = true;
        player.currentBet = 0;
        break;
      case 'check':
        if (player.currentBet !== room.currentBet) {
          io.to(player.id).emit('invalidAction', 'Cannot check, call or raise required');
          return;
        }
        break;
      case 'call': {
        const callAmount = room.currentBet - player.currentBet;
        if (callAmount > player.chips) {
          room.pot += player.chips;
          player.currentBet += player.chips;
          player.chips = 0;
          player.isAllIn = true;
        } else {
          player.chips -= callAmount;
          player.currentBet += callAmount;
          room.pot += callAmount;
        }
        break;
      }
      case 'raise': {
        if (raiseAmount <= room.currentBet) {
          io.to(player.id).emit('invalidAction', 'Raise must be higher than current bet');
          return;
        }
        const diff = raiseAmount - player.currentBet;
        if (diff > player.chips) {
          io.to(player.id).emit('invalidAction', 'Not enough chips to raise');
          return;
        }
        player.chips -= diff;
        player.currentBet = raiseAmount;
        room.currentBet = raiseAmount;
        room.pot += diff;
        break;
      }
      default:
        io.to(player.id).emit('invalidAction', 'Unknown action');
        return;
    }

    const activePlayers = room.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      const winner = activePlayers[0];
      io.to(room.id).emit('gameResult', {
        winnerId: winner.playerId,
        winnerName: winner.name,
        pot: room.pot,
        winningHand: 'Win by fold',
      });
      room.round = 'waiting';
      io.to(room.id).emit('roundStage', 'waiting');
      io.to(room.id).emit('roomData', room);
      return;
    }

    advanceTurn(room);
    io.to(room.id).emit('roomData', room);
    io.to(player.id).emit('turnEnded');
  });

  socket.on('nextStage', ({ roomId }) => {
    const room = rooms[roomId];
    const host = room?.players.find(p => p.playerId === room.hostPlayerId);
    if (!room || socket.id !== host?.id) return;

    if (room.round === 'pre-flop') {
      room.round = 'flop';
      room.board = [room.deck.pop(), room.deck.pop(), room.deck.pop()];
    } else if (room.round === 'flop') {
      room.round = 'turn';
      room.board.push(room.deck.pop());
    } else if (room.round === 'turn') {
      room.round = 'river';
      room.board.push(room.deck.pop());
    } else if (room.round === 'river') {
      room.round = 'showdown';

      const hands = room.players
        .filter(p => !p.folded)
        .map(p => ({ player: p, hand: Hand.solve(p.cards.concat(room.board)) }));

      const winners = Hand.winners(hands.map(h => h.hand));
      const winningPlayers = hands.filter(h => winners.includes(h.hand));

      if (winningPlayers.length === 0) {
        console.warn(`No winning players found in room ${room.id} during showdown`);
        room.round = 'waiting';
        io.to(room.id).emit('roundStage', 'waiting');
        io.to(room.id).emit('roomData', room);
        return;
      }

      const winner = winningPlayers[0].player;

      io.to(room.id).emit('gameResult', {
        winnerId: winner.playerId,
        winnerName: winner.name,
        pot: room.pot,
        winningHand: winners[0].descr,
      });
    } else if (room.round === 'showdown') {
      room.round = 'waiting';
      room.board = [];
    }

    io.to(room.id).emit('roundStage', room.round);
    io.to(room.id).emit('boardCards', room.board);
    io.to(room.id).emit('roomData', room);
  });

  socket.on('resetGame', ({ roomId }) => {
    const room = rooms[roomId];
    const host = room?.players.find(p => p.playerId === room.hostPlayerId);
    if (!room || socket.id !== host?.id) return;

    room.round = 'waiting';
    room.board = [];
    room.pot = 0;
    room.currentBet = 0;
    room.currentPlayerIndex = 0;
    room.players.forEach(p => {
      p.cards = [];
      p.folded = false;
      p.currentBet = 0;
      p.isAllIn = false;
    });

    io.to(room.id).emit('roomData', room);
    io.to(room.id).emit('roundStage', 'waiting');
  });

  socket.on('chatMessage', ({ roomId, message, sender }) => {
    io.to(roomId).emit('chatMessage', { message, sender });
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      const room = rooms[roomId];
      if (!room) continue;
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
        console.log(`Deleted empty room ${roomId}`);
      } else {
        io.to(roomId).emit('roomData', room);
        console.log(`Player disconnected, updated room data sent for room ${roomId}`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
