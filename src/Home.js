import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  const createRoom = () => {
    const roomId = Math.random().toString(36).substring(2, 8);
    navigate(`/room/${roomId}`);
  };

  const joinRoom = () => {
    const roomId = prompt('Enter Room ID to join:');
    if (roomId) navigate(`/room/${roomId}`);
  };

  return (
    <div style={{ textAlign: 'center', padding: '2rem', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Welcome to Poker Clone</h1>
      <button
        onClick={createRoom}
        style={{
          margin: '1rem',
          padding: '1rem 2rem',
          fontSize: '1.2rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          transition: 'background-color 0.3s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0056b3')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#007bff')}
      >
        Create Room
      </button>
      <button
        onClick={joinRoom}
        style={{
          margin: '1rem',
          padding: '1rem 2rem',
          fontSize: '1.2rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
          transition: 'background-color 0.3s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1e7e34')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#28a745')}
      >
        Join Room
      </button>
    </div>
  );
}
