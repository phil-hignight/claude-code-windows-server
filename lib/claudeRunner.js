const path = require('path');
const { spawn } = require('child_process');

class ClaudeCodeRunner {
  constructor(server) {
    this.server = server;
    this.claudeProcess = null;
  }

  async start() {
    console.log('Starting Claude Code...');
    
    try {
      // First try to import and use Claude Code as a module
      await this.startAsModule();
    } catch (error) {
      console.log('Failed to start as module, trying as CLI process:', error.message);
      // Fall back to spawning Claude Code as a process
      await this.startAsProcess();
    }
  }

  async startAsModule() {
    console.log('Starting Claude Code via dynamic import...');
    
    try {
      // Override process.argv to simulate CLI arguments
      const originalArgv = process.argv;
      const originalCwd = process.cwd();
      
      process.argv = [
        'node',
        'claude',
        // Add any default arguments here if needed
      ];

      // Change working directory to Windows CWD
      process.chdir(this.server.windowsCwd);
      
      try {
        // Dynamic import of Claude Code - this should start the CLI
        await import('@anthropic-ai/claude-code');
        
        console.log('Claude Code started successfully');
      } finally {
        // Restore original values
        process.argv = originalArgv;
        process.chdir(originalCwd);
      }
      
    } catch (error) {
      throw new Error(`Failed to import Claude Code: ${error.message}`);
    }
  }

  async startAsProcess() {
    return new Promise((resolve, reject) => {
      console.log('Starting Claude Code as subprocess...');
      
      // Try to spawn claude-code command
      this.claudeProcess = spawn('claude-code', [
        '--cwd', this.server.windowsCwd
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Pass through any needed environment variables
        }
      });

      this.claudeProcess.on('spawn', () => {
        console.log('Claude Code process started');
        resolve();
      });

      this.claudeProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error('claude-code command not found. Please ensure Claude Code is installed and in PATH.'));
        } else {
          reject(error);
        }
      });

      this.claudeProcess.on('exit', (code, signal) => {
        console.log(`Claude Code process exited with code ${code}, signal ${signal}`);
        this.claudeProcess = null;
      });

      // Pipe Claude Code output to console
      this.claudeProcess.stdout.on('data', (data) => {
        process.stdout.write(data);
      });

      this.claudeProcess.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      // Pipe stdin to Claude Code
      process.stdin.pipe(this.claudeProcess.stdin);
    });
  }

  stop() {
    if (this.claudeProcess) {
      console.log('Stopping Claude Code process...');
      this.claudeProcess.kill();
      this.claudeProcess = null;
    }
  }
}

module.exports = { ClaudeCodeRunner };