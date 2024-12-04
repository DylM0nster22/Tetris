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
let canHold = true;
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
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y].length; x++) {
      if (board[y][x] !== 0) {
        drawBlock(ctx, x, y, COLORS[board[y][x]]);
      }
    }
  }
}

// Piece-related functions
function generatePiece() {
  const id = Math.floor(Math.random() * (TETROMINOS.length - 1)) + 1;
  const shape = TETROMINOS[id];
  return { id, shape, x: 3, y: 0 };
}

function drawPiece(ctx, piece) {
  piece.shape.forEach((row, dy) => {
    row.forEach((value, dx) => {
      if (value !== 0) {
        drawBlock(ctx, piece.x + dx, piece.y + dy, COLORS[value]);
      }
    });
  });
}

// Game logic
function dropPiece() {
  // Handle piece dropping
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
  drawBoard(ctx, board);
  drawHold();
}

initGame();
