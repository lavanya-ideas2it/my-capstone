type Props = {
  value: string;
  onChange: (v: string) => void;
};

export function ChangeSummaryInput({ value, onChange }: Props) {
  return (
    <div>
      <label
        htmlFor="change-summary"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Change summary{" "}
        <span className="font-normal text-gray-400">(optional)</span>
      </label>
      <input
        id="change-summary"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe what you changed…"
        maxLength={255}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
    </div>
  );
}
