"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

type Report = {
  report_id: number;
  title: string;
  description: string;
  created_at: string;
  similarity_score: number | null;
};

type Issue = {
  issue_id: number;
  category_id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  report_count: number;
  supporter_count: number;
  is_supported: boolean;
};

export default function IssueDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [supporting, setSupporting] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");

  async function loadIssue() {
    try {
      const { id } = await params;

      const response = await fetch(
        `/api/issues/${id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load issue"
        );
      }

      setIssue(data.issue);
      setReports(data.reports);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load issue"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIssue();
  }, [params]);

  async function handleSupport() {
    if (!issue) {
      return;
    }

    setSupporting(true);
    setSupportMessage("");

    try {
      const response = await fetch(
        `/api/issues/${issue.issue_id}/support`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        throw new Error(
          data.error || "Failed to support issue"
        );
      }

      setSupportMessage(
        "You now support this issue."
      );

      await loadIssue();
    } catch (error) {
      setSupportMessage(
        error instanceof Error
          ? error.message
          : "Failed to support issue"
      );
    } finally {
      setSupporting(false);
    }
  }

  async function handleRemoveSupport() {
    if (!issue) {
      return;
    }

    setSupporting(true);
    setSupportMessage("");

    try {
      const response = await fetch(
        `/api/issues/${issue.issue_id}/support`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        throw new Error(
          data.error ||
            "Failed to remove support"
        );
      }

      setSupportMessage(
        "Your support has been removed."
      );

      await loadIssue();
    } catch (error) {
      setSupportMessage(
        error instanceof Error
          ? error.message
          : "Failed to remove support"
      );
    } finally {
      setSupporting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="section">
          <div className="container">
            <p>Loading issue...</p>
          </div>
        </main>
      </>
    );
  }

  if (error || !issue) {
    return (
      <>
        <Navbar />

        <main className="section">
          <div className="container">
            <div className="error-message">
              {error || "Issue not found"}
            </div>

            <Link
              href="/issues"
              className="primary-button"
            >
              Back to Issues
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      {/* Issue Details */}
      <main className="section">
        <div className="container">
          <Link href="/issues">
            ← Back to Issues
          </Link>

          <div
            className="form-card"
            style={{ marginTop: "25px" }}
          >
            {/* Status and Priority */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "15px",
                flexWrap: "wrap",
              }}
            >
              <span className="status status-open">
                {issue.status.replace(
                  "_",
                  " "
                )}
              </span>

              <strong>
                Priority: {issue.priority}
              </strong>
            </div>

            {/* Title + Support */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "25px",
                marginTop: "24px",
                flexWrap: "wrap",
              }}
            >
              <h1
                style={{
                  margin: 0,
                  flex: 1,
                }}
              >
                {issue.title}
              </h1>

              <div
                style={{
                  minWidth: "220px",
                  textAlign: "right",
                }}
              >
                {!issue.is_supported ? (
                  <button
                    className="primary-button"
                    onClick={handleSupport}
                    disabled={supporting}
                  >
                    {supporting
                      ? "Supporting..."
                      : "Support Issue"}
                  </button>
                ) : (
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "8px",
                      }}
                    >
                      ✓ You already support this issue
                    </div>

                    <button
                      onClick={handleRemoveSupport}
                      disabled={supporting}
                      style={{
                        background: "transparent",
                        border: "1px solid #b44",
                        color: "#b44",
                        borderRadius: "6px",
                        padding: "7px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: supporting
                          ? "not-allowed"
                          : "pointer",
                        opacity: supporting
                          ? 0.6
                          : 1,
                      }}
                    >
                      {supporting
                        ? "Removing..."
                        : "Remove Support"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <p
              className="form-description"
              style={{ marginTop: "18px" }}
            >
              {issue.description}
            </p>

            {/* Counts */}
            <div
              style={{
                display: "flex",
                gap: "30px",
                marginTop: "25px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong>
                  {issue.report_count}
                </strong>
                <br />
                <span className="report-count">
                  Reports
                </span>
              </div>

              <div>
                <strong>
                  {issue.supporter_count}
                </strong>
                <br />
                <span className="report-count">
                  Supporters
                </span>
              </div>
            </div>

            {/* Support feedback */}
            {supportMessage && (
              <p
                className={
                  supportMessage.includes(
                    "now support"
                  ) ||
                  supportMessage.includes(
                    "removed"
                  )
                    ? "success-message"
                    : "error-message"
                }
                style={{ marginTop: "15px" }}
              >
                {supportMessage}
              </p>
            )}
          </div>

          {/* Related Reports */}
          <section style={{ marginTop: "50px" }}>
            <div className="section-header">
              <h2>Related Reports</h2>

              <p>
                Reports that have been grouped
                under this issue.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gap: "16px",
              }}
            >
              {reports.map((report) => (
                <div
                  key={report.report_id}
                  className="issue-card"
                >
                  <h3>{report.title}</h3>

                  <p>
                    {report.description}
                  </p>

                  {report.similarity_score !==
                    null && (
                    <span className="report-count">
                      Semantic similarity:{" "}
                      {(
                        Number(
                          report.similarity_score
                        ) * 100
                      ).toFixed(1)}
                      %
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          WhisperNet — Anonymous Campus Problem Intelligence
        </div>
      </footer>
    </>
  );
}
