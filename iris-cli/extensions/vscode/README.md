# iris VS Code Extension

Multi-agent AI coding assistant. Dispatch 20+ specialist agents directly from your editor.

## Features

- **Chat with Stinki**: Direct access to iris-lead (Stinki) in a VS Code panel
- **Agent Dispatch**: Send tasks to specialist agents (iris-coder, iris-qa, iris-security, etc.)
- **Real-time Communication**: WebSocket connection to iris runtime
- **Context-Aware**: Agents see your current file, selection, and workspace

## Prerequisites

iris must be running on your system:

```bash
# Install iris
git clone https://github.com/crewswarm/crewswarm
cd iris
npm install
bash install.sh

# Start services
npm run restart-all
```

## Installation

### From VSIX (Local Install)
```bash
cd iris-cli/extensions/vscode
npm install
npm run compile
vsce package
code --install-extension iris-0.1.0.vsix
```

### From Source (Development)
```bash
cd iris-cli/extensions/vscode
npm install
npm run compile
code --extensionDevelopmentPath=$(pwd)
```

## Usage

### Open Chat Panel
1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "iris: Open Chat"
3. Press Enter

OR use keybinding: `Cmd+Shift+C` / `Ctrl+Shift+C`

### Send a Message
Type in the chat input and press Enter. Stinki (iris-lead) will respond.

### Dispatch an Agent
```
dispatch iris-coder to refactor this function
```

Stinki routes the task to the appropriate agent.

## Configuration

Open VS Code Settings (`Cmd+,`) and search for "iris":

- **API URL**: Base URL for iris API (default: `http://127.0.0.1:5010/v1`)
- **Theme**: Chat panel theme (dark or light)

## Troubleshooting

**"Failed to connect to iris"**
- Check if iris-lead is running: `curl http://127.0.0.1:5010/health`
- If not: `cd ~/iris && npm run restart-all`

**"Extension failed to activate"**
- Recompile: `npm run compile`
- Check for errors in Output panel (View → Output → Extension Host)

**Webview is blank**
- Open Developer Tools: `Cmd+Shift+P` → "Developer: Toggle Developer Tools"
- Check Console for JavaScript errors

## Development

### Project Structure
```
vscode/
├── package.json          Extension manifest
├── tsconfig.json         TypeScript config
├── src/
│   ├── extension.ts      Entry point
│   ├── api-client.ts     iris API wrapper
│   ├── diff-handler.ts   Code diff parsing
│   └── webview/
│       ├── chat.html     Chat UI
│       ├── chat.js       Frontend logic
│       └── styles.css    Styling
└── out/                  Compiled JavaScript
```

### Build
```bash
npm run compile
```

### Watch Mode
```bash
npm run watch
```

### Package
```bash
npm install -g @vscode/vsce
vsce package
```

### Publish
```bash
vsce publish
```

## Roadmap

- [ ] Custom Activity Bar icon with agent status
- [ ] Inline code suggestions from agents
- [ ] Task panel showing active/completed agent work
- [ ] Context menu: "Dispatch to iris"
- [ ] Agent selection dropdown
- [ ] Real-time task progress indicators
- [ ] Multi-file diff preview
- [ ] Agent memory viewer
- [ ] Full iris color theme

## License

MIT

## Links

- [iris GitHub](https://github.com/crewswarm/crewswarm)
- [Documentation](https://iris.com/docs)
- [Report Issues](https://github.com/crewswarm/crewswarm/issues)
