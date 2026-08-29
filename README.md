# 🎮 Maze Escape — AI-Powered WebMCP Game

Maze Escape is an interactive browser game where you can navigate through a maze and reach the exit.

What makes this project different is that an **AI agent can also play the game**.

The project uses **WebMCP** to allow an AI agent to interact with the game's features, while **Amazon Bedrock** provides the AI's reasoning.

🌐 **Live Demo:** https://maze-gameai.netlify.app/

---

## 💡 What Is This Project?

Maze Escape is more than a normal maze game.

A user can play the maze manually, but a compatible AI agent can also:

1. See the current maze.
2. Find the player's current position.
3. Check which directions are available.
4. Find a shortest path to the exit.
5. Move the player through the maze.
6. Check whether the maze has been successfully completed.

In simple terms:

> **You ask the AI to solve the maze, and the AI can actually interact with the game to solve it.**

The AI does not just tell you which moves to make.  
It can use the game's tools to perform the actions and verify the result.

---

## 🎯 Project Goal

The goal of this project is to demonstrate how an **AI agent can interact with a real website and perform actions**, rather than only generating text.

The project combines:

- 🎮 Interactive browser game
- 🤖 AI agent
- 🌐 WebMCP
- 🧠 Amazon Bedrock
- 🧩 BFS shortest-path algorithm

---

## 🤖 How Does the AI Solve the Maze?

When the user asks the AI to solve the maze, the AI follows this process:

```text
User asks AI to solve the maze
            ↓
     AI checks the maze
            ↓
   AI checks player position
            ↓
   Finds the shortest path
            ↓
    Executes the movements
            ↓
   Checks the game status
            ↓
      Maze Escaped 🎉
