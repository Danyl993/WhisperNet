"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function PasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update password.");
      setMessage(result.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="form-page">
        <div className="container">
          <section className="form-card" style={{ maxWidth: "520px" }}>
            <div className="hero-badge">Account security</div>
            <h1 style={{ marginTop: "12px" }}>Reset password</h1>
            <p className="form-description">Confirm your current password, then choose a new one.</p>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="current-password">Current password</label>
                <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="new-password">New password</label>
                <input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="confirm-password">Confirm new password</label>
                <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </div>
              {message && <div className="success-message">{message}</div>}
              {error && <div className="error-message">{error}</div>}
              <button className="submit-button" type="submit" disabled={loading}>
                {loading ? "Updating password..." : "Update password"}
              </button>
            </form>
            <button type="button" className="secondary-button" style={{ marginTop: "16px", cursor: "pointer" }} onClick={() => router.back()}>
              Back
            </button>
          </section>
        </div>
      </main>
    </>
  );
}
