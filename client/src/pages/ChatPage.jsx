import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./Chat.css";

const SERVER_URL =
  import.meta.env.PROD ? window.location.origin : "http://localhost:3001";

export default function Chat() {
  const location = useLocation();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordingTargetRef = useRef(null);

  const myName =
    location.state?.name || localStorage.getItem("chat_name") || "";

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [recentChats, setRecentChats] = useState([]);

  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [roomMessages, setRoomMessages] = useState({});
  const [newRoomName, setNewRoomName] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [outgoingRequest, setOutgoingRequest] = useState(null);
  const [privateMessages, setPrivateMessages] = useState({});

  const [chatMode, setChatMode] = useState("room");
  const [mobileTab, setMobileTab] = useState("groups");

  const [message, setMessage] = useState("");
  const [statusText, setStatusText] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const addRoomMessage = (roomId, msg) => {
    setRoomMessages((prev) => {
      const oldMessages = prev[roomId] || [];

      if (msg.id && oldMessages.some((m) => m.id === msg.id)) {
        return prev;
      }

      return {
        ...prev,
        [roomId]: [...oldMessages, msg],
      };
    });
  };

  const addPrivateMessage = (partner, msg) => {
    setPrivateMessages((prev) => {
      const oldMessages = prev[partner] || [];

      if (msg.id && oldMessages.some((m) => m.id === msg.id)) {
        return prev;
      }

      return {
        ...prev,
        [partner]: [...oldMessages, msg],
      };
    });
  };

  const loadRecentChats = async (username) => {
    try {
      const response = await fetch(
        `${SERVER_URL}/api/users/${encodeURIComponent(username)}/recent-chats`
      );

      const data = await response.json();

      if (response.ok && data.ok) {
        setRecentChats(data.recentChats || []);
      }
    } catch (err) {
      console.error("Recent chats load error:", err);
    }
  };

  useEffect(() => {
    if (!myName) {
      navigate("/");
      return;
    }

    loadRecentChats(myName);

    const socket = io(SERVER_URL);
    socketRef.current = socket;

    socket.emit("join", myName);

    socket.on("users_list", (users) => {
      setOnlineUsers(users.filter((u) => u !== myName));
    });

    socket.on("rooms_data", (roomsData) => {
      setRooms(roomsData || []);
    });

    socket.on("room_created", ({ room }) => {
      if (!room?.id) return;

      setSelectedRoom(room.id);
      setSelectedUser(null);
      setChatMode("room");
      setMobileTab("chat");

      setJoinedRooms((prev) =>
        prev.includes(room.id) ? prev : [...prev, room.id]
      );

      socket.emit("join_room", {
        roomId: room.id,
      });

      setStatusText("Шинэ group chat үүслээ.");
    });

    socket.on("room_removed", ({ roomId, text }) => {
      setJoinedRooms((prev) => prev.filter((id) => id !== roomId));

      setRoomMessages((prev) => {
        const copy = { ...prev };
        delete copy[roomId];
        return copy;
      });

      setSelectedRoom((prev) => (prev === roomId ? null : prev));
      setStatusText(text || "Group устлаа.");
    });

    socket.on("room_history", ({ roomId, messages }) => {
      setRoomMessages((prev) => ({
        ...prev,
        [roomId]: messages || [],
      }));
    });

    socket.on("room_system_message", (msg) => {
      addRoomMessage(msg.roomId, msg);
    });

    socket.on("room_message", (msg) => {
      addRoomMessage(msg.roomId, msg);
    });

    socket.on("room_image", (msg) => {
      addRoomMessage(msg.roomId, msg);
    });

    socket.on("room_voice", (msg) => {
      addRoomMessage(msg.roomId, msg);
    });

    socket.on("receive_chat_request", ({ from }) => {
      setIncomingRequest({ from });
      setChatMode("private");
      setSelectedUser(from);
      setSelectedRoom(null);
      setMobileTab("chat");
      setStatusText(`${from} танд chat request илгээлээ.`);
    });

    socket.on("chat_request_response", ({ from, to, accepted }) => {
      const otherUser = from === myName ? to : from;

      if (accepted) {
        setActiveChatUser(otherUser);
        setSelectedUser(otherUser);
        setSelectedRoom(null);
        setChatMode("private");
        setMobileTab("chat");
        setOutgoingRequest(null);
        setIncomingRequest(null);
        setStatusText(`${otherUser}-тэй чат эхэллээ.`);
        loadRecentChats(myName);
      } else {
        setOutgoingRequest(null);
        setIncomingRequest(null);
        setStatusText(`${otherUser} chat request-ийг татгалзлаа.`);
      }
    });

    socket.on("chat_started", ({ users }) => {
      const otherUser = users.find((u) => u !== myName);

      setActiveChatUser(otherUser);
      setSelectedUser(otherUser);
      setSelectedRoom(null);
      setChatMode("private");
      setMobileTab("chat");
      setOutgoingRequest(null);
      setIncomingRequest(null);
      setStatusText(`${otherUser}-тэй чат эхэллээ.`);
      loadRecentChats(myName);
    });

    socket.on("private_message", (msg) => {
      const partner = msg.from === myName ? msg.to : msg.from;
      addPrivateMessage(partner, msg);
    });

    socket.on("private_image", (msg) => {
      const partner = msg.from === myName ? msg.to : msg.from;
      addPrivateMessage(partner, msg);
    });

    socket.on("private_voice", (msg) => {
      const partner = msg.from === myName ? msg.to : msg.from;
      addPrivateMessage(partner, msg);
    });

    socket.on("partner_left", ({ username, text }) => {
      addPrivateMessage(username, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        from: "system",
        type: "system",
        text,
      });

      setActiveChatUser((prev) => (prev === username ? null : prev));
      setOutgoingRequest((prev) => (prev === username ? null : prev));
      setIncomingRequest((prev) => (prev?.from === username ? null : prev));
      setSelectedUser(username);
      setSelectedRoom(null);
      setChatMode("private");
      setMobileTab("chat");
      setStatusText(text);
    });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      socket.disconnect();
    };
  }, [myName, navigate]);

  const currentRoom = useMemo(() => {
    return rooms.find((room) => room.id === selectedRoom) || null;
  }, [rooms, selectedRoom]);

  const canRoomChat = chatMode === "room" && selectedRoom;

  const canPrivateChat =
    chatMode === "private" &&
    selectedUser &&
    activeChatUser &&
    selectedUser === activeChatUser;

  const canChat = canRoomChat || canPrivateChat;

  const currentMessages =
    chatMode === "room"
      ? selectedRoom
        ? roomMessages[selectedRoom] || []
        : []
      : selectedUser
      ? privateMessages[selectedUser] || []
      : [];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMessages.length, selectedRoom, selectedUser, chatMode]);

  const handleCreateRoom = () => {
    const cleanName = newRoomName.trim();
    if (!cleanName) return;

    socketRef.current.emit("create_room", {
      name: cleanName,
    });

    setNewRoomName("");
  };

  const handleRoomClick = (roomId) => {
    setChatMode("room");
    setSelectedRoom(roomId);
    setSelectedUser(null);
    setMessage("");
    setMobileTab("chat");

    if (!joinedRooms.includes(roomId)) {
      setJoinedRooms((prev) => [...prev, roomId]);
    }

    socketRef.current.emit("join_room", {
      roomId,
    });

    setStatusText("Та group room-д орлоо.");
  };

  const handleLeaveRoom = () => {
    if (!selectedRoom) return;

    socketRef.current.emit("leave_room", {
      roomId: selectedRoom,
    });

    setJoinedRooms((prev) => prev.filter((roomId) => roomId !== selectedRoom));
    setStatusText("Та room-оос гарлаа.");
  };

  const handleUserClick = (user) => {
    setChatMode("private");
    setSelectedUser(user);
    setSelectedRoom(null);
    setMessage("");
    setMobileTab("chat");

    if (activeChatUser === user) {
      setStatusText(`${user}-тэй чатлаж байна.`);
      return;
    }

    if (!onlineUsers.includes(user)) {
      setStatusText(`${user} одоогоор online биш байна.`);
      return;
    }

    if (outgoingRequest === user) {
      setStatusText(`${user} таны request-ийг зөвшөөрөхийг хүлээж байна.`);
      return;
    }

    socketRef.current.emit("send_chat_request", {
      from: myName,
      to: user,
    });

    setOutgoingRequest(user);
    setStatusText(`${user} рүү request явууллаа...`);
  };

  const handleRequestResponse = (accepted) => {
    if (!incomingRequest) return;

    socketRef.current.emit("respond_chat_request", {
      from: incomingRequest.from,
      to: myName,
      accepted,
    });

    if (accepted) {
      setActiveChatUser(incomingRequest.from);
      setSelectedUser(incomingRequest.from);
      setSelectedRoom(null);
      setChatMode("private");
      setMobileTab("chat");
      setStatusText(`${incomingRequest.from}-тэй чат эхэллээ.`);
      loadRecentChats(myName);
    } else {
      setStatusText(`${incomingRequest.from}-ийн request-ийг татгалзлаа.`);
    }

    setIncomingRequest(null);
  };

  const handleSendMessage = () => {
    const cleanText = message.trim();
    if (!cleanText) return;
    if (!canChat) return;

    if (chatMode === "room") {
      socketRef.current.emit("room_message", {
        roomId: selectedRoom,
        text: cleanText,
      });
    }

    if (chatMode === "private") {
      socketRef.current.emit("private_message", {
        from: myName,
        to: selectedUser || activeChatUser,
        text: cleanText,
      });
    }

    setMessage("");
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canChat) return;

    try {
      const base64 = await fileToBase64(file);

      if (chatMode === "room") {
        socketRef.current.emit("room_image", {
          roomId: selectedRoom,
          image: base64,
          fileName: file.name,
        });
      }

      if (chatMode === "private") {
        socketRef.current.emit("private_image", {
          from: myName,
          to: selectedUser || activeChatUser,
          image: base64,
          fileName: file.name,
        });
      }
    } catch (err) {
      console.error("Image send error:", err);
    }

    e.target.value = "";
  };

  const startRecording = async () => {
    if (!canChat) return;

    recordingTargetRef.current =
      chatMode === "room"
        ? { mode: "room", roomId: selectedRoom }
        : { mode: "private", to: selectedUser || activeChatUser };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);

        reader.onloadend = () => {
          const target = recordingTargetRef.current;

          if (target?.mode === "room") {
            socketRef.current.emit("room_voice", {
              roomId: target.roomId,
              audio: reader.result,
            });
          }

          if (target?.mode === "private") {
            socketRef.current.emit("private_voice", {
              from: myName,
              to: target.to,
              audio: reader.result,
            });
          }
        };

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access error:", err);
      alert("Микрофон permission өгнө үү.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleLogout = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    localStorage.removeItem("chat_name");
    localStorage.removeItem("chat_user_id");

    socketRef.current?.disconnect();
    navigate("/");
  };

  return (
    <div className="chat-page">
      <div className="sidebar">
        <h2>Нээлттэй байгаарай</h2>
        <div className="cat-row">🐱 🐱 🐱 🐱</div>

        <div className="my-name-box">
          <p>Таны нэр:</p>
          <strong>{myName}</strong>
        </div>

        <div className="sidebar-scroll">
          <h3 className="online-title">Group chats 💬</h3>

          <div className="rooms-list">
            {rooms.length === 0 ? (
              <div className="user-item-static">Room ачааллаж байна...</div>
            ) : (
              rooms.map((room) => {
                const isSelected =
                  chatMode === "room" && selectedRoom === room.id;
                const isJoined = joinedRooms.includes(room.id);

                return (
                  <button
                    key={room.id}
                    className={`room-item ${
                      isSelected ? "active-room" : ""
                    } ${isJoined ? "joined-room" : ""}`}
                    onClick={() => handleRoomClick(room.id)}
                  >
                    <div className="room-top">
                      <span className="room-name">{room.name}</span>
                      <span className="room-count">{room.count} хүн</span>
                    </div>

                    <div className="room-desc">{room.description}</div>

                    {isJoined && (
                      <div className="joined-badge">Та энэ room-д байна</div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="create-room-box">
            <h3 className="online-title create-room-title">
              Group үүсгэх ✨
            </h3>

            <div className="create-room-row">
              <input
                type="text"
                placeholder="Group нэр..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
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
              onClick={() =>
                setMobileTab((prev) => (prev === "recent" ? "chat" : "recent"))
              }
            >
              <span
                className={`folder-arrow ${
                  mobileTab === "recent" ? "open" : ""
                }`}
              >
                ›
              </span>

              <span className="folder-title">Өмнөх чатнууд</span>

              <span className="folder-count">{recentChats.length}</span>
            </button>

            {mobileTab === "recent" && (
              <div className="folder-content">
                {recentChats.length === 0 ? (
                  <div className="folder-empty">Одоогоор өмнөх чат алга</div>
                ) : (
                  recentChats.map((user) => (
                    <button
                      key={user}
                      className={`folder-user-item ${
                        chatMode === "private" && selectedUser === user
                          ? "active-folder-user"
                          : ""
                      }`}
                      onClick={() => handleUserClick(user)}
                    >
                      <span className="folder-user-icon">💬</span>

                      <span className="folder-user-name">{user}</span>

                      <span
                        className={`folder-user-status ${
                          onlineUsers.includes(user) ? "online" : "offline"
                        }`}
                      >
                        {onlineUsers.includes(user) ? "online" : "offline"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="folder-section">
            <button
              type="button"
              className="folder-header"
              onClick={() =>
                setMobileTab((prev) => (prev === "users" ? "chat" : "users"))
              }
            >
              <span
                className={`folder-arrow ${
                  mobileTab === "users" ? "open" : ""
                }`}
              >
                ›
              </span>

              <span className="folder-title">Online users</span>

              <span className="folder-count">{onlineUsers.length}</span>
            </button>

            {mobileTab === "users" && (
              <div className="folder-content">
                {onlineUsers.length === 0 ? (
                  <div className="folder-empty">Одоогоор online хүн алга</div>
                ) : (
                  onlineUsers.map((user) => (
                    <button
                      key={user}
                      className={`folder-user-item ${
                        chatMode === "private" && selectedUser === user
                          ? "active-folder-user"
                          : ""
                      }`}
                      onClick={() => handleUserClick(user)}
                    >
                      <span className="folder-user-icon">👤</span>

                      <span className="folder-user-name">{user}</span>

                      {activeChatUser === user ? (
                        <span className="folder-user-status chatting">
                          chat
                        </span>
                      ) : outgoingRequest === user ? (
                        <span className="folder-user-status request">
                          request
                        </span>
                      ) : (
                        <span className="folder-user-status online">
                          online
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          Гарах
        </button>
      </div>

      {/* MOBILE TAB PANEL */}
      <div className="mobile-panel">
        {mobileTab === "groups" && (
          <div className="mobile-panel-content">
            <h3>Group chats</h3>

            <div className="mobile-list">
              {rooms.length === 0 ? (
                <div className="mobile-empty">Room ачааллаж байна...</div>
              ) : (
                rooms.map((room) => {
                  const isSelected =
                    chatMode === "room" && selectedRoom === room.id;
                  const isJoined = joinedRooms.includes(room.id);

                  return (
                    <button
                      key={room.id}
                      className={`mobile-list-item ${
                        isSelected ? "active" : ""
                      }`}
                      onClick={() => handleRoomClick(room.id)}
                    >
                      <div>
                        <strong>{room.name}</strong>
                        <p>{room.description}</p>
                        {isJoined && <span>Та энэ room-д байна</span>}
                      </div>

                      <em>{room.count} хүн</em>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {mobileTab === "create" && (
          <div className="mobile-panel-content">
            <h3>Group үүсгэх ✨</h3>

            <div className="mobile-create-box">
              <input
                type="text"
                placeholder="Group нэр..."
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
              />

              <button
                type="button"
                onClick={() => {
                  handleCreateRoom();
                  setMobileTab("groups");
                }}
              >
                Үүсгэх
              </button>
            </div>
          </div>
        )}

        {mobileTab === "recent" && (
          <div className="mobile-panel-content">
            <h3>Өмнөх чатнууд 🔁</h3>

            <div className="mobile-list">
              {recentChats.length === 0 ? (
                <div className="mobile-empty">Одоогоор өмнөх чат алга</div>
              ) : (
                recentChats.map((user) => (
                  <button
                    key={user}
                    className={`mobile-list-item ${
                      chatMode === "private" && selectedUser === user
                        ? "active"
                        : ""
                    }`}
                    onClick={() => handleUserClick(user)}
                  >
                    <div>
                      <strong>{user}</strong>
                      <p>
                        {onlineUsers.includes(user)
                          ? "online байна"
                          : "offline байна"}
                      </p>
                    </div>

                    <em>{onlineUsers.includes(user) ? "online" : "offline"}</em>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {mobileTab === "users" && (
          <div className="mobile-panel-content">
            <h3>Online users 👥</h3>

            <div className="mobile-list">
              {onlineUsers.length === 0 ? (
                <div className="mobile-empty">Одоогоор online хүн алга</div>
              ) : (
                onlineUsers.map((user) => (
                  <button
                    key={user}
                    className={`mobile-list-item ${
                      chatMode === "private" && selectedUser === user
                        ? "active"
                        : ""
                    }`}
                    onClick={() => handleUserClick(user)}
                  >
                    <div>
                      <strong>{user}</strong>
                      <p>
                        {activeChatUser === user
                          ? "чатлаж байна"
                          : outgoingRequest === user
                          ? "request явсан"
                          : "request явуулах"}
                      </p>
                    </div>

                    <em>
                      {activeChatUser === user
                        ? "chat"
                        : outgoingRequest === user
                        ? "request"
                        : "online"}
                    </em>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="chat-section">
        {incomingRequest && (
          <div className="request-box">
            <p>
              <strong>{incomingRequest.from}</strong> тантай чатлах хүсэлт
              илгээлээ.
            </p>

            <div className="request-actions">
              <button
                className="accept-btn"
                onClick={() => handleRequestResponse(true)}
              >
                Зөвшөөрөх
              </button>

              <button
                className="reject-btn"
                onClick={() => handleRequestResponse(false)}
              >
                Татгалзах
              </button>
            </div>
          </div>
        )}

        <div className="chat-header">
          <div className="chat-header-top">
            <div>
              <h1>
                {chatMode === "room"
                  ? currentRoom
                    ? currentRoom.name
                    : "Group chat сонгоно уу"
                  : selectedUser
                  ? selectedUser
                  : "Хэрэглэгч сонгоно уу"}
              </h1>

              <p className="chat-subtitle">
                {chatMode === "room"
                  ? currentRoom
                    ? currentRoom.description
                    : "Зүүн талын group дээр дарж group chat эхлүүлнэ."
                  : selectedUser
                  ? canPrivateChat
                    ? `${selectedUser}-тэй private chat хийж байна.`
                    : outgoingRequest === selectedUser
                    ? `${selectedUser} таны request-ийг зөвшөөрөхийг хүлээж байна.`
                    : onlineUsers.includes(selectedUser)
                    ? "Online user дээр дарж request явуулна."
                    : "Энэ хэрэглэгч одоогоор offline байна."
                  : "Online users дээр дарж private chat эхлүүлнэ."}
              </p>

              {statusText && <p className="status-text">{statusText}</p>}
            </div>

            {chatMode === "room" && selectedRoom && (
              <button className="leave-room-btn" onClick={handleLeaveRoom}>
                Room-оос гарах
              </button>
            )}
          </div>

          {chatMode === "room" && currentRoom && (
            <div className="room-members">
              {currentRoom.users?.length > 0 ? (
                currentRoom.users.map((user) => (
                  <span key={user} className="member-pill">
                    {user}
                  </span>
                ))
              ) : (
                <span className="member-pill">Одоогоор хүн алга</span>
              )}
            </div>
          )}
        </div>

        <div className="messages-box">
          {currentMessages.length > 0 ? (
            currentMessages.map((msg, index) =>
              msg.type === "system" || msg.from === "system" ? (
                <div key={msg.id || index} className="system-message">
                  {msg.text}
                </div>
              ) : (
                <div
                  key={msg.id || index}
                  className={`message-row ${
                    msg.from === myName ? "my-message" : "their-message"
                  }`}
                >
                  <div className="message-bubble">
                    <strong>{msg.from}:</strong>{" "}
                    {msg.type === "image" ? (
                      <div className="media-message">
                        <img
                          src={msg.image}
                          alt={msg.fileName || "sent image"}
                          className="chat-image"
                        />
                      </div>
                    ) : msg.type === "audio" ? (
                      <div className="media-message">
                        <audio
                          controls
                          src={msg.audio}
                          className="chat-audio"
                        />
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              )
            )
          ) : (
            <p className="empty-text">
              {chatMode === "room"
                ? selectedRoom
                  ? "Энэ group chat-д одоогоор мессеж алга."
                  : "Эхлээд group chat сонгоно уу."
                : selectedUser
                ? "Одоогоор private мессеж алга."
                : "Эхлээд online user сонгоно уу."}
            </p>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="message-input-row">
          <input
            type="text"
            placeholder={
              canChat
                ? "Энд мессежээ бичнэ..."
                : chatMode === "room"
                ? "Мессеж бичихийн тулд group room-д орно уу."
                : "Private chat эхлэхийн тулд request зөвшөөрөгдөх хэрэгтэй."
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={!canChat}
          />

          <label className={`media-btn ${!canChat ? "disabled-btn" : ""}`}>
            🖼️
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              disabled={!canChat}
              hidden
            />
          </label>

          {!isRecording ? (
            <button
              type="button"
              className="media-btn"
              onClick={startRecording}
              disabled={!canChat}
            >
              🎤
            </button>
          ) : (
            <button
              type="button"
              className="media-btn recording-btn"
              onClick={stopRecording}
            >
              ⏹
            </button>
          )}

          <button
            type="button"
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!canChat}
          >
            Илгээх
          </button>
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="mobile-bottom-nav">
        <button
          type="button"
          className={mobileTab === "groups" ? "active" : ""}
          onClick={() => setMobileTab("groups")}
        >
          <span>💬</span>
          <p>Group</p>
        </button>

        <button
          type="button"
          className={mobileTab === "users" ? "active" : ""}
          onClick={() => setMobileTab("users")}
        >
          <span>👥</span>
          <p>Users</p>
        </button>

        <button
          type="button"
          className={mobileTab === "chat" ? "active" : ""}
          onClick={() => setMobileTab("chat")}
        >
          <span>✉️</span>
          <p>Chat</p>
        </button>

        <button
          type="button"
          className={mobileTab === "recent" ? "active" : ""}
          onClick={() => setMobileTab("recent")}
        >
          <span>🔁</span>
          <p>Recent</p>
        </button>

        <button
          type="button"
          className={mobileTab === "create" ? "active" : ""}
          onClick={() => setMobileTab("create")}
        >
          <span>＋</span>
          <p>Create</p>
        </button>
      </div>
    </div>
  );
}