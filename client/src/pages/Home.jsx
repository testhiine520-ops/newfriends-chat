import { useState } from "react";
import { useNavigate } from "react-router-dom";

const SERVER_URL =
  import.meta.env.PROD ? window.location.origin : "http://localhost:3001";

export default function Home() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setStatusText("Username болон password оруулна уу.");
      return;
    }

    try {
      setLoading(true);
      setStatusText("");

      const endpoint = mode === "login" ? "/api/login" : "/api/register";

      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setStatusText(data.message || "Алдаа гарлаа.");
        return;
      }

      localStorage.setItem("chat_name", data.user.username);
      localStorage.setItem("chat_user_id", data.user.id);

      navigate("/chat", {
        state: {
          name: data.user.username,
          userId: data.user.id,
        },
      });
    } catch (err) {
      console.error(err);
      setStatusText("Server-тэй холбогдож чадсангүй.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((prev) => (prev === "login" ? "register" : "login"));
    setStatusText("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#071a2f",
        color: "white",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#0c223d",
          border: "1px solid #1f3b5c",
          borderRadius: "22px",
          padding: "26px",
          boxSizing: "border-box",
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom: "8px",
            fontSize: "30px",
            lineHeight: 1.2,
          }}
        >
          {mode === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
        </h1>

        <p
          style={{
            marginTop: 0,
            marginBottom: "22px",
            color: "#c9d7e7",
            fontSize: "16px",
            lineHeight: 1.5,
          }}
        >
          Нээлттэй харилцааны системд account-аараа нэвтэрч,
          бусад хэрэглэгчтэй чатлаарай.
        </p>

        <label
          style={{
            display: "block",
            marginBottom: "8px",
            color: "#dce9f8",
            fontSize: "15px",
          }}
        >
          Username
        </label>

        <input
          type="text"
          placeholder="Username оруулна уу"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "14px",
            border: "1px solid #2a4a6d",
            outline: "none",
            background: "#102b4a",
            color: "white",
            marginBottom: "16px",
            boxSizing: "border-box",
            fontSize: "16px",
          }}
        />

        <label
          style={{
            display: "block",
            marginBottom: "8px",
            color: "#dce9f8",
            fontSize: "15px",
          }}
        >
          Password
        </label>

        <input
          type="password"
          placeholder="Password оруулна уу"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "14px",
            border: "1px solid #2a4a6d",
            outline: "none",
            background: "#102b4a",
            color: "white",
            marginBottom: "14px",
            boxSizing: "border-box",
            fontSize: "16px",
          }}
        />

        {statusText && (
          <p
            style={{
              margin: "0 0 14px 0",
              color: "#ffb3b3",
              fontSize: "14px",
              lineHeight: 1.4,
            }}
          >
            {statusText}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%",
            padding: "15px",
            borderRadius: "14px",
            border: "none",
            background: loading ? "#5d78b5" : "#2b69ff",
            color: "white",
            fontWeight: "700",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "17px",
            marginBottom: "14px",
          }}
        >
          {loading
            ? "Түр хүлээнэ үү..."
            : mode === "login"
            ? "Нэвтрэх"
            : "Бүртгүүлэх"}
        </button>

        <button
          onClick={switchMode}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: "14px",
            border: "1px solid #2a4a6d",
            background: "transparent",
            color: "#dce9f8",
            fontWeight: "600",
            cursor: "pointer",
            fontSize: "15px",
          }}
        >
          {mode === "login"
            ? "Account байхгүй юу? Бүртгүүлэх"
            : "Account байгаа юу? Нэвтрэх"}
        </button>
      </div>
    </div>
  );
}