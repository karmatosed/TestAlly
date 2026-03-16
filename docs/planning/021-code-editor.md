# 021 — Code Editor

## Context

The frontend shell is in place with basic textarea inputs. You are now replacing the main code input with a proper code editor (CodeMirror 6) that provides syntax highlighting, line numbers, and a better editing experience.

## Dependencies

- `020-frontend-shell.md` completed

## What You're Building

A CodeEditor component using CodeMirror 6 that:
- Provides syntax highlighting for HTML, CSS, and JavaScript
- Shows line numbers
- Supports controlled value via props
- Fires onChange callbacks
- Is accessible (keyboard navigable, labeled)
- Fits within the existing layout

---

## Steps

### 1. Install CodeMirror dependencies

```bash
npm install --workspace=client \
  @codemirror/view \
  @codemirror/state \
  @codemirror/language \
  @codemirror/lang-html \
  @codemirror/lang-css \
  @codemirror/lang-javascript \
  @codemirror/theme-one-dark
```

### 2. Create the CodeEditor component

Create `client/src/components/CodeEditor/CodeEditor.tsx`:

```tsx
import { useRef, useEffect } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import styles from './CodeEditor.module.css';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'html' | 'css' | 'javascript' | 'jsx' | 'tsx';
  placeholder?: string;
  minHeight?: string;
  label: string;
  id: string;
}

function getLanguageExtension(lang: CodeEditorProps['language']) {
  switch (lang) {
    case 'html':
      return html();
    case 'css':
      return css();
    case 'javascript':
    case 'jsx':
    case 'tsx':
      return javascript({ jsx: true, typescript: lang === 'tsx' });
    default:
      return html();
  }
}

export function CodeEditor({
  value,
  onChange,
  language,
  placeholder,
  minHeight = '200px',
  label,
  id,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref current
  onChangeRef.current = onChange;

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        getLanguageExtension(language),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': { minHeight },
          '.cm-scroller': { minHeight },
        }),
        EditorState.tabSize.of(2),
        EditorView.contentAttributes.of({
          'aria-label': label,
          role: 'textbox',
          'aria-multiline': 'true',
        }),
        placeholder ? EditorView.domEventHandlers({}) : [],
      ].flat(),
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language]); // Recreate when language changes

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div className={styles.container}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div
        ref={containerRef}
        id={id}
        className={styles.editor}
      />
    </div>
  );
}
```

Create `client/src/components/CodeEditor/CodeEditor.module.css`:

```css
.container {
  display: flex;
  flex-direction: column;
}

.label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.editor {
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  overflow: hidden;
}

.editor:focus-within {
  outline: 2px solid #4361ee;
  outline-offset: 1px;
  border-color: #4361ee;
}

.editor .cm-editor {
  font-size: 0.8125rem;
}
```

Create `client/src/components/CodeEditor/index.ts`:

```ts
export { CodeEditor } from './CodeEditor';
export type { CodeEditorProps } from './CodeEditor';
```

### 3. Integrate into Home page

Update `client/src/pages/Home.tsx`:

Add import at the top:
```tsx
import { CodeEditor } from '../components/CodeEditor';
```

Replace the main code textarea:

Find:
```tsx
<textarea
  id="code"
  value={code}
  onChange={(e) => setCode(e.target.value)}
  className={styles.codeInput}
  placeholder="Paste your component HTML/JSX here..."
  rows={12}
/>
```

Replace with:
```tsx
<CodeEditor
  id="code"
  value={code}
  onChange={setCode}
  language={language === 'tsx' || language === 'jsx' ? language : language === 'html' ? 'html' : 'html'}
  label="Component Code"
  minHeight="250px"
/>
```

And remove the `<label>` wrapper around it since CodeEditor includes its own label.

### 4. Write tests

Create `client/src/components/CodeEditor/__tests__/CodeEditor.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CodeEditor } from '../CodeEditor';

// Note: CodeMirror uses DOM APIs that may need jsdom setup.
// Install testing dependencies:
// npm install -D --workspace=client @testing-library/react @testing-library/jest-dom jsdom

describe('CodeEditor', () => {
  it('renders with a label', () => {
    render(
      <CodeEditor
        id="test-editor"
        value=""
        onChange={vi.fn()}
        language="html"
        label="Test Editor"
      />,
    );
    expect(screen.getByText('Test Editor')).toBeDefined();
  });

  it('renders the editor container', () => {
    const { container } = render(
      <CodeEditor
        id="test-editor"
        value="<div>test</div>"
        onChange={vi.fn()}
        language="html"
        label="Editor"
      />,
    );
    expect(container.querySelector('#test-editor')).toBeDefined();
  });
});
```

### 5. Install testing dependencies (if not already)

```bash
npm install -D --workspace=client @testing-library/react @testing-library/jest-dom jsdom
```

---

## Verification

```bash
# Client builds
npm run build:client

# Dev server shows editor with syntax highlighting
npm run dev:client
# Open http://localhost:5173 — code input should be a CodeMirror editor

# Tests pass
npx vitest run client/src/components/CodeEditor/__tests__/
```

## Files Created

```
client/src/components/CodeEditor/
  CodeEditor.tsx
  CodeEditor.module.css
  index.ts
  __tests__/
    CodeEditor.test.tsx
```

## Next Step

Proceed to `022-results-panel.md`.
