"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  user_id: number;
  name: string;
  email: string;
  role: string;
};

export default function Navbar() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();

        if (data.authenticated) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="logo">
          Whisper<span>Net</span>
        </Link>

        <div className="nav-links">
          <Link href="/">Home</Link>

          <Link href="/issues">
            Issues
          </Link>

          {user && (
            <Link href="/activity">
              My Activity
            </Link>
          )}

          {user?.role === "ADMIN" && (
            <Link href="/admin">
              Admin Dashboard
            </Link>
          )}

          {!loading && !user && (
            <Link href="/login">
              Sign In
            </Link>
          )}

          {user && (
            <details className="account-menu">
              <summary className="account-trigger" aria-label="Open account menu" title={user.name}>
                <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
                </svg>
              </summary>
              <div className="account-dropdown">
                <div className="account-identity">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <small>{user.role === "ADMIN" ? "Administrator" : "Student"}</small>
                </div>
                {user.role === "ADMIN" && <Link href="/admin">Admin Dashboard</Link>}
                {user.role !== "ADMIN" && <Link href="/activity">My Activity</Link>}
                <Link href="/account/password">Reset password</Link>
                <button type="button" onClick={handleLogout}>Log out</button>
              </div>
            </details>
          )}

          <Link
            href="/report"
            className="nav-button"
          >
            Submit a Report
          </Link>
        </div>
      </div>
    </nav>
  );
}
