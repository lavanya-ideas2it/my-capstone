import type { Role } from "@/types";

type Props = {
  value: Role;
  onChange: (r: Role) => void;
  disabled?: boolean;
};

const ROLES: Role[] = ["VIEWER", "EDITOR", "ADMIN"];

export function RoleSelect({ value, onChange, disabled }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      disabled={disabled}
      className="text-sm border border-gray-300 rounded-md px-2 py-1
                 focus:outline-none focus:ring-2 focus:ring-brand-500
                 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r.charAt(0) + r.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
  );
}
