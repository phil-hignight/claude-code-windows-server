const originalFetch = global.fetch;
const originalRequire = require;

class ToolOverrides {
  constructor(server) {
    this.server = server;
    this.originalTools = null;
  }

  apply() {
    // Override fetch to intercept Claude Code API calls
    global.fetch = this.createFetchOverride();
    
    // Override require to intercept child_process
    const Module = require('module');
    const originalLoad = Module._load;
    
    Module._load = (request, parent) => {
      if (request === 'child_process') {
        return this.createChildProcessOverride();
      }
      return originalLoad.apply(Module, arguments);
    };

    console.log('Tool overrides applied');
  }

  createFetchOverride() {
    return async (url, options = {}) => {
      // Check if this is a Claude API call
      if (typeof url === 'string' && url.includes('anthropic.com')) {
        return this.interceptClaudeRequest(url, options);
      }
      
      // For non-Claude requests, use original fetch
      return originalFetch(url, options);
    };
  }

  async interceptClaudeRequest(url, options) {
    try {
      const requestData = JSON.parse(options.body);
      
      // Replace filesystem tools with PowerShell tool
      if (requestData.tools) {
        requestData.tools = this.replaceToolsWithPowerShell(requestData.tools);
      }

      // Update system message to include Windows CWD
      if (requestData.system && this.server.windowsCwd) {
        requestData.system = this.updateSystemMessage(requestData.system);
      }

      // Make the actual API call with modified request
      const modifiedOptions = {
        ...options,
        body: JSON.stringify(requestData)
      };

      return originalFetch(url, modifiedOptions);
    } catch (error) {
      console.error('Error intercepting Claude request:', error);
      return originalFetch(url, options);
    }
  }

  replaceToolsWithPowerShell(tools) {
    // Remove filesystem-related tools
    const excludeTools = ['Bash', 'Grep', 'Glob', 'LS'];
    let filteredTools = tools.filter(tool => !excludeTools.includes(tool.name));

    // Add PowerShell tool
    const powershellTool = {
      name: 'PowerShell',
      description: `Execute PowerShell commands on the Windows filesystem.

Working directory: ${this.server.windowsCwd}

Common operations:
- List files: Get-ChildItem (add -Force for hidden files, -Recurse for subdirectories)
- Read files: Get-Content "filename"
- Search in files: Select-String -Pattern "text" -Path "*.js" 
- Find files: Get-ChildItem -Recurse -Name "*.json"
- Create directories: New-Item -ItemType Directory -Name "foldername"
- Copy files: Copy-Item "source" "destination"
- Move files: Move-Item "source" "destination"  
- Delete files: Remove-Item "filename" (-Recurse for folders)
- Get current directory: Get-Location
- Change directory: Set-Location "path"
- Search text: Select-String -Pattern "searchterm" -Path "file.txt"
- Count lines: (Get-Content "file.txt").Length
- File info: Get-Item "filename" | Format-List`,

      input_schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'PowerShell command to execute'
          }
        },
        required: ['command']
      }
    };

    // Replace the PowerShell tool with one that has our custom handler
    const powershellToolWithHandler = {
      ...powershellTool,
      handler: async (params) => {
        return await this.server.executeCommand(params.command);
      }
    };

    filteredTools.push(powershellToolWithHandler);
    return filteredTools;
  }

  updateSystemMessage(systemMessage) {
    if (Array.isArray(systemMessage)) {
      // Find and update the system message that mentions working directory
      return systemMessage.map(msg => {
        if (typeof msg === 'object' && msg.text && msg.text.includes('Working directory:')) {
          return {
            ...msg,
            text: msg.text.replace(
              /Working directory: .*$/m,
              `Working directory: ${this.server.windowsCwd}`
            )
          };
        }
        return msg;
      });
    } else if (typeof systemMessage === 'string') {
      return systemMessage.replace(
        /Working directory: .*$/m,
        `Working directory: ${this.server.windowsCwd}`
      );
    }
    
    return systemMessage;
  }

  createChildProcessOverride() {
    const originalChildProcess = originalRequire('child_process');
    
    return {
      ...originalChildProcess,
      spawn: this.createSpawnOverride(),
      exec: this.createExecOverride(),
      execSync: this.createExecSyncOverride()
    };
  }

  createSpawnOverride() {
    return (command, args = [], options = {}) => {
      // Intercept PowerShell tool calls
      if (this.isPowerShellCommand(command, args)) {
        return this.handlePowerShellSpawn(command, args, options);
      }
      
      // For other commands, use original spawn
      const originalChildProcess = originalRequire('child_process');
      return originalChildProcess.spawn(command, args, options);
    };
  }

  createExecOverride() {
    return (command, options, callback) => {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }

      // For now, delegate to original exec
      const originalChildProcess = originalRequire('child_process');
      return originalChildProcess.exec(command, options, callback);
    };
  }

  createExecSyncOverride() {
    return (command, options = {}) => {
      // For now, delegate to original execSync
      const originalChildProcess = originalRequire('child_process');
      return originalChildProcess.execSync(command, options);
    };
  }

  isPowerShellCommand(command, args) {
    // This would need more sophisticated logic to detect PowerShell calls
    // For now, return false to avoid intercepting other processes
    return false;
  }

  async handlePowerShellSpawn(command, args, options) {
    // This would create a mock child process that forwards to Windows
    // Implementation would be complex - for now just log
    console.log('PowerShell spawn intercepted:', command, args);
    
    const originalChildProcess = originalRequire('child_process');
    return originalChildProcess.spawn(command, args, options);
  }
}

module.exports = { ToolOverrides };