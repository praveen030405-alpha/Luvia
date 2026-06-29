require('dotenv').config();
const { spawn } = require('child_process');

console.log('Adding new MONGODB_URI...');
const add = spawn('npx.cmd', ['vercel', 'env', 'add', 'MONGODB_URI', 'production'], { stdio: ['pipe', 'inherit', 'inherit'], shell: true });
add.stdin.write(process.env.MONGODB_URI + '\n');
add.stdin.end();
