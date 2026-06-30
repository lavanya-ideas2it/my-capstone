"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import type { AuthUser } from "@/types";

function LoginForm() {
  const { setCredentials } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Validate the redirect target: must be a relative path, never a
  // protocol-relative URL (//evil.com) or absolute URL (https://evil.com).
  const rawFrom = searchParams.get("from") ?? "/";
  const from = rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/";
  const registeredEmail = searchParams.get("registered");

  const [email, setEmail] = useState(registeredEmail ?? "");
  const [password, setPassword] = useState("");
  const [notice] = useState<string | null>(
    registeredEmail ? "Account created — sign in to continue." : null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Only show the register link when no users exist yet (bootstrap window open).
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  useEffect(() => {
    fetch("/api/auth/bootstrap")
      .then((r) => r.json())
      .then(({ needsBootstrap: v }) => setNeedsBootstrap(Boolean(v)))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        // AC1.2: generic error — no hint about which field was wrong.
        setError("Invalid email or password.");
        return;
      }
      const { user, accessToken } = (await res.json()) as {
        user: AuthUser;
        accessToken: string;
      };
      setCredentials(user, accessToken);
      router.replace(from);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Sign in to TeamWiki
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="you@company.com"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {notice && (
          <p role="status" className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
            {notice}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 text-white py-2 px-4 rounded-lg text-sm font-medium
                     hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* Only shown before the first user is created (bootstrap window). */}
      {needsBootstrap && (
        <p className="mt-4 text-center text-sm text-gray-500">
          No accounts yet?{" "}
          <Link href="/register" className="text-brand-600 hover:text-brand-700 font-medium">
            Set up your account
          </Link>
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
