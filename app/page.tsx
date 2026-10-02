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
  report_count: number;
  supporter_count: number;
};

type User = {
  user_id: number;
  name: string;
  email: string;
  role: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    async function loadHomeData() {
      try {
        const authResponse =
          await fetch("/api/auth/me");

        const authData =
          await authResponse.json();

        if (!authData.authenticated) {
          setUser(null);
          return;
        }

        setUser(authData.user);

        const issuesResponse =
          await fetch("/api/issues");

        const issuesData =
          await issuesResponse.json();

        if (issuesResponse.ok) {
          setIssues(issuesData.issues);
        }

      } catch (error) {
        console.error(
          "Home page loading error:",
          error
        );
      } finally {
        setLoadingUser(false);
      }
    }

    loadHomeData();
  }, []);

  function getStatusClass(status: string) {
    switch (status) {
      case "OPEN":
        return "status-open";

      case "IN_PROGRESS":
        return "status-progress";

      case "RESOLVED":
        return "status-resolved";

      default:
        return "status-open";
    }
  }

  return (
    <>
      <Navbar />

      {/* Hero */}

      <section className="hero">
        <div className="container">
          <div className="hero-content">

            <div className="hero-badge">
              Anonymous Campus Intelligence
            </div>

            <h1>
              Your voice.
              <br />
              Your <span>campus.</span>
            </h1>

            <p>
              Report problems anonymously and help
              identify the issues affecting students
              across campus. WhisperNet groups similar
              reports together so recurring problems
              become visible.
            </p>

            <div className="hero-actions">
              <Link
                href="/report"
                className="primary-button"
              >
                Report a Problem
              </Link>

              <Link
                href="/issues"
                className="secondary-button"
              >
                Explore Issues
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Campus Issues — Only for signed-in users */}

      {!loadingUser && user && (
        <section className="section">
          <div className="container">

            <div className="section-header">
              <h2>Campus Issues</h2>

              <p>
                See the problems students are reporting
                across campus.
              </p>
            </div>

            {issues.length === 0 ? (
              <div className="form-card">
                <h2>No issues yet</h2>

                <p className="form-description">
                  No campus issues have been created yet.
                </p>
              </div>
            ) : (
              <div className="issue-grid">

                {issues.map((issue) => (
                  <Link
                    href={`/issues/${issue.issue_id}`}
                    className="issue-card"
                    key={issue.issue_id}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        marginBottom: "14px",
                      }}
                    >
                      <span
                        className={`status ${getStatusClass(
                          issue.status
                        )}`}
                      >
                        {issue.status.replace(
                          "_",
                          " "
                        )}
                      </span>

                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          color:
                            issue.priority ===
                            "URGENT"
                              ? "#a33a3a"
                              : "#777d8d",
                        }}
                      >
                        {issue.priority}
                      </span>
                    </div>

                    <h3>
                      {issue.title}
                    </h3>

                    <p>
                      {issue.description}
                    </p>

                    <div className="issue-meta">

                      <span className="report-count">
                        {issue.report_count}{" "}
                        {issue.report_count === 1
                          ? "report"
                          : "reports"}
                      </span>

                      <span className="report-count">
                        {issue.supporter_count}{" "}
                        {issue.supporter_count === 1
                          ? "supporter"
                          : "supporters"}
                      </span>

                    </div>
                  </Link>
                ))}

              </div>
            )}

          </div>
        </section>
      )}

      {/* How WhisperNet works */}

      <section className="section">
        <div className="container">

          <div className="section-header">
            <h2>
              How WhisperNet works
            </h2>

            <p>
              Individual reports become meaningful
              campus-wide insights.
            </p>
          </div>

          <div className="steps">

            <div className="step">
              <div className="step-number">
                1
              </div>

              <h3>Submit</h3>

              <p>
                Share a campus problem anonymously
                through a simple report.
              </p>
            </div>

            <div className="step">
              <div className="step-number">
                2
              </div>

              <h3>Understand</h3>

              <p>
                WhisperNet converts the report into a
                semantic representation using AI.
              </p>
            </div>

            <div className="step">
              <div className="step-number">
                3
              </div>

              <h3>Group</h3>

              <p>
                Similar reports are identified and
                grouped under the same underlying issue.
              </p>
            </div>

            <div className="step">
              <div className="step-number">
                4
              </div>

              <h3>Resolve</h3>

              <p>
                Administrators can track issues and
                manage their resolution.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* CTA */}

      <section className="section">
        <div className="container">

          <div className="form-card">
            <h2>
              Have something to report?
            </h2>

            <p className="form-description">
              Your report can help reveal problems
              that affect more students than you
              realize.
            </p>

            <Link
              href="/report"
              className="primary-button"
            >
              Submit a Report
            </Link>
          </div>

        </div>
      </section>

      {/* Footer */}

      <footer className="footer">
        <div className="container">
          WhisperNet — Anonymous Campus Problem
          Intelligence
        </div>
      </footer>
    </>
  );
}