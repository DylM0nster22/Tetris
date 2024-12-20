const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('holdCanvas');
const holdCtx = holdCanvas.getContext('2d');
const quadMessage = document.getElementById('quadMessage');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreElement = document.getElementById('finalScore');
const highScoreElement = document.getElementById('highScore');
const retryButton = document.getElementById('retryButton');
const quitButton = document.getElementById('quitButton');
const pauseScreen = document.getElementById('pauseScreen');
const resumeButton = document.getElementById('resumeButton');
const quitFromPauseButton = document.getElementById('quitFromPauseButton');
const SWIPE_THRESHOLD = 50; // Minimum swipe distance
const TAP_THRESHOLD = 10; // Maximum distance for a tap

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const MAX_UNDO_STATES = 10; // Limit number of stored states
const BOARD = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const COLORS = [
  '#000',
  '#FF0051', // Red
  '#00FF93', // Green
  '#0051FF', // Blue
  '#FFE600', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFFFFF',  // White
  '#FFA500',  // Bomb (Orange)
  '#800080',  // Ghost (Purple)
  '#4B0082',  // Time (Indigo)
  '#FF1493'   // Wild (Pink)
];

const POWER_UPS = {
  BOMB: 8,    // Clears surrounding blocks
  LASER: 9,   // Next piece can pass through other blocks once
  TIME: 10,   // Temporarily slows down falling speed
  MATCH: 11    // Can match with any color for line clears
};

// Tetromino shapes
const TETROMINOS = [
  [], // empty for index 0
  [[1, 1, 1], [0, 1, 0]], // T
  [[2, 2], [2, 2]], // O
  [[0, 3, 3], [3, 3, 0]], // S
  [[4, 4, 0], [0, 4, 4]], // Z
  [[5, 5, 5, 5]], // I
  [[6, 0, 0], [6, 6, 6]], // J
  [[0, 0, 7], [7, 7, 7]], // L
];

gameOverScreen.style.display = 'none';

// Game state
let currentPiece = null;
let nextPiece = null;
let holdPiece = null;
let animationId;
let dropInterval = 1000; // 1 second per drop
let lastDropTime = 0;
let canHold = true;
let score = 0;
let isPaused = false;
let highScore = localStorage.getItem('tetrisHighScore') || 0;
let board = JSON.parse(JSON.stringify(BOARD));
let gameStarted = false;
let previousStates = [];
let touchStartX = null;
let touchStartY = null;
let touchStartTime = null;
let powerUpsDisabled = false;
let weatherDisabled = false;


let comboCount = 0;
let lastClearTime = 0;

const CHALLENGES = [
  { 
    type: 'COMBO', 
    description: 'Get a 3x combo or higher', 
    reward: 800,
    check: () => comboCount >= 3
  },
  { 
    type: 'SPEED', 
    description: 'Clear 5 lines in 20 seconds', 
    reward: 1000,
    timeLimit: 20000,
    required: 5,
    check: (progress) => progress >= 5
  },
  { 
    type: 'TETRIS', 
    description: 'Clear a Tetris (4 lines at once)', 
    reward: 1200,
    check: (linesCleared) => linesCleared === 4
  },
  { 
    type: 'HEIGHT', 
    description: 'Clear all blocks above row 10', 
    reward: 1500,
    check: () => {
      // Check if all blocks above row 10 are clear
      for(let y = 0; y < 10; y++) {
        if(board[y].some(cell => cell !== 0)) return false;
      }
      return true;
    }
  },
  { 
    type: 'SURVIVE', 
    description: 'Survive 30 seconds with blocks above row 5', 
    reward: 2000,
    timeLimit: 30000,
    check: () => {
      // Check if there are blocks above row 5
      for(let y = 0; y < 5; y++) {
        if(board[y].some(cell => cell !== 0)) return true;
      }
      return false;
    }
  }
];

let currentChallenge = null;
let challengeProgress = 0;
let challengeTimer = null;
let challengeStartTime = null;

const WEATHER_EFFECTS = {
  WIND: { speed: 0.2, direction: 1 }, // Pieces drift left/right
  STORM: { flashRate: 500, dropSpeed: 1.5 }, // Faster drops, screen flashes
  FOG: { opacity: 0.5 } // Reduced visibility
};

let currentWeather = null;

// Add near the top with other constants
const SHOP_ITEMS = {
    SLOW_TIME: { cost: 1000, description: "Slow down time for 30 seconds" },
    BLOCK_SWAP: { cost: 800, description: "Swap current piece with any other" },
    LINE_CLEAR: { cost: 1500, description: "Clear bottom 3 rows" },
    SAFETY_NET: { cost: 2000, description: "Prevent game over once" }
};

// Add near the top with other constants
const ACHIEVEMENTS = {
    SPEED_DEMON: { description: "Drop 10 pieces in under 10 seconds", reward: 500, earned: false },
    PERFECTIONIST: { description: "Clear 5 lines without gaps", reward: 1000, earned: false },
    SURVIVOR: { description: "Reach level 10", reward: 2000, earned: false }
};

// Add near the top with other constants
const GAME_MODES = {
    CLASSIC: { description: "Traditional Tetris gameplay" },
    SPRINT: { description: "Clear 40 lines as fast as possible" },
    ULTRA: { description: "Score as many points in 3 minutes" },
    SURVIVAL: { description: "Pieces fall faster with each line cleared" }
};

// Add near the top with other game state variables
const STATS = {
    totalPiecesPlaced: 0,
    totalLinesCleared: 0,
    longestGame: 0,
    highestCombo: 0,
    powerUpsUsed: 0,
    challengesCompleted: 0
};

// Add near the top with other constants
const THEMES = {
    CLASSIC: { background: '#000', blockStyle: 'solid' },
    NEON: { background: '#111', blockStyle: 'glowing' },
    RETRO: { background: '#232', blockStyle: 'pixelated' },
    MINIMAL: { background: '#fff', blockStyle: 'outlined' }
};

// Add this to your game state variables near the top
let isInMainMenu = true;

function startRandomChallenge() {
  if (currentChallenge) return;
  
  currentChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
  challengeProgress = 0;
  
  if (currentChallenge.type === 'TIME') {
    challengeTimer = setTimeout(() => failChallenge(), 30000);
  }
  
  showChallengeNotification();
}

// Call periodically
setInterval(startRandomChallenge, 60000); // New challenge every minute

function saveGameState() {
  const gameState = {
    board: JSON.parse(JSON.stringify(board)),
    score: score,
    currentPiece: JSON.parse(JSON.stringify(currentPiece)),
    nextPiece: JSON.parse(JSON.stringify(nextPiece)),
    holdPiece: holdPiece ? JSON.parse(JSON.stringify(holdPiece)) : null
  };
  
  previousStates.push(gameState);
  if (previousStates.length > MAX_UNDO_STATES) {
    previousStates.shift(); // Remove oldest state
  }
}

function drawBlock(ctx, x, y, color, blockType = 0) {
  const currentTheme = THEMES[localStorage.getItem('currentTheme') || 'CLASSIC'];
  
  switch(currentTheme.blockStyle) {
    case 'glowing':
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      break;
    case 'pixelated':
      ctx.imageSmoothingEnabled = false;
      break;
    case 'outlined':
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      return;
  }
  
  const blockX = x * BLOCK_SIZE;
  const blockY = y * BLOCK_SIZE;
  
  // Main block face
  ctx.fillStyle = color;
  ctx.fillRect(blockX, blockY, BLOCK_SIZE, BLOCK_SIZE);
  
  // Special effects for power-up blocks
  if (blockType >= 8) { // Power-up blocks start at ID 8
    ctx.save();
    
    // Add a glowing effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    
    // Draw special patterns based on power-up type
    switch(blockType) {
      case POWER_UPS.BOMB: // Bomb
        // Draw explosion symbol
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(blockX + BLOCK_SIZE/2, blockY + 5);
        ctx.lineTo(blockX + BLOCK_SIZE/2, blockY + BLOCK_SIZE - 5);
        ctx.moveTo(blockX + 5, blockY + BLOCK_SIZE/2);
        ctx.lineTo(blockX + BLOCK_SIZE - 5, blockY + BLOCK_SIZE/2);
        ctx.stroke();
        break;
        
      case POWER_UPS.LASER: // Ghost
        // Draw wavy pattern
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(let i = 0; i < BLOCK_SIZE; i += 5) {
          ctx.moveTo(blockX + i, blockY + Math.sin(i/5) * 5 + BLOCK_SIZE/2);
          ctx.lineTo(blockX + i + 3, blockY + Math.sin((i+3)/5) * 5 + BLOCK_SIZE/2);
        }
        ctx.stroke();
        break;
        
      case POWER_UPS.TIME: // Time
        // Draw clock symbol
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(blockX + BLOCK_SIZE/2, blockY + BLOCK_SIZE/2, BLOCK_SIZE/3, 0, 2 * Math.PI);
        ctx.moveTo(blockX + BLOCK_SIZE/2, blockY + BLOCK_SIZE/2);
        ctx.lineTo(blockX + BLOCK_SIZE/2, blockY + BLOCK_SIZE/3);
        ctx.lineTo(blockX + BLOCK_SIZE * 2/3, blockY + BLOCK_SIZE/2);
        ctx.stroke();
        break;
        
      case POWER_UPS.WILD: // Wild
        // Draw star pattern
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        const center = {x: blockX + BLOCK_SIZE/2, y: blockY + BLOCK_SIZE/2};
        const spikes = 4;
        const outerRadius = BLOCK_SIZE/3;
        const innerRadius = BLOCK_SIZE/6;
        
        ctx.beginPath();
        for(let i = 0; i < spikes * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (Math.PI / spikes) * i;
          const x = center.x + Math.cos(angle) * radius;
          const y = center.y + Math.sin(angle) * radius;
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        break;
    }
    
    // Add pulsing animation
    const pulseSize = Math.sin(Date.now() / 200) * 2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(
      blockX + 3 - pulseSize,
      blockY + 3 - pulseSize,
      BLOCK_SIZE - 6 + pulseSize * 2,
      BLOCK_SIZE - 6 + pulseSize * 2
    );
    
    ctx.restore();
  } else {
    // Regular block edges (your existing code)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(blockX, blockY + BLOCK_SIZE);
    ctx.lineTo(blockX, blockY);
    ctx.lineTo(blockX + BLOCK_SIZE, blockY);
    ctx.lineTo(blockX + BLOCK_SIZE - 3, blockY + 3);
    ctx.lineTo(blockX + 3, blockY + 3);
    ctx.lineTo(blockX + 3, blockY + BLOCK_SIZE - 3);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.moveTo(blockX + BLOCK_SIZE, blockY);
    ctx.lineTo(blockX + BLOCK_SIZE, blockY + BLOCK_SIZE);
    ctx.lineTo(blockX, blockY + BLOCK_SIZE);
    ctx.lineTo(blockX + 3, blockY + BLOCK_SIZE - 3);
    ctx.lineTo(blockX + BLOCK_SIZE - 3, blockY + BLOCK_SIZE - 3);
    ctx.lineTo(blockX + BLOCK_SIZE - 3, blockY + 3);
    ctx.fill();
  }
  
  // Inner block face
  ctx.fillStyle = color;
  ctx.fillRect(
    blockX + 3,
    blockY + 3,
    BLOCK_SIZE - 6,
    BLOCK_SIZE - 6
  );
}

// ... existing code ...

// Add these touch event listeners after your keyboard event listeners
canvas.addEventListener('touchstart', handleTouchStart);
canvas.addEventListener('touchmove', handleTouchMove);
canvas.addEventListener('touchend', handleTouchEnd);

function handleTouchStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
}

function handleTouchMove(event) {
    event.preventDefault();
}

function handleTouchEnd(event) {
    event.preventDefault();
    if (!touchStartX || !touchStartY || isPaused) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;

    // Check if it's a tap (quick touch with minimal movement)
    if (deltaTime < 200 && Math.abs(deltaX) < TAP_THRESHOLD && Math.abs(deltaY) < TAP_THRESHOLD) {
        currentPiece = rotatePiece(currentPiece);
        return;
    }

    // Handle swipes
    if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
        // Determine if horizontal or vertical swipe
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal swipe
            if (deltaX > 0) {
                // Swipe right
                if (isValidMove(currentPiece, 1)) currentPiece.x++;
            } else {
                // Swipe left
                if (isValidMove(currentPiece, -1)) currentPiece.x--;
            }
        } else {
            // Vertical swipe
            if (deltaY > 0) {
                // Swipe down - hard drop
                while (isValidMove(currentPiece, 0, 1)) currentPiece.y++;
                dropPiece();
            }
        }
    }

    touchStartX = null;
    touchStartY = null;
    touchStartTime = null;
}

function drawBoard(ctx, board) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw the grid
  ctx.strokeStyle = '#444'; // Faint grid color
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }
  }

  // Draw the blocks
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y].length; x++) {
      if (board[y][x] !== 0) {
        drawBlock(ctx, x, y, COLORS[board[y][x]]);
      }
    }
  }
}

function togglePause() {
  isPaused = !isPaused;
  if (isPaused) {
      cancelAnimationFrame(animationId);
      pauseScreen.style.display = 'flex';
  } else {
      pauseScreen.style.display = 'none';
      lastDropTime = performance.now();
      animationId = requestAnimationFrame(update);
  }
}

function getShadowPiece(piece) {
  const shadowPiece = { ...piece };
  while (isValidMove(shadowPiece, 0, 1)) {
    shadowPiece.y++;
  }
  return shadowPiece;
}

// Piece-related functions
function generatePiece() {
  // Roll for power-up chance
  const roll = Math.random() * 100; // Convert to percentage

  // Check power-ups from rarest to most common
  if (roll < 0.1) { // 0.1% chance for LASER
    return {
      id: POWER_UPS.LASER,
      shape: [[POWER_UPS.LASER]],
      x: 3,
      y: 0
    };
  } else if (roll < 0.6) { // 0.5% chance for MATCH (0.6 - 0.1)
    return {
      id: POWER_UPS.MATCH,
      shape: [[POWER_UPS.MATCH]],
      x: 3,
      y: 0
    };
  } else if (roll < 1.6) { // 1% chance for BOMB (1.6 - 0.6)
    return {
      id: POWER_UPS.BOMB,
      shape: [[POWER_UPS.BOMB]],
      x: 3,
      y: 0
    };
  } else if (roll < 4.6) { // 3% chance for TIME (4.6 - 1.6)
    return {
      id: POWER_UPS.TIME,
      shape: [[POWER_UPS.TIME]],
      x: 3,
      y: 0
    };
  }

  // If no power-up, generate normal piece
  const id = Math.floor(Math.random() * (TETROMINOS.length - 1)) + 1;
  const shape = TETROMINOS[id];
  return { id, shape, x: 3, y: 0 };
}

function drawPiece(ctx, piece, isShadow = false) {
  piece.shape.forEach((row, dy) => {
    row.forEach((value, dx) => {
      if (value !== 0) {
        const color = isShadow ? 'rgba(255, 255, 255, 0.3)' : COLORS[value];
        drawBlock(ctx, piece.x + dx, piece.y + dy, color, isShadow ? 0 : value);
      }
    });
  });
}

function showPowerUpNotification(type) {
  const messages = {
    [POWER_UPS.BOMB]: "BOMB! Clears 3x3 area",
    [POWER_UPS.LASER]: "Laser! Clears and block on the row",
    [POWER_UPS.TIME]: "TIME! Slows down falling speed for 10 seconds",
    [POWER_UPS.WILD]: "WILD! Matches with any color for line clears",
    [POWER_UPS.TIME + 100]: "Speed returned to normal!" // Special message for time up
  };

  const notification = document.createElement('div');
  notification.className = 'combo-message';
  notification.style.color = COLORS[type % 100]; // Handle special notification types
  notification.textContent = messages[type];
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 2000);
}

function isValidMove(piece, offsetX = 0, offsetY = 0) {
  return piece.shape.every((row, dy) =>
    row.every((value, dx) => {
      if (value === 0) return true; // Empty block
      const newX = piece.x + dx + offsetX;
      const newY = piece.y + dy + offsetY;
      return (
        newX >= 0 && // Inside left wall
        newX < COLS && // Inside right wall
        newY < ROWS && // Above bottom
        (newY < 0 || board[newY][newX] === 0 || piece.isGhost) // Empty space or ghost piece
      );
    })
  );
}

function dropPiece() {
  if (isValidMove(currentPiece, 0, 1)) {
    currentPiece.y++;
  } else {
    lockPiece();
    clearLines();
    currentPiece = nextPiece;
    // Show notification when piece becomes playable
    if (currentPiece.id >= 8) {
      showPowerUpNotification(currentPiece.id);
    }
    nextPiece = generatePiece();
    canHold = true;
    if (!isValidMove(currentPiece)) {
      showGameOver();
      return;
    }
  }
}

function lockPiece() {
  // Save state before locking piece
  saveGameState();
  
  currentPiece.shape.forEach((row, dy) => {
    row.forEach((value, dx) => {
      if (value !== 0) {
        const x = currentPiece.x + dx;
        const y = currentPiece.y + dy;
        if (y >= 0) {
          board[y][x] = value;
          if (value >= 8) {
            activatePowerUp(value, x, y);
          }
        }
      }
    });
  });
  STATS.totalPiecesPlaced++;
  saveStats();
}

function update(time = 0) {
    if (!gameStarted || isPaused || isInMainMenu) return;
    
    const deltaTime = time - lastDropTime;
    if (deltaTime > dropInterval) {
        dropPiece();
        lastDropTime = time;
    }
    
    const shadowPiece = getShadowPiece(currentPiece);
    drawBoard(ctx, board);
    drawPiece(ctx, shadowPiece, true);
    drawPiece(ctx, currentPiece);
    drawNextPiece();
    animationId = requestAnimationFrame(update);
    
    checkAchievements();
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  
  // Calculate the size of the piece
  const pieceHeight = nextPiece.shape.length;
  const pieceWidth = nextPiece.shape[0].length;
  
  // Calculate center position
  const startX = Math.floor((nextCanvas.width / BLOCK_SIZE - pieceWidth) / 2);
  const startY = Math.floor((nextCanvas.height / BLOCK_SIZE - pieceHeight) / 2);
  
  nextPiece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawBlock(nextCtx, startX + x, startY + y, COLORS[value]);
      }
    });
  });
}

initGame();
requestAnimationFrame(update);

function holdCurrentPiece() {
  if (!canHold) return;
  if (holdPiece) {
    [currentPiece, holdPiece] = [holdPiece, currentPiece];
    currentPiece.x = 3;
    currentPiece.y = 0;
  } else {
    holdPiece = currentPiece;
    currentPiece = nextPiece;
    nextPiece = generatePiece();
  }
  canHold = false;
  drawHold();
}

function drawHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (holdPiece) {
    // Calculate the size of the piece
    const pieceHeight = holdPiece.shape.length;
    const pieceWidth = holdPiece.shape[0].length;
    
    // Calculate center position
    const startX = Math.floor((holdCanvas.width / BLOCK_SIZE - pieceWidth) / 2);
    const startY = Math.floor((holdCanvas.height / BLOCK_SIZE - pieceHeight) / 2);
    
    holdPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          drawBlock(holdCtx, startX + x, startY + y, COLORS[value]);
        }
      });
    });
  }
}

function rotatePiece(piece) {
  const newShape = piece.shape[0].map((_, i) =>
    piece.shape.map(row => row[i]).reverse()
  );
  const newPiece = { ...piece, shape: newShape };
  return isValidMove(newPiece) ? newPiece : piece;
}

// Add this new function for counter-clockwise rotation
function rotatePieceCounterClockwise(piece) {
  const newShape = piece.shape[0].map((_, i) =>
    piece.shape.map(row => row[piece.shape[0].length - 1 - i])
  );
  const newPiece = { ...piece, shape: newShape };
  return isValidMove(newPiece) ? newPiece : piece;
}

// Update the keydown event listener
document.addEventListener('keydown', event => {
  if (event.key.toLowerCase() === 'p') {
    powerUpsDisabled = true;
    weatherDisabled = true;
    console.log('Power-ups and weather have been disabled permanently.');
  }

  // Prevent further processing for the P key
  if (powerUpsDisabled && event.key.toLowerCase() === 'p') return;

  // Existing key handling logic
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
    event.preventDefault();
  }

  // Other controls
  if (event.ctrlKey && event.key === 'z') {
    event.preventDefault();
    undoMove();
  }
  if (event.key === 'Escape') {
    togglePause();
    return;
  }
  if (isPaused) return;

  switch (event.key) {
    case 'ArrowLeft':
      if (isValidMove(currentPiece, -1)) currentPiece.x--;
      break;
    case 'ArrowRight':
      if (isValidMove(currentPiece, 1)) currentPiece.x++;
      break;
    case 'ArrowDown':
      if (isValidMove(currentPiece, 0, 1)) currentPiece.y++;
      break;
    case ' ':
      while (isValidMove(currentPiece, 0, 1)) currentPiece.y++;
      dropPiece();
      break;
    case 'ArrowUp':
    case 'x':
      currentPiece = rotatePiece(currentPiece);
      break;
    case 'z':
      currentPiece = rotatePieceCounterClockwise(currentPiece);
      break;
    case 'Shift':
      holdCurrentPiece();
      break;
    case 'b': // 'b' for buy/shop
      openShop();
      break;
  }
});

// Add these event listeners after your existing ones

// Theme selection
document.querySelectorAll('#themeSelector button').forEach(button => {
  button.addEventListener('click', () => {
      const theme = button.dataset.theme;
      localStorage.setItem('currentTheme', theme);
      
      // Update selected button styling
      document.querySelectorAll('#themeSelector button').forEach(b => 
          b.classList.remove('selected'));
      button.classList.add('selected');
  });
});

// Game mode selection
document.querySelectorAll('#gameModes button').forEach(button => {
  button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      localStorage.setItem('gameMode', mode);
      
      // Update selected button styling
      document.querySelectorAll('#gameModes button').forEach(b => 
          b.classList.remove('selected'));
      button.classList.add('selected');
  });
});

// Shop button
document.getElementById('shopButton').addEventListener('click', openShop);

// Initialize achievements display
function initializeAchievements() {
  const achievementsContainer = document.querySelector('.achievements-list');
  achievementsContainer.innerHTML = Object.entries(ACHIEVEMENTS)
      .map(([id, achievement]) => `
          <div class="achievement-item ${achievement.earned ? 'earned' : ''}">
              <div>${achievement.description}</div>
              <div class="reward">Reward: ${achievement.reward} points</div>
          </div>
      `).join('');
}

// Initialize stats display
function initializeStats() {
  const statsContainer = document.querySelector('.stats-list');
  if (!statsContainer) return; // Guard clause in case element doesn't exist
  
  statsContainer.innerHTML = Object.entries(STATS)
      .map(([key, value]) => `
          <div class="stat-item">
              <div>${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}</div>
          </div>
      `).join('');
}

// Call these when the game loads
window.addEventListener('load', () => {
  initializeAchievements();
  initializeStats();
  
  // Set initial theme and mode selections
  const currentTheme = localStorage.getItem('currentTheme') || 'CLASSIC';
  const currentMode = localStorage.getItem('gameMode') || 'CLASSIC';
  
  document.querySelector(`#themeSelector button[data-theme="${currentTheme}"]`)
      ?.classList.add('selected');
  document.querySelector(`#gameModes button[data-mode="${currentMode}"]`)
      ?.classList.add('selected');
});

function showGameOver() {
    cancelAnimationFrame(animationId); // Stop the game loop
    gameOverScreen.style.display = 'flex'; // Show the game over screen
    isInMainMenu = false; // Ensure main menu state is correct
    
    // Update final score
    finalScoreElement.textContent = score;
    
    // Check and update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tetrisHighScore', highScore);
    }
    
    // Update high score display
    highScoreElement.textContent = highScore;
}

function hideGameOver() {
  gameOverScreen.style.display = 'none';
}

// Add event listeners
retryButton.addEventListener('click', () => {
  hideGameOver();
  initGame();
  startCountdown(); // Start the countdown again
});

quitButton.addEventListener('click', () => {
  window.close();
  // Fallback if window.close() is blocked
  document.body.innerHTML = '<h1>Thanks for playing!</h1>';
});

resumeButton.addEventListener('click', togglePause);
window.addEventListener('orientationchange', handleOrientationChange);
window.addEventListener('resize', handleResize);


quitFromPauseButton.addEventListener('click', () =>{
    window.close();
    // Fallback if window.close() is blocked
    document.body.innerHTML = '<h1>Thanks for playing!</h1>';
});

function clearLines() {
  const currentTime = Date.now();
  const timeSinceLastClear = currentTime - lastClearTime;
  
  let linesCleared = 0;
  let completedRows = [];

  // Find completed rows
  board.forEach((row, y) => {
    if (row.every(cell => cell !== 0)) {
      completedRows.push(y);
      linesCleared++;
    }
  });

  if (linesCleared > 0) {
    STATS.totalLinesCleared += linesCleared;
    if (comboCount > STATS.highestCombo) {
        STATS.highestCombo = comboCount;
    }
    saveStats();
    if (timeSinceLastClear < 2000) { // 2 seconds window for combos
      comboCount++;
      score += comboCount * 50; // Bonus points for combos
      showComboMessage(comboCount);
    } else {
      comboCount = 0;
    }
    lastClearTime = currentTime;

    // Calculate score based on number of lines cleared
    // Using classic NES scoring system
    switch (linesCleared) {
      case 1:
        score += 100;
        break;
      case 2:
        score += 300;
        break;
      case 3:
        score += 500;
        break;
      case 4:
        score += 800;
        break;
    }

    // Update high score if necessary
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('tetrisHighScore', highScore);
    }

    // Animate the blocks dissolving
    completedRows.forEach(y => {
      for (let x = 0; x < COLS; x++) {
        const block = document.createElement('div');
        // Position relative to the game canvas
        const canvasRect = canvas.getBoundingClientRect();
        block.style.position = 'absolute';
        block.style.left = `${canvasRect.left + x * BLOCK_SIZE}px`;
        block.style.top = `${canvasRect.top + y * BLOCK_SIZE}px`;
        block.style.width = `${BLOCK_SIZE}px`;
        block.style.height = `${BLOCK_SIZE}px`;
        block.style.backgroundColor = COLORS[board[y][x]];
        block.style.transition = 'all 0.3s';
        block.style.opacity = '1';
        document.body.appendChild(block);
        
        // Fade out animation
        setTimeout(() => {
          block.style.opacity = '0';
          block.style.transform = 'scale(1.2)';
        }, 50);

        // Remove the animated block after animation
        setTimeout(() => {
          block.remove();
        }, 300);
      }
    });

    // Wait for animation to complete before updating board
    setTimeout(() => {
      board = board.filter((row, index) => !completedRows.includes(index));
      while (board.length < ROWS) {
        board.unshift(Array(COLS).fill(0));
      }
      
      if (linesCleared === 4) {
        showQuadMessage();
      }
    }, 300);
  }

  STATS.totalLinesCleared += linesCleared;
  if (comboCount > STATS.highestCombo) {
    STATS.highestCombo = comboCount;
  }
  saveStats();

  return linesCleared;
}

function handleOrientationChange() {
  // Adjust canvas size based on new orientation
  setTimeout(adjustCanvasSize, 100); // Small delay to ensure new dimensions are available
}

function saveStats() {
  // Save stats to localStorage
  localStorage.setItem('tetrisStats', JSON.stringify(STATS));
}

// Add this function to load stats when the game starts
function loadStats() {
  const savedStats = localStorage.getItem('tetrisStats');
  if (savedStats) {
      Object.assign(STATS, JSON.parse(savedStats));
  }
}

function handleResize() {
  adjustCanvasSize();
}

function adjustCanvasSize() {
  const container = document.querySelector('.game-container');
  const containerWidth = container.clientWidth;
  
  if (window.innerWidth <= 768) {
      // Mobile view
      const maxWidth = Math.min(350, containerWidth - 20); // 20px for padding
      const scale = maxWidth / 300; // 300 is original canvas width
      
      canvas.style.width = `${maxWidth}px`;
      canvas.style.height = `${600 * scale}px`; // Maintain aspect ratio
  } else {
      // Desktop view - reset to original size
      canvas.style.width = '300px';
      canvas.style.height = '600px';
  }
}

function failChallenge() {
  if (currentChallenge) {
    // Clear the challenge timer
    if (challengeTimer) {
      clearTimeout(challengeTimer);
      challengeTimer = null;
    }

    // Add almost complete rows as penalty
    const numPenaltyRows = 3; // Number of penalty rows to add
    
    // Shift existing rows up
    for (let y = numPenaltyRows; y < ROWS; y++) {
      board[y - numPenaltyRows] = [...board[y]];
    }
    
    // Add new penalty rows
    for (let i = 0; i < numPenaltyRows; i++) {
      const row = Array(COLS).fill(1); // Fill with red blocks
      const gapPosition = Math.floor(Math.random() * COLS); // Random gap in each row
      row[gapPosition] = 0; // Create a gap
      board[ROWS - 1 - i] = row;
    }

    // Reset challenge
    currentChallenge = null;
    challengeProgress = 0;
  }
}

function showQuadMessage() {
  quadMessage.classList.remove('hidden');
  setTimeout(() => {
    quadMessage.classList.add('hidden');
  }, 1000);
}

function activatePowerUp(type, x, y) {
  if (powerUpsDisabled) return;

  switch(type) {
    case POWER_UPS.BOMB:
      // Clear surrounding blocks
      for(let dy = -1; dy <= 1; dy++) {
        for(let dx = -1; dx <= 1; dx++) {
          const newY = y + dy;
          const newX = x + dx;
          if(newY >= 0 && newY < ROWS && newX >= 0 && newX < COLS) {
            board[newY][newX] = 0;
          }
        }
      }
      break;
    
    case POWER_UPS.LASER:
        // Clear entire row
      for(let x = 0; x < COLS; x++) {
        board[y][x] = 0;
      }
        // Add laser animation effect
      const laserBeam = document.createElement('div');
      laserBeam.className = 'laser-beam';
      laserBeam.style.top = `${y * BLOCK_SIZE}px`;
      document.body.appendChild(laserBeam);
      setTimeout(() => laserBeam.remove(), 500);
      break;
      
    case POWER_UPS.TIME:
      const originalInterval = dropInterval;
      dropInterval *= 2;
      setTimeout(() => {
        dropInterval = originalInterval;
      }, 10000);
      break;
      
    case POWER_UPS.MATCH:
        // Fill gaps up to 2 blocks tall
      for(let dy = 0; dy < 2; dy++) {
        for(let dx = -1; dx <= 1; dx++) {
          const newY = y + dy;
          const newX = x + dx;
          if(newY >= 0 && newY < ROWS && newX >= 0 && newX < COLS) {
            if(board[newY][newX] === 0) {
                // Fill with a random color (1-7)
              board[newY][newX] = Math.floor(Math.random() * 7) + 1;
            }
          }
        }
      }
    break;
  }
}

function openShop() {
  if (isPaused) return;
  togglePause();
  
  const shopMenu = document.createElement('div');
  shopMenu.className = 'shop-menu';
  shopMenu.innerHTML = `
      <h2>Power-Up Shop</h2>
      <div class="shop-items">
          ${Object.entries(SHOP_ITEMS).map(([id, item]) => `
              <div class="shop-item">
                  <h3>${id}</h3>
                  <p>${item.description}</p>
                  <button onclick="purchaseItem('${id}')" 
                          ${score < item.cost ? 'disabled' : ''}>
                      Buy (${item.cost} points)
                  </button>
              </div>
          `).join('')}
      </div>
      <button onclick="closeShop()">Close</button>
  `;
  document.body.appendChild(shopMenu);
}

function completeChallenge() {
  if (!currentChallenge) return;

  // Clear any existing challenge timer
  if (challengeTimer) {
    clearTimeout(challengeTimer);
    challengeTimer = null;
  }

  // Award base reward
  score += currentChallenge.reward;

  // Add special rewards
  const rewards = [
    { chance: 0.4, type: 'powerup', value: generatePowerUpPiece() },
    { chance: 0.3, type: 'clearRows', value: clearRandomRows(2) },
    { chance: 0.2, type: 'slowTime', value: activateTemporarySlowdown() },
    { chance: 0.1, type: 'extraPoints', value: currentChallenge.reward * 2 }
  ];

  const randomValue = Math.random();
  let cumulativeChance = 0;

  for (const reward of rewards) {
    cumulativeChance += reward.chance;
    if (randomValue <= cumulativeChance) {
      applyReward(reward);
      break;
    }
  }

  // Show completion message
  showChallengeComplete(currentChallenge);
  
  // Reset challenge
  currentChallenge = null;
  challengeProgress = 0;
}

function generatePowerUpPiece() {
  const powerUpType = Math.floor(Math.random() * Object.keys(POWER_UPS).length) + 8;
  return {
    id: powerUpType,
    shape: [[powerUpType]],
    x: 3,
    y: 0
  };
}

function clearRandomRows(count) {
  const availableRows = [];
  for(let y = 0; y < ROWS; y++) {
    if(board[y].some(cell => cell !== 0)) {
      availableRows.push(y);
    }
  }
  
  for(let i = 0; i < count && availableRows.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * availableRows.length);
    const rowToClear = availableRows.splice(randomIndex, 1)[0];
    board[rowToClear] = Array(COLS).fill(0);
  }
}

function activateTemporarySlowdown() {
  const originalInterval = dropInterval;
  dropInterval *= 2;
  setTimeout(() => {
    dropInterval = originalInterval;
  }, 15000); // 15 seconds of slow time
}

function undoMove() {
  if (previousStates.length === 0 || isPaused) return;
  
  const previousState = previousStates.pop();
  board = previousState.board;
  score = previousState.score;
  currentPiece = previousState.currentPiece;
  nextPiece = previousState.nextPiece;
  holdPiece = previousState.holdPiece;
  
  // Redraw everything
  drawBoard(ctx, board);
  drawNextPiece();
  drawHold();
}

function showChallengeNotification() {
  const notification = document.createElement('div');
  notification.className = 'challenge-notification';
  notification.textContent = currentChallenge.description;
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function applyReward(reward) {
  let message = '';
  
  switch(reward.type) {
    case 'powerup':
      nextPiece = reward.value;
      message = "Bonus Power-up Block!";
      break;
    case 'clearRows':
      reward.value;
      message = "2 Random Rows Cleared!";
      break;
    case 'slowTime':
      reward.value;
      message = "15 Seconds of Slow Fall Speed!";
      break;
    case 'extraPoints':
      score += reward.value;
      message = `Bonus ${reward.value} Points!`;
      break;
  }

  const notification = document.createElement('div');
  notification.className = 'reward-notification';
  notification.innerHTML = `
    <h3>Challenge Reward!</h3>
    <p>${message}</p>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 2000);
}


function showMessage(text) {
  const message = document.createElement('div');
  message.className = 'combo-message';
  message.style.color = '#00ff00';
  message.textContent = text;
  document.body.appendChild(message);
  setTimeout(() => message.remove(), 2000);
}

function showChallengeComplete(challenge) {
  const notification = document.createElement('div');
  notification.className = 'challenge-complete';
  
  const title = document.createElement('h2');
  title.textContent = 'Challenge Complete!';
  
  const description = document.createElement('p');
  description.textContent = challenge.description;
  
  const reward = document.createElement('p');
  reward.textContent = `Reward: ${challenge.reward} points`;
  
  notification.appendChild(title);
  notification.appendChild(description);
  notification.appendChild(reward);
  
  document.body.appendChild(notification);
  
  // Remove notification after animation
  setTimeout(() => {
    notification.remove();
  }, 2000);
}

function startWeatherEffect() {
  if (weatherDisabled) return;
  
  const effects = Object.keys(WEATHER_EFFECTS);
  const newWeather = effects[Math.floor(Math.random() * effects.length)];
  
  if (newWeather !== currentWeather) {
    currentWeather = newWeather;
    
    // Show weather notification
    const weatherMessages = {
      WIND: "Strong winds are affecting block movement!",
      STORM: "A storm is causing faster drops!",
      FOG: "Fog is reducing visibility!"
    };
    
    const notification = document.createElement('div');
    notification.className = 'weather-notification';
    notification.textContent = weatherMessages[currentWeather];
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => notification.remove(), 3000);
    
    // Apply weather effects
    const gameContainer = document.querySelector('.game-container');
    gameContainer.className = 'game-container ' + currentWeather.toLowerCase() + '-effect';
    
    // Clear weather after 10 seconds
    setTimeout(() => {
      currentWeather = null;
      gameContainer.className = 'game-container';
    }, 10000); // Weather lasts 10 seconds
  }
}

// Change weather every 30 seconds

function showComboMessage(combo) {
  const message = document.createElement('div');
  message.className = 'combo-message';
  message.textContent = `${combo}x COMBO!`;
  document.body.appendChild(message);
  setTimeout(() => message.remove(), 1000);
}


function startCountdown() {
  const countdown = document.getElementById('countdown');
  let count = 3;
  
  // Cancel any existing animation frame
  if (animationId) {
      cancelAnimationFrame(animationId);
  }
  
  // Hide main menu and set state
  document.getElementById('mainMenu').style.display = 'none';
  isInMainMenu = false;
  
  countdown.classList.remove('hidden');
  countdown.textContent = count;

  const countInterval = setInterval(() => {
      count--;
      if (count > 0) {
          countdown.textContent = count;
          countdown.style.animation = 'none';
          void countdown.offsetWidth;
          countdown.style.animation = 'countdownScale 1s ease-in-out';
      } else if (count === 0) {
          countdown.textContent = 'GO!';
      } else {
          clearInterval(countInterval);
          countdown.classList.add('hidden');
          gameStarted = true;
          lastDropTime = performance.now();
          animationId = requestAnimationFrame(update);
      }
  }, 1000);
}

document.getElementById('playButton').addEventListener('click', startCountdown);
document.getElementById('quitFromMenuButton').addEventListener('click', () => {
    window.close();
    document.body.innerHTML = '<h1>Thanks for playing!</h1>';
});

function initGame(mode = 'CLASSIC') {
  isInMainMenu = true;  // Set initial state
  gameStarted = false;  // Ensure game isn't running
  
  // Cancel any existing animation frame
  if (animationId) {
      cancelAnimationFrame(animationId);
  }
  
  board = JSON.parse(JSON.stringify(BOARD));
  score = 0;
  highScore = Number(localStorage.getItem('tetrisHighScore')) || 0;
  currentPiece = generatePiece();
  currentWeather = null;
  nextPiece = generatePiece();
  holdPiece = null;
  canHold = true;
  lastDropTime = performance.now();
  dropInterval = 1000;
  hideGameOver();
  drawBoard(ctx, board);
  drawHold();
  loadStats();
  initializeStats();
  
  // Start weather system
  startWeatherSystem();
  
  switch(mode) {
    case 'SPRINT':
      initSprintMode();
      break;
    case 'ULTRA':
      initUltraMode();
      break;
    case 'SURVIVAL':
      initSurvivalMode();
      break;
  }
}

// Initialize the game but don't start it
initGame();

function startWeatherSystem() {
  // Check for weather every 2-5 minutes
  setInterval(() => {
    if (!currentWeather && Math.random() < 0.3) { //
      startWeatherEffect();
    }
  }, Math.random() * (300000 - 120000) + 120000); //
}

function checkAchievements() {
  // Example achievement check
  if (!ACHIEVEMENTS.SURVIVOR.earned && score >= 10000) {
    unlockAchievement('SURVIVOR');
  }
}

// Add mode-specific initialization functions
function initSprintMode() {
  const lineGoal = 40;
  let linesCleared = 0;
  const startTime = Date.now();
  
  // Override clearLines() to check for win condition
  const originalClearLines = clearLines;
  clearLines = function() {
    const lines = originalClearLines();
    linesCleared += lines;
    if (linesCleared >= lineGoal) {
      const endTime = Date.now();
      showSprintComplete(endTime - startTime);
    }
    return lines;
  };
}
