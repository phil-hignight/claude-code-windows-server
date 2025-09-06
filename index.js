#!/usr/bin/env node

const { program } = require('commander');
const { WindowsServer } = require('./lib/server');

program
  .option('-p, --port <port>', 'server port', '8080')
  .option('-k, --api-key <key>', 'API key for client authentication', 'default-key')
  .option('-h, --host <host>', 'server host', '0.0.0.0')
  .parse();

const options = program.opts();

console.log('Starting Claude Code Windows Server...');
console.log(`Port: ${options.port}`);
console.log(`Host: ${options.host}`);
console.log(`API Key: ${options.apiKey.substring(0, 8)}...`);

const server = new WindowsServer({
  port: parseInt(options.port),
  host: options.host,
  apiKey: options.apiKey
});

server.start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.stop();
  process.exit(0);
});