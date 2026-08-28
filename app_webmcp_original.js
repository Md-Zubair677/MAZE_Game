const DIRECTIONS = {
  up: { dx: 0, dy: -1, opposite: 'down', wallKey: 'n' },
  down: { dx: 0, dy: 1, opposite: 'up', wallKey: 's' },
  left: { dx: -1, dy: 0, opposite: 'right', wallKey: 'w' },
  right: { dx: 1, dy: 0, opposite: 'left', wallKey: 'e' },
};

const DEFAULT_SIZE = 10;
const MAZE_TYPES = {
  10: { size: 10, timeLimit: 120000 },
  20: { size: 20, timeLimit: 180000 },
  30: { size: 30, timeLimit: 300000 },
};

const state = {
  size: DEFAULT_SIZE,
  maze: [],
  player: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  goal: { x: 0, y: 0 },
  moveCount: 0,
  elapsedMs: 0,
  startedAt: 0,
  won: false,
  visited: new Set(),
  lastHint: '',
  lives: 3,
  score: 0,
  level: 1,
  timeLimit: 0,
  timeRemaining: 0,
  maxLives: 3,
  status: 'playing',
};

window.state = state;
globalThis.state = state;
window.DIRECTIONS = DIRECTIONS;
window.MAZE_TYPES = MAZE_TYPES;
globalThis.DIRECTIONS = DIRECTIONS;
globalThis.MAZE_TYPES = MAZE_TYPES;

const boardEl = document.getElementById('mazeBoard');
const startScreenEl = document.getElementById('startScreen');
const startGameBtn = document.getElementById('startGameBtn');
const timerValueEl = document.getElementById('timerValue');
const movesValueEl = document.getElementById('movesValue');
const statusValueEl = document.getElementById('statusValue');
const hintTextEl = document.getElementById('hintText');
const difficultySelectEl = document.getElementById('difficultySelect');
const newMazeBtn = document.getElementById('newMazeBtn');
const resetBtn = document.getElementById('resetBtn');
const hintBtn = document.getElementById('hintBtn');
const livesValueEl = document.getElementById('livesValue');
const scoreValueEl = document.getElementById('scoreValue');
const levelValueEl = document.getElementById('levelValue');
const timeLimitEl = document.getElementById('timeLimit');
const webmcpStatusEl = document.getElementById('webmcpStatus');
const webmcpStateEl = document.getElementById('webmcpState');
const webmcpToolsEl = document.getElementById('webmcpTools');
const agentLogEl = document.getElementById('agentLog');

function startGame() {
  startScreenEl?.classList.add('is-hidden');
  document.body.classList.add('game-started');
  boardEl?.focus({ preventScroll: true });
}

function clampSize(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SIZE;
  return Math.min(Math.max(parsed, 4), 30);
}

function playSound(type) {
  if (!window.AudioContext && !window.webkitAudioContext) return;

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioCtor();
  const now = audioContext.currentTime;

  switch (type) {
    case 'move': {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 400;
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }
    case 'win': {
      const notes = [523, 659, 784];
      notes.forEach((freq, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.2);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.2);
      });
      break;
    }
    case 'penalty': {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.frequency.value = 200;
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    }
    default:
      break;
  }
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function makeCell(x, y) {
  return {
    x,
    y,
    walls: {
      n: true,
      e: true,
      s: true,
      w: true,
    },
  };
}

function serializePosition(position) {
  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
    return { row: 0, col: 0 };
  }
  return { row: position.y, col: position.x };
}

function removeWallBetween(grid, current, next, direction) {
  const currentCell = grid[current.y][current.x];
  const nextCell = grid[next.y][next.x];

  if (direction === 'up') {
    currentCell.walls.n = false;
    nextCell.walls.s = false;
  }
  if (direction === 'down') {
    currentCell.walls.s = false;
    nextCell.walls.n = false;
  }
  if (direction === 'left') {
    currentCell.walls.w = false;
    nextCell.walls.e = false;
  }
  if (direction === 'right') {
    currentCell.walls.e = false;
    nextCell.walls.w = false;
  }
}

function setAgentLog(message) {
  if (!agentLogEl) return;
  agentLogEl.textContent = message;
}

function getCurrentGameStatus() {
  if (state.won) {
    state.status = 'escaped';
  } else if (state.lives === 0) {
    state.status = 'game-over';
  } else if (state.timeRemaining === 0) {
    state.status = 'time-up';
  } else {
    state.status = 'playing';
  }
  return state.status;
}

function generateMaze(size) {
  const rows = size;
  const cols = size;
  const grid = Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => makeCell(x, y))
  );

  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack = [{ x: 0, y: 0 }];
  visited[0][0] = true;

  while (stack.length) {
    const current = stack[stack.length - 1];
    const neighbors = [];

    if (current.y > 0 && !visited[current.y - 1][current.x]) {
      neighbors.push({ x: current.x, y: current.y - 1, direction: 'up' });
    }
    if (current.x < cols - 1 && !visited[current.y][current.x + 1]) {
      neighbors.push({ x: current.x + 1, y: current.y, direction: 'right' });
    }
    if (current.y < rows - 1 && !visited[current.y + 1][current.x]) {
      neighbors.push({ x: current.x, y: current.y + 1, direction: 'down' });
    }
    if (current.x > 0 && !visited[current.y][current.x - 1]) {
      neighbors.push({ x: current.x - 1, y: current.y, direction: 'left' });
    }

    if (neighbors.length) {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      visited[next.y][next.x] = true;
      removeWallBetween(grid, current, next, next.direction);
      stack.push(next);
    } else {
      stack.pop();
    }
  }

  const startPos = {
    x: Math.floor(Math.random() * size),
    y: Math.floor(Math.random() * size),
  };
  let goalPos = {
    x: Math.floor(Math.random() * size),
    y: Math.floor(Math.random() * size),
  };

  while (goalPos.x === startPos.x && goalPos.y === startPos.y) {
    goalPos = {
      x: Math.floor(Math.random() * size),
      y: Math.floor(Math.random() * size),
    };
  }

  const entryX = Math.floor(Math.random() * Math.min(3, size));
  const entryY = 0;
  if (grid[entryY][entryX]) {
    grid[entryY][entryX].walls.n = false;
  }

  const exitX = Math.floor(size - Math.min(3, size) + Math.random() * Math.min(3, size));
  const exitY = size - 1;
  if (grid[exitY][exitX]) {
    grid[exitY][exitX].walls.s = false;
  }

  state.maze = grid;
  state.size = size;
  state.start = { x: startPos.x, y: startPos.y };
  state.player = { x: startPos.x, y: startPos.y };
  state.goal = goalPos;
  state.moveCount = 0;
  state.won = false;
  state.lives = state.maxLives;
  state.visited = new Set([cellKey(startPos.x, startPos.y)]);
  state.startedAt = performance.now();
  state.elapsedMs = 0;
  state.timeLimit = MAZE_TYPES[size]?.timeLimit || 120000;
  state.timeRemaining = state.timeLimit;
  state.lastHint = 'Find the glowing exit to escape!';
  state.status = 'playing';
  setHintText(state.lastHint);
  setAgentLog('Agent ready. Use get_maze_state() or find_solution().');
  renderBoard();
  updateHud();
}

function setHintText(text) {
  if (hintTextEl) {
    hintTextEl.textContent = text;
  }
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateHud() {
  if (timerValueEl) timerValueEl.textContent = formatTime(state.elapsedMs);
  if (movesValueEl) movesValueEl.textContent = String(state.moveCount);
  if (livesValueEl) livesValueEl.textContent = String(state.lives);
  if (scoreValueEl) scoreValueEl.textContent = String(state.score);
  if (levelValueEl) levelValueEl.textContent = String(state.level);

  state.timeRemaining = Math.max(0, state.timeLimit - state.elapsedMs);
  if (timeLimitEl) timeLimitEl.textContent = formatTime(state.timeRemaining);

  if (state.timeRemaining < 30000 && state.timeRemaining > 0) {
    timeLimitEl?.classList.add('warning');
  } else if (state.timeRemaining === 0) {
    timeLimitEl?.classList.add('critical');
  } else {
    timeLimitEl?.classList.remove('warning', 'critical');
  }

  const status = getCurrentGameStatus();
  const label = status === 'escaped' ? 'Escaped!' : status === 'game-over' ? 'Game Over!' : status === 'time-up' ? "Time's Up!" : 'In progress';
  if (statusValueEl) statusValueEl.textContent = label;
}

function getCellClassNames(cell) {
  const classes = ['cell'];
  const key = cellKey(cell.x, cell.y);

  if (state.visited.has(key)) classes.push('visited');
  if (cell.x === state.player.x && cell.y === state.player.y) classes.push('player');
  if (cell.x === state.goal.x && cell.y === state.goal.y) classes.push('goal');
  if (cell.walls.n) classes.push('wall-n');
  if (cell.walls.e) classes.push('wall-e');
  if (cell.walls.s) classes.push('wall-s');
  if (cell.walls.w) classes.push('wall-w');

  return classes.join(' ');
}

function renderBoard() {
  if (!boardEl) return;
  boardEl.style.gridTemplateColumns = `repeat(${state.size}, minmax(0, 1fr))`;
  boardEl.style.gridTemplateRows = `repeat(${state.size}, minmax(0, 1fr))`;

  const cells = [];
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      const cell = state.maze[y][x];
      const cellEl = document.createElement('div');
      cellEl.className = getCellClassNames(cell);
      cellEl.setAttribute('role', 'gridcell');
      cellEl.setAttribute('aria-label', `Cell ${x + 1}, ${y + 1}`);
      cells.push(cellEl);
    }
  }

  boardEl.replaceChildren(...cells);
}

function updateVisitedState() {
  state.visited.add(cellKey(state.player.x, state.player.y));
}

function getMazeStateHandler() {
  const grid = state.maze.map((row) => row.map((cell) => ({
    x: cell.x,
    y: cell.y,
    walls: { ...cell.walls },
  })));

  return {
    width: state.size,
    height: state.size,
    maze: grid,
    player: serializePosition(state.player),
    exit: serializePosition(state.goal),
    start: serializePosition(state.start),
    status: getCurrentGameStatus(),
    moves: state.moveCount,
    elapsedSeconds: Math.floor(state.elapsedMs / 1000),
    elapsedMs: state.elapsedMs,
    visited: Array.from(state.visited),
    won: state.won,
    escaped: state.won,
    size: state.size,
  };
}

function getPlayerState() {
  return {
    position: serializePosition(state.player),
    status: getCurrentGameStatus(),
    moves: state.moveCount,
    elapsedSeconds: Math.floor(state.elapsedMs / 1000),
    escaped: state.won,
    won: state.won,
  };
}

function getAvailableMoves() {
  const current = state.maze[state.player.y][state.player.x];
  const options = [];

  Object.entries(DIRECTIONS).forEach(([direction, delta]) => {
    const nextX = state.player.x + delta.dx;
    const nextY = state.player.y + delta.dy;
    if (nextY < 0 || nextY >= state.size || nextX < 0 || nextX >= state.size) return;
    if (current.walls[delta.wallKey]) return;
    options.push(direction);
  });

  return {
    position: serializePosition(state.player),
    availableMoves: options,
  };
}

function getGameStatus() {
  return {
    status: getCurrentGameStatus(),
    moves: state.moveCount,
    elapsedSeconds: Math.floor(state.elapsedMs / 1000),
    elapsedMs: state.elapsedMs,
    player: serializePosition(state.player),
    exit: serializePosition(state.goal),
    escaped: state.won,
    won: state.won,
  };
}

function getMazeState() {
  return getMazeStateHandler();
}

function getPlayerStatePublic() {
  return getPlayerState();
}

function getAvailableMovesPublic() {
  return getAvailableMoves();
}

function restartGame() {
  resetGame();
  return {
    success: true,
    status: getCurrentGameStatus(),
    position: serializePosition(state.player),
    message: 'Game restarted.',
  };
}

function normalizeDirection(direction) {
  if (typeof direction !== 'string') return null;
  const norm = direction.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DIRECTIONS, norm) ? norm : null;
}

function movePlayerHandler(args = {}) {
  const direction = normalizeDirection(args.direction);
  if (!direction) {
    return {
      success: false,
      error: 'Invalid direction. Use up, down, left, or right.',
      direction: args.direction || null,
      position: serializePosition(state.player),
      status: getCurrentGameStatus(),
      message: 'Invalid direction. Use up, down, left, or right.',
    };
  }

  const result = attemptMove(direction);
  return {
    ...result,
    player: serializePosition(state.player),
    goal: serializePosition(state.goal),
    moves: state.moveCount,
    elapsedSeconds: Math.floor(state.elapsedMs / 1000),
    elapsedMs: state.elapsedMs,
    status: getCurrentGameStatus(),
    escaped: state.won,
  };
}

function newMazeHandler(args = {}) {
  const nextSize = clampSize(args.size ?? args.difficulty ?? difficultySelectEl.value);
  newMaze(nextSize);
  return getMazeStateHandler();
}

function resetGameHandler() {
  resetGame();
  return getMazeStateHandler();
}

function hintHandler() {
  return getHint();
}

function attemptMove(direction) {
  const status = getCurrentGameStatus();
  if (status === 'escaped' || state.lives === 0 || state.timeRemaining === 0) {
    return {
      success: false,
      moved: false,
      reachedGoal: false,
      direction,
      position: serializePosition(state.player),
      status: getCurrentGameStatus(),
      error: state.won ? 'Maze has already been solved.' : 'Game is over.',
      message: state.won ? 'Maze has already been solved.' : 'Game is over.',
    };
  }

  const current = state.maze[state.player.y][state.player.x];
  const delta = DIRECTIONS[direction];

  if (!delta) {
    return {
      success: false,
      moved: false,
      reachedGoal: false,
      direction,
      position: serializePosition(state.player),
      status: getCurrentGameStatus(),
      error: 'Invalid direction. Use up, down, left, or right.',
      message: 'Invalid direction. Use up, down, left, or right.',
    };
  }

  const nextX = state.player.x + delta.dx;
  const nextY = state.player.y + delta.dy;

  if (nextY < 0 || nextY >= state.size || nextX < 0 || nextX >= state.size) {
    return {
      success: false,
      moved: false,
      reachedGoal: false,
      direction,
      position: serializePosition(state.player),
      status: getCurrentGameStatus(),
      error: 'Movement blocked by the maze boundary.',
      message: 'Movement blocked by the maze boundary.',
    };
  }

  if (current.walls[delta.wallKey]) {
    playSound('penalty');
    return {
      success: false,
      moved: false,
      reachedGoal: false,
      direction,
      position: serializePosition(state.player),
      status: getCurrentGameStatus(),
      error: 'Movement blocked by a wall.',
      message: 'Movement blocked by a wall.',
    };
  }

  state.player = { x: nextX, y: nextY };
  state.moveCount += 1;
  state.score += 10;
  updateVisitedState();
  playSound('move');

  const reachedGoal = nextX === state.goal.x && nextY === state.goal.y;
  if (reachedGoal) {
    state.won = true;
    playSound('win');
    const timeBonus = Math.max(0, Math.floor((state.timeRemaining / state.timeLimit) * 100));
    const efficiencyBonus = Math.max(0, 500 - state.moveCount * 2);
    const totalBonus = timeBonus + efficiencyBonus;
    state.score += totalBonus;
    state.level += 1;
    saveHighScore(state.score);
  }

  renderBoard();
  updateHud();

  const nextStatus = getCurrentGameStatus();
  if (reachedGoal) {
    const escapedText = `Escaped with ${state.score} points! Hit New Maze to continue.`;
    setHintText(escapedText);
    setAgentLog('Maze escaped. Agent status: successful.');
    return {
      success: true,
      moved: true,
      reachedGoal: true,
      direction,
      position: serializePosition(state.player),
      status: nextStatus,
      message: 'Player reached the exit.',
      escaped: true,
      moves: state.moveCount,
    };
  }

  const message = `Player moved ${direction}.`;
  setHintText(message);
  return {
    success: true,
    moved: true,
    reachedGoal: false,
    direction,
    position: serializePosition(state.player),
    status: nextStatus,
    message,
    escaped: false,
    moves: state.moveCount,
  };
}

function findPath(start = { x: state.player.x, y: state.player.y }, goal = state.goal) {
  const queue = [{ x: start.x, y: start.y }];
  const visitedNodes = new Set([cellKey(start.x, start.y)]);
  const previous = new Map();

  while (queue.length) {
    const current = queue.shift();
    if (current.x === goal.x && current.y === goal.y) {
      const path = [];
      let cursor = current;
      while (cursor) {
        path.unshift({ x: cursor.x, y: cursor.y });
        cursor = previous.get(cellKey(cursor.x, cursor.y)) || null;
      }
      return path;
    }

    for (const [directionName, delta] of Object.entries(DIRECTIONS)) {
      const nextX = current.x + delta.dx;
      const nextY = current.y + delta.dy;
      const nextKey = cellKey(nextX, nextY);

      if (nextY < 0 || nextY >= state.size || nextX < 0 || nextX >= state.size) {
        continue;
      }

      const cell = state.maze[current.y][current.x];
      if (cell.walls[delta.wallKey]) {
        continue;
      }

      if (visitedNodes.has(nextKey)) {
        continue;
      }

      visitedNodes.add(nextKey);
      previous.set(nextKey, { x: current.x, y: current.y });
      queue.push({ x: nextX, y: nextY });
    }
  }

  return [];
}

function findSolution() {
  const pathCells = findPath();
  if (!pathCells.length) {
    return {
      solvable: false,
      path: [],
      steps: 0,
      message: 'No route to the exit was found.',
    };
  }

  if (pathCells.length === 1) {
    return {
      solvable: true,
      path: [],
      steps: 0,
      message: 'The player is already at the exit.',
    };
  }

  const directions = [];
  for (let i = 1; i < pathCells.length; i += 1) {
    const prev = pathCells[i - 1];
    const current = pathCells[i];
    const deltaX = current.x - prev.x;
    const deltaY = current.y - prev.y;
    const direction = Object.entries(DIRECTIONS).find(([, value]) => value.dx === deltaX && value.dy === deltaY)?.[0];
    if (direction) {
      directions.push(direction);
    }
  }

  return {
    solvable: true,
    path: directions,
    steps: directions.length,
    message: `Route found with ${directions.length} step(s).`,
  };
}

function executeSolution(path) {
  const moves = Array.isArray(path) ? path : [];
  const results = [];

  for (const direction of moves) {
    const result = attemptMove(normalizeDirection(direction));
    results.push(result);
    if (!result.success) {
      break;
    }
  }

  return {
    success: results.every((entry) => entry.success),
    results,
    path: moves,
    status: getCurrentGameStatus(),
  };
}

function getHint() {
  const path = findPath();
  if (!path.length) {
    const fallback = 'No clear route is available yet. Try exploring a new branch.';
    setHintText(fallback);
    return { found: false, message: fallback, path: [] };
  }

  if (path.length === 1) {
    const message = 'You are already at the exit.';
    setHintText(message);
    return { found: true, message, path: path.map((p) => ({ x: p.x, y: p.y })) };
  }

  const firstStep = path[1];
  const deltaX = firstStep.x - state.player.x;
  const deltaY = firstStep.y - state.player.y;
  const direction = Object.entries(DIRECTIONS).find(([, value]) => value.dx === deltaX && value.dy === deltaY)?.[0];
  const message = direction ? `Hint: move ${direction} toward the exit.` : 'Hint: keep moving toward the goal.';
  setHintText(message);
  state.lastHint = message;

  return {
    found: true,
    message,
    direction,
    nextStep: firstStep,
    path: path.map((p) => ({ x: p.x, y: p.y })),
  };
}

function resetGame() {
  state.player = { x: state.start.x, y: state.start.y };
  state.moveCount = 0;
  state.won = false;
  state.lives = state.maxLives;
  state.visited = new Set([cellKey(state.start.x, state.start.y)]);
  state.startedAt = performance.now();
  state.elapsedMs = 0;
  state.timeRemaining = state.timeLimit;
  state.status = 'playing';
  setHintText('The maze was reset. Find the glowing exit again.');
  setAgentLog('Game restarted. The maze has been reset to its start position.');
  renderBoard();
  updateHud();
}

function saveHighScore(score) {
  const highScores = JSON.parse(localStorage.getItem('mazeHighScores') || '[]');
  highScores.push({ score, date: new Date().toISOString(), level: state.level });
  highScores.sort((a, b) => b.score - a.score);
  localStorage.setItem('mazeHighScores', JSON.stringify(highScores.slice(0, 10)));
}

function getHighScores() {
  return JSON.parse(localStorage.getItem('mazeHighScores') || '[]');
}

function displayHighScores() {
  const scores = getHighScores();
  if (scores.length === 0) {
    console.log('No high scores yet!');
    return;
  }
  console.log('High Scores:');
  scores.forEach((entry, i) => {
    console.log(`${i + 1}. ${entry.score} (Level ${entry.level})`);
  });
}

function newMaze(sizeValue) {
  const selectedSize = clampSize(sizeValue ?? difficultySelectEl.value);
  if (difficultySelectEl) difficultySelectEl.value = String(selectedSize);
  generateMaze(selectedSize);
}

function tick(now) {
  if (!state.won && state.lives > 0) {
    state.elapsedMs = now - state.startedAt;
    state.timeRemaining = Math.max(0, state.timeLimit - state.elapsedMs);

    if (state.timeRemaining === 0 && !state.won) {
      state.lives = 0;
      state.status = 'time-up';
      playSound('penalty');
      setAgentLog('Time expired. The maze is no longer playable.');
    }

    updateHud();
  }
  requestAnimationFrame(tick);
}

function updateWebMCPStatus() {
  const api = document.modelContext;
  const available = Boolean(api);

  window.__mazeWebMCPStatus = {
    available,
    apiName: available ? 'document.modelContext' : 'Unavailable',
  };

  if (webmcpStatusEl) {
    const statusText = available ? '● Ready' : '● Not Available';
    webmcpStatusEl.textContent = statusText;
    webmcpStatusEl.classList.toggle('online', available);
    webmcpStatusEl.classList.toggle('offline', !available);
  }

  if (webmcpStateEl) {
    webmcpStateEl.textContent = available ? 'Connected' : 'Unavailable';
  }

  if (webmcpToolsEl) {
    const tools = window.__mazeWebMCPTools || [];
    webmcpToolsEl.innerHTML = '';
    tools.forEach((name) => {
      const item = document.createElement('li');
      item.textContent = `✓ ${name}`;
      webmcpToolsEl.appendChild(item);
    });
  }
}

async function registerWebMCPTool(toolName, description, inputSchema, handler) {
  const api = document.modelContext;

  if (!api || typeof api.registerTool !== 'function' || typeof handler !== 'function') {
    return false;
  }

  try {
    await api.registerTool({
      name: toolName,
      description,
      inputSchema,
      execute: async (input = {}) => {
        return await handler(input);
      },
    });

    console.log(`[WebMCP] Registered tool: ${toolName}`);
    return true;
  } catch (error) {
    console.error(`[WebMCP] Failed to register ${toolName}:`, error);
    return false;
  }
}

async function registerWebMCPTools() {
  const api = document.modelContext;
  if (!api || typeof api.registerTool !== 'function') {
    window.__mazeWebMCPTools = [];
    updateWebMCPStatus();
    return;
  }

  const toolBase = {
    type: 'object',
    properties: {},
    additionalProperties: false,
  };

  const mazeStateOutput = {
    type: 'object',
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
      player: { type: 'object', properties: { row: { type: 'number' }, col: { type: 'number' } } },
      exit: { type: 'object', properties: { row: { type: 'number' }, col: { type: 'number' } } },
      start: { type: 'object', properties: { row: { type: 'number' }, col: { type: 'number' } } },
      status: { type: 'string' },
      moves: { type: 'number' },
      elapsedSeconds: { type: 'number' },
      visited: { type: 'array', items: { type: 'string' } },
      size: { type: 'number' },
    },
    required: ['width', 'height', 'player', 'exit', 'status', 'moves', 'elapsedSeconds'],
    additionalProperties: false,
  };

  const playerStateOutput = {
    type: 'object',
    properties: {
      position: { type: 'object', properties: { row: { type: 'number' }, col: { type: 'number' } } },
      status: { type: 'string' },
      moves: { type: 'number' },
      elapsedSeconds: { type: 'number' },
      escaped: { type: 'boolean' },
    },
    required: ['position', 'status', 'moves', 'elapsedSeconds'],
    additionalProperties: false,
  };

  const availableMovesOutput = {
    type: 'object',
    properties: {
      position: { type: 'object', properties: { row: { type: 'number' }, col: { type: 'number' } } },
      availableMoves: { type: 'array', items: { type: 'string' } },
    },
    required: ['position', 'availableMoves'],
    additionalProperties: false,
  };

  const moveOutput = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      moved: { type: 'boolean' },
      reachedGoal: { type: 'boolean' },
      direction: { type: 'string' },
      position: { type: 'object', properties: { row: { type: 'number' }, col: { type: 'number' } } },
      status: { type: 'string' },
      message: { type: 'string' },
      error: { type: 'string' },
    },
    required: ['success', 'moved', 'direction', 'position', 'status'],
    additionalProperties: false,
  };

  const gameStatusOutput = {
    type: 'object',
    properties: {
      status: { type: 'string' },
      moves: { type: 'number' },
      elapsedSeconds: { type: 'number' },
      player: { type: 'object', properties: { row: { type: 'number' }, col: { type: 'number' } } },
      exit: { type: 'object', properties: { row: { type: 'number' }, col: { type: 'number' } } },
      escaped: { type: 'boolean' },
    },
    required: ['status', 'moves', 'elapsedSeconds', 'player', 'exit'],
    additionalProperties: false,
  };

  const solveOutput = {
    type: 'object',
    properties: {
      solvable: { type: 'boolean' },
      path: { type: 'array', items: { type: 'string' } },
      steps: { type: 'number' },
      message: { type: 'string' },
    },
    required: ['solvable', 'path', 'steps'],
    additionalProperties: false,
  };

  const tools = [
    {
      name: 'get_maze_state',
      description: 'Return the current maze dimensions, player location, exit, visited cells, status, and move metadata.',
      inputSchema: { ...toolBase },
      outputSchema: mazeStateOutput,
      handler: getMazeStateHandler,
    },
    {
      name: 'get_player_state',
      description: 'Return the current player position, game status, move count, elapsed time, and whether the player escaped.',
      inputSchema: { ...toolBase },
      outputSchema: playerStateOutput,
      handler: getPlayerState,
    },
    {
      name: 'get_available_moves',
      description: 'List the legal moves from the current player position without walking through doors or walls.',
      inputSchema: { ...toolBase },
      outputSchema: availableMovesOutput,
      handler: getAvailableMoves,
    },
    {
      name: 'move_player',
      description: 'Move the player one cell in a valid direction: up, down, left, or right.',
      inputSchema: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Move direction.' },
        },
        required: ['direction'],
        additionalProperties: false,
      },
      outputSchema: moveOutput,
      handler: movePlayerHandler,
    },
    {
      name: 'restart_game',
      description: 'Reset the current maze to its starting position using the game’s existing restart flow.',
      inputSchema: { ...toolBase },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          status: { type: 'string' },
          position: { type: 'object', properties: { row: { type: 'number' }, col: { type: 'number' } } },
          message: { type: 'string' },
        },
        required: ['success', 'status', 'position'],
        additionalProperties: false,
      },
      handler: () => {
        resetGame();
        return {
          success: true,
          status: getCurrentGameStatus(),
          position: serializePosition(state.player),
          message: 'Game restarted.',
        };
      },
    },
    {
      name: 'get_game_status',
      description: 'Return the current game status, move count, elapsed time, and relevant player and exit positions.',
      inputSchema: { ...toolBase },
      outputSchema: gameStatusOutput,
      handler: getGameStatus,
    },
    {
      name: 'find_solution',
      description: 'Compute a valid route from the current player position to the exit using BFS on the maze grid.',
      inputSchema: { ...toolBase },
      outputSchema: solveOutput,
      handler: findSolution,
    },
  ];

  const registeredTools = [];

  for (const { name, description, inputSchema, handler } of tools) {
    const registered = await registerWebMCPTool(
      name,
      description,
      inputSchema,
      handler
    );

    if (registered) {
      registeredTools.push(name);
    }
  }

  window.__mazeWebMCPTools = registeredTools;
  updateWebMCPStatus();
}

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const map = {
    arrowup: 'up',
    w: 'up',
    arrowdown: 'down',
    s: 'down',
    arrowleft: 'left',
    a: 'left',
    arrowright: 'right',
    d: 'right',
  };

  if (map[key]) {
    event.preventDefault();
    attemptMove(map[key]);
  }
});

newMazeBtn?.addEventListener('click', () => newMaze(difficultySelectEl.value));
resetBtn?.addEventListener('click', resetGame);
hintBtn?.addEventListener('click', getHint);
difficultySelectEl?.addEventListener('change', () => newMaze(difficultySelectEl.value));
startGameBtn?.addEventListener('click', startGame);

document.querySelectorAll('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => attemptMove(button.dataset.direction));
});

window.gameAPI = {
  getMazeState,
  getPlayerState: getPlayerStatePublic,
  getAvailableMoves: getAvailableMovesPublic,
  movePlayer: movePlayerHandler,
  restartGame,
  getGameStatus,
  findSolution,
  executeSolution,
  newMaze,
  getHint,
  resetGame,
};

window.getMazeState = getMazeState;
window.getPlayerState = getPlayerStatePublic;
window.getAvailableMoves = getAvailableMovesPublic;
window.getGameStatus = getGameStatus;
window.restartGame = restartGame;
window.findSolution = findSolution;
window.executeSolution = executeSolution;
window.getAvailableMoves = getAvailableMovesPublic;

window.__mazeWebMCPStatus = { available: false, apiName: 'Unavailable' };
window.__mazeWebMCPTools = [];

registerWebMCPTools();
newMaze(DEFAULT_SIZE);
requestAnimationFrame(tick);
