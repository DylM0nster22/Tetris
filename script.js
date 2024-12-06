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
const BOARD = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const COLORS = [
  '#000',
  '#FF0051', // Red
  '#00FF93', // Green
  '#0051FF', // Blue
  '#FFE600', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFFFFF'  // White
];


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

let touchStartX = null;
let touchStartY = null;
let touchStartTime = null;

function drawBlock(ctx, x, y, color) {
  const blockX = x * BLOCK_SIZE;
  const blockY = y * BLOCK_SIZE;
  
  // Main block face
  ctx.fillStyle = color;
  ctx.fillRect(blockX, blockY, BLOCK_SIZE, BLOCK_SIZE);
  
  // Light edge (top, left)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.moveTo(blockX, blockY + BLOCK_SIZE);
  ctx.lineTo(blockX, blockY);
  ctx.lineTo(blockX + BLOCK_SIZE, blockY);
  ctx.lineTo(blockX + BLOCK_SIZE - 3, blockY + 3);
  ctx.lineTo(blockX + 3, blockY + 3);
  ctx.lineTo(blockX + 3, blockY + BLOCK_SIZE - 3);
  ctx.fill();
  
  // Dark edge (bottom, right)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.moveTo(blockX + BLOCK_SIZE, blockY);
  ctx.lineTo(blockX + BLOCK_SIZE, blockY + BLOCK_SIZE);
  ctx.lineTo(blockX, blockY + BLOCK_SIZE);
  ctx.lineTo(blockX + 3, blockY + BLOCK_SIZE - 3);
  ctx.lineTo(blockX + BLOCK_SIZE - 3, blockY + BLOCK_SIZE - 3);
  ctx.lineTo(blockX + BLOCK_SIZE - 3, blockY + 3);
  ctx.fill();
  
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
      showGameOver();
      return;
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
  if (!gameStarted || isPaused) return;
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
  // Prevent default behavior for game control keys
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
    event.preventDefault();
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
  }
});

function showGameOver() {
  cancelAnimationFrame(animationId); // Stop the game loop
  gameOverScreen.style.display = 'flex'; // Show the game over screen
  
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


quitFromPauseButton.addEventListener('click', () => {S
    window.close();
    // Fallback if window.close() is blocked
    document.body.innerHTML = '<h1>Thanks for playing!</h1>';
});

function clearLines() {
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

  return linesCleared;
}

function handleOrientationChange() {
  // Adjust canvas size based on new orientation
  setTimeout(adjustCanvasSize, 100); // Small delay to ensure new dimensions are available
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

function showQuadMessage() {
  quadMessage.classList.remove('hidden');
  setTimeout(() => {
    quadMessage.classList.add('hidden');
  }, 1000);
}

// Initialization
function initGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  score = 0;
  // Convert stored high score to number, default to 0 if null/undefined
  highScore = Number(localStorage.getItem('tetrisHighScore')) || 0;
  currentPiece = generatePiece();
  nextPiece = generatePiece();
  holdPiece = null;
  canHold = true;
  lastDropTime = 0;
  gameStarted = false;
  hideGameOver();
  drawBoard(ctx, board);
  drawHold();
}

function startCountdown() {
    const countdown = document.getElementById('countdown');
    let count = 3;
    
    document.getElementById('mainMenu').style.display = 'none';
    countdown.classList.remove('hidden');
    countdown.textContent = count; // Start with 3

    const countInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdown.textContent = count;
            countdown.style.animation = 'none';
            void countdown.offsetWidth; // Trigger reflow
            countdown.style.animation = 'countdownScale 1s ease-in-out';
        } else if (count === 0) {
            countdown.textContent = 'GO!';
        } else {
            clearInterval(countInterval);
            countdown.classList.add('hidden');
            gameStarted = true;
            lastDropTime = performance.now();
            requestAnimationFrame(update);
        }
    }, 1000);
}

document.getElementById('playButton').addEventListener('click', startCountdown);
document.getElementById('quitFromMenuButton').addEventListener('click', () => {
    window.close();
    document.body.innerHTML = '<h1>Thanks for playing!</h1>';
});

// Initialize the game but don't start it
initGame();