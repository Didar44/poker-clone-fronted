import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const SERVER_URL = 'https://poker-clone.onrender.com';
const socket = io(SERVER_URL);

const PLAYER_ID_KEY = 'poker-player-id';

function getPlayerId() {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

function Card({ card }) {
  const isRed = card.includes('♥️') || card.includes('♦️');
  return (
    <span
      style={{
        display: 'inline-block',
        border: '1px solid #333',
        borderRadius: 5,
        padding: '5px 10px',
        marginRight: 6,
        color: isRed ? 'red' : 'black',
        fontWeight: 'bold',
        fontSize: '1.2rem',
        userSelect: 'none',
        backgroundColor: '#fff',
      }}
    >
      {card}
    </span>
  );
}

export default function Lobby() {
  const { id: roomId } = useParams();

  const [players, setPlayers] = useState([]);
  const [name, setName] = useState('');
  const [hostId, setHostId] = useState(null);
  const [myId, setMyId] = useState(null);
  const [round, setRound] = useState('waiting');
  const [boardCards, setBoardCards] = useState([]);
  const [hand, setHand] = useState([]);
  const [error, setError] = useState('');
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [gameResult, setGameResult] = useState(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [pot, setPot] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const TURN_TIME = 30;
  const [timeLeft, setTimeLeft] = useState(0);

  const progressRef = useRef(null);

  // Имя игрока
  useEffect(() => {
    if (!name) {
      const playerName = prompt('Enter your name') || 'Anonymous';
      setName(playerName);
    }
  }, [name]);

  // Подключение к комнате
  useEffect(() => {
    if (!name) return;
    const playerId = getPlayerId();
    socket.emit('joinRoom', { roomId, playerName: name, playerId });
  }, [name, roomId]);

  // Обработчики сокетов
  useEffect(() => {
    socket.on('connect', () => {
      setMyId(socket.id);
    });

    socket.on('roomData', (room) => {
      setPlayers(room.players);
      setHostId(room.hostId || null);
      setPot(room.pot || 0);
      setCurrentPlayerIndex(room.currentPlayerIndex || 0);
      setError('');
    });

    socket.on('roundStage', (stage) => {
      setRound(stage);
      if (stage === 'waiting') setGameResult(null);
    });

    socket.on('boardCards', setBoardCards);

    socket.on('dealCards', setHand);

    socket.on('yourTurn', () => {
      setIsMyTurn(true);
      setError('');
    });

    socket.on('turnEnded', () => {
      setIsMyTurn(false);
      setTimeLeft(0);
    });

    socket.on('invalidAction', setError);

    socket.on('gameResult', setGameResult);

    socket.on('chatMessage', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.off('connect');
      socket.off('roomData');
      socket.off('roundStage');
      socket.off('boardCards');
      socket.off('dealCards');
      socket.off('yourTurn');
      socket.off('turnEnded');
      socket.off('invalidAction');
      socket.off('gameResult');
      socket.off('chatMessage');
    };
  }, []);

  // Таймер и прогресс-бар хода
  useEffect(() => {
    if (!isMyTurn) {
      setTimeLeft(0);
      if (progressRef.current) progressRef.current.style.width = '0%';
      return;
    }
    setTimeLeft(TURN_TIME);
    if (progressRef.current) progressRef.current.style.transition = `width ${TURN_TIME}s linear`;
    if (progressRef.current) progressRef.current.style.width = '100%';

    const timerId = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          sendAction('fold');
          clearInterval(timerId);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timerId);
      if (progressRef.current) {
        progressRef.current.style.transition = 'none';
        progressRef.current.style.width = '0%';
      }
    };
  }, [isMyTurn]);

  const isHost = hostId === myId;

  const handleStartGame = () => {
    socket.emit('startGame', { roomId });
  };

  const handleNextStage = () => {
    socket.emit('nextStage', { roomId });
  };

  const sendAction = (action, amount = 0) => {
    socket.emit('playerAction', { roomId, action, raiseAmount: amount });
    setIsMyTurn(false);
    setRaiseAmount(0);
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    socket.emit('chatMessage', { roomId, message: chatInput, sender: name });
    setChatInput('');
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
      <h2>Room ID: {roomId}</h2>
      <p>Round: <b>{round}</b></p>
      <p>Pot: {pot} chips</p>
      <p>Host ID: {hostId || '-'}</p>
      <p>My ID: {myId || '-'}</p>
      <p>Is Host: {isHost ? 'Yes' : 'No'}</p>

      <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
        {players.map((p, i) => (
          <li
            key={p.id}
            style={{
              fontWeight: p.id === hostId ? 'bold' : 'normal',
              backgroundColor: i === currentPlayerIndex ? '#e3f7ff' : 'transparent',
              padding: '6px 10px',
              borderRadius: 5,
              marginBottom: 4,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            <span>
              {p.name} {p.isBot && '🤖'} {p.id === hostId && '👑 (Host)'}
            </span>
            <span style={{ fontWeight: 'bold' }}>
              Chips: {p.chips} | Bet: {p.currentBet}
            </span>
          </li>
        ))}
      </ul>

      {boardCards.length > 0 && (
        <>
          <h3>Board Cards:</h3>
          <div>{boardCards.map((c, i) => <Card key={i} card={c} />)}</div>
        </>
      )}

      {hand.length > 0 && (
        <>
          <h3>Your Cards:</h3>
          <div>{hand.map((c, i) => <Card key={i} card={c} />)}</div>
        </>
      )}

      {isHost && round === 'waiting' && (
        <button
          onClick={handleStartGame}
          style={{
            marginTop: 20,
            padding: '10px 20px',
            cursor: 'pointer',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            fontWeight: 'bold',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0056b3')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#007bff')}
        >
          Start Game
        </button>
      )}

      {isHost && round !== 'waiting' && round !== 'showdown' && (
        <button
          onClick={handleNextStage}
          style={{
            marginTop: 20,
            padding: '10px 20px',
            cursor: 'pointer',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            fontWeight: 'bold',
            marginLeft: 10,
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1e7e34')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#28a745')}
        >
          Next Stage
        </button>
      )}

      {isMyTurn && (
        <div style={{ marginTop: 15, userSelect: 'none' }}>
          <p>
            Time left: {timeLeft}s
          </p>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 8,
              backgroundColor: '#ddd',
              borderRadius: 4,
              overflow: 'hidden',
              marginBottom: 10,
            }}
          >
            <div
              ref={progressRef}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: 0,
                backgroundColor: '#007bff',
                transition: 'width 1s linear',
              }}
            />
          </div>

          <button
            onClick={() => sendAction('fold')}
            style={{ marginRight: 8, padding: '8px 16px', cursor: 'pointer' }}
          >
            Fold
          </button>
          <button
            onClick={() => sendAction('check')}
            style={{ marginRight: 8, padding: '8px 16px', cursor: 'pointer' }}
          >
            Check
          </button>
          <button
            onClick={() => sendAction('call')}
            style={{ marginRight: 8, padding: '8px 16px', cursor: 'pointer' }}
          >
            Call
          </button>
          <input
            type="number"
            placeholder="Raise amount"
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            style={{ width: 100, marginRight: 8, padding: '6px 10px' }}
            min={0}
          />
          <button
            onClick={() => sendAction('raise', raiseAmount)}
            style={{ padding: '8px 16px', cursor: 'pointer' }}
          >
            Raise
          </button>
        </div>
      )}

      {gameResult && (
        <div style={{ marginTop: 20, fontWeight: 'bold', color: 'green' }}>
          Winner: {gameResult.winnerName} — wins {gameResult.pot} chips!<br />
          Hand: {gameResult.winningHand}
        </div>
      )}

      {error && <div style={{ color: 'red', marginTop: 20 }}>{error}</div>}

      <div
        style={{
          marginTop: 30,
          maxHeight: 160,
          overflowY: 'auto',
          border: '1px solid #ccc',
          padding: 10,
          fontSize: '0.9rem',
          backgroundColor: '#fafafa',
          borderRadius: 5,
        }}
      >
        {chatMessages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <b>{msg.sender}:</b> {msg.message}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, display: 'flex' }}>
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
          placeholder="Type message..."
          style={{ flexGrow: 1, padding: '8px 12px' }}
        />
        <button
          onClick={sendChatMessage}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            marginLeft: 6,
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            fontWeight: 'bold',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0056b3')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#007bff')}
        >
          Send
        </button>
      </div>
    </div>
  );
}
