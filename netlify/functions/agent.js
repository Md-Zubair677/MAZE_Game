import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-haiku-4-5-20251001-v1:0';

const credentials =
  process.env.MY_AWS_ACCESS_KEY_ID &&
  process.env.MY_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
        ...(process.env.MY_AWS_SESSION_TOKEN
          ? { sessionToken: process.env.MY_AWS_SESSION_TOKEN }
          : {}),
      }
    : undefined;

const client = new BedrockRuntimeClient({
  region: process.env.MY_AWS_REGION || 'us-east-1',
  credentials,
});

const emptyInput = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

const tools = [
  {
    toolSpec: {
      name: 'get_maze_state',
      description: 'Return the current maze dimensions, maze walls, player position, exit, visited cells, status, and move metadata.',
      inputSchema: { json: emptyInput },
    },
  },
  {
    toolSpec: {
      name: 'get_player_state',
      description: 'Return the current player position, game status, move count, elapsed time, and whether the player escaped.',
      inputSchema: { json: emptyInput },
    },
  },
  {
    toolSpec: {
      name: 'get_available_moves',
      description: 'List legal moves from the current player position without walking through walls.',
      inputSchema: { json: emptyInput },
    },
  },
  {
    toolSpec: {
      name: 'move_player',
      description: 'Move the player one cell. Direction must be up, down, left, or right.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
          },
          required: ['direction'],
          additionalProperties: false,
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'restart_game',
      description: 'Reset the current maze to its starting position.',
      inputSchema: { json: emptyInput },
    },
  },
  {
    toolSpec: {
      name: 'get_game_status',
      description: 'Return the current game status, moves, elapsed time, player position, exit position, and escaped state.',
      inputSchema: { json: emptyInput },
    },
  },
  {
    toolSpec: {
      name: 'find_solution',
      description: 'Compute a valid shortest route from the current player position to the exit using BFS. Returns a direction array.',
      inputSchema: { json: emptyInput },
    },
  },
  {
    toolSpec: {
      name: 'execute_solution',
      description: 'Execute a previously computed solution path on the live maze. Use this after find_solution when the user asks the agent to actually play the game.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            path: {
              type: 'array',
              items: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
            },
          },
          required: ['path'],
          additionalProperties: false,
        },
      },
    },
  },
];

const systemPrompt = `You are the Maze Escape AI agent. You control a real browser game through tools.

Rules:
- Use tools instead of guessing game state.
- If the user asks you to solve or play the maze, inspect the current state first.
- If the game is over, restart it before attempting to play.
- Use find_solution to obtain a valid shortest route.
- If the user asks you to actually play, call execute_solution with the returned path. Do not merely describe the path.
- After acting, call get_game_status to verify the result.
- Keep the final response concise and state whether the maze was escaped.
`;

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (!messages.length) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const command = new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: systemPrompt }],
      messages,
      toolConfig: { tools },
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.2,
      },
    });

    const t0 = Date.now();
    const response = await client.send(command);
    const latencyMs = Date.now() - t0;
    const usage = response.usage || {};
    console.log('[Bedrock]', {
      modelId: MODEL_ID,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      latencyMs,
    });
    const content = response?.output?.message?.content || [];

    return new Response(JSON.stringify({
      stopReason: response.stopReason,
      content,
      usage: response.usage || null,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('[Bedrock]', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
