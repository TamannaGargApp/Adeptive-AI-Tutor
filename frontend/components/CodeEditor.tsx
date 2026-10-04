"use client";

const INDENT = "    ";

interface CodeEditorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
}

/** A plain code textarea where Tab indents instead of leaving the field (Escape, then Tab, leaves it). */
export default function CodeEditor({ id, value, onChange, disabled, label }: CodeEditorProps) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || event.shiftKey) return;
    event.preventDefault();
    const element = event.currentTarget;
    const { selectionStart, selectionEnd } = element;
    onChange(value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd));
    requestAnimationFrame(() => element.setSelectionRange(selectionStart + INDENT.length, selectionStart + INDENT.length));
  }

  const rows = Math.min(Math.max(value.split("\n").length + 1, 6), 20);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={rows}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="w-full resize-y rounded-lg border border-line bg-code p-3 font-mono text-sm leading-relaxed text-code-fg focus:border-blue focus:outline-none"
      />
    </div>
  );
}