import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  Code2,
} from 'lucide-react';

type Props = {
  value: string;
  onChange: (nextHtml: string) => void;
  onUploadImage: (file: File) => Promise<string>;
  disabled?: boolean;
};

function looksLikeHtml(s: string): boolean {
  const t = s.trim();
  return t.startsWith('<') && (t.includes('</') || t.includes('/>'));
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
  <head></head>
  <body>
    <p></p>
  </body>
</html>`;

export const HtmlEmailEditor = ({ value, onChange, onUploadImage, disabled }: Props): JSX.Element => {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [htmlDraft, setHtmlDraft] = useState(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const initialContent = useMemo(() => {
    const v = (value || '').trim();
    if (!v) return DEFAULT_HTML;
    return looksLikeHtml(v) ? v : `<p>${v}</p>`;
  }, []); // intentionally only once on mount

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      setHtmlDraft(html);
    },
  });

  // Keep editor in sync when parent changes (e.g. switch templates).
  useEffect(() => {
    if (!editor) return;
    const incoming = (value || '').trim();
    const incomingHtml = incoming ? (looksLikeHtml(incoming) ? incoming : `<p>${incoming}</p>`) : DEFAULT_HTML;
    const current = editor.getHTML();
    if (incomingHtml !== current) {
      editor.commands.setContent(incomingHtml, false);
      setHtmlDraft(incomingHtml);
    }
  }, [value, editor]);

  const toggleMode = () => {
    if (!editor) return;
    if (mode === 'visual') {
      setHtmlDraft(editor.getHTML());
      setMode('html');
    } else {
      // When switching back to visual, apply HTML draft into editor
      const next = (htmlDraft || '').trim() || DEFAULT_HTML;
      editor.commands.setContent(next, false);
      onChange(next);
      setMode('visual');
    }
  };

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter URL', previousUrl || 'https://');
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
  };

  const onPickImage = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const onImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const url = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const visualToolbarDisabled = disabled || !editor || mode !== 'visual';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            disabled={visualToolbarDisabled}
            className={`px-2 py-1 rounded border text-sm flex items-center gap-1 ${
              editor?.isActive('bold') ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700'
            } disabled:opacity-50`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            disabled={visualToolbarDisabled}
            className={`px-2 py-1 rounded border text-sm flex items-center gap-1 ${
              editor?.isActive('italic') ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700'
            } disabled:opacity-50`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            disabled={visualToolbarDisabled}
            className={`px-2 py-1 rounded border text-sm flex items-center gap-1 ${
              editor?.isActive('underline') ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700'
            } disabled:opacity-50`}
            title="Underline"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={setLink}
            disabled={visualToolbarDisabled}
            className="px-2 py-1 rounded border text-sm flex items-center gap-1 bg-white border-gray-300 text-gray-700 disabled:opacity-50"
            title="Insert/Edit Link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onPickImage}
            disabled={visualToolbarDisabled || isUploading}
            className="px-2 py-1 rounded border text-sm flex items-center gap-1 bg-white border-gray-300 text-gray-700 disabled:opacity-50"
            title="Upload & insert image"
          >
            <ImageIcon className="w-4 h-4" />
            {isUploading ? 'Uploading...' : 'Image'}
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <button
            type="button"
            onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            disabled={visualToolbarDisabled}
            className="px-2 py-1 rounded border text-sm flex items-center gap-1 bg-white border-gray-300 text-gray-700 disabled:opacity-50"
            title="Align left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            disabled={visualToolbarDisabled}
            className="px-2 py-1 rounded border text-sm flex items-center gap-1 bg-white border-gray-300 text-gray-700 disabled:opacity-50"
            title="Align center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().setTextAlign('right').run()}
            disabled={visualToolbarDisabled}
            className="px-2 py-1 rounded border text-sm flex items-center gap-1 bg-white border-gray-300 text-gray-700 disabled:opacity-50"
            title="Align right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={toggleMode}
          disabled={disabled || !editor}
          className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm flex items-center gap-2 disabled:opacity-50"
          title={mode === 'visual' ? 'View/edit HTML' : 'Back to visual editor'}
        >
          {mode === 'visual' ? <Code2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {mode === 'visual' ? 'HTML' : 'Visual'}
        </button>
      </div>

      {uploadError && (
        <div className="p-3 bg-red-100 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{uploadError}</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onImageSelected}
        className="hidden"
      />

      {mode === 'visual' ? (
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <div className="bg-white p-3">
            <EditorContent editor={editor} />
          </div>
        </div>
      ) : (
        <textarea
          value={htmlDraft}
          onChange={(e) => {
            const next = e.target.value;
            setHtmlDraft(next);
            onChange(next);
          }}
          rows={16}
          disabled={disabled}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm disabled:opacity-50"
        />
      )}

      <p className="text-xs text-gray-500 flex items-center gap-2">
        <span className="inline-flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" />
          Tip: use “Preview” to confirm it renders well in email clients.
        </span>
      </p>
    </div>
  );
};

