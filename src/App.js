import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Lobby from './Lobby';
import './App.css';

function Home() {
  return (
    <div className="page-container">
      <h1>Welcome to Poker Clone</h1>
      <div className="button-group">
        <Link to={`/room/${Math.random().toString(36).substring(2, 8)}`} className="btn">
          Create Room
        </Link>
        <Link to="/join" className="btn">
          Join Room
        </Link>
      </div>
    </div>
  );
}

function Rules() {
  return (
    <div className="page-container">
      <h1>Poker Rules</h1>
      <p>
        {/* Тут можно добавить описание правил */}
        Poker is a card game that combines gambling, strategy, and skill...
      </p>
      <Link to="/" className="btn btn-secondary">Back to Home</Link>
    </div>
  );
}

function JoinRoom() {
  const [roomId, setRoomId] = React.useState('');
  const [error, setError] = React.useState('');

  const navigateToRoom = (e) => {
    e.preventDefault();
    if (roomId.trim().length < 3) {
      setError('Please enter a valid room ID');
      return;
    }
    window.location.href = `/room/${roomId.trim()}`;
  };

  return (
    <div className="page-container">
      <h1>Join a Room</h1>
      <form onSubmit={navigateToRoom}>
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Enter room ID"
          className="input"
          autoFocus
        />
        <button type="submit" className="btn">Join</button>
      </form>
      {error && <p className="error">{error}</p>}
      <Link to="/" className="btn btn-secondary" style={{ marginTop: '1rem' }}>Back to Home</Link>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <nav className="navbar">
        <Link to="/" className="nav-link">Home</Link>
        <Link to="/rules" className="nav-link">Rules</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/room/:id" element={<Lobby />} />
      </Routes>
    </Router>
  );
}
