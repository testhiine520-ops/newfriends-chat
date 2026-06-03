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

const SECURITY_QUESTIONS = [
  "Таны хамгийн дуртай өнгө юу вэ?",
  "Таны төрсөн хот хаана вэ?",
  "Таны анхны багшийн нэр хэн бэ?",
  "Таны дуртай хоол юу вэ?",
  "Таны тэжээвэр амьтны нэр хэн бэ?",
];

/* =========================
   HOME PAGE
========================= */

export default function Home() {
  const navigate = useNavigate();

  // mode: "login" | "register" | "recover"
  const [mode, setMode] = useState("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // register дээр ашиглах
  const [securityQuestion, setSecurityQuestion] = useState(
    SECURITY_QUESTIONS[0]
  );
  const [securityAnswer, setSecurityAnswer] = useState("");

  // recover дээр ашиглах
  const [recoverStep, setRecoverStep] = useState(1); // 1: нэр, 2: хариулт+шинэ нууц үг
  const [recoverQuestion, setRecoverQuestion] = useState("");
  const [recoverAnswer, setRecoverAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";
  const isRecover = mode === "recover";

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const saveUserAndGoChat = (userData) => {
    const user = userData || { username: username.trim() };
    localStorage.setItem("newfriends_user", JSON.stringify(user));
    navigate("/chat", { replace: true });
  };

  /* ===== LOGIN / REGISTER ===== */
  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    resetMessages();

    if (!cleanUsername || !cleanPassword) {
      setError("Username болон password оруулна уу.");
      return;
    }
    if (isRegister && !securityAnswer.trim()) {
      setError("Нууц үг сэргээх асуултын хариултаа оруулна уу.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegister ? "/api/register" : "/api/login";
      const body = isRegister
        ? {
            username: cleanUsername,
            password: cleanPassword,
            securityQuestion,
            securityAnswer: securityAnswer.trim(),
          }
        : { username: cleanUsername, password: cleanPassword };

      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

      setSuccess(isRegister ? "Амжилттай бүртгэгдлээ." : "Амжилттай нэвтэрлээ.");
      saveUserAndGoChat(data.user);
    } catch (err) {
      console.error("Auth error:", err);
      setError("Server-тэй холбогдож чадсангүй.");
    } finally {
      setLoading(false);
    }
  };

  /* ===== RECOVER STEP 1: нэр оруулаад асуулт авах ===== */
  const handleRecoverGetQuestion = async (event) => {
    event.preventDefault();
    const cleanUsername = username.trim();
    resetMessages();

    if (!cleanUsername) {
      setError("Нэрээ оруулна уу.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/recover/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUsername }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message || "Асуулт авах үед алдаа гарлаа.");
        return;
      }

      setRecoverQuestion(data.securityQuestion);
      setRecoverStep(2);
    } catch (err) {
      console.error("Recover question error:", err);
      setError("Server-тэй холбогдож чадсангүй.");
    } finally {
      setLoading(false);
    }
  };

  /* ===== RECOVER STEP 2: хариулт + шинэ нууц үг ===== */
  const handleRecoverReset = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!recoverAnswer.trim() || !newPassword.trim()) {
      setError("Хариулт болон шинэ нууц үгээ оруулна уу.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/recover/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          securityAnswer: recoverAnswer.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message || "Сэргээх үед алдаа гарлаа.");
        return;
      }

      setSuccess(data.message || "Нууц үг шинэчлэгдлээ. Одоо нэвтэрнэ үү.");
      // login руу буцаах
      setMode("login");
      setRecoverStep(1);
      setPassword("");
      setRecoverAnswer("");
      setNewPassword("");
    } catch (err) {
      console.error("Recover reset error:", err);
      setError("Server-тэй холбогдож чадсангүй.");
    } finally {
      setLoading(false);
    }
  };

  const goToMode = (next) => {
    setMode(next);
    setRecoverStep(1);
    resetMessages();
    setPassword("");
    setSecurityAnswer("");
    setRecoverAnswer("");
    setNewPassword("");
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
        <h1>
          {isRecover
            ? "Нууц үг сэргээх"
            : isRegister
            ? "Бүртгүүлэх"
            : "Нэвтрэх"}
        </h1>

        <p className="auth-subtitle">
          {isRecover
            ? "Бүртгүүлэхдээ сонгосон асуултад хариулж нууц үгээ шинэчилнэ үү."
            : "Нээлттэй харилцааны системд account-аараа нэвтэрч, бусад хэрэглэгчтэй чатлаарай."}
        </p>

        {/* ===== LOGIN / REGISTER FORM ===== */}
        {!isRecover && (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={isRegister ? "new-password" : "current-password"}
            />

            {isRegister && (
              <>
                <label htmlFor="secq">Нууц үг сэргээх асуулт</label>
                <select
                  id="secq"
                  className="auth-select"
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                >
                  {SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>

                <label htmlFor="seca">Хариулт</label>
                <input
                  id="seca"
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="Хариултаа бичнэ үү"
                />
              </>
            )}

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
        )}

        {/* ===== RECOVER FORM ===== */}
        {isRecover && recoverStep === 1 && (
          <form className="auth-form" onSubmit={handleRecoverGetQuestion}>
            <label htmlFor="recname">Username</label>
            <input
              id="recname"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Нэрээ оруулна уу"
            />

            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button type="submit" className="auth-main-btn" disabled={loading}>
              {loading ? "Түр хүлээнэ үү..." : "Үргэлжлүүлэх"}
            </button>
          </form>
        )}

        {isRecover && recoverStep === 2 && (
          <form className="auth-form" onSubmit={handleRecoverReset}>
            <label>Асуулт</label>
            <div className="recover-question">{recoverQuestion}</div>

            <label htmlFor="recans">Хариулт</label>
            <input
              id="recans"
              type="text"
              value={recoverAnswer}
              onChange={(e) => setRecoverAnswer(e.target.value)}
              placeholder="Хариултаа бичнэ үү"
            />

            <label htmlFor="newpass">Шинэ нууц үг</label>
            <input
              id="newpass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Шинэ нууц үг"
              autoComplete="new-password"
            />

            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button type="submit" className="auth-main-btn" disabled={loading}>
              {loading ? "Түр хүлээнэ үү..." : "Нууц үг шинэчлэх"}
            </button>
          </form>
        )}

        {/* ===== SWITCH LINKS ===== */}
        {!isRecover ? (
          <>
            <button
              type="button"
              className="auth-switch-btn"
              onClick={() => goToMode(isRegister ? "login" : "register")}
            >
              {isRegister
                ? "Account байгаа юу? Нэвтрэх"
                : "Account байхгүй юу? Бүртгүүлэх"}
            </button>

            {!isRegister && (
              <button
                type="button"
                className="auth-forgot-btn"
                onClick={() => goToMode("recover")}
              >
                Нууц үгээ мартсан уу?
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            className="auth-switch-btn"
            onClick={() => goToMode("login")}
          >
            ← Нэвтрэх рүү буцах
          </button>
        )}
      </div>
    </div>
  );
}
