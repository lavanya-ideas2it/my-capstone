"use client";

import type { TagSummary } from "@/types";

type Props = {
  all: TagSummary[];
  selected: string[];
  onChange: (ids: string[]) => void;
};

export function TagPicker({ all, selected, onChange }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (all.length === 0) {
    return <p className="text-sm text-gray-500">No tags yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {all.map((tag) => {
        const active = selected.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={`px-3 py-1 text-sm rounded-full border transition-colors
              ${active
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-brand-400 hover:text-brand-700"}`}
          >
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
