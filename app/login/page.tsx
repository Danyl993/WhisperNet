"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Login failed"
        );
      }

      // Admin and regular users go to different areas.
      if (data.user.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/activity");
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Invalid email or password"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="logo">
            Whisper<span>Net</span>
          </Link>

          <div className="nav-links">
            <Link href="/">Home</Link>
            <Link href="/issues">Issues</Link>
            <Link href="/report">Submit a Report</Link>
          </div>
        </div>
      </nav>

      <main className="form-page">
        <div className="container">
          <div
            className="form-card"
            style={{ maxWidth: "460px" }}
          >
            <div className="hero-badge">
              Welcome back
            </div>

            <h1>Sign in to WhisperNet</h1>

            <p className="form-description">
              Sign in to view your activity, support issues,
              and access features available to your account.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">
                  Email
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading
                  ? "Signing in..."
                  : "Sign In"}
              </button>
            </form>

            <div
              style={{
                marginTop: "24px",
                padding: "14px",
                background: "#f7f8fc",
                borderRadius: "9px",
                fontSize: "13px",
                color: "#777d8d",
                lineHeight: 1.6,
              }}
            >
              <strong>Demo accounts</strong>
              <br />
              User: user1@whispernet.test / user123
              <br />
              Admin: admin@whispernet.test / admin123
            </div>
          </div>
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