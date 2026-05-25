const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

/* =========================
   ENV CONFIG
========================= */

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

/* =========================
   MIDDLEWARE
========================= */

app.use(
  cors({
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  })
);

app.use(express.json({ limit: "25mb" }));

/* =========================
   REACT BUILD SERVE
   client/dist-ийг server өөрөө website болгож өгнө
========================= */

const clientBuildPath = path.join(__dirname, "../client/dist");
app.use(express.static(clientBuildPath));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

/* =========================
   ACCOUNT STORAGE
========================= */

const USERS_FILE = path.join(__dirname, "users.json");

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
    }

    const raw = fs.readFileSync(USERS_FILE, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("Users load error:", err);
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt) {
  return crypto
    .createHash("sha256")
    .update(`${password}:${salt}`)
    .digest("hex");
}

function createUser(username, password) {
  const users = loadUsers();

  const cleanUsername = String(username || "").trim();
  const cleanPassword = String(password || "").trim();

  if (!cleanUsername || !cleanPassword) {
    return {
      ok: false,
      message: "Username болон password оруулна уу.",
    };
  }

  if (cleanUsername.length < 3) {
    return {
      ok: false,
      message: "Username хамгийн багадаа 3 тэмдэгт байх ёстой.",
    };
  }

  if (cleanPassword.length < 4) {
    return {
      ok: false,
      message: "Password хамгийн багадаа 4 тэмдэгт байх ёстой.",
    };
  }

  const exists = users.some(
    (user) => user.username.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (exists) {
    return {
      ok: false,
      message: "Энэ username бүртгэлтэй байна.",
    };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(cleanPassword, salt);

  const newUser = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    username: cleanUsername,
    salt,
    passwordHash,
    recentChats: [],
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  return {
    ok: true,
    user: {
      id: newUser.id,
      username: newUser.username,
    },
  };
}

function loginUser(username, password) {
  const users = loadUsers();

  const cleanUsername = String(username || "").trim();
  const cleanPassword = String(password || "").trim();

  if (!cleanUsername || !cleanPassword) {
    return {
      ok: false,
      message: "Username болон password оруулна уу.",
    };
  }

  const user = users.find(
    (item) => item.username.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (!user) {
    return {
      ok: false,
      message: "Ийм username бүртгэлгүй байна.",
    };
  }

  const passwordHash = hashPassword(cleanPassword, user.salt);

  if (passwordHash !== user.passwordHash) {
    return {
      ok: false,
      message: "Password буруу байна.",
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
    },
  };
}

function addRecentChat(userA, userB) {
  if (!userA || !userB || userA === userB) return;

  const users = loadUsers();
  const now = new Date().toISOString();

  users.forEach((user) => {
    if (user.username === userA) {
      user.recentChats = user.recentChats || [];
      user.recentChats = user.recentChats.filter((name) => name !== userB);
      user.recentChats.unshift(userB);
      user.lastChatAt = now;
    }

    if (user.username === userB) {
      user.recentChats = user.recentChats || [];
      user.recentChats = user.recentChats.filter((name) => name !== userA);
      user.recentChats.unshift(userA);
      user.lastChatAt = now;
    }
  });

  saveUsers(users);
}

/* =========================
   API ROUTES
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Server is running",
  });
});

app.post("/api/register", (req, res) => {
  const result = createUser(req.body.username, req.body.password);

  if (!result.ok) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

app.post("/api/login", (req, res) => {
  const result = loginUser(req.body.username, req.body.password);

  if (!result.ok) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

app.get("/api/users/:username/recent-chats", (req, res) => {
  const users = loadUsers();
  const user = users.find((item) => item.username === req.params.username);

  if (!user) {
    return res.status(404).json({
      ok: false,
      message: "User олдсонгүй.",
    });
  }

  return res.json({
    ok: true,
    recentChats: user.recentChats || [],
  });
});

/* =========================
   ONLINE USERS + PRIVATE CHAT
========================= */

const onlineUsers = {};
const activeChats = {};

/* =========================
   GROUP CHAT ROOMS
========================= */

let rooms = [
  {
    id: "study",
    name: "Хамт хичээл хийх",
    description: "Хичээлээ хамт хийж, даалгавраа ярилцах",
    custom: false,
    creator: null,
  },
  {
    id: "room",
    name: "Заал авах",
    description: "Цуг заал авч тоглоё!",
    custom: false,
    creator: null,
  },
  {
    id: "movie",
    name: "Кино, сериал",
    description: "Кино, сериалын талаар ярилцах, санал болгох",
    custom: false,
    creator: null,
  },
  {
    id: "game",
    name: "Тоглоом",
    description: "Хамт PC болон Mobile тоглоом тоглоё!",
    custom: false,
    creator: null,
  },
  {
    id: "fun",
    name: "Цагийг зугаатай өнгөрөөх",
    description: "Уйдсан үедээ ярилцаж, танилцах",
    custom: false,
    creator: null,
  },
  {
    id: "friend",
    name: "Шинэ найз олох",
    description: "Шинэ хүмүүстэй танилцаж, нөхөрлөх",
    custom: false,
    creator: null,
  },
  {
    id: "food",
    name: "Хоол, кофе",
    description: "Хоол идэх, кофе уух хүмүүс хайх",
    custom: false,
    creator: null,
  },
  {
    id: "help",
    name: "Тусламж, зөвлөгөө",
    description: "Асуулт асууж, зөвлөгөө авах",
    custom: false,
    creator: null,
  },
];

const roomUsers = {};
const roomMessages = {};

rooms.forEach((room) => {
  roomUsers[room.id] = new Set();
  roomMessages[room.id] = [];
});

function sendOnlineUsers() {
  io.emit("users_list", Object.keys(onlineUsers));
}

function getRoomsData() {
  return rooms.map((room) => ({
    ...room,
    count: roomUsers[room.id]?.size || 0,
    users: Array.from(roomUsers[room.id] || []),
  }));
}

function sendRoomsData() {
  io.emit("rooms_data", getRoomsData());
}

function makeMessage(data) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    ...data,
  };
}

function removeCustomRoom(roomId) {
  const room = rooms.find((item) => item.id === roomId);
  if (!room) return;
  if (!room.custom) return;

  io.to(roomId).emit("room_removed", {
    roomId,
    roomName: room.name,
    text: `"${room.name}" group устлаа.`,
  });

  delete roomUsers[roomId];
  delete roomMessages[roomId];

  rooms = rooms.filter((item) => item.id !== roomId);

  sendRoomsData();
}

/* =========================
   SOCKET.IO
========================= */

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (username) => {
    const cleanName = String(username || "").trim();
    if (!cleanName) return;

    socket.username = cleanName;
    onlineUsers[cleanName] = socket.id;

    sendOnlineUsers();
    sendRoomsData();

    console.log("Online users:", Object.keys(onlineUsers));
  });

  socket.on("create_room", ({ name }) => {
    const username = socket.username;
    if (!username) return;

    const cleanName = String(name || "").trim();
    if (!cleanName) return;

    const roomId = `custom-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const newRoom = {
      id: roomId,
      name: cleanName,
      description: `${username} үүсгэсэн group chat`,
      custom: true,
      creator: username,
    };

    rooms.push(newRoom);
    roomUsers[roomId] = new Set();
    roomMessages[roomId] = [];

    sendRoomsData();

    socket.emit("room_created", {
      room: newRoom,
    });
  });

  socket.on("join_room", ({ roomId }) => {
    const username = socket.username;
    if (!username) return;

    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;

    const alreadyJoined = roomUsers[roomId]?.has(username);

    socket.join(roomId);
    roomUsers[roomId].add(username);

    if (!alreadyJoined) {
      const systemMessage = makeMessage({
        roomId,
        type: "system",
        text: `${username} room-д орлоо.`,
      });

      roomMessages[roomId].push(systemMessage);
      io.to(roomId).emit("room_system_message", systemMessage);
    }

    socket.emit("room_history", {
      roomId,
      messages: roomMessages[roomId] || [],
    });

    sendRoomsData();
  });

  socket.on("leave_room", ({ roomId }) => {
    const username = socket.username;
    if (!username) return;

    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;

    if (!roomUsers[roomId]?.has(username)) return;

    socket.leave(roomId);
    roomUsers[roomId].delete(username);

    const systemMessage = makeMessage({
      roomId,
      type: "system",
      text: `${username} room-оос гарлаа.`,
    });

    roomMessages[roomId].push(systemMessage);
    io.to(roomId).emit("room_system_message", systemMessage);

    if (room.custom && roomUsers[roomId].size === 0) {
      removeCustomRoom(roomId);
      return;
    }

    sendRoomsData();
  });

  socket.on("room_message", ({ roomId, text }) => {
    const username = socket.username;
    if (!username) return;

    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;

    if (!roomUsers[roomId]?.has(username)) return;

    const cleanText = String(text || "").trim();
    if (!cleanText) return;

    const message = makeMessage({
      roomId,
      type: "text",
      from: username,
      text: cleanText,
    });

    roomMessages[roomId].push(message);
    io.to(roomId).emit("room_message", message);
  });

  socket.on("room_image", ({ roomId, image, fileName }) => {
    const username = socket.username;
    if (!username) return;

    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;

    if (!roomUsers[roomId]?.has(username)) return;

    const message = makeMessage({
      roomId,
      type: "image",
      from: username,
      image,
      fileName,
    });

    roomMessages[roomId].push(message);
    io.to(roomId).emit("room_image", message);
  });

  socket.on("room_voice", ({ roomId, audio }) => {
    const username = socket.username;
    if (!username) return;

    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;

    if (!roomUsers[roomId]?.has(username)) return;

    const message = makeMessage({
      roomId,
      type: "audio",
      from: username,
      audio,
    });

    roomMessages[roomId].push(message);
    io.to(roomId).emit("room_voice", message);
  });

  /* =========================
     PRIVATE REQUEST
  ========================= */

  socket.on("send_chat_request", ({ from, to }) => {
    const requester = socket.username || from;
    if (!requester || !to) return;

    const targetSocketId = onlineUsers[to];

    console.log("CHAT REQUEST:", {
      from: requester,
      to,
      targetSocketId,
    });

    if (targetSocketId) {
      io.to(targetSocketId).emit("receive_chat_request", {
        from: requester,
      });
    } else {
      socket.emit("partner_left", {
        username: to,
        text: `${to} одоогоор offline байна.`,
      });
    }
  });

  socket.on("respond_chat_request", ({ from, to, accepted }) => {
    const requester = from;
    const responder = socket.username || to;

    if (!requester || !responder) return;

    const requesterSocketId = onlineUsers[requester];
    const responderSocketId = onlineUsers[responder];

    console.log("CHAT RESPONSE:", {
      requester,
      responder,
      accepted,
      requesterSocketId,
      responderSocketId,
    });

    if (requesterSocketId) {
      io.to(requesterSocketId).emit("chat_request_response", {
        from: requester,
        to: responder,
        accepted,
      });
    }

    if (responderSocketId) {
      io.to(responderSocketId).emit("chat_request_response", {
        from: requester,
        to: responder,
        accepted,
      });
    }

    if (accepted) {
      activeChats[requester] = responder;
      activeChats[responder] = requester;

      addRecentChat(requester, responder);

      if (requesterSocketId) {
        io.to(requesterSocketId).emit("chat_started", {
          users: [requester, responder],
        });
      }

      if (responderSocketId) {
        io.to(responderSocketId).emit("chat_started", {
          users: [requester, responder],
        });
      }
    }
  });

  /* =========================
     PRIVATE MESSAGES
========================= */

  socket.on("private_message", ({ from: clientFrom, to, text }) => {
    const from = socket.username || clientFrom;
    if (!from || !to) return;

    const cleanText = String(text || "").trim();
    if (!cleanText) return;

    const targetSocketId = onlineUsers[to];

    const message = makeMessage({
      from,
      to,
      type: "text",
      text: cleanText,
    });

    console.log("PRIVATE TEXT:", {
      from,
      to,
      text: cleanText,
      targetSocketId,
    });

    socket.emit("private_message", message);

    if (targetSocketId) {
      io.to(targetSocketId).emit("private_message", message);
    } else {
      socket.emit("partner_left", {
        username: to,
        text: `${to} одоогоор offline байна.`,
      });
    }
  });

  socket.on("private_image", ({ from: clientFrom, to, image, fileName }) => {
    const from = socket.username || clientFrom;
    if (!from || !to) return;

    const targetSocketId = onlineUsers[to];

    const message = makeMessage({
      from,
      to,
      type: "image",
      image,
      fileName,
    });

    socket.emit("private_image", message);

    if (targetSocketId) {
      io.to(targetSocketId).emit("private_image", message);
    } else {
      socket.emit("partner_left", {
        username: to,
        text: `${to} одоогоор offline байна.`,
      });
    }
  });

  socket.on("private_voice", ({ from: clientFrom, to, audio }) => {
    const from = socket.username || clientFrom;
    if (!from || !to) return;

    const targetSocketId = onlineUsers[to];

    const message = makeMessage({
      from,
      to,
      type: "audio",
      audio,
    });

    socket.emit("private_voice", message);

    if (targetSocketId) {
      io.to(targetSocketId).emit("private_voice", message);
    } else {
      socket.emit("partner_left", {
        username: to,
        text: `${to} одоогоор offline байна.`,
      });
    }
  });

  socket.on("disconnect", () => {
    const username = socket.username;

    if (username) {
      const partner = activeChats[username];

      if (partner && onlineUsers[partner]) {
        io.to(onlineUsers[partner]).emit("partner_left", {
          username,
          text: `${username} гарсан байна.`,
        });
      }

      if (partner && activeChats[partner] === username) {
        delete activeChats[partner];
      }

      delete activeChats[username];

      const joinedRoomIds = Object.keys(roomUsers).filter((roomId) =>
        roomUsers[roomId]?.has(username)
      );

      joinedRoomIds.forEach((roomId) => {
        const room = rooms.find((item) => item.id === roomId);
        if (!room) return;

        roomUsers[roomId].delete(username);

        const systemMessage = makeMessage({
          roomId,
          type: "system",
          text: `${username} системээс гарлаа.`,
        });

        roomMessages[roomId].push(systemMessage);
        io.to(roomId).emit("room_system_message", systemMessage);

        if (room.custom && roomUsers[roomId].size === 0) {
          removeCustomRoom(roomId);
        }
      });

      if (onlineUsers[username] === socket.id) {
        delete onlineUsers[username];
      }
    }

    sendOnlineUsers();
    sendRoomsData();

    console.log("User disconnected:", socket.id);
    console.log("Online users:", Object.keys(onlineUsers));
  });
});

/* =========================
   REACT ROUTE FALLBACK
   /chat refresh хийсэн ч ажиллана
========================= */

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

/* =========================
   START SERVER
========================= */

server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
  console.log(`Allowed client: ${CLIENT_URL}`);
});