import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import licenseText from "../../LICENSE?raw";
import { withAuthSlot } from "../app/authStorage.js";
import "../styles/license-page.css";

const LICENSE_CONTENT = String(licenseText || "").trim();
const LICENSE_FALLBACK_TEXT = "License 内容暂时不可用。";

export default function LicensePage() {
  return (
    <main className="license-page">
      <section className="license-card">
        <header className="license-header">
          <Link className="license-back-link" to={withAuthSlot("/login")}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>返回登录</span>
          </Link>
          <h1 className="license-title">开源协议 License</h1>
          <p className="license-subtitle">
            本项目采用 GNU Affero General Public License v3.0（仅第 3 版，AGPL-3.0-only）。
          </p>
          <p className="license-subtitle">Copyright © 2026 Fuze Shangguan（上官福泽）</p>
          <p className="license-subtitle">
            你可以依照本许可证修改和再分发本项目；本项目不提供任何担保。
          </p>
          <a
            className="license-back-link"
            href="https://github.com/ShangguanAlbert/Metrix"
            target="_blank"
            rel="noopener noreferrer"
          >
            获取项目源码
          </a>
        </header>
        <pre className="license-content">{LICENSE_CONTENT || LICENSE_FALLBACK_TEXT}</pre>
      </section>
    </main>
  );
}
