import { useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { buildSafePreviewDocument } from "../../../pages/party/webCode.js";
import { normalizeProgrammingTemplate } from "../../../../shared/party-template.js";
import { publishAdminProgrammingTemplate } from "../../../pages/admin/adminApi.js";

const HTML_EXTENSIONS = [html()];
const CSS_EXTENSIONS = [css()];

export default function ProgrammingTemplateEditor({ lesson, onChange, onSave, adminToken }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const template = normalizeProgrammingTemplate(lesson.programmingTemplate);
  const preview = useMemo(() => buildSafePreviewDocument(template.html, template.css), [template.html, template.css]);

  async function publish() {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      if (!await onSave({ silent: true })) throw new Error("课时尚未保存，模板未发布。");
      await publishAdminProgrammingTemplate(adminToken, lesson.id);
      setNotice("本课模板已发布，学生可在编程区载入。已有作品保持原样。");
    } catch (error) { setNotice(error.message || "发布模板失败。"); }
    finally { setBusy(false); }
  }

  return <section className="teacher-programming-template">
    <h3>编程模板</h3>
    <p>提供本课 HTML/CSS 初始代码，让学生围绕知识点修改并预览。</p>
    <div className="teacher-programming-template-editors">
      <div><label>HTML 模板</label><CodeMirror value={template.html} height="220px" extensions={HTML_EXTENSIONS}
        editable={!busy} onChange={(value) => onChange({ programmingTemplate: { ...template, html: value } })} /></div>
      <div><label>CSS 模板</label><CodeMirror value={template.css} height="220px" extensions={CSS_EXTENSIONS}
        editable={!busy} onChange={(value) => onChange({ programmingTemplate: { ...template, css: value } })} /></div>
    </div>
    <div className="teacher-course-announcement-actions">
      <button type="button" className="teacher-ghost-btn" onClick={() => setPreviewOpen((open) => !open)}>{previewOpen ? "收起模板预览" : "预览模板"}</button>
      <button type="button" className="teacher-primary-btn" onClick={() => void publish()} disabled={busy || (!template.html.trim() && !template.css.trim())}>{busy ? "发布中..." : "保存并发布本课模板"}</button>
    </div>
    {notice ? <p role="status">{notice}</p> : null}
    {previewOpen ? <iframe title="教师编程模板预览" sandbox="" srcDoc={preview} className="teacher-programming-template-preview" /> : null}
  </section>;
}
