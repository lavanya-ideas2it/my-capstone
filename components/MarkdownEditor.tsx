"use client";

import { useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const handleChange = useCallback(
    (val: string) => onChange(val),
    [onChange]
  );

  return (
    <div className="rounded-lg overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-transparent">
      <CodeMirror
        value={value}
        onChange={handleChange}
        extensions={[markdown()]}
        theme={oneDark}
        placeholder={placeholder ?? "Write Markdown here…"}
        minHeight="320px"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
        }}
        className="text-sm"
      />
    </div>
  );
}
