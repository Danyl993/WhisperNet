"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";

type Report = {
  report_id: number;
  title: string;
  description: string;
  status: string;
  created_at: string;
};

type SupportedIssue = {
  issue_id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  supported_at: string;
};

type User = {
  user_id: number;
  name: string;
  email: string;
  role: string;
};

export default function ActivityPage() {
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [supportedIssues, setSupportedIssues] = useState<
    SupportedIssue[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadActivity() {
      try {
        const response = await fetch("/api/activity");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to load activity"
          );
        }

        setUser(data.user);
        setReports(data.reports);
        setSupportedIssues(data.supportedIssues);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load activity"
        );
      } finally {
        setLoading(false);
      }
    }

    loadActivity();
  }, []);

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="section">
          <div className="container">
            <p>Loading your activity...</p>
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />

        <main className="section">
          <div className="container">
            <div className="form-card">
              <h1>Sign in required</h1>

              <p className="form-description">
                Please sign in to view your activity.
              </p>

              <Link
                href="/login"
                className="primary-button"
              >
                Sign In
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="section">
        <div className="container">

          {/* Profile Header */}

          <div className="section-header">
            <div className="hero-badge">
              My Activity
            </div>

            <h1>
              Welcome, {user?.name}
            </h1>

            <p>
              View your submitted reports and the issues
              you've supported.
            </p>
          </div>

          {/* Statistics */}

          <div className="issue-grid">

            <div className="issue-card">
              <h3>{reports.length}</h3>

              <p>
                Reports submitted
              </p>
            </div>

            <div className="issue-card">
              <h3>{supportedIssues.length}</h3>

              <p>
                Issues supported
              </p>
            </div>

            <div className="issue-card">
              <h3>{user?.role}</h3>

              <p>
                Account role
              </p>
            </div>

          </div>

          {/* My Reports */}

          <section style={{ marginTop: "60px" }}>

            <div className="section-header">
              <h2>My Reports</h2>

              <p>
                Reports submitted from your account.
              </p>
            </div>

            {reports.length === 0 ? (
              <div className="form-card">

                <h3>No reports yet</h3>

                <p className="form-description">
                  You haven't submitted any reports yet.
                </p>

                <Link
                  href="/report"
                  className="primary-button"
                >
                  Submit a Report
                </Link>

              </div>
            ) : (
              <div className="issue-grid">

                {reports.map((report) => (
                  <div
                    className="issue-card"
                    key={report.report_id}
                  >
                    <span className="status status-open">
                      {report.status}
                    </span>

                    <h3
                      style={{
                        marginTop: "15px",
                      }}
                    >
                      {report.title}
                    </h3>

                    <p>
                      {report.description}
                    </p>

                    <span className="report-count">
                      Report #{report.report_id}
                    </span>
                  </div>
                ))}

              </div>
            )}

          </section>

          {/* Supported Issues */}

          <section style={{ marginTop: "60px" }}>

            <div className="section-header">
              <h2>Issues I Support</h2>

              <p>
                Campus issues you've supported.
              </p>
            </div>

            {supportedIssues.length === 0 ? (
              <div className="form-card">

                <h3>No supported issues</h3>

                <p className="form-description">
                  You haven't supported any campus issues yet.
                </p>

                <Link
                  href="/issues"
                  className="primary-button"
                >
                  Explore Issues
                </Link>

              </div>
            ) : (
              <div className="issue-grid">

                {supportedIssues.map((issue) => (
                  <Link
                    href={`/issues/${issue.issue_id}`}
                    className="issue-card"
                    key={issue.issue_id}
                  >
                    <span className="status status-open">
                      {issue.status.replace(
                        "_",
                        " "
                      )}
                    </span>

                    <h3
                      style={{
                        marginTop: "15px",
                      }}
                    >
                      {issue.title}
                    </h3>

                    <p>
                      {issue.description}
                    </p>

                    <span className="report-count">
                      Priority: {issue.priority}
                    </span>
                  </Link>
                ))}

              </div>
            )}

          </section>

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