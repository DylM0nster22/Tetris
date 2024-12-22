const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

// Serve static files
app.use(express.static(path.join(__dirname)));

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// WebSocket setup
const wss = new WebSocketServer({ server });

const rooms = new Map();
const players = new Map();

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    switch(data.type) {
      case 'create_room':
        const roomId = Math.random().toString(36).substring(7);
        rooms.set(roomId, {
          players: [ws],
          gameState: null
        });
        ws.roomId = roomId;
        ws.send(JSON.stringify({
          type: 'room_created', 
          roomId,
          message: `Room ${roomId} created!`
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
                gameState: data.gameState
              }));
            }
          });
        }
        break;
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
