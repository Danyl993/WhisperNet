"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

type Issue = {
  issue_id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  report_count: number;
  supporter_count: number;
};

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [closedIssues, setClosedIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadIssues() {
      try {
        const authResponse = await fetch("/api/auth/me");
        const authData = await authResponse.json();

        if (!authData.authenticated) {
          setAuthenticated(false);
          setLoading(false);
          return;
        }

        setAuthenticated(true);

        const response = await fetch("/api/issues");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to load issues"
          );
        }

        setIssues(data.issues);
        setClosedIssues(data.closedIssues || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load issues"
        );
      } finally {
        setLoading(false);
      }
    }

    loadIssues();
  }, []);

  function getStatusClass(status: string) {
    switch (status) {
      case "OPEN":
        return "status-open";
      case "IN_PROGRESS":
        return "status-progress";
      case "RESOLVED":
        return "status-resolved";
      case "CLOSED":
        return "status-closed";
      default:
        return "status-open";
    }
  }

  function renderIssueCards(items: Issue[]) {
    return (
      <div className="issue-grid">
        {items.map((issue) => (
          <Link href={`/issues/${issue.issue_id}`} className="issue-card" key={issue.issue_id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span className={`status ${getStatusClass(issue.status)}`}>
                {issue.status.replace("_", " ")}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: issue.priority === "URGENT" ? "#a33a3a" : "#777d8d" }}>
                {issue.priority}
              </span>
            </div>
            <h3>{issue.title}</h3>
            <p>{issue.description}</p>
            <div className="issue-meta">
              <span className="report-count">{issue.report_count} {issue.report_count === 1 ? "report" : "reports"}</span>
              <span className="report-count">{issue.supporter_count} {issue.supporter_count === 1 ? "supporter" : "supporters"}</span>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <>
      <Navbar />

      <main className="section">
        <div className="container">

          {!loading && !authenticated ? (
            <div className="form-card">
              <div className="hero-badge">
                Sign In Required
              </div>

              <h1>Campus Issues</h1>

              <p className="form-description">
                Please sign in to view campus issues
                reported by students.
              </p>

              <Link
                href="/login"
                className="primary-button"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="section-header">
                <div className="hero-badge">
                  Campus Issues
                </div>

                <h1>
                  Issues reported by students
                </h1>

                <p>
                  Similar reports are grouped together
                  so recurring problems become easier
                  to identify.
                </p>
              </div>

              {loading && (
                <p>Loading campus issues...</p>
              )}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {!loading && authenticated && !error && (
                <>
                  <section>
                    <div className="section-header"><h2>Active Issues</h2></div>
                    {issues.length === 0 ? (
                      <div className="form-card"><p className="form-description">There are no active issues right now.</p></div>
                    ) : renderIssueCards(issues)}
                  </section>

                  <section style={{ marginTop: "56px" }}>
                    <div className="section-header">
                      <h2>Closed Issues</h2>
                      <p>Issues closed by campus administrators remain available here for students.</p>
                    </div>
                    {closedIssues.length === 0 ? (
                      <div className="form-card"><p className="form-description">There are no closed issues yet.</p></div>
                    ) : renderIssueCards(closedIssues)}
                  </section>
                </>
              )}
            </>
          )}

        </div>
      </main>

      <footer className="footer">
        <div className="container">
          WhisperNet — Anonymous Campus Problem Intelligence
        </div>
      </footer>
    </>
  );
}
