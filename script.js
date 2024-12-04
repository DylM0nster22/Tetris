const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('holdCanvas');
const holdCtx = holdCanvas.getContext('2d');
const quadMessage = document.getElementById('quadMessage');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const BOARD = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const COLORS = ['#000', '#f00', '#0f0', '#00f', '#ff0', '#f0f', '#0ff', '#fff'];

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
let board = JSON.parse(JSON.stringify(BOARD));
let linesClearedTotal = 0;
let highScore = localStorage.getItem('highScore') || 0;

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

function updateScore(newScore) {
  if (newScore > highScore) {
    highScore = newScore;
    localStorage.setItem('highScore', highScore);
  }
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
  const deltaTime = time - lastDropTime;
  if (deltaTime > dropInterval) {
    dropPiece();
    lastDropTime = time;
  }
  
  const shadowPiece = getShadowPiece(currentPiece);

  drawBoard(ctx, board);
  drawPiece(ctx, shadowPiece, true); // Draw shadow piece
  drawPiece(ctx, currentPiece); // Draw current piece
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
});

function clearLines() {
  let linesCleared = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== 0)) {
      linesCleared++;
      // Remove the cleared row
      board.splice(y, 1);
      // Add a new empty row at the top
      board.unshift(Array(COLS).fill(0));
      y++; // Check the new row at this index
    }
  }

  if (linesCleared === 4) {
    showQuadMessage();
  }
}

function showQuadMessage() {
  const quadMessage = document.getElementById('quadMessage');
  quadMessage.classList.remove('hidden');
  quadMessage.classList.add('visible');
  setTimeout(() => {
    quadMessage.classList.remove('visible');
    quadMessage.classList.add('hidden');
  }, 1000);
}


// Initialization
function initGame() {
  currentPiece = generatePiece();
  nextPiece = generatePiece();
  drawBoard(ctx, board);
  drawHold();
}

initGame();
