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
   ADMIN CONFIG
   Demo admin account
========================= */

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

/* =========================
   ADMIN PAGE
========================= */

export default function AdminPage() {
  const navigate = useNavigate();

  /* =========================
     ADMIN LOGIN STATE
  ========================= */

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
    localStorage.getItem("newfriends_admin") === "true"
  );

  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  /* =========================
     REPORT STATE
  ========================= */

  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);

  /* =========================
     ADMIN LOGIN
  ========================= */

  const handleAdminLogin = (event) => {
    event.preventDefault();

    if (
      adminUsername.trim() === ADMIN_USERNAME &&
      adminPassword.trim() === ADMIN_PASSWORD
    ) {
      localStorage.setItem("newfriends_admin", "true");
      setIsAdminLoggedIn(true);
      setAdminError("");
      return;
    }

    setAdminError("Admin нэр эсвэл нууц үг буруу байна.");
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("newfriends_admin");
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

  useEffect(() => {
    if (isAdminLoggedIn) {
      loadReports();
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

  /* =========================
     ADMIN LOGIN RENDER
  ========================= */

  if (!isAdminLoggedIn) {
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
          <h1>Admin нэвтрэх</h1>

          <p>
            Report жагсаалтыг харахын тулд admin эрхээр нэвтэрнэ үү.
          </p>

          <form className="admin-login-form" onSubmit={handleAdminLogin}>
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
              placeholder="admin123"
            />

            {adminError && <div className="admin-error">{adminError}</div>}

            <button type="submit">Нэвтрэх</button>
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

        <button type="button" onClick={loadReports}>
          Refresh
        </button>

        <button type="button" onClick={() => navigate("/")}>
          Нэвтрэх хуудас
        </button>

        <button type="button" onClick={() => navigate("/chat")}>
          Chat руу очих
        </button>

        <button
          type="button"
          className="admin-logout-btn"
          onClick={handleAdminLogout}
        >
          Admin гарах
        </button>
      </aside>

      <main className="admin-main">
        <div className="admin-header">
          <h1>Ирсэн report-ууд</h1>
          <p>Нийт report: {reports.length}</p>
        </div>

        <div className="admin-content">
          <section className="report-list-panel">
            {loading ? (
              <div className="admin-empty">Ачааллаж байна...</div>
            ) : reports.length === 0 ? (
              <div className="admin-empty">Одоогоор report алга.</div>
            ) : (
              reports.map((report) => (
                <button
                  key={report._id}
                  type="button"
                  className={`report-list-item ${
                    selectedReport?._id === report._id ? "active" : ""
                  }`}
                  onClick={() => setSelectedReport(report)}
                >
                  <div className="report-list-top">
                    <strong>{report.target}</strong>

                    <span className={`report-status ${report.status}`}>
                      {report.status || "pending"}
                    </span>
                  </div>

                  <p>
                    {report.chatType} · {report.reporter}
                  </p>

                  <small>
                    {report.createdAt
                      ? new Date(report.createdAt).toLocaleString()
                      : ""}
                  </small>
                </button>
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

                    <p>
                      <strong>Огноо:</strong>{" "}
                      {selectedReport.createdAt
                        ? new Date(selectedReport.createdAt).toLocaleString()
                        : ""}
                    </p>
                  </div>

                  <span className={`report-status ${selectedReport.status}`}>
                    {selectedReport.status || "pending"}
                  </span>
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