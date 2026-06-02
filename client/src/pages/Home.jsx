/* =========================
   IMPORTS
========================= */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

/* =========================
   SERVER CONFIG
========================= */

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin);

/* =========================
   HOME PAGE
========================= */

export default function Home() {
  const navigate = useNavigate();

  /* =========================
     FORM STATE
  ========================= */

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  /* =========================
     UI STATE
  ========================= */

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  /* =========================
     SAVE USER AND GO CHAT
  ========================= */

  const saveUserAndGoChat = (userData) => {
    const user = userData || {
      username: username.trim(),
    };

    localStorage.setItem("newfriends_user", JSON.stringify(user));
    navigate("/chat", { replace: true });
  };

  /* =========================
     LOGIN / REGISTER SUBMIT
  ========================= */

  const handleSubmit = async (event) => {
    event.preventDefault();

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    setError("");
    setSuccess("");

    if (!cleanUsername || !cleanPassword) {
      setError("Username болон password оруулна уу.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isRegister ? "/api/register" : "/api/login";

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
        setError(
          data.message ||
            (isRegister
              ? "Бүртгүүлэх үед алдаа гарлаа."
              : "Нэвтрэх үед алдаа гарлаа.")
        );
        return;
      }

      setSuccess(
        isRegister ? "Амжилттай бүртгэгдлээ." : "Амжилттай нэвтэрлээ."
      );

      saveUserAndGoChat(data.user);
    } catch (err) {
      console.error("Auth error:", err);
      setError("Server-тэй холбогдож чадсангүй.");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     SWITCH LOGIN / REGISTER
  ========================= */

  const handleSwitchMode = () => {
    setIsRegister((prev) => !prev);
    setError("");
    setSuccess("");
  };

  /* =========================
     PAGE RENDER
  ========================= */

  return (
    <div className="home-page">
      <button
        type="button"
        className="home-admin-btn"
        onClick={() => navigate("/admin")}
      >
        Admin
      </button>

      <div className="auth-card compact-auth-card">
        <h1>{isRegister ? "Бүртгүүлэх" : "Нэвтрэх"}</h1>

        <p className="auth-subtitle">
          Нээлттэй харилцааны системд account-аараа нэвтэрч, бусад
          хэрэглэгчтэй чатлаарай.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>

          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            autoComplete="username"
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete={isRegister ? "new-password" : "current-password"}
          />

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button type="submit" className="auth-main-btn" disabled={loading}>
            {loading
              ? "Түр хүлээнэ үү..."
              : isRegister
              ? "Бүртгүүлэх"
              : "Нэвтрэх"}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch-btn"
          onClick={handleSwitchMode}
        >
          {isRegister
            ? "Account байгаа юу? Нэвтрэх"
            : "Account байхгүй юу? Бүртгүүлэх"}
        </button>
      </div>
    </div>
  );
}