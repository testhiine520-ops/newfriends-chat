/* =========================
   IMPORTS
========================= */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./Chat.css";

/* =========================
   SERVER CONFIG
========================= */

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin);

const socket = io(SERVER_URL, {
  withCredentials: true,
  transports: ["websocket", "polling"],
});

/* =========================
   DEFAULT ROOMS
========================= */

const DEFAULT_ROOMS = [
  {
    id: "study",
    name: "Хамт хичээл хийх",
    description: "Хичээлээ хамт хийж, даалгавраа ярилцах",
    custom: false,
    creator: null,
    users: [],
    count: 0,
  },
  {
    id: "room",
    name: "Заал авах",
    description: "Цуг заал авч тоглоё!",
    custom: false,
    creator: null,
    users: [],
    count: 0,
  },
  {
    id: "movie",
    name: "Кино, сериал",
    description: "Кино, сериалын талаар ярилцах, санал болгох",
    custom: false,
    creator: null,
    users: [],
    count: 0,
  },
  {
    id: "game",
    name: "Тоглоом",
    description: "Хамт PC болон Mobile тоглоом тоглоё!",
    custom: false,
    creator: null,
    users: [],
    count: 0,
  },
  {
    id: "fun",
    name: "Цагийг зугаатай өнгөрөөх",
    description: "Уйдсан үедээ ярилцаж, танилцах",
    custom: false,
    creator: null,
    users: [],
    count: 0,
  },
  {
    id: "friend",
    name: "Шинэ найз олох",
    description: "Шинэ хүмүүстэй танилцаж, нөхөрлөх",
    custom: false,
    creator: null,
    users: [],
    count: 0,
  },
  {
    id: "food",
    name: "Хоол, кофе",
    description: "Хоол идэх, кофе уух хүмүүс хайх",
    custom: false,
    creator: null,
    users: [],
    count: 0,
  },
  {
    id: "help",
    name: "Тусламж, зөвлөгөө",
    description: "Асуулт асууж, зөвлөгөө авах",
    custom: false,
    creator: null,
    users: [],
    count: 0,
  },
];

/* =========================
   HELPER FUNCTIONS
========================= */

function getUsernameFromStorage() {
  const possibleKeys = [
    "newfriends_user",
    "chatUser",
    "user",
    "currentUser",
    "username",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (!value) continue;

    try {
      const parsed = JSON.parse(value);

      if (typeof parsed === "string") return parsed;
      if (parsed?.username) return parsed.username;
      if (parsed?.name) return parsed.name;
      if (parsed?.user?.username) return parsed.user.username;
    } catch {
      return value;
    }
  }

  return "";
}

function formatMessageTime(createdAt) {
  if (!createdAt) return "";

  try {
    const date = new Date(createdAt);

    return date.toLocaleTimeString("mn-MN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function isSamePrivatePair(message, myName, selectedUser) {
  if (!message || !myName || !selectedUser) return false;

  return (
    (message.from === myName && message.to === selectedUser) ||
    (message.from === selectedUser && message.to === myName)
  );
}

function uniqueMessages(messages) {
  const seen = new Set();

  return messages.filter((msg) => {
    const key =
      msg.id ||
      `${msg.from}-${msg.to}-${msg.roomId}-${msg.text}-${msg.createdAt}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

/* =========================
   MAIN COMPONENT
========================= */

export default function ChatPage() {
  const navigate = useNavigate();

  /* =========================
     USER STATE
  ========================= */

  const [myName, setMyName] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);

  /* =========================
     ROOM STATE
  ========================= */

  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");

  /* =========================
     PRIVATE CHAT STATE
  ========================= */

  const [selectedUser, setSelectedUser] = useState(null);
  const [privateActiveUser, setPrivateActiveUser] = useState(null);
  const [receivedRequest, setReceivedRequest] = useState(null);

  /* =========================
     SAVED PRIVATE CHATS STATE
     ❤️ дарсан хүмүүс л энд хадгалагдана
  ========================= */

  const [recentChats, setRecentChats] = useState([]);
  const [savedChats, setSavedChats] = useState([]);

  /* =========================
     MESSAGE STATE
  ========================= */

  const [chatMode, setChatMode] = useState("room");
  const [roomMessages, setRoomMessages] = useState({});
  const [privateMessages, setPrivateMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [statusText, setStatusText] = useState(
    "Эхлээд group chat сонгоно уу."
  );

  /* =========================
     UI STATE
  ========================= */

  const [isRecentOpen, setIsRecentOpen] = useState(true);
  const [isOnlineOpen, setIsOnlineOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState("chat");

  /* =========================
     MEDIA STATE
  ========================= */

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);

  /* =========================
     CURRENT USER INIT
  ========================= */

  useEffect(() => {
    const username = getUsernameFromStorage();

    if (!username) {
      navigate("/");
      return;
    }

    setMyName(username);
    socket.emit("join", username);
    loadRecentChats(username);
  }, [navigate]);

  /* =========================
   LOAD RECENT CHATS FROM MONGODB
   Чаталсан хүмүүс = recentChats
   Зүрх дарсан хүмүүс = savedChats
========================= */

const loadRecentChats = async (username) => {
  try {
    const response = await fetch(
      `${SERVER_URL}/api/users/${encodeURIComponent(username)}/recent-chats`
    );

    const data = await response.json();

    if (response.ok && data.ok) {
      setRecentChats(data.recentChats || []);
      setSavedChats(data.savedChats || []);
    }
  } catch (err) {
    console.error("Recent chats load error:", err);
  }
};

/* =========================
   LOAD SAVED PRIVATE MESSAGE HISTORY
   Зөвхөн savedChats-д байгаа хүний хадгалсан мессежийг татна
========================= */

const loadPrivateHistory = async (partner) => {
  if (!myName || !partner) return;

  try {
    const response = await fetch(
      `${SERVER_URL}/api/users/${encodeURIComponent(
        myName
      )}/private-history/${encodeURIComponent(partner)}`
    );

    const data = await response.json();

    if (response.ok && data.ok) {
      setPrivateMessages((prev) =>
        uniqueMessages([...prev, ...(data.messages || [])])
      );
    }
  } catch (err) {
    console.error("Private history load error:", err);
  }
};

  /* =========================
     SOCKET EVENTS
  ========================= */

  useEffect(() => {
    if (!myName) return;

    const handleUsersList = (users) => {
      setOnlineUsers(Array.isArray(users) ? users : []);
    };

    const handleRoomsData = (data) => {
      if (Array.isArray(data)) {
        setRooms(data);
      }
    };

    const handleRoomCreated = ({ room }) => {
      if (!room) return;

      setRooms((prev) => {
        const exists = prev.some((item) => item.id === room.id);
        if (exists) return prev;
        return [...prev, room];
      });

      setSelectedRoom(room);
      setSelectedUser(null);
      setChatMode("room");
      setStatusText(`"${room.name}" group үүслээ.`);

      socket.emit("join_room", { roomId: room.id });
    };

    const handleRoomRemoved = ({ roomId, text }) => {
      setRooms((prev) => prev.filter((room) => room.id !== roomId));

      setRoomMessages((prev) => {
        const next = { ...prev };
        delete next[roomId];
        return next;
      });

      if (selectedRoom?.id === roomId) {
        setSelectedRoom(null);
        setStatusText(text || "Group устлаа.");
      }
    };

    const handleRoomHistory = ({ roomId, messages }) => {
      setRoomMessages((prev) => ({
        ...prev,
        [roomId]: Array.isArray(messages) ? messages : [],
      }));
    };

    
    const appendRoomMessage = (message) => {
  if (!message?.roomId) return;

  setRoomMessages((prev) => {
    const oldMessages = prev[message.roomId] || [];

    return {
      ...prev,
      [message.roomId]: uniqueMessages([...oldMessages, message]),
    };
  });
};

    const appendPrivateMessage = (msg) => {
      if (!msg?.from || !msg?.to) return;

      setPrivateMessages((prev) => uniqueMessages([...prev, msg]));
    };

    const handleReceiveChatRequest = ({ from }) => {
      if (!from) return;

      setReceivedRequest({ from });
      setStatusText(`${from} private chat хийх хүсэлт илгээлээ.`);
    };

    const handleChatRequestResponse = ({ from, accepted }) => {
      if (!from) return;

      if (accepted) {
        setSelectedUser(from);
        setSelectedRoom(null);
        setChatMode("private");
        setPrivateActiveUser(from);
        setStatusText(`${from}-тэй chat эхэллээ.`);
      } else {
        setPrivateActiveUser(null);
        setStatusText(`${from} request-ийг зөвшөөрсөнгүй.`);
      }
    };

    const handleChatStarted = ({ users }) => {
      if (!Array.isArray(users)) return;

      const partner = users.find((user) => user !== myName);

      if (!partner) return;

      setSelectedUser(partner);
      setSelectedRoom(null);
      setChatMode("private");
      setPrivateActiveUser(partner);
      setStatusText(`${partner}-тэй chat эхэллээ.`);
    };

    const handlePartnerLeft = ({ username, text }) => {
      setPrivateActiveUser(null);
      setStatusText(text || `${username || "Нөгөө хүн"} offline байна.`);
    };

    socket.on("users_list", handleUsersList);
    socket.on("rooms_data", handleRoomsData);
    socket.on("room_created", handleRoomCreated);
    socket.on("room_removed", handleRoomRemoved);
    socket.on("room_history", handleRoomHistory);

    socket.on("room_message", appendRoomMessage);
    socket.on("room_image", appendRoomMessage);
    socket.on("room_voice", appendRoomMessage);
    socket.on("room_system_message", appendRoomMessage);

    socket.on("receive_chat_request", handleReceiveChatRequest);
    socket.on("chat_request_response", handleChatRequestResponse);
    socket.on("chat_started", handleChatStarted);
    socket.on("partner_left", handlePartnerLeft);

    socket.on("private_message", appendPrivateMessage);
    socket.on("private_image", appendPrivateMessage);
    socket.on("private_voice", appendPrivateMessage);

    return () => {
      socket.off("users_list", handleUsersList);
      socket.off("rooms_data", handleRoomsData);
      socket.off("room_created", handleRoomCreated);
      socket.off("room_removed", handleRoomRemoved);
      socket.off("room_history", handleRoomHistory);

      socket.off("room_message", appendRoomMessage);
      socket.off("room_image", appendRoomMessage);
      socket.off("room_voice", appendRoomMessage);
      socket.off("room_system_message", appendRoomMessage);

      socket.off("receive_chat_request", handleReceiveChatRequest);
      socket.off("chat_request_response", handleChatRequestResponse);
      socket.off("chat_started", handleChatStarted);
      socket.off("partner_left", handlePartnerLeft);

      socket.off("private_message", appendPrivateMessage);
      socket.off("private_image", appendPrivateMessage);
      socket.off("private_voice", appendPrivateMessage);
    };
  }, [myName, selectedRoom]);

  /* =========================
     AUTO SCROLL
  ========================= */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [roomMessages, privateMessages, selectedRoom, selectedUser, chatMode]);

  /* =========================
     DERIVED DATA
  ========================= */

  const filteredOnlineUsers = useMemo(() => {
    return onlineUsers.filter((user) => user !== myName);
  }, [onlineUsers, myName]);

  const selectedRoomMessages = useMemo(() => {
    if (!selectedRoom) return [];
    return roomMessages[selectedRoom.id] || [];
  }, [roomMessages, selectedRoom]);

  const selectedPrivateMessages = useMemo(() => {
    if (!selectedUser) return [];

    return privateMessages.filter((msg) =>
      isSamePrivatePair(msg, myName, selectedUser)
    );
  }, [privateMessages, myName, selectedUser]);

  const currentMessages =
    chatMode === "private" ? selectedPrivateMessages : selectedRoomMessages;

  const isSelectedUserOnline = selectedUser
    ? onlineUsers.includes(selectedUser)
    : false;

  const canSendPrivate =
    chatMode === "private" &&
    selectedUser &&
    privateActiveUser === selectedUser &&
    isSelectedUserOnline;

  const canSendRoom = chatMode === "room" && Boolean(selectedRoom?.id);

  const canSendMessage = canSendRoom || canSendPrivate;

  /* =========================
     ROOM ACTIONS
  ========================= */

  const handleSelectRoom = (room) => {
    if (!room) return;

    setSelectedRoom(room);
    setSelectedUser(null);
    setPrivateActiveUser(null);
    setChatMode("room");
    setMobileTab("chat");
    setStatusText(`Та "${room.name}" group room-д орлоо.`);

    socket.emit("join_room", {
      roomId: room.id,
    });
  };

  const handleLeaveRoom = () => {
    if (!selectedRoom) return;

    socket.emit("leave_room", {
      roomId: selectedRoom.id,
    });

    setSelectedRoom(null);
    setStatusText("Эхлээд group chat сонгоно уу.");
  };

  const handleCreateRoom = () => {
    const cleanName = newRoomName.trim();

    if (!cleanName) return;

    socket.emit("create_room", {
      name: cleanName,
    });

    setNewRoomName("");
    setMobileTab("chat");
  };

  /* =========================
     PRIVATE CHAT ACTIONS
  ========================= */

  const handleSelectUser = (username) => {
    if (!username || username === myName) return;

    setSelectedUser(username);
    setSelectedRoom(null);
    setChatMode("private");
    setMobileTab("chat");
    loadPrivateHistory(username);

    if (!onlineUsers.includes(username)) {
      setPrivateActiveUser(null);
      setStatusText(`${username} одоогоор offline байна.`);
      return;
    }

    setStatusText(`${username} рүү private chat request явууллаа.`);

    socket.emit("send_chat_request", {
      from: myName,
      to: username,
    });
  };

  const handleAcceptRequest = () => {
    if (!receivedRequest?.from) return;

    socket.emit("respond_chat_request", {
      from: receivedRequest.from,
      to: myName,
      accepted: true,
    });

    setSelectedUser(receivedRequest.from);
    setSelectedRoom(null);
    setChatMode("private");
    setPrivateActiveUser(receivedRequest.from);
    setStatusText(`${receivedRequest.from}-тэй chat эхэллээ.`);
    setReceivedRequest(null);
    setMobileTab("chat");
  };

  const handleRejectRequest = () => {
    if (!receivedRequest?.from) return;

    socket.emit("respond_chat_request", {
      from: receivedRequest.from,
      to: myName,
      accepted: false,
    });

    setStatusText(`${receivedRequest.from}-ийн request татгалзлаа.`);
    setReceivedRequest(null);
  };

  /* =========================
   SAVE PRIVATE CHAT ACTION
   ❤️ дарвал тухайн хүнтэй хийсэн chat history-г хадгална
========================= */

const handleToggleSaveChat = async () => {
  if (!selectedUser || chatMode !== "private") return;

  const isSaved = savedChats.includes(selectedUser);

  const messagesWithSelectedUser = privateMessages.filter((message) =>
    isSamePrivatePair(message, myName, selectedUser)
  );

  try {
    const response = await fetch(
      `${SERVER_URL}/api/users/${encodeURIComponent(myName)}/saved-chats`,
      {
        method: isSaved ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          partner: selectedUser,
          messages: messagesWithSelectedUser,
        }),
      }
    );

    const data = await response.json();

    if (response.ok && data.ok) {
      setRecentChats(data.recentChats || []);
      setSavedChats(data.savedChats || []);

      setStatusText(
        isSaved
          ? `${selectedUser} хадгалсан чатаас хасагдлаа.`
          : `${selectedUser}-тэй хийсэн chat history хадгалагдлаа.`
      );
    }
  } catch (err) {
    console.error("Save chat error:", err);
    setStatusText("Chat хадгалах үед алдаа гарлаа.");
  }
};

/* =========================
   REPORT CHAT ACTION
   Одоогийн chat-ийн сүүлийн message-үүдийг admin руу илгээнэ
========================= */

const handleReportChat = async () => {
  try {
    const target =
      chatMode === "private"
        ? selectedUser
        : selectedRoom?.name || "Group сонгоогүй";

    const messagesToReport =
      chatMode === "private"
        ? privateMessages
            .filter((message) =>
              isSamePrivatePair(message, myName, selectedUser)
            )
            .slice(-20)
        : currentMessages.slice(-20);

    const response = await fetch(`${SERVER_URL}/api/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reporter: myName,
        chatType: chatMode === "private" ? "private" : "group",
        target,
        messages: messagesToReport,
      }),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      setStatusText("Report admin руу амжилттай илгээгдлээ.");
      alert("Report admin руу амжилттай илгээгдлээ.");
    } else {
      alert(data.message || "Report илгээх үед алдаа гарлаа.");
    }
  } catch (err) {
    console.error("Report error:", err);
    alert("Report илгээх үед алдаа гарлаа.");
  }
};

  /* =========================
   SEND TEXT MESSAGE
========================= */

const handleSendMessage = () => {
  const cleanText = messageInput.trim();

  if (!cleanText) return;

  if (chatMode === "room") {
    if (!selectedRoom?.id) {
      setStatusText("Эхлээд group chat сонгоно уу.");
      return;
    }

    socket.emit("join_room", {
      roomId: selectedRoom.id,
    });

    socket.emit("room_message", {
      roomId: selectedRoom.id,
      text: cleanText,
    });

    setMessageInput("");
    return;
  }

  if (chatMode === "private") {
    if (!selectedUser) return;

    if (!canSendPrivate) {
      setStatusText(
        "Private chat эхлүүлэхийн тулд request зөвшөөрөгдөх хэрэгтэй."
      );
      return;
    }

    socket.emit("private_message", {
      from: myName,
      to: selectedUser,
      text: cleanText,
    });

    setMessageInput("");
  }
};

const handleInputKeyDown = (event) => {
  if (event.key === "Enter") {
    handleSendMessage();
  }
};

  /* =========================
     SEND IMAGE MESSAGE
  ========================= */

  const handleImageButtonClick = () => {
    if (!canSendMessage) return;
    fileInputRef.current?.click();
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Зөвхөн зураг файл сонгоно уу.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = reader.result;

      if (chatMode === "room" && selectedRoom) {
        socket.emit("room_image", {
          roomId: selectedRoom.id,
          image,
          fileName: file.name,
        });
      }

      if (chatMode === "private" && selectedUser && canSendPrivate) {
        socket.emit("private_image", {
          from: myName,
          to: selectedUser,
          image,
          fileName: file.name,
        });
      }
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  /* =========================
     SEND VOICE MESSAGE
  ========================= */

  const handleVoiceButtonClick = async () => {
    if (!canSendMessage) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        const reader = new FileReader();

        reader.onload = () => {
          const audio = reader.result;

          if (chatMode === "room" && selectedRoom) {
            socket.emit("room_voice", {
              roomId: selectedRoom.id,
              audio,
            });
          }

          if (chatMode === "private" && selectedUser && canSendPrivate) {
            socket.emit("private_voice", {
              from: myName,
              to: selectedUser,
              audio,
            });
          }
        };

        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Voice record error:", err);
      alert("Микрофон ашиглах зөвшөөрөл хэрэгтэй.");
      setIsRecording(false);
    }
  };

  /* =========================
     LOGOUT
  ========================= */

  const handleLogout = () => {
    localStorage.removeItem("newfriends_user");
    localStorage.removeItem("chatUser");
    localStorage.removeItem("user");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("username");

    navigate("/");
  };

  /* =========================
     RENDER MESSAGE
  ========================= */

  const renderMessage = (msg) => {
    if (!msg) return null;

    if (msg.type === "system" || msg.from === "system") {
      return (
        <div key={msg.id || msg.createdAt} className="system-message">
          {msg.text}
        </div>
      );
    }

    const isMine = msg.from === myName;

    return (
      <div
        key={msg.id || `${msg.from}-${msg.createdAt}-${msg.text}`}
        className={`message-row ${isMine ? "my-message" : "their-message"}`}
      >
        <div className="message-bubble">
          {chatMode !== "private" && (
            <strong className="message-sender">{msg.from}</strong>
          )}

          {msg.type === "image" && msg.image ? (
            <div className="media-message">
              <img className="chat-image" src={msg.image} alt="chat upload" />
            </div>
          ) : msg.type === "audio" && msg.audio ? (
            <div className="media-message">
              <audio className="chat-audio" src={msg.audio} controls />
            </div>
          ) : (
            <div className="message-text">{msg.text}</div>
          )}

          {msg.createdAt && (
            <span className="message-time">
              {formatMessageTime(msg.createdAt)}
            </span>
          )}
        </div>
      </div>
    );
  };

  /* =========================
     RENDER ROOM ITEM
  ========================= */

  const renderRoomItem = (room) => (
    <button
      key={room.id}
      type="button"
      className={`room-item ${
        selectedRoom?.id === room.id ? "active-room" : ""
      }`}
      onClick={() => handleSelectRoom(room)}
    >
      <div className="room-top">
        <div className="room-name">{room.name}</div>
        <div className="room-count">{room.count || 0} хүн</div>
      </div>

      <div className="room-desc">{room.description}</div>

      {selectedRoom?.id === room.id && (
        <div className="joined-badge">Та энэ room-д байна</div>
      )}
    </button>
  );

  /* =========================
     RENDER SAVED CHAT ITEM
  ========================= */

  const renderSavedChatItem = (username) => {
    const online = onlineUsers.includes(username);

    return (
      <button
        key={username}
        type="button"
        className={`folder-user-item ${
          selectedUser === username ? "active-folder-user" : ""
        }`}
        onClick={() => handleSelectUser(username)}
      >
        <span className="folder-user-icon">💬</span>
        <span className="folder-user-name">{username}</span>
        <span
          className={`folder-user-status ${online ? "online" : "offline"}`}
        >
          {online ? "online" : "offline"}
        </span>
      </button>
    );
  };

  /* =========================
     RENDER ONLINE USER ITEM
  ========================= */

  const renderOnlineUserItem = (username) => (
    <button
      key={username}
      type="button"
      className={`folder-user-item ${
        selectedUser === username ? "active-folder-user" : ""
      }`}
      onClick={() => handleSelectUser(username)}
    >
      <span className="folder-user-icon">👥</span>
      <span className="folder-user-name">{username}</span>
      <span className="folder-user-status online">online</span>
    </button>
  );

  /* =========================
     RENDER SIDEBAR
  ========================= */

  const renderSidebar = () => (
    <aside className="sidebar">
      <h2>Newfriends.com</h2>

      <div className="cat-row"></div>

      <div className="my-name-box">
        <p>Таны нэр:</p>
        <strong>{myName}</strong>
      </div>

      <div className="sidebar-scroll">
        <div className="online-title">Групп chats 💭</div>

        <div className="rooms-list">{rooms.map(renderRoomItem)}</div>

        <div className="create-room-box">
          <div className="online-title create-room-title">
            Групп үүсгэх ✨
          </div>

          <div className="create-room-row">
            <input
              value={newRoomName}
              onChange={(event) => setNewRoomName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCreateRoom();
              }}
              placeholder="Групп нэр..."
            />

            <button type="button" onClick={handleCreateRoom}>
              +
            </button>
          </div>
        </div>

        <div className="folder-section">
          <button
            type="button"
            className="folder-header"
            onClick={() => setIsRecentOpen((prev) => !prev)}
          >
            <span className={`folder-arrow ${isRecentOpen ? "open" : ""}`}>
              ›
            </span>
            <span className="folder-title">Өмнөх чатнууд</span>
            <span className="folder-count">{recentChats.length}</span>
          </button>

          {isRecentOpen && (
            <div className="folder-content">
              {recentChats.length > 0 ? (
                recentChats.map(renderSavedChatItem)
              ) : (
                <div className="folder-empty">Одоогоор өмнөх чат алга</div>
              )}
            </div>
          )}
        </div>

        <div className="folder-section">
          <button
            type="button"
            className="folder-header"
            onClick={() => setIsOnlineOpen((prev) => !prev)}
          >
            <span className={`folder-arrow ${isOnlineOpen ? "open" : ""}`}>
              ›
            </span>
            <span className="folder-title">Онлайн хэрэглэгчид</span>
            <span className="folder-count">{filteredOnlineUsers.length}</span>
          </button>

          {isOnlineOpen && (
            <div className="folder-content">
              {filteredOnlineUsers.length > 0 ? (
                filteredOnlineUsers.map(renderOnlineUserItem)
              ) : (
                <div className="folder-empty">Одоогоор online хүн алга</div>
              )}
            </div>
          )}
        </div>
      </div>

      <button type="button" className="logout-btn" onClick={handleLogout}>
        Гарах
      </button>
    </aside>
  );

  /* =========================
   RENDER CHAT HEADER
========================= */

const renderChatHeader = () => {
  let title = "Group chat сонгоно уу";
  let subtitle = "Зүүн талын group дээр дарж group chat эхлүүлнэ.";

  if (chatMode === "room" && selectedRoom) {
    title = selectedRoom.name;
    subtitle = selectedRoom.description;
  }

  if (chatMode === "private" && selectedUser) {
    title = selectedUser;
    subtitle = `${selectedUser}-тэй private Чат хийж байна.`;
  }

  return (
    <div className="chat-header">
      <div className="chat-header-info">
        <h1>{title}</h1>
        <p className="chat-subtitle">{subtitle}</p>
        <p className="status-text">{statusText}</p>
      </div>

      <div className="chat-action-row">
        {chatMode === "room" && selectedRoom && (
          <button
            type="button"
            className="leave-room-btn"
            onClick={handleLeaveRoom}
          >
            Room-оос гарах
          </button>
        )}

        {chatMode === "private" && selectedUser && (
          <button
            type="button"
            className={`save-chat-btn ${
              savedChats.includes(selectedUser) ? "saved" : ""
            }`}
            onClick={handleToggleSaveChat}
            title="Энэ чатыг хадгалах"
          >
            {savedChats.includes(selectedUser)
              ? "❤️ Хадгалсан"
              : "🤍 Хадгалах"}
          </button>
        )}

        <button
          type="button"
          className="report-btn"
          onClick={handleReportChat}
        >
          Report
        </button>
      </div>

      {chatMode === "room" && selectedRoom?.users?.length > 0 && (
        <div className="room-members">
          {selectedRoom.users.map((user) => (
            <span key={user} className="member-pill">
              {user}
            </span>
          ))}
        </div>
      )}

      {chatMode === "private" && selectedUser && (
        <div className="room-members">
          <span className="member-pill">
            {isSelectedUserOnline ? "online" : "offline"}
          </span>
          <span className="member-pill">
            {canSendPrivate ? "chatting" : "request хэрэгтэй"}
          </span>
        </div>
      )}
    </div>
  );
};

  /* =========================
     RENDER REQUEST BOX
  ========================= */

  const renderRequestBox = () => {
    if (!receivedRequest) return null;

    return (
      <div className="request-box">
        <p>
          <strong>{receivedRequest.from}</strong> private chat хийх хүсэлт
          илгээсэн байна.
        </p>

        <div className="request-actions">
          <button type="button" className="accept-btn" onClick={handleAcceptRequest}>
            Зөвшөөрөх
          </button>

          <button type="button" className="reject-btn" onClick={handleRejectRequest}>
            Татгалзах
          </button>
        </div>
      </div>
    );
  };

  /* =========================
     RENDER MESSAGES
  ========================= */

  const renderMessages = () => (
    <div className="messages-box">
      {currentMessages.length > 0 ? (
        currentMessages.map(renderMessage)
      ) : (
        <p className="empty-text">
  {chatMode === "private"
    ? "Одоогоор private мессеж алга."
    : selectedRoom
    ? "Энэ group-д одоогоор мессеж алга. Эхний мессежээ бичээрэй."
    : "Эхлээд group chat сонгоно уу."}
</p>
      )}

      <div ref={messagesEndRef} />
    </div>
  );

  /* =========================
     RENDER INPUT BAR
  ========================= */

  const renderInputBar = () => (
    <div className="message-input-row">
      <input
        value={messageInput}
        onChange={(event) => setMessageInput(event.target.value)}
        onKeyDown={handleInputKeyDown}
        disabled={!canSendMessage}
        placeholder={
          canSendMessage
            ? "Энд мессежээ бичнэ..."
            : chatMode === "private"
            ? "Private chat эхлүүлэхийн тулд request зөвшөөрөгдөх хэрэгтэй."
            : "Мессеж бичихийн тулд group room-д орно уу."
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        style={{ display: "none" }}
      />

      <button
        type="button"
        className="media-btn"
        onClick={handleImageButtonClick}
        disabled={!canSendMessage}
      >
        🖼️
      </button>

      <button
        type="button"
        className={`media-btn ${isRecording ? "recording-btn" : ""}`}
        onClick={handleVoiceButtonClick}
        disabled={!canSendMessage}
      >
        🎤
      </button>

      <button
        type="button"
        className="send-btn"
        onClick={handleSendMessage}
        disabled={!canSendMessage}
      >
        Илгээх
      </button>
    </div>
  );

  /* =========================
     MOBILE PANEL
  ========================= */

  const renderMobilePanel = () => {
    if (mobileTab === "chat") return null;

    if (mobileTab === "rooms") {
      return (
        <div className="mobile-panel">
          <div className="mobile-panel-content">
            <h3>Групп чат</h3>

            <div className="mobile-list">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className={`mobile-list-item ${
                    selectedRoom?.id === room.id ? "active" : ""
                  }`}
                  onClick={() => handleSelectRoom(room)}
                >
                  <div>
                    <strong>{room.name}</strong>
                    <p>{room.description}</p>
                    {selectedRoom?.id === room.id && <span>Та энэ room-д байна</span>}
                  </div>

                  <em>{room.count || 0}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (mobileTab === "recent") {
      return (
        <div className="mobile-panel">
          <div className="mobile-panel-content">
            <h3>Өмнөх чатнууд</h3>

            <div className="mobile-list">
              {recentChats.length > 0 ? (
                recentChats.map((username) => (
                  <button
                    key={username}
                    type="button"
                    className={`mobile-list-item ${
                      selectedUser === username ? "active" : ""
                    }`}
                    onClick={() => handleSelectUser(username)}
                  >
                    <div>
                      <strong>{username}</strong>
                      <p>Хадгалсан private chat</p>
                    </div>

                    <em>{onlineUsers.includes(username) ? "online" : "offline"}</em>
                  </button>
                ))
              ) : (
                <div className="mobile-empty">Одоогоор өмнөх чат алга</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (mobileTab === "users") {
      return (
        <div className="mobile-panel">
          <div className="mobile-panel-content">
            <h3>Онлайн хэрэглэгчид</h3>

            <div className="mobile-list">
              {filteredOnlineUsers.length > 0 ? (
                filteredOnlineUsers.map((username) => (
                  <button
                    key={username}
                    type="button"
                    className={`mobile-list-item ${
                      selectedUser === username ? "active" : ""
                    }`}
                    onClick={() => handleSelectUser(username)}
                  >
                    <div>
                      <strong>{username}</strong>
                      <p>Private chat request явуулах</p>
                    </div>

                    <em>online</em>
                  </button>
                ))
              ) : (
                <div className="mobile-empty">Одоогоор online хүн алга</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (mobileTab === "create") {
      return (
        <div className="mobile-panel">
          <div className="mobile-panel-content">
            <h3>Групп үүсгэх</h3>

            <div className="mobile-create-box">
              <input
                value={newRoomName}
                onChange={(event) => setNewRoomName(event.target.value)}
                placeholder="Групп нэр..."
              />

              <button type="button" onClick={handleCreateRoom}>
                Үүсгэх
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  /* =========================
     MOBILE BOTTOM NAV
  ========================= */

  const renderMobileBottomNav = () => (
    <nav className="mobile-bottom-nav">
      <button
        type="button"
        className={mobileTab === "rooms" ? "active" : ""}
        onClick={() => setMobileTab("rooms")}
      >
        <span>👥</span>
        <p>Групп</p>
      </button>

      <button
        type="button"
        className={mobileTab === "users" ? "active" : ""}
        onClick={() => setMobileTab("users")}
      >
        <span>🧑‍🤝‍🧑</span>
        <p>Хүмүүс</p>
      </button>

      <button
        type="button"
        className={mobileTab === "chat" ? "active" : ""}
        onClick={() => setMobileTab("chat")}
      >
        <span>💬</span>
        <p>Чат</p>
      </button>

      <button
        type="button"
        className={mobileTab === "recent" ? "active" : ""}
        onClick={() => setMobileTab("recent")}
      >
        <span>🤍</span>
        <p>Өмнөх</p>
      </button>

      <button
        type="button"
        className={mobileTab === "create" ? "active" : ""}
        onClick={() => setMobileTab("create")}
      >
        <span>＋</span>
        <p>Үүсгэх</p>
      </button>
    </nav>
  );

  /* =========================
     PAGE RENDER
  ========================= */

  return (
    <div className="chat-page">
      {renderSidebar()}

      <main className="chat-section">
        {renderChatHeader()}
        {renderRequestBox()}
        {renderMessages()}
        {renderInputBar()}
      </main>

      {renderMobilePanel()}
      {renderMobileBottomNav()}
    </div>
  );
}