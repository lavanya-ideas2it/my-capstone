type Props = {
  saving: boolean;
  mode: "create" | "edit";
  onSave: () => void;
  onCancel: () => void;
  error?: string | null;
};

export function SaveBar({ saving, mode, onSave, onCancel, error }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200">
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300
                     text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white
                     hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {saving
            ? "Saving…"
            : mode === "create"
              ? "Create article"
              : "Save changes"}
        </button>
      </div>
    </div>
  );
}
