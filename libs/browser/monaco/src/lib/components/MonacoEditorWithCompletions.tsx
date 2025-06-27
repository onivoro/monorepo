import React, { useRef, useEffect } from 'react';
import * as monaco from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';

interface EditorProps {
  value?: string;
  language?: string;
  theme?: 'vs-dark' | 'light';
  onChange?: (value: string | undefined) => void;
}

export const MonacoEditorWithCompletions: React.FC<EditorProps> = ({
  value = '',
  language = 'sql',
  theme = 'vs-dark',
  onChange
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const registerCustomCompletions = (monaco: typeof Monaco) => {

    monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.', '<'],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const lineContent = model.getLineContent(position.lineNumber);
        const textUntilPosition = lineContent.substring(0, position.column - 1);

        const suggestions: Monaco.languages.CompletionItem[] = [];

        if (textUntilPosition.trim().length === 0 || textUntilPosition.endsWith('<')) {
          suggestions.push({
            label: 'react-functional-component',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
              'const ${1:ComponentName}: React.FC = () => {',
              '  return (',
              '    <div>',
              '      $0',
              '    </div>',
              '  );',
              '};',
              '',
              'export default ${1:ComponentName};'
            ].join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Create a new functional React component',
            range
          });
        }

        // Hook snippets
        if (textUntilPosition.includes('use')) {
          suggestions.push(
            {
              label: 'useState',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: 'const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState<${2:type}>(${3:initialValue});',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'React useState hook',
              range
            },
            {
              label: 'useEffect',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: [
                'useEffect(() => {',
                '  ${1}',
                '  return () => {',
                '    ${2}',
                '  };',
                '}, [${3}]);'
              ].join('\n'),
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'React useEffect hook with cleanup',
              range
            }
          );
        }

        // Custom method completions
        if (textUntilPosition.endsWith('.')) {
          suggestions.push(
            {
              label: 'customMethod',
              kind: monaco.languages.CompletionItemKind.Method,
              insertText: 'customMethod(${1:param}: ${2:type}): void {\n  ${0}\n}',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Insert a custom method',
              range
            }
          );
        }

        return { suggestions };
      }
    });
  };

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monacoInstance: typeof Monaco) => {
    editorRef.current = editor;
    registerCustomCompletions(monacoInstance);

    // Enable quick suggestions
    editor.updateOptions({
      quickSuggestions: { other: true, comments: true, strings: true },
      suggestOnTriggerCharacters: true,
      snippetSuggestions: 'inline'
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (onChange) {
      onChange(value);
    }
  };

  return (
    <div className="h-96 w-full border border-gray-300 rounded-lg overflow-hidden">
      <monaco.Editor
        height="100%"
        width="100%"
        value={value}
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
