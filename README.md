# Maze Escape — WebMCP + Amazon Bedrock

A browser maze game with real WebMCP tools and an optional Amazon Bedrock AI agent.

The existing game state is shared with the WebMCP tool layer. The Bedrock bridge runs in a Netlify Serverless Function so AWS credentials never enter `app.js`.

## WebMCP tools

- `get_maze_state`
- `get_player_state`
- `get_available_moves`
- `move_player`
- `restart_game`
- `get_game_status`
- `find_solution`
- `execute_solution` (added for efficient agent execution)

The first seven tools are the tools you already tested in the WebMCP Inspector. The eighth tool executes a previously computed BFS path in one tool call, which avoids making the LLM reason about every individual move.

## 1. Install Node.js

Use Node.js 20+.

## 2. Configure AWS credentials

Do **not** put AWS credentials in the browser or in `app.js`.

For local development, the simplest option is the AWS CLI profile:

```bash
aws configure
```

Enter your AWS access key, secret key, default region (`us-east-1`) and output format when prompted.

Alternatively, copy `.env.example` to `.env` and fill the AWS variables. Never commit `.env`.

Your AWS identity needs permission to invoke the Bedrock model, such as `bedrock:InvokeModel` for the required model/inference profile.

## 3. Install dependencies

From this folder:

```bash
npm install
```

## 4. Start the game

```bash
npm start
```

Open:

```text
http://localhost:8000
```

The Node server serves the game and locally forwards `/api/agent` to the same function implementation used by Netlify.

## 5. Deploy to Netlify

This repository includes `netlify.toml`, which publishes the project root and rewrites `/api/agent` to `netlify/functions/agent.js`.

In the Netlify site settings, add these environment variables:

```text
MY_AWS_ACCESS_KEY_ID
MY_AWS_SECRET_ACCESS_KEY
AWS_REGION
BEDROCK_MODEL_ID
```

Use a least-privilege AWS identity with permission to invoke the selected Bedrock model. Do not commit credentials or deploy until the variables are configured.

## 6. Test Bedrock

Open the game and use the **Ask the AI agent** box.

Recommended demo prompt:

> Restart the Maze Escape game if it is not currently active. Get the current maze state, find the shortest valid solution, actually play the maze using the available tools, and verify the final game status.

The expected flow is:

```text
User
  ↓
Amazon Bedrock / Claude Haiku 4.5
  ↓
get_maze_state
  ↓
find_solution
  ↓
execute_solution
  ↓
get_game_status
  ↓
Maze escaped
```

## 7. WebMCP Inspector

Keep Chrome WebMCP testing enabled:

```text
chrome://flags/#enable-webmcp-testing
```

Then open the game in the supported Chrome build and open the WebMCP Model Context Tool Inspector. The registered tools should appear there.

## Security

- Never expose AWS secret keys in frontend JavaScript.
- Never commit `.env`.
- The Bedrock request is made by `netlify/functions/agent.js`.
- The browser only executes live game functions and sends their results back to the server-side agent loop.

## Notes

Amazon Bedrock's Converse API supports client-side tool use: the model requests a tool and the application executes it, then returns the tool result to the model. This project uses that pattern while keeping the actual maze state in the browser.
