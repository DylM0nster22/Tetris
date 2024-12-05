const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('holdCanvas');
const holdCtx = holdCanvas.getContext('2d');
const quadMessage = document.getElementById('quadMessage');
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const comboDisplay = document.getElementById('combo');
const COLS = 10;
const ROWS = 20;
const pieceQueue = [];
const QUEUE_SIZE = 3;
const BLOCK_SIZE = 30;
const BOARD = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const COLORS = ['#000', '#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff', '#fff'];
const menuItems = ['Resume', 'Statistics', 'Settings', 'Quit'];
const pieceStats = {
  T: 0, O: 0, S: 0, Z: 0, I: 0, J: 0, L: 0};

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

// Game state
let currentPiece = null;
let nextPiece = null;
let holdPiece = null;
let dropInterval = 1000; // 1 second per drop
let lastDropTime = 0;
let canHold = true;
let score = 0;
let level = 1;
let backToBack = false;
let selectedMenuItem = 0;
let isPaused = false;
let pauseMenuState = 'main'; // 'main', 'settings', 'stats'
let resumeCountdown = 0;
let combo = 0;
let board = JSON.parse(JSON.stringify(BOARD));

// Utility functions
function drawBlock(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  ctx.strokeStyle = '#222';
  ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
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

function updateDisplays() {
  scoreDisplay.textContent = score;
  levelDisplay.textContent = level;
  comboDisplay.textContent = combo;
}

function fillQueue() {
  while (pieceQueue.length < QUEUE_SIZE) {
      pieceQueue.push(generatePiece());
  }
}

function getNextPiece() {
  const piece = pieceQueue.shift();
  fillQueue();
  return piece;
}

function flashLines(completedLines) {
  const flashCount = 3;
  let flashes = 0;
  
  const flash = setInterval(() => {
      completedLines.forEach(y => {
          for (let x = 0; x < COLS; x++) {
              const color = flashes % 2 === 0 ? '#FFF' : '#000';
              drawBlock(ctx, x, y, color);
          }
      });
      
      flashes++;
      if (flashes >= flashCount * 2) {
          clearInterval(flash);
      }
  }, 100);
}

function updateScore(linesCleared, isTSpin) {
  let points = 0;
  if (isTSpin) {
      points = linesCleared * 400;
      if (backToBack) points *= 1.5;
      backToBack = true;
  } else if (linesCleared === 4) {
      points = 800;
      if (backToBack) points *= 1.5;
      backToBack = true;
  } else {
      backToBack = false;
      points = linesCleared * 100;
  }
  score += points * level;
}

function updatePieceStats(piece) {
  const pieceTypes = ['', 'T', 'O', 'S', 'Z', 'I', 'J', 'L'];
  pieceStats[pieceTypes[piece.id]]++;
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
  const id = Math.floor(Math.random() * (TETROMINOS.length - 1)) + 1;
  const shape = TETROMINOS[id];
  return { id, shape, x: 3, y: 0 };
}

function drawPiece(ctx, piece, isShadow = false) {
  piece.shape.forEach((row, dy) => {
    row.forEach((value, dx) => {
      if (value !== 0) {
        const color = isShadow ? 'rgba(255, 255, 255, 0.3)' : COLORS[value];
        drawBlock(ctx, piece.x + dx, piece.y + dy, color);
      }
    });
  });
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
        (newY < 0 || board[newY][newX] === 0) // Empty board space or above top
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
    nextPiece = generatePiece();
    canHold = true; // Reset hold availability
    if (!isValidMove(currentPiece)) {
      alert('Game Over');
      initGame();
    }
  }
}

function lockPiece() {
  currentPiece.shape.forEach((row, dy) => {
    row.forEach((value, dx) => {
      if (value !== 0) {
        const x = currentPiece.x + dx;
        const y = currentPiece.y + dy;
        if (y >= 0) board[y][x] = value;
      }
    });
  });
}

function update(time = 0) {
  if (isPaused) {
      showPauseMenu();
      requestAnimationFrame(update);
      return;
  }

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
  requestAnimationFrame(update);
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextPiece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawBlock(nextCtx, x, y, COLORS[value]);
      }
    });
  });
}

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
    holdPiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          drawBlock(holdCtx, x, y, COLORS[value]);
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

document.addEventListener('keydown', event => {
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
      currentPiece = rotatePiece(currentPiece);
      break;
    case 'Shift':
      holdCurrentPiece();
      break;
  }
  if (event.key === 'Escape') {
    togglePause();
    return;
  }

  if (isPaused) {
    handlePauseMenuInput(event);
    return;
  }
});

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = {
      x: (Math.random() - 0.5) * 5,
      y: (Math.random() - 4) * 5
    };
    this.size = Math.random() * 3 + 1;
    this.life = 1;
  }

  update() {
    this.x += this.speed.x;
    this.y += this.speed.y;
    this.life -= 0.01;
  }

  draw(ctx) {
    ctx.fillStyle = `rgba(255, 255, 255, ${this.life})`;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

let particles = [];

// Add to clearLines() when a line is cleared
function addParticles(y) {
  for (let i = 0; i < 50; i++) {
    particles.push(new Particle(canvas.width / 2, y * BLOCK_SIZE));
  }
}

function handlePauseMenuInput(event) {
  if (!isPaused) return;

  if (pauseMenuState === 'main') {
      switch(event.key) {
          case 'ArrowUp':
              // Navigate menu up
              selectedMenuItem = (selectedMenuItem - 1 + menuItems.length) % menuItems.length;
              break;
          case 'ArrowDown':
              // Navigate menu down
              selectedMenuItem = (selectedMenuItem + 1) % menuItems.length;
              break;
          case 'Enter':
              switch(selectedMenuItem) {
                  case 0: // Resume
                      togglePause();
                      break;
                  case 1: // Statistics
                      pauseMenuState = 'stats';
                      break;
                  case 2: // Settings
                      pauseMenuState = 'settings';
                      break;
                  case 3: // Quit
                      if (confirm('Are you sure you want to quit?')) {
                          initGame();
                          isPaused = false;
                      }
                      break;
              }
              break;
      }
  } else if (event.key === 'Backspace') {
      pauseMenuState = 'main';
  }
}

function clearLines() {
  let linesCleared = 0;
  board = board.filter(row => {
    if (row.every(cell => cell !== 0)) {
      linesCleared++;
      return false;
    }
    return true;
  });

  // Add scoring based on lines cleared
  switch(linesCleared) {
    case 1: score += 100 * level; break;
    case 2: score += 300 * level; break;
    case 3: score += 500 * level; break;
    case 4: score += 800 * level; break;
  }

  if (linesCleared > 0) {
    combo++;
    score += combo * 50; // Bonus points for combos
  } else {
    combo = 0;
  }

  // Level up every 10 lines
  level = Math.floor(score / 1000) + 1;
  dropInterval = Math.max(100, 1000 - (level * 50)); // Speed up as level increases

  while (board.length < ROWS) {
    board.unshift(Array(COLS).fill(0));

  updateDisplays(); // Add here
  }
}

function showPauseMenu() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (pauseMenuState === 'main') {
      drawMainPauseMenu();
  } else if (pauseMenuState === 'stats') {
      drawStatsMenu();
  } else if (pauseMenuState === 'settings') {
      drawSettingsMenu();
  }
}

function drawStatsMenu() {
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'left';
  
  const stats = [
      `Score: ${score}`,
      `Level: ${level}`,
      `Combo: ${combo}`,
      'Piece Statistics:',
      `T: ${pieceStats.T}`,
      `I: ${pieceStats.I}`,
      `O: ${pieceStats.O}`,
      `S: ${pieceStats.S}`,
      `Z: ${pieceStats.Z}`,
      `J: ${pieceStats.J}`,
      `L: ${pieceStats.L}`
  ];

  stats.forEach((stat, index) => {
      ctx.fillText(stat, canvas.width * 0.2, canvas.height * 0.2 + (index * 30));
  });

  ctx.fillText('Press Backspace to return', canvas.width * 0.2, canvas.height * 0.8);
}

function startResumeCountdown() {
  resumeCountdown = 3;
  const countdownInterval = setInterval(() => {
      if (resumeCountdown > 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'white';
          ctx.font = '50px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(resumeCountdown, canvas.width / 2, canvas.height / 2);
          resumeCountdown--;
      } else {
          clearInterval(countdownInterval);
          isPaused = false;
          lastDropTime = performance.now();
          requestAnimationFrame(update);
      }
  }, 1000);
}

function drawMainPauseMenu() {
  menuItems.forEach((item, index) => {
      ctx.fillStyle = index === selectedMenuItem ? '#ff0' : 'white';
      ctx.font = '30px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item, canvas.width / 2, canvas.height * (0.3 + index * 0.1));
  });
}

function isTSpin(piece) {
  if (piece.id !== 1) return false; // Only T pieces
  let corners = 0;
  const x = piece.x;
  const y = piece.y;
  
  // Check corners around T piece
  if (y + 2 < ROWS && x >= 0 && board[y + 2][x] !== 0) corners++;
  if (y + 2 < ROWS && x + 2 < COLS && board[y + 2][x + 2] !== 0) corners++;
  if (y >= 0 && x >= 0 && board[y][x] !== 0) corners++;
  if (y >= 0 && x + 2 < COLS && board[y][x + 2] !== 0) corners++;
  
  return corners >= 3;
}

  function saveHighScore() {
    const highScores = JSON.parse(localStorage.getItem('tetrisHighScores') || '[]');
    highScores.push(score);
    highScores.sort((a, b) => b - a);
    highScores.splice(5); // Keep top 5 scores
    localStorage.setItem('tetrisHighScores', JSON.stringify(highScores));
  }

  // Add to game over condition
  if (!isValidMove(currentPiece)) {
    saveHighScore();
    alert(`Game Over!\nScore: ${score}\nLevel: ${level}`);
    initGame();
  }

  function showQuadMessage() {
    quadMessage.classList.remove('hidden');
    setTimeout(() => {
      quadMessage.classList.add('hidden');
    }, 1000);
  }
// Initialization
function initGame() {
  currentPiece = generatePiece();
  nextPiece = generatePiece();
  board = JSON.parse(JSON.stringify(BOARD));
  score = 0;
  level = 1;
  combo = 0;
  isPaused = false;
  pauseMenuState = 'main';
  selectedMenuItem = 0;
  updateDisplays();
  drawBoard(ctx, board);
  drawHold();
}

initGame();
requestAnimationFrame(update);