"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { RoleGate } from "@/components/RoleGate";
import { SearchBar } from "@/components/SearchBar";
import { TagNav } from "@/components/TagNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading…
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <Link
            href="/"
            className="text-lg font-bold text-brand-700 hover:text-brand-800"
          >
            TeamWiki
          </Link>
        </div>

        <div className="p-4 space-y-4 flex-1">
          <SearchBar />
          <TagNav />
        </div>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <RoleGate role="EDITOR">
            <Link
              href="/articles/new"
              className="block w-full text-center px-3 py-1.5 text-sm font-medium
                         bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              + New article
            </Link>
            <Link
              href="/import"
              className="block text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
            >
              Import docs
            </Link>
          </RoleGate>

          <RoleGate role="ADMIN">
            <Link
              href="/admin/users"
              className="block text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
            >
              Admin: users
            </Link>
            <Link
              href="/register"
              className="block text-sm text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100"
            >
              Admin: add user
            </Link>
          </RoleGate>

          <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
            <span className="truncate">{user.name}</span>
            <button
              onClick={logout}
              className="ml-2 text-gray-400 hover:text-gray-700 shrink-0"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
