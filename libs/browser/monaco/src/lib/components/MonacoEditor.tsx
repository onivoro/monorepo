import React, { useRef, CSSProperties } from 'react';
import * as monaco from '@monaco-editor/react';

interface EditorProps {
  value?: string;
  language?: string;
  theme?: 'vs-dark' | 'light';
  style?: CSSProperties;
  onChange?: (value: string | undefined) => void;
}

export const MonacoEditor: React.FC<EditorProps> = ({
  value = '// Start coding here',
  language = 'typescript',
  theme = 'vs-dark',
  onChange,
  style,
}) => {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    // Enable quick suggestions
    editor.updateOptions({
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      snippetSuggestions: 'on'
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (onChange) {
      onChange(value);
    }
  };

  return (
    <div style={style} className="h-full w-full border border-icon-stroke-blue rounded-lg overflow-hidden flex flex-col justify-stretch">
      <monaco.Editor
        value={value}
        height="100%"
        width="100%"
        defaultLanguage={language}
        theme={theme}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          automaticLayout: true
        }}
      />
    </div>
  );
};
