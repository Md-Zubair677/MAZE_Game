import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import agent from './netlify/functions/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 8000);
const MY_AWS_REGION = process.env.MY_AWS_REGION || 'us-east-1';
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-haiku-4-5-20251001-v1:0';

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: MODEL_ID, region: MY_AWS_REGION });
});

app.post('/api/agent', async (req, res) => {
  const response = await agent(new Request(`http://localhost:${PORT}/api/agent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req.body),
  }));

  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.send(await response.text());
});

app.listen(PORT, () => {
  console.log(`Maze Escape running at http://localhost:${PORT}`);
});
