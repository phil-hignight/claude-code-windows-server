const WebSocket = require('ws');
const { v4: uuidv4 } = require('crypto').webcrypto ? require('crypto') : { v4: () => Math.random().toString(36) };
const { ProtocolHandler, MessageType } = require('./protocol');
const { ToolOverrides } = require('./toolOverrides');
const { ClaudeCodeRunner } = require('./claudeRunner');

class WindowsServer {
  constructor(options) {
    this.port = options.port;
    this.host = options.host;
    this.apiKey = options.apiKey;
    this.wss = null;
    this.client = null;
    this.windowsCwd = null;
    this.pendingCommands = new Map();
    this.toolOverrides = new ToolOverrides(this);
    this.claudeRunner = new ClaudeCodeRunner(this);
  }

  async start() {
    this.wss = new WebSocket.Server({ 
      port: this.port, 
      host: this.host 
    });

    console.log(`Server listening on ${this.host}:${this.port}`);

    this.wss.on('connection', (ws) => {
      console.log('Client connected');
      
      ws.on('message', async (data) => {
        await this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        if (this.client === ws) {
          this.client = null;
          this.windowsCwd = null;
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    return new Promise((resolve) => {
      this.wss.on('listening', resolve);
    });
  }

  stop() {
    if (this.claudeRunner) {
      this.claudeRunner.stop();
    }
    if (this.wss) {
      this.wss.close();
    }
  }

  async handleMessage(ws, data) {
    try {
      const message = ProtocolHandler.parseMessage(data.toString());
      
      switch (message.type) {
        case MessageType.AUTH:
          await this.handleAuth(ws, message);
          break;
        case MessageType.COMMAND_RESULT:
          this.handleCommandResult(message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(ProtocolHandler.serializeMessage(
        ProtocolHandler.createErrorMessage('Invalid message format')
      ));
    }
  }

  async handleAuth(ws, message) {
    if (message.apiKey !== this.apiKey) {
      console.log('Authentication failed');
      ws.send(ProtocolHandler.serializeMessage(
        ProtocolHandler.createErrorMessage('Authentication failed')
      ));
      ws.close();
      return;
    }

    console.log('Client authenticated successfully');
    console.log('Windows CWD:', message.cwd);
    
    this.client = ws;
    this.windowsCwd = message.cwd;
    
    // Start Claude Code with overrides
    await this.startClaudeCode();
  }

  handleCommandResult(message) {
    const pendingCommand = this.pendingCommands.get(message.requestId);
    if (pendingCommand) {
      this.pendingCommands.delete(message.requestId);
      
      if (message.success) {
        pendingCommand.resolve({
          stdout: message.stdout,
          stderr: message.stderr,
          exitCode: message.exitCode
        });
      } else {
        pendingCommand.reject(new Error(message.stderr || 'Command failed'));
      }
    }
  }

  async executeCommand(command) {
    if (!this.client) {
      throw new Error('No Windows client connected');
    }

    const requestId = uuidv4();
    const executeMessage = ProtocolHandler.createExecuteMessage(requestId, command);

    return new Promise((resolve, reject) => {
      this.pendingCommands.set(requestId, { resolve, reject });
      
      this.client.send(ProtocolHandler.serializeMessage(executeMessage));
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingCommands.has(requestId)) {
          this.pendingCommands.delete(requestId);
          reject(new Error('Command timeout'));
        }
      }, 30000);
    });
  }

  async startClaudeCode() {
    console.log('Starting Claude Code with Windows overrides...');
    
    try {
      // Apply overrides first
      this.toolOverrides.apply();
      
      // Start Claude Code
      await this.claudeRunner.start();
      
      console.log('Claude Code started successfully with Windows integration');
    } catch (error) {
      console.error('Failed to start Claude Code:', error);
      
      // If Claude Code fails to start, we can still keep the server running
      // for potential retry or manual intervention
      console.log('Server will continue running. You can try connecting a new client or restart.');
    }
  }
}

module.exports = { WindowsServer };