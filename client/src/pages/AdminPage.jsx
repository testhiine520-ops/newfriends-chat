import React, { useEffect, useState } from "react";
import "./AdminPage.css";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : window.location.origin);

export default function AdminPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/reports`);
      const data = await response.json();

      if (data.ok) {
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error("Load reports error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id) => {
    try {
      const response = await fetch(`${SERVER_URL}/api/reports/${id}/resolve`, {
        method: "PATCH",
      });

      const data = await response.json();

      if (data.ok) {
        loadReports();
      }
    } catch (error) {
      console.error("Resolve error:", error);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1>Admin Report Center</h1>
        <p>Ирсэн бүх report-ууд энд харагдана.</p>

        {loading ? (
          <p>Ачааллаж байна...</p>
        ) : reports.length === 0 ? (
          <p>Одоогоор report алга.</p>
        ) : (
          <div className="report-list">
            {reports.map((report) => (
              <div className="report-card" key={report._id}>
                <div className="report-top">
                  <h3>{report.target}</h3>
                  <span className={`status-badge ${report.status}`}>
                    {report.status}
                  </span>
                </div>

                <p><strong>Илгээсэн:</strong> {report.reporter}</p>
                <p><strong>Төрөл:</strong> {report.chatType}</p>
                <p>
                  <strong>Огноо:</strong>{" "}
                  {report.createdAt
                    ? new Date(report.createdAt).toLocaleString()
                    : ""}
                </p>

                <div className="report-messages">
                  <strong>Сүүлийн мессежүүд:</strong>
                  {report.messages && report.messages.length > 0 ? (
                    <ul>
                      {report.messages.map((msg, idx) => (
                        <li key={idx}>
                          <strong>{msg.from || "unknown"}:</strong>{" "}
                          {msg.text || msg.message || ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Мессеж алга</p>
                  )}
                </div>

                {report.status !== "resolved" && (
                  <button
                    className="resolve-btn"
                    onClick={() => handleResolve(report._id)}
                  >
                    Resolved болгох
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}