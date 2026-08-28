import fs from 'node:fs';
import vm from 'node:vm';

function createMockElement() {
  return {
    style: {},
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    dataset: {},
    children: [],
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    appendChild() {},
    replaceChildren() {},
    setAttribute() {},
    focus() {},
    addEventListener() {},
  };
}

const mockIds = [
  'mazeBoard',
  'startScreen',
  'startGameBtn',
  'timerValue',
  'movesValue',
  'statusValue',
  'hintText',
  'difficultySelect',
  'newMazeBtn',
  'resetBtn',
  'hintBtn',
  'livesValue',
  'scoreValue',
  'levelValue',
  'timeLimit',
  'webmcpStatus',
  'webmcpState',
  'webmcpTools',
  'agentLog',
  'agentPrompt',
  'agentRunBtn',
  'agentClearBtn',
];

const elements = Object.fromEntries(mockIds.map((id) => [id, createMockElement()]));

const document = {
  body: createMockElement(),
  modelContext: undefined,
  getElementById(id) {
    if (!Object.prototype.hasOwnProperty.call(elements, id)) {
      elements[id] = createMockElement();
    }
    return elements[id];
  },
  querySelectorAll() {
    return [];
  },
  createElement() {
    return createMockElement();
  },
  addEventListener() {},
};

const localStorage = {
  store: {},
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
};

const context = {
  console,
  document,
  window: null,
  localStorage,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout,
  clearTimeout,
  AudioContext: undefined,
  webkitAudioContext: undefined,
};

context.window = context;
globalThis.window = context.window;

vm.createContext(context);

const source = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
vm.runInContext(source, context, { filename: 'app.js' });

const state = context.window.state;
state.size = 3;
state.maze = Array.from({ length: 3 }, (_, y) =>
  Array.from({ length: 3 }, (_, x) => ({
    x,
    y,
    walls: {
      n: true,
      e: true,
      s: true,
      w: true,
    },
  }))
);
state.start = { x: 0, y: 0 };
state.player = { x: 0, y: 0 };
state.goal = { x: 2, y: 2 };
state.moveCount = 0;
state.elapsedMs = 0;
state.won = false;
state.lives = 3;
state.status = 'playing';
state.visited = new Set(['0,0']);
state.startedAt = Date.now();
state.timeLimit = 10000;
state.timeRemaining = 10000;

// Build an open corridor for the real path: (0,0) -> (1,0) -> (2,0) -> (2,1) -> (2,2)
state.maze[0][0].walls.e = false;
state.maze[0][1].walls.w = false;

state.maze[0][1].walls.e = false;
state.maze[0][2].walls.w = false;

state.maze[0][2].walls.s = false;
state.maze[1][2].walls.n = false;

state.maze[1][2].walls.s = false;
state.maze[2][2].walls.n = false;

// Keep remaining walls closed so the path stays valid and deterministic.

const path = ['right', 'right', 'down', 'down'];
const startedAt = Date.now();
const result = await context.window.executeSolution(path);
const elapsedMs = Date.now() - startedAt;

console.log(JSON.stringify({
  elapsedMs,
  movesExecuted: result.results.length,
  finalPlayerPosition: result.finalPlayerPosition,
  success: result.success,
  escaped: result.escaped,
  won: result.won,
  status: result.status,
  path,
}, null, 2));

if (result.results.length !== 4) {
  throw new Error(`Expected 4 moves, received ${result.results.length}`);
}

if (result.finalPlayerPosition.row !== 2 || result.finalPlayerPosition.col !== 2) {
  throw new Error(
    `Expected final player position (2,2), received ${JSON.stringify(result.finalPlayerPosition)}`
  );
}

if (!result.escaped || !result.won) {
  throw new Error(`Expected escaped/won to be true. Received escaped=${result.escaped}, won=${result.won}`);
}

if (result.status !== 'escaped') {
  throw new Error(`Expected status to be "escaped", received ${JSON.stringify(result.status)}`);
}

if (elapsedMs < 1000) {
  throw new Error(`Expected sequential move delay near 400ms per step, measured ${elapsedMs}ms for 4 moves`);
}

console.log('executeSolution sequential execution test passed.');
