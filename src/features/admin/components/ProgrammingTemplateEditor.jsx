import { useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { buildSafePreviewDocument } from "../../../pages/party/webCode.js";
import { rangeDecorations } from "../../classroom/coding/exerciseEditor.js";
import { normalizeProgrammingTemplate, MAX_EXERCISE_RANGES } from "../../../../shared/party-template.js";
import { publishAdminProgrammingTemplate } from "../../../pages/admin/adminApi.js";

const HTML_EXTENSIONS = [html(), EditorView.lineWrapping, EditorView.contentAttributes.of({ "aria-label": "HTML 练习代码" })];
const CSS_EXTENSIONS = [css(), EditorView.lineWrapping, EditorView.contentAttributes.of({ "aria-label": "CSS 练习代码" })];
const FILES = [
  { key: "html", label: "HTML", extensions: HTML_EXTENSIONS },
  { key: "css", label: "CSS", extensions: CSS_EXTENSIONS },
];

export default function ProgrammingTemplateEditor({ lesson, onChange, onSave, adminToken }) {
  const editorViews = useRef({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeFile, setActiveFile] = useState("html");
  const template = normalizeProgrammingTemplate(lesson.programmingTemplate);
  const preview = useMemo(() => buildSafePreviewDocument(template.html, template.css), [template.html, template.css]);

  const rangeCount = template.editableRanges.html.length + template.editableRanges.css.length;
  const activeRanges = template.editableRanges[activeFile];
  const fileExtensions = useMemo(() => Object.fromEntries(FILES.map((file) => [file.key, [
    ...file.extensions,
    EditorView.decorations.of(rangeDecorations(template.editableRanges[file.key], "teacher-exercise-fill")),
  ]])), [template.editableRanges]);

  function markAnswer() {
    const view = editorViews.current[activeFile];
    if (!view) return;
    const { from, to } = view.state.selection.main;
    if (activeRanges.length >= MAX_EXERCISE_RANGES) { setNotice(`每个文件最多设置 ${MAX_EXERCISE_RANGES} 个填写区。`); return; }
    if (activeRanges.some((range) => from <= range.to && to >= range.from)) { setNotice("选区与已有填写区重叠或相邻，请选择其他位置。"); return; }
    const insert = from === to ? "____" : "";
    if (insert) view.dispatch({ changes: { from, insert } });
    const ranges = activeRanges.map((range) => ({ ...range, from: range.from >= from ? range.from + insert.length : range.from, to: range.to >= from ? range.to + insert.length : range.to }));
    ranges.push({ id: crypto.randomUUID(), from, to: to + insert.length });
    onChange({ programmingTemplate: { ...template, [activeFile]: view.state.doc.toString(), editMode: "fill", editableRanges: { ...template.editableRanges, [activeFile]: ranges } } });
    setNotice("已设为填写区。学生只能修改高亮内容，其余代码将锁定。");
    view.dispatch({ selection: { anchor: from, head: to + insert.length } });
    view.focus();
  }

  async function publish() {
    if (busy || (template.editMode === "fill" && !rangeCount)) return;
    setBusy(true);
    setNotice("");
    try {
      if (!await onSave({ silent: true })) throw new Error("课时尚未保存，练习未发布。");
      await publishAdminProgrammingTemplate(adminToken, lesson.id);
      setNotice("练习已发布。学生进入“本课练习”载入代码后即可开始，长期任务会独立保留。");
    } catch (error) { setNotice(error.message || "发布练习失败。"); }
    finally { setBusy(false); }
  }

  return <section className="teacher-programming-practice" aria-label="本课编程练习编辑">
    <header className="teacher-practice-head">
      <div>
        <h3>本课编程练习</h3>
        <p>先编写代码，再选中允许学生修改的内容，点击“设为填写区”。</p>
        <small>未选中文字时，会在光标处插入空位。填写区以外的代码会锁定；HTML 和 CSS 都可以设空。</small>
      </div>
      <div className="teacher-practice-actions">
        <button type="button" className="teacher-ghost-btn" aria-expanded={previewOpen}
          onClick={() => setPreviewOpen((open) => !open)}>{previewOpen ? "关闭预览" : "预览练习"}</button>
        <button type="button" className="teacher-primary-btn" onClick={() => void publish()}
          disabled={busy || (!template.html.trim() && !template.css.trim()) || (template.editMode === "fill" && !rangeCount)}>{busy ? "发布中..." : "保存并发布练习"}</button>
      </div>
    </header>
    <div className="teacher-practice-mode" role="group" aria-label="学生编辑方式">
      <span>学生编辑方式</span>
      {[{ value: "free", label: "自由编程" }, { value: "fill", label: "代码填空" }].map((mode) => <button type="button" key={mode.value}
        aria-pressed={template.editMode === mode.value} disabled={busy}
        onClick={() => onChange({ programmingTemplate: { ...template, editMode: mode.value } })}>{mode.label}</button>)}
      <span>{template.editMode === "fill" ? `已设置 ${rangeCount} 个填写区 · 其余代码锁定` : "学生可修改全部代码"}</span>
    </div>
    {notice ? <p className="teacher-practice-notice" role="status">{notice}</p> : null}
    <div className={`teacher-practice-workbench${previewOpen ? " has-preview" : ""}`}>
      <div className="teacher-practice-code">
        <div className="teacher-practice-file-tabs" role="tablist" aria-label="练习代码文件">
          {FILES.map((file) => <button key={file.key} type="button" role="tab"
            id={`practice-file-tab-${file.key}`} aria-controls={`practice-file-panel-${file.key}`}
            aria-selected={activeFile === file.key} onClick={() => setActiveFile(file.key)}>{file.label}</button>)}
        </div>
        <div className="teacher-practice-blank-tools">
          <button type="button" className="teacher-ghost-btn" disabled={busy} onMouseDown={(event) => event.preventDefault()} onClick={markAnswer}>设为填写区</button>
          <span>{activeFile.toUpperCase()} · {activeRanges.length} 个填写区</span>
          {activeRanges.map((range, index) => <button type="button" key={range.id} className="teacher-practice-remove-blank" disabled={busy}
            aria-label={`移除 ${activeFile.toUpperCase()} 填写区 ${index + 1}`}
            onClick={() => onChange({ programmingTemplate: { ...template, editableRanges: { ...template.editableRanges, [activeFile]: activeRanges.filter((item) => item.id !== range.id) } } })}>填写区 {index + 1} ×</button>)}
        </div>
        {FILES.map((file) => <div key={file.key} className="teacher-practice-code-file" role="tabpanel"
          id={`practice-file-panel-${file.key}`} aria-labelledby={`practice-file-tab-${file.key}`} hidden={activeFile !== file.key}>
          <CodeMirror value={template[file.key]} height="100%" extensions={fileExtensions[file.key]} onCreateEditor={(view) => { editorViews.current[file.key] = view; }}
            aria-label={`${file.label} 练习代码`} editable={!busy}
            onChange={(value, update) => {
              setNotice("");
              const ranges = template.editableRanges[file.key].map((range) => ({ ...range,
                from: update.changes.mapPos(range.from, -1), to: update.changes.mapPos(range.to, 1),
              })).filter((range) => range.to > range.from);
              onChange({ programmingTemplate: { ...template, [file.key]: value, editableRanges: { ...template.editableRanges, [file.key]: ranges } } });
            }} />
        </div>)}
      </div>
      {previewOpen ? <div className="teacher-practice-preview">
        <div className="teacher-practice-preview-label">学生看到的网页</div>
        <iframe title="本课编程练习预览" sandbox="" srcDoc={preview} />
      </div> : null}
    </div>
  </section>;
}
