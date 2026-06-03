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

  const [adminTheme, setAdminTheme] = useState("dark");

  const [authMode, setAuthMode] = useState("login"); // "login" | "register" | "recover"
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [recoverNewPw, setRecoverNewPw] = useState("");

  // Нэвтэрсэн admin-ийн нэр (нууц үг солиход хэрэгтэй)
  const [loggedAdminName, setLoggedAdminName] = useState("");

  // Нууц үг солих modal
  const [showAdminPwModal, setShowAdminPwModal] = useState(false);
  const [apwOld, setApwOld] = useState("");
  const [apwNew, setApwNew] = useState("");
  const [apwMsg, setApwMsg] = useState("");
  const [apwErr, setApwErr] = useState("");
  const [apwLoading, setApwLoading] = useState(false);

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
        setLoggedAdminName(data.username || username);
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
    const code = adminCode.trim();

    if (!username || !password) {
      setAdminError("Admin нэр болон нууц үг хэрэгтэй.");
      return;
    }

    if (!code) {
      setAdminError("Admin нууц код хэрэгтэй.");
      return;
    }

    setAuthLoading(true);
    setAdminError("");
    setAdminSuccess("");

    try {
      const response = await fetch(`${SERVER_URL}/api/admin/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, adminCode: code }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setAdminSuccess("Амжилттай бүртгэгдлээ. Одоо нэвтэрнэ үү.");
        setAuthMode("login");
        setAdminPassword("");
        setAdminCode("");
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
    setAdminPassword("");
    setAdminCode("");
    setRecoverNewPw("");
  };

  // Мартсан үед нууц кодоор сэргээх
  const handleAdminRecover = async (event) => {
    event.preventDefault();

    const username = adminUsername.trim();
    const code = adminCode.trim();
    const newPassword = recoverNewPw.trim();

    if (!username || !code || !newPassword) {
      setAdminError("Нэр, нууц код, шинэ нууц үг бүгд хэрэгтэй.");
      return;
    }

    setAuthLoading(true);
    setAdminError("");
    setAdminSuccess("");

    try {
      const response = await fetch(`${SERVER_URL}/api/admin/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, adminCode: code, newPassword }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setAdminSuccess(data.message || "Нууц үг шинэчлэгдлээ. Нэвтэрнэ үү.");
        setAuthMode("login");
        setAdminPassword("");
        setAdminCode("");
        setRecoverNewPw("");
        return;
      }

      setAdminError(data.message || "Сэргээх үед алдаа гарлаа.");
    } catch (err) {
      console.error("Admin recover error:", err);
      setAdminError("Сервертэй холбогдоход алдаа гарлаа.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Нэвтэрсэн үед нууц үг солих
  const closeAdminPwModal = () => {
    setShowAdminPwModal(false);
    setApwOld("");
    setApwNew("");
    setApwMsg("");
    setApwErr("");
  };

  const handleAdminChangePassword = async () => {
    setApwErr("");
    setApwMsg("");

    if (!apwOld.trim() || !apwNew.trim()) {
      setApwErr("Хуучин болон шинэ нууц үгээ оруулна уу.");
      return;
    }
    if (apwNew.trim().length < 4) {
      setApwErr("Шинэ нууц үг хамгийн багадаа 4 тэмдэгт байх ёстой.");
      return;
    }

    setApwLoading(true);
    try {
      const response = await fetch(
        `${SERVER_URL}/api/admin/change-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: loggedAdminName,
            oldPassword: apwOld,
            newPassword: apwNew.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setApwErr(data.message || "Нууц үг солих үед алдаа гарлаа.");
        return;
      }

      setApwMsg(data.message || "Нууц үг амжилттай солигдлоо.");
      setApwOld("");
      setApwNew("");
    } catch (err) {
      console.error("Admin change password error:", err);
      setApwErr("Сервертэй холбогдоход алдаа гарлаа.");
    } finally {
      setApwLoading(false);
    }
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
    const isRecover = authMode === "recover";

    return (
      <div className={`admin-login-page ${adminTheme === "light" ? "admin-light" : ""}`}>
        <button
          type="button"
          className="admin-back-btn"
          onClick={() => navigate("/")}
        >
          ← Буцах
        </button>

        <button
          type="button"
          className="admin-theme-toggle"
          onClick={() =>
            setAdminTheme((prev) => (prev === "light" ? "dark" : "light"))
          }
        >
          {adminTheme === "light" ? "🌙 Бараан горим" : "☀️ Гэрэлтэй горим"}
        </button>

        <div className="admin-login-card">
          <h1>
            {isRecover
              ? "Admin нууц үг сэргээх"
              : isRegister
              ? "Admin бүртгүүлэх"
              : "Admin нэвтрэх"}
          </h1>

          <p>
            {isRecover
              ? "Admin нууц кодоо оруулж шинэ нууц үг тохируулна уу."
              : isRegister
              ? "Шинэ admin эрх үүсгэхийн тулд нэр, нууц үгээ оруулна уу."
              : "Report жагсаалтыг харахын тулд admin эрхээр нэвтэрнэ үү."}
          </p>

          {!isRecover && (
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
          )}

          {/* LOGIN / REGISTER FORM */}
          {!isRecover && (
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

              {isRegister && (
                <>
                  <label>Admin нууц код</label>
                  <input
                    type="password"
                    value={adminCode}
                    onChange={(event) => setAdminCode(event.target.value)}
                    placeholder="Бүртгүүлэх нууц код"
                  />
                </>
              )}

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
          )}

          {/* RECOVER FORM */}
          {isRecover && (
            <form className="admin-login-form" onSubmit={handleAdminRecover}>
              <label>Admin username</label>
              <input
                value={adminUsername}
                onChange={(event) => setAdminUsername(event.target.value)}
                placeholder="admin"
              />

              <label>Admin нууц код</label>
              <input
                type="password"
                value={adminCode}
                onChange={(event) => setAdminCode(event.target.value)}
                placeholder="Admin нууц код"
              />

              <label>Шинэ нууц үг</label>
              <input
                type="password"
                value={recoverNewPw}
                onChange={(event) => setRecoverNewPw(event.target.value)}
                placeholder="Шинэ нууц үг (4+ тэмдэгт)"
              />

              {adminError && <div className="admin-error">{adminError}</div>}
              {adminSuccess && (
                <div className="admin-success">{adminSuccess}</div>
              )}

              <button type="submit" disabled={authLoading}>
                {authLoading ? "Түр хүлээнэ үү..." : "Нууц үг шинэчлэх"}
              </button>
            </form>
          )}

          {/* FORGOT / BACK LINK */}
          {authMode === "login" && (
            <button
              type="button"
              className="admin-forgot-btn"
              onClick={() => switchAuthMode("recover")}
            >
              Нууц үгээ мартсан уу?
            </button>
          )}
          {isRecover && (
            <button
              type="button"
              className="admin-forgot-btn"
              onClick={() => switchAuthMode("login")}
            >
              ← Нэвтрэх рүү буцах
            </button>
          )}
        </div>
      </div>
    );
  }

  /* =========================
     ADMIN DASHBOARD RENDER
  ========================= */

  return (
    <div className={`admin-page ${adminTheme === "light" ? "admin-light" : ""}`}>
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
              className="admin-header-btn admin-header-theme"
              onClick={() =>
                setAdminTheme((prev) => (prev === "light" ? "dark" : "light"))
              }
            >
              {adminTheme === "light" ? "🌙 Бараан" : "☀️ Гэрэлтэй"}
            </button>

            <button
              type="button"
              className="admin-header-btn"
              onClick={() => setShowAdminPwModal(true)}
            >
              🔑 Нууц үг солих
            </button>

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
                    {report.chatType === "group" ? "Групп" : "Хувийн"} ·{" "}
                    {report.reporter}
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
                      <strong>Чат төрөл:</strong>{" "}
                      {selectedReport.chatType === "group"
                        ? "Групп"
                        : "Хувийн"}
                    </p>

                    {selectedReport.chatType === "group" &&
                      selectedReport.roomName && (
                        <p>
                          <strong>Групп:</strong> {selectedReport.roomName}
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

      {showAdminPwModal && (
        <div className="report-modal-overlay" onClick={closeAdminPwModal}>
          <div
            className="report-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="report-modal-title">Admin нууц үг солих</h2>
            <p className="report-modal-sub">
              Хуучин нууц үгээ оруулж, шинэ нууц үгээ тохируулна уу.
            </p>

            <div className="report-modal-field">
              <label>Хуучин нууц үг</label>
              <input
                type="password"
                value={apwOld}
                onChange={(event) => setApwOld(event.target.value)}
                placeholder="Хуучин нууц үг"
              />
            </div>

            <div className="report-modal-field">
              <label>Шинэ нууц үг</label>
              <input
                type="password"
                value={apwNew}
                onChange={(event) => setApwNew(event.target.value)}
                placeholder="Шинэ нууц үг (4+ тэмдэгт)"
              />
            </div>

            {apwErr && <div className="pw-modal-error">{apwErr}</div>}
            {apwMsg && <div className="pw-modal-success">{apwMsg}</div>}

            <div className="report-modal-actions">
              <button
                type="button"
                className="report-modal-cancel"
                onClick={closeAdminPwModal}
              >
                Хаах
              </button>
              <button
                type="button"
                className="report-modal-submit"
                onClick={handleAdminChangePassword}
                disabled={apwLoading}
              >
                {apwLoading ? "Солиж байна..." : "Нууц үг солих"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}