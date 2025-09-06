# Claude Code Windows Server

A bridge server that enables Claude Code to work with Windows systems by proxying filesystem operations through WebSocket to a Windows client.

## Installation

```bash
npm install -g claude-code-windows-server
```

## Usage

Start the server on your Linux/macOS machine:

```bash
claude-code-windows-server --port 8080 --api-key your-secret-key
```

### Options

- `--port, -p <port>`: Server port (default: 8080)
- `--api-key, -k <key>`: API key for client authentication (default: 'default-key')
- `--host, -h <host>`: Server host (default: '0.0.0.0')

## How it works

1. The server starts a WebSocket server and waits for Windows client connection
2. Once connected and authenticated, it overrides Claude Code's filesystem tools
3. All filesystem operations are converted to PowerShell commands and sent to the Windows client
4. The Windows client executes PowerShell commands and returns results
5. Claude Code receives results as if it were running natively on Windows

## Architecture

The server intercepts:
- `fetch()` calls to Claude API to replace filesystem tools with PowerShell tool
- `child_process.spawn()` calls to redirect command execution to Windows client

## Security

- API key authentication required for client connections
- Command validation on Windows client side
- No direct filesystem access from server

## Requirements

- Node.js 16+
- WebSocket connectivity to Windows client
- Claude Code installation on the Linux/macOS machine