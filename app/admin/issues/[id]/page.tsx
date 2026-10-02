"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

type Report = {
  report_id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
  similarity_score: string | null;
};

type StatusHistory = {
  history_id: number;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by_name: string;
};

type AdminResponse = {
  response_id: number;
  response: string;
  created_at: string;
  admin_name: string;
};

type Issue = {
  issue_id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  category_id: number;
  category_name: string;
};

type IssueData = {
  issue: Issue;
  reports: Report[];
  supporter_count: number;
  status_history: StatusHistory[];
  admin_responses: AdminResponse[];
};

export default function AdminIssuePage() {
  const params = useParams();
  const router = useRouter();

  const [data, setData] = useState<IssueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  async function loadIssue() {
    try {
      const response = await fetch(
        `/api/admin/issues/${params.id}`
      );

      const result = await response.json();

      if (response.status === 403) {
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load issue"
        );
      }

      setData(result);
      setStatus(result.issue.status);
      setPriority(result.issue.priority);
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
  }, [params.id]);

  async function updateIssue() {
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `/api/admin/issues/${params.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            priority,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to update issue"
        );
      }

      setSuccessMessage(
        "Issue updated successfully."
      );

      await loadIssue();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update issue"
      );
    } finally {
      setSaving(false);
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

  if (error && !data) {
    return (
      <>
        <Navbar />

        <main className="section">
          <div className="container">
            <div className="error-message">
              {error}
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!data) {
    return null;
  }

  const { issue } = data;

  return (
    <>
      <Navbar />

      <main className="section">
        <div className="container">

          <button
            className="nav-button"
            onClick={() => router.push("/admin")}
          >
            ← Back to Admin Dashboard
          </button>

          <div className="section-header">
            <div className="hero-badge">
              Issue #{issue.issue_id}
            </div>

            <h1>{issue.title}</h1>

            <p>{issue.description}</p>
          </div>

          <div className="issue-grid">

            <div className="issue-card">
              <h3>Status</h3>
              <p>{issue.status.replace("_", " ")}</p>
            </div>

            <div className="issue-card">
              <h3>Priority</h3>
              <p>{issue.priority}</p>
            </div>

            <div className="issue-card">
              <h3>Category</h3>
              <p>{issue.category_name}</p>
            </div>

            <div className="issue-card">
              <h3>Supporters</h3>
              <p>{data.supporter_count}</p>
            </div>

          </div>

          <div className="form-card">

            <div className="section-header">
              <h2>Manage Issue</h2>
              <p>
                Update the current status and priority.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="status">
                Status
              </label>

              <select
                id="status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
              >
                <option value="OPEN">
                  OPEN
                </option>

                <option value="IN_PROGRESS">
                  IN PROGRESS
                </option>

                <option value="RESOLVED">
                  RESOLVED
                </option>

                <option value="CLOSED">
                  CLOSED
                </option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority">
                Priority
              </label>

              <select
                id="priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value)
                }
              >
                <option value="LOW">
                  LOW
                </option>

                <option value="MEDIUM">
                  MEDIUM
                </option>

                <option value="HIGH">
                  HIGH
                </option>

                <option value="URGENT">
                  URGENT
                </option>
              </select>
            </div>

            <button
              className="submit-button"
              onClick={updateIssue}
              disabled={saving}
            >
              {saving
                ? "Updating..."
                : "Update Issue"}
            </button>

            {successMessage && (
              <div className="success-message">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

          </div>

          <div className="section-header">
            <h2>Linked Reports</h2>
          </div>

          <div className="issue-grid">
            {data.reports.length === 0 ? (
              <p>No linked reports.</p>
            ) : (
              data.reports.map((report) => (
                <div
                  className="issue-card"
                  key={report.report_id}
                >
                  <h3>{report.title}</h3>

                  <p>{report.description}</p>

                  <div className="issue-meta">
                    <span>
                      Report #{report.report_id}
                    </span>

                    <span>
                      {report.similarity_score
                        ? `Similarity: ${(
                            Number(
                              report.similarity_score
                            ) * 100
                          ).toFixed(1)}%`
                        : "Similarity: N/A"}
                    </span>
                  </div>

                  <p>
                    Status: {report.status}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="section-header">
            <h2>Status History</h2>
          </div>

          <div className="issue-grid">
            {data.status_history.length === 0 ? (
              <p>No status changes recorded.</p>
            ) : (
              data.status_history.map((history) => (
                <div
                  className="issue-card"
                  key={history.history_id}
                > 
                  <p>
                    <strong>Issue:</strong> {issue.title}
                  </p>
                  <h3>
                    {history.old_status
                      ? `${history.old_status.replace(
                          "_",
                          " "
                        )} → ${history.new_status.replace(
                          "_",
                          " "
                        )}`
                      : history.new_status.replace(
                          "_",
                          " "
                        )}
                  </h3>

                  <p>
                    Changed by: {history.changed_by_name}
                  </p>

                  <p>
                    {new Intl.DateTimeFormat("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    }).format(new Date(history.changed_at))}
                  </p>
                </div>
              ))
            )}
          </div>
          
          <div className="form-card">
            <h2>Admin Response</h2>

            <form
                onSubmit={async (e) => {
                e.preventDefault();

                const form = e.currentTarget;
                const textarea = form.elements.namedItem(
                    "response"
                ) as HTMLTextAreaElement;

                const response = textarea.value.trim();

                if (!response) return;

                const res = await fetch(
                    `/api/admin/issues/${params.id}/responses`,
                    {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ response }),
                    }
                );

                const data = await res.json();

                if (!res.ok) {
                    alert(data.error || "Failed to add response");
                    return;
                }

                textarea.value = "";

                window.location.reload();
                }}
            >
                <div className="form-group">
                <label htmlFor="response">
                    Response to students
                </label>

                <textarea
                    id="response"
                    name="response"
                    rows={5}
                    placeholder="Enter an official response..."
                    required
                />
                </div>

                <button type="submit" className="submit-button">
                Send Response
                </button>
            </form>
            </div>

          <div className="section-header">
            <h2>Admin Responses</h2>
          </div>

          <div className="issue-grid">
            {data.admin_responses.length === 0 ? (
              <p>No admin responses.</p>
            ) : (
              data.admin_responses.map((response) => (
                <div
                  className="issue-card"
                  key={response.response_id}
                >
                  <p>
                    <strong>Issue:</strong> {issue.title}
                  </p>

                  <p>{response.response}</p>

                  <div className="issue-meta">
                    <span>
                      {response.admin_name}
                    </span>

                    <span>
                      <span>
                        {new Intl.DateTimeFormat("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "numeric",
                          month: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        }).format(new Date(response.created_at))}
                      </span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </main>

      <footer className="footer">
        <div className="container">
          WhisperNet — Admin Issue Management
        </div>
      </footer>
    </>
  );
}