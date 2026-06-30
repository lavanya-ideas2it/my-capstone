"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { AuthUser, Role } from "@/types";

const ROLES: Role[] = ["VIEWER", "EDITOR", "ADMIN"];

export default function RegisterPage() {
  const { user, apiFetch } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Role selector only visible to authenticated admins (AC3.1).
  const [role, setRole] = useState<Role>("VIEWER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  // Bootstrap: first registration is open (no users exist yet).
  // Otherwise, only ADMINs can reach this page (middleware redirects others).

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, string> = { email, name, password };
      if (isAdmin) body.role = role;

      // Use apiFetch so the admin's Bearer token is attached automatically.
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError(
            "User accounts already exist. Log in as admin, then use Admin → Add user to create accounts."
          );
        } else {
          const data = (await res.json()) as { error?: string };
          setError(data.error ?? "Registration failed.");
        }
        return;
      }

      const { user: created } = (await res.json()) as { user: AuthUser };

      if (isAdmin) {
        // Admin created another user — stay in the app.
        router.push("/admin/users");
      } else {
        // Bootstrap: account created, now go log in.
        router.push(`/login?registered=${encodeURIComponent(created.email)}`);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">
        {isAdmin ? "Create account" : "Set up TeamWiki"}
      </h1>
      {!isAdmin && (
        <p className="text-sm text-gray-500 mb-6">
          Register the first admin account to get started.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 mt-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Full name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="Jane Smith"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="jane@company.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            htmlFor="confirm"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Role selector only visible to admins (AC3.1/AC3.2). */}
        {isAdmin && (
          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            href={isAdmin ? "/" : "/login"}
            className="flex-1 text-center py-2 px-4 rounded-lg text-sm font-medium
                       border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-brand-600 text-white py-2 px-4 rounded-lg text-sm font-medium
                       hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {loading
              ? "Creating account…"
              : isAdmin
                ? "Create account"
                : "Create admin account"}
          </button>
        </div>
      </form>

      {!isAdmin && (
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
