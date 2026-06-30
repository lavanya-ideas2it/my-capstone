"use client";

import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import type { Role } from "@/types";

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
};

type Props = {
  /** Minimum role required. Hides children if user doesn't meet the threshold (AC12.2). */
  role: Role;
  children: ReactNode;
  fallback?: ReactNode;
};

export function RoleGate({ role, children, fallback = null }: Props) {
  const { user } = useAuth();
  if (!user || ROLE_RANK[user.role] < ROLE_RANK[role]) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
