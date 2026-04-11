import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodeSelection } from "@tiptap/pm/state";
import { useEditor, useEditorState } from "@tiptap/react";
import Heading from "@tiptap/extension-heading";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import { HeadingAnchor } from "./extensions/headingAnchor.js";
import { ActiveBlockHighlight } from "./extensions/activeBlockHighlight.js";
import { CodeBlockTools } from "./extensions/codeBlockTools.js";
import { EnhancedLink } from "./extensions/enhancedLink.js";
import { ImagePlaceholder, NoteImage } from "./extensions/enhancedImage.js";
import { htmlToMarkdown, markdownToHtml, normalizeMarkdown } from "./markdown.js";
import { uploadNoteImageFile } from "./services/mediaUploadService.js";
import { findMarkRangeAtPos, getEditorRectForRange } from "./utils/editorPosition.js";
import { buildTocItemsFromDoc } from "./utils/toc.js";
import { createEditorStableId } from "./utils/editorIds.js";

export function useRichNoteEditor({
  noteId = "",
  markdown = "",
  editable = true,
  placeholder = "",
  spellCheckEnabled = false,
  onMarkdownChange,
}) {
  const [tocItems, setTocItems] = useState([]);
  const [linkEditor, setLinkEditor] = useState({
    visible: false,
    position: null,
    link: { href: "", text: "" },
    range: null,
    canRemove: false,
    mode: "full",
  });
  const [linkBubble, setLinkBubble] = useState({
    visible: false,
    position: null,
    link: { href: "", text: "" },
    range: null,
  });
  const [tableUI, setTableUI] = useState({
    visible: false,
    triggerPosition: null,
    menuPosition: null,
    actions: [],
  });
  const [imageUI, setImageUI] = useState({
    visible: false,
    position: null,
    align: "left",
    size: "medium",
  });
  const normalizedMarkdown = useMemo(
    () => normalizeMarkdown(markdown),
    [markdown],
  );
  const lastSyncedMarkdownRef = useRef(normalizedMarkdown);
  const pendingUploadsRef = useRef(new Map());
  const editorRef = useRef(null);
  const linkEditorVisibleRef = useRef(false);

  useEffect(() => {
    linkEditorVisibleRef.current = linkEditor.visible;
  }, [linkEditor.visible]);

  const refreshToc = useCallback((currentEditor) => {
    if (!currentEditor) {
      setTocItems([]);
      return;
    }
    const activePos = Number(currentEditor.state.selection?.from || 0);
    setTocItems(buildTocItemsFromDoc(currentEditor.state.doc, activePos));
  }, []);

  const closeLinkEditor = useCallback(() => {
    setLinkEditor((current) => ({ ...current, visible: false, mode: "full" }));
  }, []);

  const closeLinkBubble = useCallback(() => {
    setLinkBubble((current) => ({ ...current, visible: false }));
  }, []);

  const closeTableMenu = useCallback(() => {
    setTableUI((current) => ({ ...current, visible: false }));
  }, []);

  const showLinkEditor = useCallback(
    ({ href = "", text = "", range = null, rect = null, mode = "full" } = {}) => {
      closeLinkBubble();
      setLinkEditor({
        visible: true,
        position: rect
          ? { left: rect.left, top: rect.top, bottom: rect.bottom }
          : { left: 24, top: 80, bottom: 80 },
        link: {
          href: String(href || "").trim(),
          text: String(text || "").trim(),
        },
        range,
        canRemove: !!range && !!String(href || "").trim(),
        mode,
      });
    },
    [closeLinkBubble],
  );

  const getLinkRangeNearSelection = useCallback((currentEditor) => {
    if (!currentEditor) return null;
    const selectionPos = Number(currentEditor.state.selection.from || 0);
    return (
      findMarkRangeAtPos(currentEditor.state.doc, selectionPos, "link") ||
      findMarkRangeAtPos(
        currentEditor.state.doc,
        Math.max(0, selectionPos - 1),
        "link",
      )
    );
  }, []);

  const openLinkEditor = useCallback(() => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;

    const baseRange = currentEditor.isActive("link")
      ? getLinkRangeNearSelection(currentEditor)
      : {
          from: currentEditor.state.selection.from,
          to: currentEditor.state.selection.to,
        };

    showLinkEditor({
      href: String(currentEditor.getAttributes("link")?.href || "").trim(),
      text: baseRange
        ? currentEditor.state.doc.textBetween(baseRange.from, baseRange.to, "\n")
        : "",
      range: baseRange,
      rect: getEditorRectForRange(currentEditor, baseRange),
      mode: "full",
    });
  }, [getLinkRangeNearSelection, showLinkEditor]);

  const normalizeHref = useCallback((value = "") => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
    if (trimmed.includes(".") && !trimmed.startsWith("/")) return `https://${trimmed}`;
    return trimmed;
  }, []);

  const saveLinkEditor = useCallback(
    ({ href = "", text = "" } = {}) => {
      const currentEditor = editorRef.current;
      if (!currentEditor) return;
      const resolvedHref =
        linkEditor.mode === "title"
          ? String(linkEditor.link?.href || "").trim()
          : href;
      const normalizedHref = normalizeHref(resolvedHref);
      if (!normalizedHref) return;

      const currentRange = linkEditor.range || {
        from: currentEditor.state.selection.from,
        to: currentEditor.state.selection.to,
      };
      const nextText = String(text || "").trim() || normalizedHref;

      currentEditor
        .chain()
        .focus()
        .insertContentAt(currentRange, nextText)
        .setTextSelection({
          from: currentRange.from,
          to: currentRange.from + nextText.length,
        })
        .setLink({ href: normalizedHref })
        .run();

      closeLinkEditor();
      requestAnimationFrame(() => {
        const nextEditor = editorRef.current;
        if (!nextEditor) return;
        const refreshedRange = findMarkRangeAtPos(
          nextEditor.state.doc,
          currentRange.from,
          "link",
        );
        const rect = getEditorRectForRange(nextEditor, refreshedRange || currentRange);
        if (!refreshedRange || !rect) return;
        setLinkBubble({
          visible: true,
          position: {
            anchorX: rect.left + rect.width / 2,
            top: rect.top - 46,
          },
          link: {
            href: normalizedHref,
            text: nextText,
          },
          range: refreshedRange,
        });
      });
    },
    [closeLinkEditor, linkEditor.link?.href, linkEditor.mode, linkEditor.range, normalizeHref],
  );

  const removeLink = useCallback(() => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    const currentRange =
      linkEditor.range ||
      getLinkRangeNearSelection(currentEditor);
    if (!currentRange) {
      closeLinkEditor();
      return;
    }
    currentEditor.chain().focus().setTextSelection(currentRange).unsetLink().run();
    closeLinkEditor();
    closeLinkBubble();
  }, [closeLinkBubble, closeLinkEditor, getLinkRangeNearSelection, linkEditor.range]);

  const openLinkInNewTab = useCallback((href = "") => {
    const safeHref = normalizeHref(href);
    if (!safeHref) return;
    window.open(safeHref, "_blank", "noopener,noreferrer");
  }, [normalizeHref]);

  const startLinkTitleEdit = useCallback(() => {
    const currentEditor = editorRef.current;
    const currentRange = linkBubble.range || getLinkRangeNearSelection(currentEditor);
    if (!currentEditor || !currentRange) return;
    showLinkEditor({
      href: linkBubble.link?.href || currentEditor.getAttributes("link")?.href || "",
      text:
        linkBubble.link?.text ||
        currentEditor.state.doc.textBetween(currentRange.from, currentRange.to, "\n"),
      range: currentRange,
      rect: getEditorRectForRange(currentEditor, currentRange),
      mode: "title",
    });
  }, [getLinkRangeNearSelection, linkBubble.link?.href, linkBubble.link?.text, linkBubble.range, showLinkEditor]);

  const uploadImageForPlaceholder = useCallback(
    async (placeholderId, file) => {
      const currentEditor = editorRef.current;
      if (!currentEditor || !placeholderId || !(file instanceof File)) return;

      pendingUploadsRef.current.set(placeholderId, file);
      currentEditor.commands.updateImagePlaceholder(placeholderId, {
        status: "uploading",
        message: "正在上传图片…",
      });

      try {
        const uploaded = await uploadNoteImageFile({ noteId, file });
        currentEditor.commands.replaceImagePlaceholder(placeholderId, {
          src: uploaded.url,
          alt: uploaded.fileName || file.name || "图片",
          title: uploaded.fileName || "",
          align: "left",
          size: "medium",
        });
        pendingUploadsRef.current.delete(placeholderId);
      } catch (error) {
        currentEditor.commands.updateImagePlaceholder(placeholderId, {
          status: "error",
          message: error?.message || "图片上传失败，请重试。",
        });
      }
    },
    [noteId],
  );

  const insertImageFromFile = useCallback(
    async (file) => {
      const currentEditor = editorRef.current;
      if (!currentEditor || !editable) return;
      const placeholderId = createEditorStableId("image");
      currentEditor
        .chain()
        .focus()
        .insertImagePlaceholder({
          placeholderId,
          fileName: String(file?.name || "图片").trim() || "图片",
          status: "uploading",
          message: "正在上传图片…",
        })
        .run();

      await uploadImageForPlaceholder(placeholderId, file);
    },
    [editable, uploadImageForPlaceholder],
  );

  const retryImageUpload = useCallback(
    (placeholderId) => {
      const file = pendingUploadsRef.current.get(placeholderId);
      if (file) {
        void uploadImageForPlaceholder(placeholderId, file);
      }
    },
    [uploadImageForPlaceholder],
  );

  const removeImagePlaceholder = useCallback((placeholderId) => {
    pendingUploadsRef.current.delete(placeholderId);
    editorRef.current?.commands.removeImagePlaceholder(placeholderId);
  }, []);

  const buildTableActions = useCallback((currentEditor) => {
    if (!currentEditor) return [];

    const safeRun = (runner) => () => {
      runner?.();
      requestAnimationFrame(() => {
        const nextEditor = editorRef.current;
        if (nextEditor) {
          const selectionRect = getEditorRectForRange(nextEditor);
          if (selectionRect) {
            const triggerPosition = {
              left: selectionRect.right + 8,
              top: selectionRect.top - 10,
            };
            setTableUI((current) => ({
              ...current,
              triggerPosition,
              menuPosition: {
                left: triggerPosition.left,
                top: triggerPosition.top + 40,
              },
            }));
          }
        }
      });
    };

    return [
      {
        id: "row-before",
        label: "上方插入一行",
        onClick: safeRun(() => currentEditor.chain().focus().addRowBefore().run()),
      },
      {
        id: "row-after",
        label: "下方插入一行",
        onClick: safeRun(() => currentEditor.chain().focus().addRowAfter().run()),
      },
      {
        id: "column-before",
        label: "左侧插入一列",
        onClick: safeRun(() => currentEditor.chain().focus().addColumnBefore().run()),
      },
      {
        id: "column-after",
        label: "右侧插入一列",
        onClick: safeRun(() => currentEditor.chain().focus().addColumnAfter().run()),
      },
      {
        id: "delete-row",
        label: "删除当前行",
        onClick: safeRun(() => currentEditor.chain().focus().deleteRow().run()),
      },
      {
        id: "delete-column",
        label: "删除当前列",
        onClick: safeRun(() => currentEditor.chain().focus().deleteColumn().run()),
      },
      {
        id: "delete-table",
        label: "删除表格",
        danger: true,
        onClick: safeRun(() => currentEditor.chain().focus().deleteTable().run()),
      },
    ];
  }, []);

  const refreshTableUI = useCallback(
    (currentEditor) => {
      if (!currentEditor || !currentEditor.isActive("table")) {
        setTableUI((current) => ({
          ...current,
          triggerPosition: null,
          visible: false,
          actions: [],
        }));
        return;
      }

      const selectionRect = getEditorRectForRange(currentEditor);
      if (!selectionRect) return;

      const triggerPosition = {
        left: selectionRect.right + 8,
        top: selectionRect.top - 10,
      };

      setTableUI((current) => ({
        ...current,
        triggerPosition,
        menuPosition: {
          left: triggerPosition.left,
          top: triggerPosition.top + 40,
        },
        actions: buildTableActions(currentEditor),
      }));
    },
    [buildTableActions],
  );

  const refreshLinkBubble = useCallback(
    (currentEditor) => {
      if (
        !editable ||
        !currentEditor ||
        !currentEditor.isFocused ||
        linkEditorVisibleRef.current
      ) {
        setLinkBubble((current) => ({ ...current, visible: false, position: null }));
        return;
      }

      const currentRange = getLinkRangeNearSelection(currentEditor);
      if (!currentRange) {
        setLinkBubble((current) => ({ ...current, visible: false, position: null }));
        return;
      }

      const rect = getEditorRectForRange(currentEditor, currentRange);
      if (!rect) {
        setLinkBubble((current) => ({ ...current, visible: false, position: null }));
        return;
      }

      const href = String(currentRange.mark?.attrs?.href || "").trim();
      if (!href) {
        setLinkBubble((current) => ({ ...current, visible: false, position: null }));
        return;
      }

      setLinkBubble({
        visible: true,
        position: {
          anchorX: rect.left + rect.width / 2,
          top: rect.top - 46,
        },
        link: {
          href,
          text:
            String(currentRange.text || "").trim() ||
            currentEditor.state.doc.textBetween(currentRange.from, currentRange.to, "\n"),
        },
        range: currentRange,
      });
    },
    [editable, getLinkRangeNearSelection],
  );

  useEffect(() => {
    if (linkEditor.visible) return;
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    requestAnimationFrame(() => refreshLinkBubble(currentEditor));
  }, [linkEditor.visible, refreshLinkBubble]);

  const closeImageToolbar = useCallback(() => {
    setImageUI((current) => ({ ...current, visible: false }));
  }, []);

  const refreshImageUI = useCallback(
    (currentEditor) => {
      if (!editable || !currentEditor) {
        setImageUI((current) => ({
          ...current,
          visible: false,
          position: null,
        }));
        return;
      }

      const { selection } = currentEditor.state;
      if (
        !(selection instanceof NodeSelection) ||
        selection.node?.type?.name !== "image"
      ) {
        setImageUI((current) => ({
          ...current,
          visible: false,
          position: null,
        }));
        return;
      }

      const imageNode = selection.node;
      const imageElement = currentEditor.view.nodeDOM(selection.from);
      if (!(imageElement instanceof HTMLElement)) {
        setImageUI((current) => ({
          ...current,
          visible: false,
          position: null,
        }));
        return;
      }

      const rect = imageElement.getBoundingClientRect();
      const anchorX = rect.left + rect.width / 2;
      const top = rect.top - 42;

      setImageUI({
        visible: true,
        position: { anchorX, top },
        align: String(imageNode.attrs?.align || "left").trim() || "left",
        size: String(imageNode.attrs?.size || "medium").trim() || "medium",
      });
    },
    [editable],
  );

  const setImageAlign = useCallback((align) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    currentEditor.chain().focus().updateAttributes("image", { align }).run();
    requestAnimationFrame(() => refreshImageUI(currentEditor));
  }, [refreshImageUI]);

  const setImageSize = useCallback((size) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    currentEditor.chain().focus().updateAttributes("image", { size }).run();
    requestAnimationFrame(() => refreshImageUI(currentEditor));
  }, [refreshImageUI]);

  const deleteSelectedImage = useCallback(() => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    currentEditor.chain().focus().deleteSelection().run();
    setImageUI((current) => ({ ...current, visible: false, position: null }));
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: {
          HTMLAttributes: {
            class: "notes-rich-editor-code-block",
          },
        },
      }),
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      HeadingAnchor,
      EnhancedLink.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        editable,
        onLinkClick: showLinkEditor,
      }),
      Placeholder.configure({
        placeholder,
      }),
      ActiveBlockHighlight.configure({
        enabled: editable,
      }),
      CodeBlockTools.configure({
        enabled: editable,
      }),
      Underline,
      NoteImage,
      // eslint-disable-next-line react-hooks/refs
      ImagePlaceholder.configure({
        onRetryUpload: retryImageUpload,
        onRemoveUpload: removeImagePlaceholder,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: markdownToHtml(normalizedMarkdown),
    editable,
    editorProps: {
      attributes: {
        class: "notes-rich-editor-prosemirror",
        spellcheck: spellCheckEnabled ? "true" : "false",
      },
      handlePaste: (_view, event) => {
        if (!editable) return false;
        const file = Array.from(event.clipboardData?.files || []).find((item) =>
          String(item?.type || "").startsWith("image/"),
        );
        if (!file) return false;
        event.preventDefault();
        void insertImageFromFile(file);
        return true;
      },
      handleDrop: (view, event) => {
        if (!editable) return false;
        const file = Array.from(event.dataTransfer?.files || []).find((item) =>
          String(item?.type || "").startsWith("image/"),
        );
        if (!file) return false;

        const coords = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        if (coords?.pos) {
          editorRef.current?.chain().focus().setTextSelection(coords.pos).run();
        }

        event.preventDefault();
        void insertImageFromFile(file);
        return true;
      },
    },
    onCreate({ editor: currentEditor }) {
      refreshToc(currentEditor);
      refreshLinkBubble(currentEditor);
      refreshTableUI(currentEditor);
      refreshImageUI(currentEditor);
    },
    onFocus({ editor: currentEditor }) {
      refreshLinkBubble(currentEditor);
      refreshTableUI(currentEditor);
      refreshImageUI(currentEditor);
    },
    onBlur() {
      setLinkBubble((current) => ({ ...current, visible: false, position: null }));
    },
    onUpdate({ editor: nextEditor }) {
      const nextMarkdown = htmlToMarkdown(nextEditor.getHTML());
      lastSyncedMarkdownRef.current = nextMarkdown;
      onMarkdownChange?.(nextMarkdown);
      refreshToc(nextEditor);
      refreshLinkBubble(nextEditor);
      refreshTableUI(nextEditor);
      refreshImageUI(nextEditor);
    },
    onSelectionUpdate({ editor: currentEditor }) {
      refreshToc(currentEditor);
      refreshLinkBubble(currentEditor);
      refreshTableUI(currentEditor);
      refreshImageUI(currentEditor);
    },
  });

  useEffect(() => {
    editorRef.current = editor || null;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute(
      "spellcheck",
      spellCheckEnabled ? "true" : "false",
    );
  }, [editor, spellCheckEnabled]);

  useEffect(() => {
    setLinkBubble({
      visible: false,
      position: null,
      link: { href: "", text: "" },
      range: null,
    });
  }, [noteId]);

  useEffect(() => {
    if (!editor) return;
    if (normalizedMarkdown === lastSyncedMarkdownRef.current) return;
    editor.commands.setContent(markdownToHtml(normalizedMarkdown), false);
    lastSyncedMarkdownRef.current = normalizedMarkdown;
    refreshToc(editor);
    setLinkBubble((current) => ({ ...current, visible: false, position: null }));
    refreshTableUI(editor);
    refreshImageUI(editor);
  }, [editor, normalizedMarkdown, refreshImageUI, refreshTableUI, refreshToc]);

  const formatting = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) {
        return {
          canUndo: false,
          canRedo: false,
          isBold: false,
          isItalic: false,
          isUnderline: false,
          isStrike: false,
          isCode: false,
          isLink: false,
          isBulletList: false,
          isOrderedList: false,
          isTaskList: false,
          isBlockquote: false,
          isCodeBlock: false,
          isHeading1: false,
          isHeading2: false,
          isHeading3: false,
          isTable: false,
        };
      }

      return {
        canUndo: currentEditor.can().chain().focus().undo().run(),
        canRedo: currentEditor.can().chain().focus().redo().run(),
        isBold: currentEditor.isActive("bold"),
        isItalic: currentEditor.isActive("italic"),
        isUnderline: currentEditor.isActive("underline"),
        isStrike: currentEditor.isActive("strike"),
        isCode: currentEditor.isActive("code"),
        isLink: currentEditor.isActive("link"),
        isBulletList: currentEditor.isActive("bulletList"),
        isOrderedList: currentEditor.isActive("orderedList"),
        isTaskList: currentEditor.isActive("taskList"),
        isBlockquote: currentEditor.isActive("blockquote"),
        isCodeBlock: currentEditor.isActive("codeBlock"),
        isHeading1: currentEditor.isActive("heading", { level: 1 }),
        isHeading2: currentEditor.isActive("heading", { level: 2 }),
        isHeading3: currentEditor.isActive("heading", { level: 3 }),
        isTable: currentEditor.isActive("table"),
      };
    },
  });

  return {
    editor,
    formatting,
    tocItems,
    linkEditor,
    linkBubble,
    tableUI,
    imageUI,
    openLinkEditor,
    closeLinkEditor,
    closeLinkBubble,
    saveLinkEditor,
    removeLink,
    openLinkInNewTab,
    startLinkTitleEdit,
    insertImageFromFile,
    closeTableMenu,
    closeImageToolbar,
    setImageAlign,
    setImageSize,
    deleteSelectedImage,
    toggleTableMenu: () =>
      setTableUI((current) => ({ ...current, visible: !current.visible })),
  };
}
