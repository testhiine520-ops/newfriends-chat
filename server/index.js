const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

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
let messagesCollection = null;

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
    messagesCollection = db.collection("messages");

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
   Register/Login хэрэглэгчийг MongoDB дээр хадгална
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

    const usernameLower = username.toLowerCase();

    if (usersCollection) {
      const existsInMongo = await usersCollection.findOne({ usernameLower });

      if (existsInMongo) {
        return res.status(409).json({
          ok: false,
          message: "Энэ нэр бүртгэлтэй байна.",
        });
      }
    }

    const users = readUsers();

    const existsInJson = users.some(
      (user) => String(user.username || "").toLowerCase() === usernameLower
    );

    if (existsInJson) {
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
      usernameLower,
      salt,
      passwordHash,
      savedChats: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastChatAt: null,
    };

    users.push(newUser);
    writeUsers(users);

    if (usersCollection) {
      await usersCollection.insertOne({
        id: newUser.id,
        username: newUser.username,
        usernameLower: newUser.usernameLower,
        salt: newUser.salt,
        passwordHash: newUser.passwordHash,
        savedChats: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastChatAt: null,
      });
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

app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: "Нэр болон нууц үг хэрэгтэй.",
      });
    }

    const usernameLower = username.toLowerCase();

    if (usersCollection) {
      const mongoUser = await usersCollection.findOne({ usernameLower });

      if (mongoUser) {
        const checkHash = hashPassword(password, mongoUser.salt);

        if (checkHash !== mongoUser.passwordHash) {
          return res.status(401).json({
            ok: false,
            message: "Нэр эсвэл нууц үг буруу байна.",
          });
        }

        return res.json({
          ok: true,
          user: {
            id: mongoUser.id,
            username: mongoUser.username,
          },
        });
      }
    }

    const users = readUsers();

    const jsonUser = users.find(
      (user) => String(user.username || "").toLowerCase() === usernameLower
    );

    if (!jsonUser) {
      return res.status(401).json({
        ok: false,
        message: "Нэр эсвэл нууц үг буруу байна.",
      });
    }

    const checkHash = hashPassword(password, jsonUser.salt);

    if (checkHash !== jsonUser.passwordHash) {
      return res.status(401).json({
        ok: false,
        message: "Нэр эсвэл нууц үг буруу байна.",
      });
    }

    if (usersCollection) {
      await usersCollection.updateOne(
        { usernameLower },
        {
          $setOnInsert: {
            id: jsonUser.id || createId(),
            username: jsonUser.username,
            usernameLower,
            salt: jsonUser.salt,
            passwordHash: jsonUser.passwordHash,
            savedChats: jsonUser.savedChats || [],
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
        id: jsonUser.id,
        username: jsonUser.username,
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

/* =========================
   RECENT CHATS API
   Chat хийсэн хүмүүс энд хадгалагдана
========================= */

app.get("/api/users/:username/recent-chats", async (req, res) => {
  try {
    const username = req.params.username;

    if (usersCollection) {
      const user = await usersCollection.findOne({ username });

      return res.json({
        ok: true,
        recentChats: user?.recentChats || [],
        savedChats: user?.savedChats || [],
      });
    }

    const users = readUsers();
    const user = users.find((u) => u.username === username);

    res.json({
      ok: true,
      recentChats: user?.recentChats || [],
      savedChats: user?.savedChats || [],
    });
  } catch (err) {
    console.error("Get recent chats error:", err);

    res.status(500).json({
      ok: false,
      message: "Өмнөх чат авах үед алдаа гарлаа.",
    });
  }
});

/* =========================
   SAVED CHATS API
   ❤️ дарсан хүнтэй хийсэн message history хадгална
========================= */

app.post("/api/users/:username/saved-chats", async (req, res) => {
  try {
    const username = req.params.username;
    const partner = String(req.body.partner || "").trim();
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];

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
            usernameLower: username.toLowerCase(),
            createdAt: new Date(),
          },
          $addToSet: {
            savedChats: partner,
            recentChats: partner,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      await saveExistingMessagesForUser(username, partner, messages);

      const user = await usersCollection.findOne({ username });

      return res.json({
        ok: true,
        recentChats: user?.recentChats || [],
        savedChats: user?.savedChats || [],
      });
    }

    res.json({
      ok: true,
      recentChats: [],
      savedChats: [],
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

      if (messagesCollection) {
        await messagesCollection.updateMany(
          {
            pairKey: getPairKey(username, partner),
          },
          {
            $pull: {
              savedFor: username,
            },
          }
        );
      }

      const user = await usersCollection.findOne({ username });

      return res.json({
        ok: true,
        recentChats: user?.recentChats || [],
        savedChats: user?.savedChats || [],
      });
    }

    res.json({
      ok: true,
      recentChats: [],
      savedChats: [],
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
   SAVED PRIVATE MESSAGE HISTORY API
========================= */

app.get("/api/users/:username/private-history/:partner", async (req, res) => {
  try {
    const username = req.params.username;
    const partner = req.params.partner;

    if (!messagesCollection) {
      return res.json({
        ok: true,
        messages: [],
      });
    }

    const messages = await messagesCollection
      .find({
        pairKey: getPairKey(username, partner),
        savedFor: username,
      })
      .sort({ createdAt: 1 })
      .toArray();

    res.json({
      ok: true,
      messages: messages.map((msg) => ({
        id: msg.messageId,
        from: msg.from,
        to: msg.to,
        type: msg.type,
        text: msg.text,
        image: msg.image,
        audio: msg.audio,
        fileName: msg.fileName,
        createdAt: msg.createdAt,
      })),
    });
  } catch (err) {
    console.error("Private history error:", err);

    res.status(500).json({
      ok: false,
      message: "Private chat history авах үед алдаа гарлаа.",
    });
  }
});

/* =========================
   PRIVATE CHAT SAVE HELPERS
========================= */

function getPairKey(userA, userB) {
  return [userA, userB].sort().join("__");
}

async function addRecentChat(username, partner) {
  if (!usersCollection || !username || !partner || username === partner) return;

  await usersCollection.updateOne(
    { username },
    {
      $setOnInsert: {
        username,
        usernameLower: username.toLowerCase(),
        createdAt: new Date(),
      },
      $addToSet: {
        recentChats: partner,
      },
      $set: {
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

async function getUsersWhoSavedThisChat(from, to) {
  if (!usersCollection) return [];

  const users = await usersCollection
    .find({
      username: { $in: [from, to] },
    })
    .toArray();

  const savedFor = [];

  users.forEach((user) => {
    const savedChats = user.savedChats || [];

    if (user.username === from && savedChats.includes(to)) {
      savedFor.push(from);
    }

    if (user.username === to && savedChats.includes(from)) {
      savedFor.push(to);
    }
  });

  return savedFor;
}

async function savePrivateMessageIfNeeded(message) {
  try {
    if (!messagesCollection || !message?.from || !message?.to) return;

    const savedFor = await getUsersWhoSavedThisChat(message.from, message.to);

    if (savedFor.length === 0) return;

    await messagesCollection.updateOne(
      {
        messageId: message.id,
      },
      {
        $setOnInsert: {
          messageId: message.id,
          pairKey: getPairKey(message.from, message.to),
          from: message.from,
          to: message.to,
          type: message.type || "text",
          text: message.text || "",
          image: message.image || "",
          audio: message.audio || "",
          fileName: message.fileName || "",
          createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
        },
        $addToSet: {
          savedFor: {
            $each: savedFor,
          },
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("Save private message if needed error:", err);
  }
}

async function saveExistingMessagesForUser(username, partner, messages) {
  try {
    if (!messagesCollection || !username || !partner) return;

    const validMessages = (messages || []).filter((msg) => {
      return (
        msg &&
        msg.from &&
        msg.to &&
        ((msg.from === username && msg.to === partner) ||
          (msg.from === partner && msg.to === username))
      );
    });

    for (const msg of validMessages) {
      const messageId = msg.id || createId();

      await messagesCollection.updateOne(
        {
          messageId,
        },
        {
          $setOnInsert: {
            messageId,
            pairKey: getPairKey(username, partner),
            from: msg.from,
            to: msg.to,
            type: msg.type || "text",
            text: msg.text || "",
            image: msg.image || "",
            audio: msg.audio || "",
            fileName: msg.fileName || "",
            createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          },
          $addToSet: {
            savedFor: username,
          },
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error("Save existing messages error:", err);
  }
}

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

    addRecentChat(sender, receiver);
    addRecentChat(receiver, sender);
    savePrivateMessageIfNeeded(msg);

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

    addRecentChat(sender, receiver);
    addRecentChat(receiver, sender);
    savePrivateMessageIfNeeded(msg);

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

    addRecentChat(sender, receiver);
    addRecentChat(receiver, sender);
    savePrivateMessageIfNeeded(msg);

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

      addRecentChat(sender, receiver);
      addRecentChat(receiver, sender);

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

    addRecentChat(sender, receiver);
    addRecentChat(receiver, sender);
    savePrivateMessageIfNeeded(msg);

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

    addRecentChat(sender, receiver);
    addRecentChat(receiver, sender);
    savePrivateMessageIfNeeded(msg);

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

    addRecentChat(sender, receiver);
    addRecentChat(receiver, sender);
    savePrivateMessageIfNeeded(msg);

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