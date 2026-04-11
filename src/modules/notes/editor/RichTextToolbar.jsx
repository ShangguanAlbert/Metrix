import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

function ToolbarButton({
  title,
  active = false,
  disabled = false,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      className={`notes-rich-toolbar-btn${active ? " active" : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="notes-rich-toolbar-divider" aria-hidden="true" />;
}

export default function RichTextToolbar({
  editor,
  formatting,
  onOpenLinkEditor,
  onOpenImagePicker,
}) {
  if (!editor) return null;

  return (
    <div className="notes-rich-toolbar" role="toolbar" aria-label="富文本工具栏">
      <ToolbarButton
        title="撤销"
        disabled={!formatting?.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="重做"
        disabled={!formatting?.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="正文"
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <RemoveFormatting size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="标题 1"
        active={formatting?.isHeading1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="标题 2"
        active={formatting?.isHeading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="标题 3"
        active={formatting?.isHeading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="加粗"
        active={formatting?.isBold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="斜体"
        active={formatting?.isItalic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="下划线"
        active={formatting?.isUnderline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="删除线"
        active={formatting?.isStrike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="行内代码"
        active={formatting?.isCode}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="链接"
        active={formatting?.isLink}
        onClick={onOpenLinkEditor}
      >
        <Link2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="插入图片"
        onClick={onOpenImagePicker}
      >
        <ImageIcon size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton
        title="无序列表"
        active={formatting?.isBulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="有序列表"
        active={formatting?.isOrderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="任务列表"
        active={formatting?.isTaskList}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="引用"
        active={formatting?.isBlockquote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="代码块"
        active={formatting?.isCodeBlock}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="分割线"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus size={16} />
      </ToolbarButton>
      <ToolbarButton
        title="插入表格"
        active={formatting?.isTable}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        <TableIcon size={16} />
      </ToolbarButton>
    </div>
  );
}
