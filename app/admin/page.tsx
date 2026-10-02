"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

type Issue = {
  issue_id: number;
  title: string;
  priority: string;
  status: string;
  category_name: string;
  report_count: number;
  supporter_count: number;
};

type AnalyticsItem = {
  status?: string;
  priority?: string;
  category_id?: number;
  category_name?: string;
  issue_count: number;
};

type DashboardData = {
  admin: {
    name: string;
    email: string;
  };
  issues: Issue[];
  analytics: {
    status: AnalyticsItem[];
    priority: AnalyticsItem[];
    category: AnalyticsItem[];
  };
};

export default function AdminPage() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/admin");

        const result = await response.json();

        if (response.status === 403) {
          router.push("/");
          return;
        }

        if (!response.ok) {
          throw new Error(
            result.error || "Failed to load dashboard"
          );
        }

        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard"
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  if (loading) {
    return (
      <>
        <Navbar />

        <main className="section">
          <div className="container">
            <p>Loading admin dashboard...</p>
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

  const totalIssues = data.issues.length;

  const openIssues =
    data.analytics.status.find(
      (item) => item.status === "OPEN"
    )?.issue_count || 0;

  const inProgressIssues =
    data.analytics.status.find(
      (item) => item.status === "IN_PROGRESS"
    )?.issue_count || 0;

  const resolvedIssues =
    data.analytics.status.find(
      (item) => item.status === "RESOLVED"
    )?.issue_count || 0;

  return (
    <>
      <Navbar />

      <main className="section">
        <div className="container">

          <div className="section-header">
            <div className="hero-badge">
              Admin Dashboard
            </div>

            <h1>Welcome, {data.admin.name}</h1>

            <p>
              Manage campus issues and monitor
              WhisperNet activity.
            </p>
          </div>

          <div className="issue-grid">

            <div className="issue-card">
              <h3>Total Issues</h3>
              <p>{totalIssues}</p>
            </div>

            <div className="issue-card">
              <h3>Open</h3>
              <p>{openIssues}</p>
            </div>

            <div className="issue-card">
              <h3>In Progress</h3>
              <p>{inProgressIssues}</p>
            </div>

            <div className="issue-card">
              <h3>Resolved</h3>
              <p>{resolvedIssues}</p>
            </div>

          </div>

          <div className="section-header">
            <h2>Issues</h2>
            <p>
              Current campus issues requiring
              administration.
            </p>
          </div>

          <div className="issue-grid">
            {data.issues.map((issue) => (
              <div
                className="issue-card"
                key={issue.issue_id}
              >
                <span className="status status-open">
                  {issue.status.replace("_", " ")}
                </span>

                <h3>{issue.title}</h3>

                <p>
                  Category: {issue.category_name}
                </p>

                <div className="issue-meta">
                  <span className="report-count">
                    {issue.report_count} reports
                  </span>

                  <span className="report-count">
                    {issue.supporter_count} supporters
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>

      <footer className="footer">
        <div className="container">
          WhisperNet — Admin Dashboard
        </div>
      </footer>
    </>
  );
}