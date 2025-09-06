class MessageType {
  static AUTH = 'auth';
  static COMMAND_RESULT = 'command_result';
  static EXECUTE = 'execute';
  static ERROR = 'error';
}

class ProtocolHandler {
  static createAuthMessage(apiKey, cwd) {
    return {
      type: MessageType.AUTH,
      apiKey,
      cwd
    };
  }

  static createExecuteMessage(requestId, command) {
    return {
      type: MessageType.EXECUTE,
      requestId,
      command
    };
  }

  static createCommandResultMessage(requestId, success, stdout, stderr, exitCode) {
    return {
      type: MessageType.COMMAND_RESULT,
      requestId,
      success,
      stdout,
      stderr,
      exitCode
    };
  }

  static createErrorMessage(message, details = null) {
    return {
      type: MessageType.ERROR,
      message,
      details
    };
  }

  static parseMessage(data) {
    try {
      const message = JSON.parse(data);
      if (!message.type) {
        throw new Error('Message missing type field');
      }
      return message;
    } catch (error) {
      throw new Error(`Invalid message format: ${error.message}`);
    }
  }

  static serializeMessage(message) {
    return JSON.stringify(message);
  }
}

module.exports = {
  MessageType,
  ProtocolHandler
};