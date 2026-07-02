const cors = require('cors');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;
const users = new Map();
const messages = [];

app.use(cors());
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.post('/login', (request, response) => {
  const username = String(request.body?.username || '').trim();

  if (!username) {
    return response.status(400).json({ error: 'Username is required.' });
  }

  const user = {
    id: `user-${Date.now()}`,
    username,
  };

  users.set(user.id, user);

  return response.json({ user });
});

io.on('connection', (socket) => {
  socket.on('join', (user) => {
    if (!user?.id || !user?.username) {
      return;
    }

    users.set(user.id, user);
    socket.data.user = user;
    socket.emit('message:history', messages);
  });

  socket.on('message:send', (payload) => {
    const text = String(payload?.text || '').trim();
    const user = payload?.user;

    if (!text || !user?.id || !user?.username) {
      return;
    }

    const message = {
      id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      username: user.username,
      text,
      timestamp: new Date().toISOString(),
    };

    messages.push(message);
    io.emit('message:new', message);
  });
});

server.listen(PORT, () => {
  console.log(`Chat server listening on http://localhost:${PORT}`);
});