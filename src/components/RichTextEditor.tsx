import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Bold, Italic, List, ListOrdered, Quote, Heading1, Heading2, Code, Highlighter, FileCode } from 'lucide-react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import json from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/github-dark.css';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';

const lowlight = createLowlight(common);
lowlight.register({ json });

// Extension to handle JSON paste
const JsonPasteHandler = Extension.create({
  name: 'jsonPasteHandler',
  
  addProseMirrorPlugins() {
    const plugin = new Plugin({
      key: new PluginKey('jsonPasteHandler'),
      props: {
        handlePaste: (view, event) => {
          const plainText = event.clipboardData?.getData('text/plain');
          
          if (!plainText) return false;
          
          // Try to parse as JSON to check if valid
          try {
            // Will throw if not valid JSON
            const jsonObj = JSON.parse(plainText);
            
            // Format JSON with proper indentation
            const formattedJson = JSON.stringify(jsonObj, null, 2);
            
            // If we got here, it's valid JSON - insert a code block
            this.editor.commands.insertContent({
              type: 'codeBlock',
              attrs: { language: 'json' },
              content: [{ type: 'text', text: formattedJson }]
            });
            
            return true; // Event handled
          } catch (e) {
            // Not JSON, let the editor handle it normally
            return false;
          }
        }
      }
    });
    
    return [plugin];
  }
});

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Highlight.configure({
        multicolor: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'json',
      }),
      JsonPasteHandler,
    ],
    content,
    editable: true,
    autofocus: true,
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none max-w-none min-h-[200px] max-h-[calc(100vh-16rem)] overflow-y-auto border-b border-gray-200',
      },
    },
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML();
      if (newContent !== content) {
        onChange(newContent);
      }
    },
  });

  React.useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  const ToolbarButton = ({ 
    onClick, 
    isActive, 
    icon: Icon,
    title 
  }: { 
    onClick: () => void; 
    isActive: boolean; 
    icon: typeof Bold;
    title: string;
  }) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`p-1.5 rounded transition-colors ${
        isActive ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-700'
      }`}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center space-x-1 p-2 border-b border-gray-200">
        <div className="flex items-center space-x-1 pr-2 border-r border-gray-200">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            icon={Heading1}
            title="Heading 1"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            icon={Heading2}
            title="Heading 2"
          />
        </div>
        
        <div className="flex items-center space-x-1 pr-2 border-r border-gray-200">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            icon={Bold}
            title="Bold"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            icon={Italic}
            title="Italic"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            icon={Code}
            title="Code"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            isActive={editor.isActive('codeBlock')}
            icon={FileCode}
            title="Code Block"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
            icon={Highlighter}
            title="Highlight"
          />
        </div>
        
        <div className="flex items-center space-x-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            icon={List}
            title="Bullet List"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            icon={ListOrdered}
            title="Numbered List"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            icon={Quote}
            title="Quote"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <EditorContent 
          editor={editor}
          className="h-full"
        />
      </div>
    </div>
  );
}