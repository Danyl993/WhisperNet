"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

const categories = [
  { id: 1, name: "Academics" },
  { id: 2, name: "Infrastructure" },
  { id: 3, name: "Hostel" },
  { id: 4, name: "Transport" },
  { id: 5, name: "Canteen" },
];

export default function ReportPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Check whether the user is logged in
  useEffect(() => {
    async function checkAuthentication() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();

        if (!data.authenticated) {
          router.replace("/login");
          return;
        }

        setAuthenticated(true);
      } catch (error) {
        console.error(
          "Authentication check failed:",
          error
        );

        router.replace("/login");
      } finally {
        setAuthLoading(false);
      }
    }

    checkAuthentication();
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category_id: Number(categoryId),
          title,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to submit report"
        );
      }

      setMessage(
        `Report submitted successfully! Your report ID is ${data.report_id}.`
      );

      setCategoryId("");
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while submitting the report."
      );
    } finally {
      setLoading(false);
    }
  }

  // While checking authentication
  if (authLoading) {
    return (
      <>
        <Navbar />

        <main className="section">
          <div className="container">
            <p>Checking authentication...</p>
          </div>
        </main>
      </>
    );
  }

  // If not authenticated, redirect is already being performed.
  // Do not render the report form.
  if (!authenticated) {
    return null;
  }

  return (
    <>
      <Navbar />

      {/* Report Form */}
      <main className="form-page">
        <div className="container">
          <div className="form-card">
            <div className="hero-badge">
              Anonymous Reporting
            </div>

            <h1>Report a Campus Problem</h1>

            <p className="form-description">
              Tell us about a problem you're experiencing on
              campus. Your report helps identify recurring
              issues and improve campus life.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Category */}
              <div className="form-group">
                <label htmlFor="category">
                  Category
                </label>

                <select
                  id="category"
                  value={categoryId}
                  onChange={(event) =>
                    setCategoryId(event.target.value)
                  }
                  required
                >
                  <option value="">
                    Select a category
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="form-group">
                <label htmlFor="title">
                  Problem Title
                </label>

                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder="e.g. WiFi problem in library"
                  required
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="description">
                  Describe the Problem
                </label>

                <textarea
                  id="description"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Describe what is happening, where it is happening, and how it affects students..."
                  rows={7}
                  required
                />
              </div>

              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading
                  ? "Processing Report..."
                  : "Submit Report"}
              </button>
            </form>

            {message && (
              <div className="success-message">
                {message}
              </div>
            )}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <p
              style={{
                marginTop: "22px",
                fontSize: "13px",
                color: "#777d8d",
                lineHeight: 1.6,
              }}
            >
              Your report is processed anonymously. Similar
              reports may be grouped together to identify
              recurring campus issues.
            </p>
          </div>
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