require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  },
  maxHttpBufferSize: 25 * 1024 * 1024,
});

/* =========================
   USERS JSON FALLBACK
========================= */

const USERS_FILE = path.join(__dirname, "users.json");

function ensureUsersFile() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
}

function readUsers() {
  try {
    ensureUsersFile();
    const data = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(data || "[]");
  } catch (err) {
    console.error("Read users error:", err);
    return [];
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Write users error:", err);
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
}

/* =========================
   MONGODB CONNECTION
========================= */

let mongoClient = null;
let usersCollection = null;

async function connectMongoDB() {
  try {
    if (!process.env.MONGO_URI) {
      console.log("MONGO_URI not found. MongoDB disabled.");
      return;
    }

    mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();

    const db = mongoClient.db("newfriends");
    usersCollection = db.collection("users");

    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

connectMongoDB();

/* =========================
   DEFAULT ROOMS
========================= */

let rooms = [
  {
    id: "study",
    name: "Хамт хичээл хийх",
    description: "Хичээлээ хамт хийж, даалгавраа ярилцах",
    custom: false,
    creator: null,
    users: [],
  },
  {
    id: "room",
    name: "Заал авах",
    description: "Цуг заал авч тоглоё!",
    custom: false,
    creator: null,
    users: [],
  },
  {
    id: "movie",
    name: "Кино, сериал",
    description: "Кино, сериалын талаар ярилцах, санал болгох",
    custom: false,
    creator: null,
    users: [],
  },
  {
    id: "game",
    name: "Тоглоом",
    description: "Хамт PC болон Mobile тоглоом тоглоё!",
    custom: false,
    creator: null,
    users: [],
  },
  {
    id: "fun",
    name: "Цагийг зугаатай өнгөрөөх",
    description: "Уйдсан үедээ ярилцаж, танилцах",
    custom: false,
    creator: null,
    users: [],
  },
  {
    id: "friend",
    name: "Шинэ найз олох",
    description: "Шинэ хүмүүстэй танилцаж, нөхөрлөх",
    custom: false,
    creator: null,
    users: [],
  },
  {
    id: "food",
    name: "Хоол, кофе",
    description: "Хоол идэх, кофе уух хүмүүс хайх",
    custom: false,
    creator: null,
    users: [],
  },
  {
    id: "help",
    name: "Тусламж, зөвлөгөө",
    description: "Асуулт асууж, зөвлөгөө авах",
    custom: false,
    creator: null,
    users: [],
  },
];

const roomMessages = {};
const activeUsers = new Map(); // username -> socket.id
const socketUsers = new Map(); // socket.id -> username
const activePrivateChats = new Map(); // username -> partner

function getPublicRooms() {
  return rooms.map((room) => ({
    ...room,
    count: room.users.length,
  }));
}

function emitUsersList() {
  io.emit("users_list", Array.from(activeUsers.keys()));
}

function emitRoomsData() {
  io.emit("rooms_data", getPublicRooms());
}

function addUserToRoom(username, roomId) {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  if (!room.users.includes(username)) {
    room.users.push(username);
  }

  return room;
}

function removeUserFromRoom(username, roomId) {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  room.users = room.users.filter((u) => u !== username);

  return room;
}

function removeEmptyCustomRooms() {
  const removedRooms = [];

  rooms = rooms.filter((room) => {
    if (room.custom && room.users.length === 0) {
      removedRooms.push(room);
      return false;
    }

    return true;
  });

  removedRooms.forEach((room) => {
    delete roomMessages[room.id];

    io.emit("room_removed", {
      roomId: room.id,
      text: `"${room.name}" group устлаа.`,
    });
  });
}

function createMessage(extra = {}) {
  return {
    id: createId(),
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

/* =========================
   AUTH API
========================= */

app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: "Нэр болон нууц үг хэрэгтэй.",
      });
    }

    const users = readUsers();

    const exists = users.some(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );

    if (exists) {
      return res.status(409).json({
        ok: false,
        message: "Энэ нэр бүртгэлтэй байна.",
      });
    }

    const salt = createSalt();
    const passwordHash = hashPassword(password, salt);

    const newUser = {
      id: createId(),
      username,
      salt,
      passwordHash,
      savedChats: [],
      createdAt: new Date().toISOString(),
      lastChatAt: null,
    };

    users.push(newUser);
    writeUsers(users);

    if (usersCollection) {
      await usersCollection.updateOne(
        { username },
        {
          $setOnInsert: {
            username,
            savedChats: [],
            createdAt: new Date(),
          },
          $set: {
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    res.json({
      ok: true,
      user: {
        id: newUser.id,
        username: newUser.username,
      },
    });
  } catch (err) {
    console.error("Register error:", err);

    res.status(500).json({
      ok: false,
      message: "Бүртгэх үед алдаа гарлаа.",
    });
  }
});

app.post("/api/login", (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: "Нэр болон нууц үг хэрэгтэй.",
      });
    }

    const users = readUsers();

    const user = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Нэр эсвэл нууц үг буруу байна.",
      });
    }

    const checkHash = hashPassword(password, user.salt);

    if (checkHash !== user.passwordHash) {
      return res.status(401).json({
        ok: false,
        message: "Нэр эсвэл нууц үг буруу байна.",
      });
    }

    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err) {
    console.error("Login error:", err);

    res.status(500).json({
      ok: false,
      message: "Нэвтрэх үед алдаа гарлаа.",
    });
  }
});

/* =========================
   SAVED PRIVATE CHATS API
   ❤️ дарахад л хадгална
========================= */

app.get("/api/users/:username/recent-chats", async (req, res) => {
  try {
    const username = req.params.username;

    if (usersCollection) {
      const user = await usersCollection.findOne({ username });

      return res.json({
        ok: true,
        recentChats: user?.savedChats || [],
      });
    }

    const users = readUsers();
    const user = users.find((u) => u.username === username);

    res.json({
      ok: true,
      recentChats: user?.savedChats || [],
    });
  } catch (err) {
    console.error("Get saved chats error:", err);

    res.status(500).json({
      ok: false,
      message: "Saved chats авах үед алдаа гарлаа.",
    });
  }
});

app.post("/api/users/:username/saved-chats", async (req, res) => {
  try {
    const username = req.params.username;
    const partner = String(req.body.partner || "").trim();

    if (!partner) {
      return res.status(400).json({
        ok: false,
        message: "Partner нэр хэрэгтэй.",
      });
    }

    if (username === partner) {
      return res.status(400).json({
        ok: false,
        message: "Өөрийгөө хадгалах боломжгүй.",
      });
    }

    if (usersCollection) {
      await usersCollection.updateOne(
        { username },
        {
          $setOnInsert: {
            username,
            createdAt: new Date(),
          },
          $addToSet: {
            savedChats: partner,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      const user = await usersCollection.findOne({ username });

      return res.json({
        ok: true,
        savedChats: user?.savedChats || [],
      });
    }

    const users = readUsers();
    let user = users.find((u) => u.username === username);

    if (!user) {
      user = {
        id: createId(),
        username,
        savedChats: [],
        createdAt: new Date().toISOString(),
      };
      users.push(user);
    }

    if (!Array.isArray(user.savedChats)) {
      user.savedChats = [];
    }

    if (!user.savedChats.includes(partner)) {
      user.savedChats.push(partner);
    }

    user.updatedAt = new Date().toISOString();

    writeUsers(users);

    res.json({
      ok: true,
      savedChats: user.savedChats,
    });
  } catch (err) {
    console.error("Save chat error:", err);

    res.status(500).json({
      ok: false,
      message: "Chat хадгалах үед алдаа гарлаа.",
    });
  }
});

app.delete("/api/users/:username/saved-chats", async (req, res) => {
  try {
    const username = req.params.username;
    const partner = String(req.body.partner || "").trim();

    if (!partner) {
      return res.status(400).json({
        ok: false,
        message: "Partner нэр хэрэгтэй.",
      });
    }

    if (usersCollection) {
      await usersCollection.updateOne(
        { username },
        {
          $pull: {
            savedChats: partner,
          },
          $set: {
            updatedAt: new Date(),
          },
        }
      );

      const user = await usersCollection.findOne({ username });

      return res.json({
        ok: true,
        savedChats: user?.savedChats || [],
      });
    }

    const users = readUsers();
    const user = users.find((u) => u.username === username);

    if (!user) {
      return res.json({
        ok: true,
        savedChats: [],
      });
    }

    user.savedChats = (user.savedChats || []).filter((name) => name !== partner);
    user.updatedAt = new Date().toISOString();

    writeUsers(users);

    res.json({
      ok: true,
      savedChats: user.savedChats || [],
    });
  } catch (err) {
    console.error("Remove saved chat error:", err);

    res.status(500).json({
      ok: false,
      message: "Хадгалсан чатаас хасах үед алдаа гарлаа.",
    });
  }
});

/* =========================
   SOCKET.IO
========================= */

io.on("connection", (socket) => {
  socket.on("join", (username) => {
    const cleanUsername = String(username || "").trim();

    if (!cleanUsername) return;

    socket.username = cleanUsername;

    activeUsers.set(cleanUsername, socket.id);
    socketUsers.set(socket.id, cleanUsername);

    emitUsersList();
    emitRoomsData();
  });

  socket.on("create_room", ({ name }) => {
    const username = socket.username;
    const cleanName = String(name || "").trim();

    if (!username || !cleanName) return;

    const roomId = `custom-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const room = {
      id: roomId,
      name: cleanName,
      description: `${username} үүсгэсэн group chat`,
      custom: true,
      creator: username,
      users: [],
    };

    rooms.push(room);

    socket.emit("room_created", {
      room: {
        ...room,
        count: 0,
      },
    });

    emitRoomsData();
  });

  socket.on("join_room", ({ roomId }) => {
    const username = socket.username;

    if (!username || !roomId) return;

    const room = addUserToRoom(username, roomId);

    if (!room) return;

    socket.join(roomId);

    const messages = roomMessages[roomId] || [];

    socket.emit("room_history", {
      roomId,
      messages,
    });

    const systemMsg = createMessage({
      roomId,
      from: "system",
      type: "system",
      text: `${username} group-д орлоо.`,
    });

    roomMessages[roomId] = [...messages, systemMsg].slice(-100);

    io.to(roomId).emit("room_system_message", systemMsg);

    emitRoomsData();
  });

  socket.on("leave_room", ({ roomId }) => {
    const username = socket.username;

    if (!username || !roomId) return;

    const room = removeUserFromRoom(username, roomId);

    socket.leave(roomId);

    if (room) {
      const systemMsg = createMessage({
        roomId,
        from: "system",
        type: "system",
        text: `${username} room-оос гарлаа.`,
      });

      roomMessages[roomId] = [...(roomMessages[roomId] || []), systemMsg].slice(
        -100
      );

      io.to(roomId).emit("room_system_message", systemMsg);
    }

    removeEmptyCustomRooms();
    emitRoomsData();
  });

  socket.on("room_message", ({ roomId, text }) => {
    const username = socket.username;
    const cleanText = String(text || "").trim();

    if (!username || !roomId || !cleanText) return;

    const msg = createMessage({
      roomId,
      from: username,
      type: "text",
      text: cleanText,
    });

    roomMessages[roomId] = [...(roomMessages[roomId] || []), msg].slice(-100);

    io.to(roomId).emit("room_message", msg);
  });

  socket.on("room_image", ({ roomId, image, fileName }) => {
    const username = socket.username;

    if (!username || !roomId || !image) return;

    const msg = createMessage({
      roomId,
      from: username,
      type: "image",
      image,
      fileName: fileName || "image",
    });

    roomMessages[roomId] = [...(roomMessages[roomId] || []), msg].slice(-100);

    io.to(roomId).emit("room_image", msg);
  });

  socket.on("room_voice", ({ roomId, audio }) => {
    const username = socket.username;

    if (!username || !roomId || !audio) return;

    const msg = createMessage({
      roomId,
      from: username,
      type: "audio",
      audio,
    });

    roomMessages[roomId] = [...(roomMessages[roomId] || []), msg].slice(-100);

    io.to(roomId).emit("room_voice", msg);
  });

  socket.on("send_chat_request", ({ from, to }) => {
    const sender = socket.username || from;
    const target = String(to || "").trim();

    if (!sender || !target || sender === target) return;

    const targetSocketId = activeUsers.get(target);

    if (!targetSocketId) {
      socket.emit("partner_left", {
        username: target,
        text: `${target} одоогоор offline байна.`,
      });
      return;
    }

    io.to(targetSocketId).emit("receive_chat_request", {
      from: sender,
    });
  });

  socket.on("respond_chat_request", ({ from, to, accepted }) => {
    const sender = String(from || "").trim();
    const receiver = socket.username || String(to || "").trim();

    if (!sender || !receiver) return;

    const senderSocketId = activeUsers.get(sender);
    const receiverSocketId = activeUsers.get(receiver);

    if (accepted) {
      activePrivateChats.set(sender, receiver);
      activePrivateChats.set(receiver, sender);

      if (senderSocketId) {
        io.to(senderSocketId).emit("chat_request_response", {
          from: receiver,
          to: sender,
          accepted: true,
        });

        io.to(senderSocketId).emit("chat_started", {
          users: [sender, receiver],
        });
      }

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("chat_request_response", {
          from: sender,
          to: receiver,
          accepted: true,
        });

        io.to(receiverSocketId).emit("chat_started", {
          users: [sender, receiver],
        });
      }
    } else {
      if (senderSocketId) {
        io.to(senderSocketId).emit("chat_request_response", {
          from: receiver,
          to: sender,
          accepted: false,
        });
      }
    }
  });

  socket.on("private_message", ({ from, to, text }) => {
    const sender = socket.username || String(from || "").trim();
    const receiver = String(to || "").trim();
    const cleanText = String(text || "").trim();

    if (!sender || !receiver || !cleanText) return;

    const msg = createMessage({
      from: sender,
      to: receiver,
      type: "text",
      text: cleanText,
    });

    const senderSocketId = activeUsers.get(sender);
    const receiverSocketId = activeUsers.get(receiver);

    if (senderSocketId) {
      io.to(senderSocketId).emit("private_message", msg);
    }

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("private_message", msg);
    }
  });

  socket.on("private_image", ({ from, to, image, fileName }) => {
    const sender = socket.username || String(from || "").trim();
    const receiver = String(to || "").trim();

    if (!sender || !receiver || !image) return;

    const msg = createMessage({
      from: sender,
      to: receiver,
      type: "image",
      image,
      fileName: fileName || "image",
    });

    const senderSocketId = activeUsers.get(sender);
    const receiverSocketId = activeUsers.get(receiver);

    if (senderSocketId) {
      io.to(senderSocketId).emit("private_image", msg);
    }

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("private_image", msg);
    }
  });

  socket.on("private_voice", ({ from, to, audio }) => {
    const sender = socket.username || String(from || "").trim();
    const receiver = String(to || "").trim();

    if (!sender || !receiver || !audio) return;

    const msg = createMessage({
      from: sender,
      to: receiver,
      type: "audio",
      audio,
    });

    const senderSocketId = activeUsers.get(sender);
    const receiverSocketId = activeUsers.get(receiver);

    if (senderSocketId) {
      io.to(senderSocketId).emit("private_voice", msg);
    }

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("private_voice", msg);
    }
  });

  socket.on("disconnect", () => {
    const username = socketUsers.get(socket.id);

    if (!username) return;

    activeUsers.delete(username);
    socketUsers.delete(socket.id);

    const partner = activePrivateChats.get(username);

    if (partner) {
      activePrivateChats.delete(username);
      activePrivateChats.delete(partner);

      const partnerSocketId = activeUsers.get(partner);

      if (partnerSocketId) {
        io.to(partnerSocketId).emit("partner_left", {
          username,
          text: `${username} гарсан байна.`,
        });
      }
    }

    rooms.forEach((room) => {
      if (room.users.includes(username)) {
        room.users = room.users.filter((u) => u !== username);

        const systemMsg = createMessage({
          roomId: room.id,
          from: "system",
          type: "system",
          text: `${username} room-оос гарлаа.`,
        });

        roomMessages[room.id] = [
          ...(roomMessages[room.id] || []),
          systemMsg,
        ].slice(-100);

        io.to(room.id).emit("room_system_message", systemMsg);
      }
    });

    removeEmptyCustomRooms();

    emitUsersList();
    emitRoomsData();
  });
});

/* =========================
   SERVE REACT CLIENT
========================= */

const CLIENT_DIST_PATH = path.join(__dirname, "../client/dist");

app.use(express.static(CLIENT_DIST_PATH));

app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
    return next();
  }

  res.sendFile(path.join(CLIENT_DIST_PATH, "index.html"));
});

/* =========================
   START SERVER
========================= */

server.listen(PORT, () => {
  console.log(`Socket server running on port ${PORT}`);
  console.log(`Allowed client: ${CLIENT_URL}`);
});