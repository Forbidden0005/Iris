# Examples

This guide provides practical examples of how to use `iris-cli` for common development workflows.

## 1. Chat and Auto-Routing

Use the `chat` command to let the Orchestrator automatically decide the best agent for your request.

```bash
# General question (routes to iris-main)
iris chat "How do I set up a new React project?"

# Code generation request (routes to iris-coder)
iris chat "Create a simple Express.js server with a health check endpoint."

# Specialist request (routes to iris-fixer)
iris chat "Ask the fixer to resolve the unhandled promise rejection in src/api.ts"
```

## 2. Using the Sandbox

The Sandbox allows you to queue changes, preview them, and then safely apply them.

```bash
# Dispatch a coding task
iris chat "Update the README to include a new section on Docker"

# The agent's changes are added to the sandbox. Preview them:
iris preview

# If everything looks good, apply the changes to the filesystem
iris apply
```

## 3. Branching Workflows

Explore multiple alternative implementations safely using named sandbox branches.

```bash
# Create a new branch for an experimental feature
iris branch explore-websockets

# Dispatch task
iris chat "Implement a basic WebSocket server"

# Create a second branch to try a different approach
iris branch explore-socketio main

# Dispatch alternative task
iris chat "Implement a basic Socket.IO server"

# Compare the current branch with main

## 4. Hello Command

A simple command that prints "hello" to stdout. Useful for smoke tests and verifying CLI installation.

```bash
iris hello
```

## 4. Hello Command

Use the `hello` command to quickly verify the CLI is working.

```bash
npx iris-cli hello
```
ain
iris preview

# If you like the Socket.IO approach, switch and merge it
iris switch main
iris merge explore-socketio
iris apply
```

## 4. Automated Testing / Debugging

Ensure code quality by running tests automatically after applying changes.

```bash
# Dispatch a code change
iris chat "Refactor the authentication logic"

# Apply changes and run tests immediately
iris apply --check "npm test"

# If tests fail, you can easily roll back
iris rollback
```

## 5. Finding Local Tokens

Save API costs by using `iris auth` to discover existing local session tokens (like Claude Code or Cursor).

```bash
iris auth
# Output:
# --- Local Tokens Found ---
# ✓ Claude Code session found
# ✓ Gemini ADC credentials found
```

## 6. Planning Workflow

Use the `plan` command for complex features. It breaks the task into steps and lets you execute them sequentially.

```bash
iris plan "Build a complete CRUD API for a blog application with user authentication"
```
