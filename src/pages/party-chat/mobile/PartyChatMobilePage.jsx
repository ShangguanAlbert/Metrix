import { useEffect, useRef, useState } from "react";
import PartyChatDesktopPage from "../desktop/PartyChatDesktopPage.jsx";
import "../../../styles/party-chat-mobile.css";
import { getStoredAuthUser } from "../../../app/authStorage.js";

export default function PartyChatMobilePage() {
  const shellRef = useRef(null);
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [activePane, setActivePane] = useState("chat");
  const hasCoding = getStoredAuthUser()?.teacherScopeKey === "shi-gaojun";

  useEffect(() => {
    if (!isSidebarDrawerOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setIsSidebarDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSidebarDrawerOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const shell = shellRef.current;
    const viewport = window.visualViewport;
    if (!shell || !viewport) return undefined;

    function syncKeyboardOffset() {
      const keyboardHeight = Math.max(
        0,
        Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
      );
      shell.style.setProperty("--party-mobile-vv-bottom", `${keyboardHeight}px`);
    }

    syncKeyboardOffset();
    viewport.addEventListener("resize", syncKeyboardOffset);
    viewport.addEventListener("scroll", syncKeyboardOffset);
    return () => {
      shell.style.setProperty("--party-mobile-vv-bottom", "0px");
      viewport.removeEventListener("resize", syncKeyboardOffset);
      viewport.removeEventListener("scroll", syncKeyboardOffset);
    };
  }, []);

  return (
    <div
      ref={shellRef}
      className={`party-mobile-shell${isSidebarDrawerOpen ? " is-drawer-open" : ""}${hasCoding ? " has-coding" : ""}${activePane === "coding" ? " is-coding-pane" : ""}`}
      data-layout="mobile"
    >
      <nav className="party-mobile-workspace-tabs" aria-label="协作区域">
        <button type="button" onClick={() => setIsSidebarDrawerOpen((open) => !open)} aria-expanded={isSidebarDrawerOpen}>小组与任务</button>
        {hasCoding ? <>
          <button type="button" aria-pressed={activePane === "chat"} onClick={() => setActivePane("chat")}>讨论</button>
          <button type="button" aria-pressed={activePane === "coding"} onClick={() => setActivePane("coding")}>编程</button>
        </> : null}
      </nav>
      <PartyChatDesktopPage
        isMobileSidebarDrawer
        isSidebarDrawerOpen={isSidebarDrawerOpen}
        onToggleSidebarDrawer={setIsSidebarDrawerOpen}
      />

      <button
        type="button"
        className="party-mobile-overlay"
        onClick={() => setIsSidebarDrawerOpen(false)}
        aria-label="关闭侧栏抽屉"
      />
    </div>
  );
}
