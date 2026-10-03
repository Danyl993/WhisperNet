"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    if (creatingAccount && password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(creatingAccount ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
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

      // Public registration always creates a student (USER) account.
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
              {creatingAccount ? "Student registration" : "Welcome back"}
            </div>

            <h1>{creatingAccount ? "Create your student account" : "Sign in to WhisperNet"}</h1>

            <p className="form-description">
              {creatingAccount
                ? "Join WhisperNet to report campus problems, support issues, and track your activity."
                : "Sign in to view your activity, support issues, and access features available to your account."}
            </p>

            <form onSubmit={handleSubmit}>
              {creatingAccount && (
                <div className="form-group">
                  <label htmlFor="name">Full name</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </div>
              )}

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
                  autoComplete="email"
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
                  autoComplete={creatingAccount ? "new-password" : "current-password"}
                  minLength={creatingAccount ? 8 : undefined}
                  maxLength={72}
                  required
                />
              </div>

              {creatingAccount && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                    required
                  />
                </div>
              )}

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
                  : creatingAccount ? "Create Student Account" : "Sign In"}
              </button>
            </form>

            <div style={{ marginTop: "20px", textAlign: "center", fontSize: "14px" }}>
              {creatingAccount ? "Already have an account? " : "New student? "}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setCreatingAccount(!creatingAccount);
                  setError("");
                }}
                style={{ color: "#4f46e5", background: "none", border: 0, cursor: "pointer", font: "inherit", fontWeight: 600 }}
              >
                {creatingAccount ? "Sign in" : "Create a student account"}
              </button>
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
