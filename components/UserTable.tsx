"use client";

import { useState } from "react";
import { RoleSelect } from "./RoleSelect";
import type { AuthUser, Role } from "@/types";

type Props = {
  users: AuthUser[];
  currentUserId: string;
  onRoleChange: (id: string, role: Role) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function UserTable({
  users,
  currentUserId,
  onRoleChange,
  onDelete,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  async function handleRoleChange(id: string, role: Role) {
    setBusy(id);
    await onRoleChange(id, role).finally(() => setBusy(null));
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setBusy(id);
    await onDelete(id).finally(() => setBusy(null));
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left">
            <th className="px-4 py-3 font-medium text-gray-700">Name</th>
            <th className="px-4 py-3 font-medium text-gray-700">Email</th>
            <th className="px-4 py-3 font-medium text-gray-700">Role</th>
            <th className="px-4 py-3 font-medium text-gray-700">
              Member since
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const isBusy = busy === u.id;
            return (
              <tr
                key={u.id}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {u.name}
                  {isSelf && (
                    <span className="ml-2 text-xs text-gray-400">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <RoleSelect
                    value={u.role}
                    onChange={(r) => handleRoleChange(u.id, r)}
                    disabled={isSelf || isBusy}
                  />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  {!isSelf && (
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      disabled={isBusy}
                      className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      {isBusy ? "…" : "Delete"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
