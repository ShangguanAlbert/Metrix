export default function SourceTextEditor({
  value = "",
  onChange,
  spellCheckEnabled = false,
}) {
  return (
    <textarea
      className="notes-source-editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      spellCheck={spellCheckEnabled}
      placeholder="在这里以 Markdown 源码方式编辑笔记"
    />
  );
}
