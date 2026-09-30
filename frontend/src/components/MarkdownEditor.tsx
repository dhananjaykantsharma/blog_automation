import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CodeToggle,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { useState } from 'react'

// Languages offered in a code block's dropdown; fences with other languages still load and fall back to plain text
const codeLanguages = {
  txt: 'Plain text',
  bash: 'Bash',
  python: 'Python',
  js: 'JavaScript',
  ts: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  sql: 'SQL',
  yaml: 'YAML',
}

// Each plugin teaches the editor one kind of markdown; built once, not on every render
const plugins = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  tablePlugin(),
  codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
  codeMirrorPlugin({ codeBlockLanguages: codeLanguages }),
  markdownShortcutPlugin(), // typing "## " makes a heading, "- " a list, and so on
  diffSourcePlugin({ viewMode: 'rich-text' }), // lets the user flip to the raw markdown
  toolbarPlugin({
    toolbarContents: () => (
      <DiffSourceToggleWrapper options={['rich-text', 'source']}>
        <UndoRedo />
        <Separator />
        <BlockTypeSelect />
        <BoldItalicUnderlineToggles />
        <CodeToggle />
        <Separator />
        <ListsToggle />
        <CreateLink />
        <InsertTable />
        <InsertCodeBlock />
        <InsertThematicBreak />
      </DiffSourceToggleWrapper>
    ),
  }),
]

/**
 * WYSIWYG markdown editor: shows the blog formatted, and hands back markdown on every change.
 * `markdown` is read only on mount (MDXEditor's rule), so give the component a new `key` to load other content.
 */
export function MarkdownEditor({ markdown, onChange }: { markdown: string; onChange: (markdown: string) => void }) {
  const [parseError, setParseError] = useState<string | null>(null)

  if (parseError) {
    // The editor couldn't read some of the markdown; editing it would drop that part, so edit the raw text instead
    return (
      <div className="space-y-2">
        <p className="text-xs text-amber-700">The formatted editor couldn't load this text ({parseError}). Editing the raw markdown.</p>
        <textarea
          value={markdown}
          onChange={(e) => onChange(e.target.value)}
          rows={24}
          aria-label="Blog markdown"
          className="block w-full resize-y rounded-lg border border-slate-300 bg-white p-4 font-mono text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
        />
      </div>
    )
  }

  return (
    <MDXEditor
      markdown={markdown}
      onChange={onChange}
      onError={({ error }) => setParseError(error)}
      plugins={plugins}
      className="overflow-hidden rounded-lg border border-slate-300 bg-white"
      contentEditableClassName="prose prose-slate max-w-none max-h-[36rem] min-h-[20rem] overflow-y-auto px-5 py-4 prose-pre:bg-transparent prose-pre:p-0"
    />
  )
}
