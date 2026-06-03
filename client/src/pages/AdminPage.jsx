/* =========================
   IMPORTS
========================= */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminPage.css";

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
   ADMIN PAGE
========================= */

export default function AdminPage() {
  const navigate = useNavigate();

  /* =========================
     ADMIN LOGIN STATE
  ========================= */

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  /* =========================
     REPORT STATE
  ========================= */

  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);

  /* =========================
     BANNED USERS STATE
  ========================= */

  const [bannedUsers, setBannedUsers] = useState([]);
  const [actionMsg, setActionMsg] = useState("");

  /* =========================
     ADMIN LOGIN
  ========================= */

  const handleAdminLogin = async (event) => {
    event.preventDefault();

    const username = adminUsername.trim();
    const password = adminPassword.trim();

    if (!username || !password) {
      setAdminError("Admin нэр болон нууц үг хэрэгтэй.");
      return;
    }

    setAuthLoading(true);
    setAdminError("");
    setAdminSuccess("");

    try {
      const response = await fetch(`${SERVER_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setIsAdminLoggedIn(true);
        setAdminError("");
        return;
      }

      setAdminError(data.message || "Admin нэр эсвэл нууц үг буруу байна.");
    } catch (err) {
      console.error("Admin login error:", err);
      setAdminError("Сервертэй холбогдоход алдаа гарлаа.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminRegister = async (event) => {
    event.preventDefault();

    const username = adminUsername.trim();
    const password = adminPassword.trim();

    if (!username || !password) {
      setAdminError("Admin нэр болон нууц үг хэрэгтэй.");
      return;
    }

    setAuthLoading(true);
    setAdminError("");
    setAdminSuccess("");

    try {
      const response = await fetch(`${SERVER_URL}/api/admin/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setAdminSuccess("Амжилттай бүртгэгдлээ. Одоо нэвтэрнэ үү.");
        setAuthMode("login");
        setAdminPassword("");
        return;
      }

      setAdminError(data.message || "Admin бүртгэх үед алдаа гарлаа.");
    } catch (err) {
      console.error("Admin register error:", err);
      setAdminError("Сервертэй холбогдоход алдаа гарлаа.");
    } finally {
      setAuthLoading(false);
    }
  };

  const switchAuthMode = (mode) => {
    setAuthMode(mode);
    setAdminError("");
    setAdminSuccess("");
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("newfriends_admin");
    localStorage.removeItem("newfriends_admin_name");
    setIsAdminLoggedIn(false);
    setSelectedReport(null);
  };

  /* =========================
     LOAD REPORTS
  ========================= */

  const loadReports = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${SERVER_URL}/api/reports`);
      const data = await response.json();

      if (response.ok && data.ok) {
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error("Load reports error:", error);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     LOAD / BAN / UNBAN USERS
  ========================= */

  const loadBanned = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/admin/banned`);
      const data = await response.json();

      if (response.ok && data.ok) {
        setBannedUsers(data.banned || []);
      }
    } catch (error) {
      console.error("Load banned error:", error);
    }
  };

  const handleBanUser = async (username, reason, reportId) => {
    if (!username) return;

    setActionMsg("");

    try {
      const response = await fetch(`${SERVER_URL}/api/admin/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, reason }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setBannedUsers(data.banned || []);
        setActionMsg(data.message || `${username} гаргагдлаа.`);

        // Хүчээр гаргасан бол report-ийг шийдвэрлэсэн болгоно
        if (reportId) {
          await handleResolveReport(reportId);
        }
      } else {
        setActionMsg(data.message || "Гаргах үед алдаа гарлаа.");
      }
    } catch (error) {
      console.error("Ban error:", error);
      setActionMsg("Сервертэй холбогдоход алдаа гарлаа.");
    }
  };

  const handleUnbanUser = async (username) => {
    if (!username) return;

    setActionMsg("");

    try {
      const response = await fetch(`${SERVER_URL}/api/admin/unban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setBannedUsers(data.banned || []);
        setActionMsg(data.message || `${username} сэргээгдлээ.`);
      } else {
        setActionMsg(data.message || "Сэргээх үед алдаа гарлаа.");
      }
    } catch (error) {
      console.error("Unban error:", error);
      setActionMsg("Сервертэй холбогдоход алдаа гарлаа.");
    }
  };

  const isBanned = (username) =>
    bannedUsers.some(
      (b) => String(b.username).toLowerCase() === String(username).toLowerCase()
    );

  useEffect(() => {
    if (isAdminLoggedIn) {
      loadReports();
      loadBanned();
    }
  }, [isAdminLoggedIn]);

  /* =========================
     RESOLVE REPORT
  ========================= */

  const handleResolveReport = async (reportId) => {
    try {
      const response = await fetch(
        `${SERVER_URL}/api/reports/${reportId}/resolve`,
        {
          method: "PATCH",
        }
      );

      const data = await response.json();

      if (response.ok && data.ok) {
        await loadReports();

        setSelectedReport((prev) =>
          prev && prev._id === reportId
            ? {
                ...prev,
                status: "resolved",
                resolvedAt: new Date().toISOString(),
              }
            : prev
        );
      }
    } catch (error) {
      console.error("Resolve report error:", error);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!reportId) return;

    if (!window.confirm("Энэ report-ийг устгах уу?")) return;

    try {
      const response = await fetch(`${SERVER_URL}/api/reports/${reportId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        await loadReports();

        setSelectedReport((prev) =>
          prev && prev._id === reportId ? null : prev
        );
      } else {
        setActionMsg(data.message || "Report устгах үед алдаа гарлаа.");
      }
    } catch (error) {
      console.error("Delete report error:", error);
      setActionMsg("Сервертэй холбогдоход алдаа гарлаа.");
    }
  };

  /* =========================
     ADMIN LOGIN RENDER
  ========================= */

  if (!isAdminLoggedIn) {
    const isRegister = authMode === "register";

    return (
      <div className="admin-login-page">
        <button
          type="button"
          className="admin-back-btn"
          onClick={() => navigate("/")}
        >
          ← Буцах
        </button>

        <div className="admin-login-card">
          <h1>{isRegister ? "Admin бүртгүүлэх" : "Admin нэвтрэх"}</h1>

          <p>
            {isRegister
              ? "Шинэ admin эрх үүсгэхийн тулд нэр, нууц үгээ оруулна уу."
              : "Report жагсаалтыг харахын тулд admin эрхээр нэвтэрнэ үү."}
          </p>

          <div className="admin-auth-tabs">
            <button
              type="button"
              className={`admin-auth-tab ${!isRegister ? "active" : ""}`}
              onClick={() => switchAuthMode("login")}
            >
              Нэвтрэх
            </button>
            <button
              type="button"
              className={`admin-auth-tab ${isRegister ? "active" : ""}`}
              onClick={() => switchAuthMode("register")}
            >
              Бүртгүүлэх
            </button>
          </div>

          <form
            className="admin-login-form"
            onSubmit={isRegister ? handleAdminRegister : handleAdminLogin}
          >
            <label>Admin username</label>

            <input
              value={adminUsername}
              onChange={(event) => setAdminUsername(event.target.value)}
              placeholder="admin"
            />

            <label>Password</label>

            <input
              type="password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              placeholder={isRegister ? "Шинэ нууц үг" : "Нууц үг"}
            />

            {adminError && <div className="admin-error">{adminError}</div>}
            {adminSuccess && (
              <div className="admin-success">{adminSuccess}</div>
            )}

            <button type="submit" disabled={authLoading}>
              {authLoading
                ? "Түр хүлээнэ үү..."
                : isRegister
                ? "Бүртгүүлэх"
                : "Нэвтрэх"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* =========================
     ADMIN DASHBOARD RENDER
  ========================= */

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <h2>Admin</h2>
        <p>Report Center</p>

        <div className="admin-banned-section">
          <h3 className="admin-banned-title">
            Гаргасан хэрэглэгчид ({bannedUsers.length})
          </h3>

          {bannedUsers.length === 0 ? (
            <p className="admin-banned-empty">Одоогоор хэн ч гаргагдаагүй.</p>
          ) : (
            <div className="admin-banned-list">
              {bannedUsers.map((b) => (
                <div className="admin-banned-item" key={b.username}>
                  <div className="admin-banned-info">
                    <strong>{b.username}</strong>
                    {b.reason && <small>{b.reason}</small>}
                  </div>

                  <button
                    type="button"
                    className="admin-unban-btn"
                    onClick={() => handleUnbanUser(b.username)}
                  >
                    Эрх сэргээх
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-header">
          <div className="admin-header-titles">
            <h1>Ирсэн report-ууд</h1>
            <p>Нийт report: {reports.length}</p>
          </div>

          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-header-btn"
              onClick={() => {
                loadReports();
                loadBanned();
              }}
            >
              Refresh
            </button>

            <button
              type="button"
              className="admin-header-btn admin-header-logout"
              onClick={handleAdminLogout}
            >
              Гарах
            </button>
          </div>
        </div>

        {actionMsg && <div className="admin-action-msg">{actionMsg}</div>}

        <div className="admin-content">
          <section className="report-list-panel">
            {loading ? (
              <div className="admin-empty">Ачааллаж байна...</div>
            ) : reports.length === 0 ? (
              <div className="admin-empty">Одоогоор report алга.</div>
            ) : (
              reports.map((report) => (
                <div
                  key={report._id}
                  className={`report-list-item ${
                    selectedReport?._id === report._id ? "active" : ""
                  }`}
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="report-list-top">
                    <strong>{report.target}</strong>

                    <div className="report-list-badges">
                      <span className={`report-status ${report.status}`}>
                        {report.status || "pending"}
                      </span>

                      <button
                        type="button"
                        className="report-delete-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteReport(report._id);
                        }}
                      >
                        Устгах
                      </button>
                    </div>
                  </div>

                  <p>
                    {report.chatType} · {report.reporter}
                  </p>

                  <small>
                    {report.createdAt
                      ? new Date(report.createdAt).toLocaleString()
                      : ""}
                  </small>
                </div>
              ))
            )}
          </section>

          <section className="report-detail-panel">
            {!selectedReport ? (
              <div className="admin-empty">
                Зүүн талын report-оос нэгийг сонгож дэлгэрэнгүй харна уу.
              </div>
            ) : (
              <div className="report-detail-card">
                <div className="report-detail-top">
                  <div>
                    <h2>{selectedReport.target}</h2>

                    <p>
                      <strong>Report хийсэн:</strong>{" "}
                      {selectedReport.reporter}
                    </p>

                    <p>
                      <strong>Chat төрөл:</strong>{" "}
                      {selectedReport.chatType}
                    </p>

                    {selectedReport.chatType === "group" &&
                      selectedReport.roomName && (
                        <p>
                          <strong>Group:</strong> {selectedReport.roomName}
                        </p>
                      )}

                    <p>
                      <strong>Огноо:</strong>{" "}
                      {selectedReport.createdAt
                        ? new Date(selectedReport.createdAt).toLocaleString()
                        : ""}
                    </p>

                    {selectedReport.reason && (
                      <p className="report-detail-reason">
                        <strong>Шалтгаан:</strong> {selectedReport.reason}
                      </p>
                    )}
                  </div>

                  <div className="report-detail-actions">
                    {isBanned(selectedReport.target) ? (
                      <button
                        type="button"
                        className="report-unban-btn"
                        onClick={() => handleUnbanUser(selectedReport.target)}
                      >
                        Эрх сэргээх
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="report-ban-btn"
                        onClick={() =>
                          handleBanUser(
                            selectedReport.target,
                            `Report (${selectedReport.reporter})-ын улмаас гаргагдсан.`,
                            selectedReport._id
                          )
                        }
                      >
                        Хүчээр гаргах
                      </button>
                    )}
                  </div>
                </div>

                <div className="report-message-box">
                  <h3>Report-д ирсэн сүүлийн мессежүүд</h3>

                  {selectedReport.messages &&
                  selectedReport.messages.length > 0 ? (
                    selectedReport.messages.map((message, index) => (
                      <div className="admin-message-item" key={index}>
                        <strong>{message.from || "unknown"}:</strong>

                        <span>
                          {message.text ||
                            message.message ||
                            (message.type === "image"
                              ? "[Зураг]"
                              : message.type === "audio"
                              ? "[Voice]"
                              : "")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="admin-empty-small">Мессеж алга.</p>
                  )}
                </div>

                {selectedReport.status !== "resolved" && (
                  <button
                    type="button"
                    className="resolve-btn"
                    onClick={() => handleResolveReport(selectedReport._id)}
                  >
                    Шийдвэрлэсэн болгох
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}