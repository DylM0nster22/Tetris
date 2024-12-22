const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// Memory optimization
const MAX_ROOMS = 50;
const INACTIVE_TIMEOUT = 15 * 60 * 1000; // 15 minutes

// Add compression for static files
const compression = require('compression');
app.use(compression());

// Serve static files with caching
app.use(express.static(path.join(__dirname), {
  maxAge: '1h',
  etag: true
}));

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// WebSocket setup with ping-pong
const wss = new WebSocketServer({ 
  server,
  clientTracking: true,
  maxPayload: 1024 * 16 // 16kb limit
});

const rooms = new Map();
const players = new Map();

// Cleanup inactive rooms
setInterval(() => {
  rooms.forEach((room, roomId) => {
    const now = Date.now();
    if (now - room.lastActivity > INACTIVE_TIMEOUT) {
      room.players.forEach(player => {
        player.close();
      });
      rooms.delete(roomId);
    }
  });
}, 5 * 60 * 1000); // Check every 5 minutes

wss.on('connection', (ws) => {
  // Set initial ping state
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Update room activity
      if (ws.roomId) {
        const room = rooms.get(ws.roomId);
        if (room) room.lastActivity = Date.now();
      }
      
      switch(data.type) {
        case 'create_room':
          if (rooms.size >= MAX_ROOMS) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Server is full'
            }));
            return;
          }
          const roomId = Math.random().toString(36).substring(7);
          rooms.set(roomId, {
            players: [ws],
            gameState: null,
            lastActivity: Date.now()
          });
          ws.roomId = roomId;
          ws.send(JSON.stringify({
            type: 'room_created',
            roomId
          }));
          break;
        
      case 'join_room':
        const room = rooms.get(data.roomId);
        if (room && room.players.length < 2) {
          room.players.push(ws);
          ws.roomId = data.roomId;
          room.players.forEach(player => {
            player.send(JSON.stringify({
              type: 'game_start',
              message: 'Player 2 joined! Game starting...'
            }));
          });
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Room full or not found'
          }));
        }
        break;
        
        case 'game_update':
            if (ws.roomId) {
              const currentRoom = rooms.get(ws.roomId);
              currentRoom.players.forEach(player => {
                if (player !== ws) {
                  player.send(JSON.stringify({
                    type: 'opponent_update',
                    gameState: {
                      board: data.gameState.board,
                      currentPiece: data.gameState.currentPiece,
                      score: data.gameState.score,
                      nextPiece: data.gameState.nextPiece
                    }
                  }));
                }
              });
            }
            break;          
      }
    } catch (err) {
      console.error('Message processing error:', err);
    }
  });

  ws.on('close', () => {
    if (ws.roomId) {
      const room = rooms.get(ws.roomId);
      if (room) {
        room.players = room.players.filter(player => player !== ws);
        if (room.players.length === 0) {
          rooms.delete(ws.roomId);
        } else {
          room.players.forEach(player => {
            player.send(JSON.stringify({
              type: 'player_left',
              message: 'Opponent left the game'
            }));
          });
        }
      }
    }
  });
});

// Ping all clients every 30 seconds
const interval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);