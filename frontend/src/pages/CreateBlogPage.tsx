import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  FileSearch,
  Globe,
  Link2,
  ListTree,
  PenTool,
  Plus,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react'
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Spinner } from '../components/Spinner'
import { createBlog, lengthWords, type BlogLength, type BlogType, type CreateBlogRequest, type Tone } from '../lib/blogs'

const blogTypes: { value: BlogType; label: string; hint: string }[] = [
  { value: 'how_to', label: 'How-to guide', hint: 'Step-by-step solution to a problem' },
  { value: 'listicle', label: 'Listicle', hint: '"10 ways to…", scannable list' },
  { value: 'tutorial', label: 'Tutorial', hint: 'Hands-on, with code or examples' },
  { value: 'comparison', label: 'Comparison', hint: 'X vs Y, pros and cons' },
  { value: 'opinion', label: 'Opinion / thought leadership', hint: 'A clear point of view' },
  { value: 'news', label: 'News / update', hint: 'What changed and why it matters' },
  { value: 'case_study', label: 'Case study', hint: 'Problem, approach, results' },
  { value: 'review', label: 'Product review', hint: 'Hands-on verdict on a product' },
]

const tones: { value: Tone; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'technical', label: 'Technical' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'authoritative', label: 'Authoritative' },
]

const steps = [
  { icon: FileSearch, title: 'Research', text: 'Reads your URLs, plus web search if enabled' },
  { icon: ListTree, title: 'Outline', text: 'Drafts an H2/H3 structure' },
  { icon: UserCheck, title: 'You review the outline', text: 'Approve or edit before writing', human: true },
  { icon: PenTool, title: 'Write', text: 'Section by section, with citations' },
]

const MAX_URLS = 10

const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'

function isValidUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function Field({
  label,
  htmlFor,
  hint,
  optional,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
        {label}
        {optional && <span className="text-xs font-normal text-slate-400">Optional</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? 'bg-indigo-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </label>
  )
}

function KeywordInput({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const [draft, setDraft] = useState('')

  function commit() {
    const next = draft
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k && !values.includes(k))
    if (next.length) onChange([...values, ...next])
    setDraft('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-sm transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
      {values.map((k) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
          {k}
          <button
            type="button"
            onClick={() => onChange(values.filter((v) => v !== k))}
            className="text-indigo-400 hover:text-indigo-700"
            aria-label={`Remove ${k}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id="secondary-keywords"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={values.length ? '' : 'Type and press Enter'}
        className="min-w-[8rem] flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-slate-400"
      />
    </div>
  )
}

export function CreateBlogPage() {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [blogType, setBlogType] = useState<BlogType>('how_to')
  const [urls, setUrls] = useState<string[]>([''])
  const [webResearch, setWebResearch] = useState(true)
  const [primaryKeyword, setPrimaryKeyword] = useState('')
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([])
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState<Tone>('professional')
  const [length, setLength] = useState<BlogLength>('medium')
  const [language, setLanguage] = useState('English')
  const [includeFaq, setIncludeFaq] = useState(true)
  const [includeCta, setIncludeCta] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filledUrls = urls.map((u) => u.trim()).filter(Boolean)
  const invalidUrls = new Set(filledUrls.filter((u) => !isValidUrl(u)))
  const noResearchSource = !webResearch && filledUrls.length === 0

  function updateUrl(index: number, value: string) {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)))
  }

  function removeUrl(index: number) {
    setUrls((prev) => (prev.length === 1 ? [''] : prev.filter((_, i) => i !== index)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    setError(null)
    if (!title.trim() || invalidUrls.size || noResearchSource) return

    const payload: CreateBlogRequest = {
      title: title.trim(),
      blog_type: blogType,
      research_urls: [...new Set(filledUrls)],
      web_research: webResearch,
      primary_keyword: primaryKeyword.trim(),
      secondary_keywords: secondaryKeywords,
      target_audience: audience.trim(),
      tone,
      length,
      language: language.trim() || 'English',
      include_faq: includeFaq,
      include_cta: includeCta,
      instructions: instructions.trim(),
    }

    setSubmitting(true)
    try {
      const blog = await createBlog(payload)
      navigate(`/blogs/${blog.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedType = blogTypes.find((t) => t.value === blogType)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Create Blog</h1>
        <p className="mt-1 text-sm text-slate-500">Tell us what to write and where to research. You'll approve the outline before anything is drafted.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Basics" description="What the blog is about">
            <Field label="Blog title or topic" htmlFor="title" hint="A working title is fine. The outline step can refine it.">
              <input
                id="title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. How to build a RAG pipeline with LangGraph"
                maxLength={200}
                className={`${inputClass} ${touched && !title.trim() ? 'border-red-400' : ''}`}
              />
              {touched && !title.trim() && <p className="mt-1.5 text-xs text-red-600">Title is required.</p>}
            </Field>

            <Field label="Blog type" htmlFor="blog-type" hint={selectedType?.hint}>
              <select id="blog-type" value={blogType} onChange={(e) => setBlogType(e.target.value as BlogType)} className={inputClass}>
                {blogTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section title="Research sources" description="URLs the research step must read and cite">
            <div className="space-y-2.5">
              {urls.map((url, i) => {
                const invalid = touched && invalidUrls.has(url.trim())
                return (
                  <div key={i}>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => updateUrl(i, e.target.value)}
                          placeholder="https://example.com/article"
                          aria-label={`Research URL ${i + 1}`}
                          className={`${inputClass} pl-9 ${invalid ? 'border-red-400' : ''}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeUrl(i)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 text-slate-400 shadow-sm transition hover:bg-slate-50 hover:text-slate-600"
                        aria-label={`Remove URL ${i + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {invalid && <p className="mt-1.5 text-xs text-red-600">Enter a full http(s) URL.</p>}
                  </div>
                )
              })}
              {urls.length < MAX_URLS && (
                <button
                  type="button"
                  onClick={() => setUrls((prev) => [...prev, ''])}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  <Plus className="h-4 w-4" /> Add URL
                </button>
              )}
            </div>

            <div className="border-t border-slate-100 pt-5">
              <Toggle
                checked={webResearch}
                onChange={setWebResearch}
                label="Also search the web"
                description="Off = research strictly from the URLs above."
              />
              {touched && noResearchSource && (
                <p className="mt-2 text-xs text-red-600">Add at least one URL, or turn on web search.</p>
              )}
            </div>
          </Section>

          <Section title="SEO & audience" description="Who it's for and what it should rank for">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Primary keyword" htmlFor="primary-keyword" optional>
                <input
                  id="primary-keyword"
                  value={primaryKeyword}
                  onChange={(e) => setPrimaryKeyword(e.target.value)}
                  placeholder="e.g. langgraph rag"
                  className={inputClass}
                />
              </Field>
              <Field label="Target audience" htmlFor="audience" optional>
                <input
                  id="audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g. Backend devs new to LLMs"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Secondary keywords" htmlFor="secondary-keywords" optional hint="Press Enter or comma to add.">
              <KeywordInput values={secondaryKeywords} onChange={setSecondaryKeywords} />
            </Field>
          </Section>

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span>
                <span className="block text-base font-semibold text-slate-900">Style & extras</span>
                <span className="block text-sm text-slate-500">Tone, length, language and custom instructions</span>
              </span>
              <ChevronDown className={`h-5 w-5 text-slate-400 transition ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>

            {showAdvanced && (
              <div className="space-y-5 border-t border-slate-200 px-5 py-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Tone" htmlFor="tone">
                    <select id="tone" value={tone} onChange={(e) => setTone(e.target.value as Tone)} className={inputClass}>
                      {tones.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Language" htmlFor="language">
                    <input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass} />
                  </Field>
                </div>

                <Field label="Length">
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(lengthWords) as BlogLength[]).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLength(l)}
                        aria-pressed={length === l}
                        className={`rounded-lg border px-3 py-2.5 text-left transition ${
                          length === l
                            ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10'
                            : 'border-slate-300 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-sm font-medium capitalize text-slate-900">{l}</span>
                        <span className="block text-xs text-slate-500">{lengthWords[l]}</span>
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="space-y-4">
                  <Toggle checked={includeFaq} onChange={setIncludeFaq} label="FAQ section" description="Adds 4–6 questions at the end." />
                  <Toggle checked={includeCta} onChange={setIncludeCta} label="Call to action" description="Closes with a CTA paragraph." />
                </div>

                <Field label="Additional instructions" htmlFor="instructions" optional>
                  <textarea
                    id="instructions"
                    rows={4}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Include a Python code sample. Don't mention competitor names."
                    className={`${inputClass} resize-y`}
                  />
                </Field>
              </div>
            )}
          </section>
        </div>

        {/* Summary */}
        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">What happens next</h2>
              <p className="text-sm text-slate-500">
                {webResearch ? (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" /> Web + {filledUrls.length} URL{filledUrls.length === 1 ? '' : 's'}
                  </span>
                ) : (
                  `Only your ${filledUrls.length} URL${filledUrls.length === 1 ? '' : 's'}`
                )}
              </p>
            </div>
            <ol className="space-y-4 px-5 py-5">
              {steps.map(({ icon: Icon, title: stepTitle, text, human }) => (
                <li key={stepTitle} className="flex gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      human ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{stepTitle}</p>
                    <p className="text-xs text-slate-500">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {submitting ? 'Starting…' : 'Start research'}
          </button>
        </aside>
      </form>
    </div>
  )
}
