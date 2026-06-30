"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RoleGate } from "@/components/RoleGate";
import { UserTable } from "@/components/UserTable";
import type { AuthUser, Role } from "@/types";

function AccessDenied() {
  return (
    <div className="text-center py-16">
      <p className="text-2xl font-semibold text-gray-700 mb-2">Access denied</p>
      <p className="text-gray-500">Only admins can view this page.</p>
    </div>
  );
}

function AdminContent() {
  const { user, apiFetch } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load users");
        const { users: u } = (await res.json()) as { users: AuthUser[] };
        setUsers(u);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Error loading users")
      )
      .finally(() => setLoading(false));
  }, [apiFetch]);

  async function handleRoleChange(id: string, role: Role) {
    const res = await apiFetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const { user: updated } = (await res.json()) as { user: AuthUser };
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    }
  }

  async function handleDelete(id: string) {
    const res = await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  return (
    <UserTable
      users={users}
      currentUserId={user!.id}
      onRoleChange={handleRoleChange}
      onDelete={handleDelete}
    />
  );
}

export default function UserAdminPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User management</h1>
      </div>
      <RoleGate role="ADMIN" fallback={<AccessDenied />}>
        <AdminContent />
      </RoleGate>
    </div>
  );
}
