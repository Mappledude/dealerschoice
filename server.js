const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

// 1. Allow Vercel to connect
app.use(cors({
  origin: ["https://dealerschoice.vercel.app", "http://localhost:3000"]
}));

const server = http.createServer(app);

// 2. Setup Socket.io with the correct handshake
const io = new Server(server, {
  cors: {
    origin: ["https://dealerschoice.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

// 3. Simple health check route
app.get('/', (req, res) => {
  res.send('Poker Server is Running');
});

// --- POKER ENGINE LOGIC ---
// (The server logic for dealing and players goes here)
// Make sure you don't have another "const io =" below this!

// 4. Start the server (Only ONE listen command at the very end)
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is live on port ${PORT}`);
});
