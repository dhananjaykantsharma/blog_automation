import { AlertCircle, ArrowLeft, Check, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FullPageSpinner, Spinner } from '../components/Spinner'
import { ApiError } from '../lib/api'
import {
  getBlog,
  reviewContent,
  reviewOutline,
  streamBlogEvents,
  type BlogDetail,
  type BlogStatus,
  type ContentDecision,
  type Outline,
  type OutlineDecision,
  type OutlineReviewPayload,
  type ReviewPayload,
} from '../lib/blogs'

// The editor is ~1 MB of JS; load it only when a draft or final blog is actually shown
const LazyMarkdownEditor = lazy(() => import('../components/MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })))

function MarkdownEditor(props: { markdown: string; onChange: (markdown: string) => void }) {
  return (
    <Suspense fallback={<Spinner className="h-5 w-5 text-indigo-600" />}>
      <LazyMarkdownEditor {...props} />
    </Suspense>
  )
}

const statusStyles: Record<BlogStatus, { label: string; className: string }> = {
  running: { label: 'Working', className: 'bg-sky-50 text-sky-700' },
  awaiting_outline_review: { label: 'Review outline', className: 'bg-amber-50 text-amber-700' },
  awaiting_content_review: { label: 'Review draft', className: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700' },
}

const inputClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60'

const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong'
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function OutlineReview({
  payload,
  onSubmit,
}: {
  payload: OutlineReviewPayload
  onSubmit: (decision: OutlineDecision) => Promise<void>
}) {
  const [outline, setOutline] = useState<Outline>(payload.outline)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState<OutlineDecision['action'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function updateSection(index: number, patch: Partial<Outline['sections'][number]>) {
    setOutline((o) => ({ ...o, sections: o.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)) }))
  }

  async function submit(decision: OutlineDecision) {
    setSubmitting(decision.action)
    setError(null)
    try {
      await onSubmit(decision) // on success the parent swaps this component out
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(null)
    }
  }

  function approve() {
    // Key points are edited as free text; drop blank lines and empty sections only on submit
    const cleaned: Outline = {
      title: outline.title.trim(),
      sections: outline.sections
        .filter((s) => s.heading.trim())
        .map((s) => ({ heading: s.heading.trim(), key_points: s.key_points.map((p) => p.trim()).filter(Boolean) })),
    }
    if (!cleaned.title || cleaned.sections.length === 0) {
      setError('The outline needs a title and at least one section.')
      return
    }
    submit({ action: 'approve', outline: cleaned })
  }

  return (
    <Card title="Review the outline" description="Edit headings and key points, then approve to start writing.">
      <div className="space-y-5">
        {error && <InlineError message={error} />}

        <div>
          <label htmlFor="outline-title" className="mb-1.5 block text-sm font-medium text-slate-700">
            Title
          </label>
          <input
            id="outline-title"
            value={outline.title}
            onChange={(e) => setOutline((o) => ({ ...o, title: e.target.value }))}
            className={inputClass}
          />
        </div>

        <ol className="space-y-3">
          {outline.sections.map((section, i) => (
            <li key={i} className="rounded-lg border border-slate-200 p-4">
              <div className="flex gap-2">
                <span className="mt-2.5 w-6 shrink-0 text-sm font-medium text-slate-400">{i + 1}.</span>
                <div className="flex-1 space-y-2">
                  <input
                    value={section.heading}
                    onChange={(e) => updateSection(i, { heading: e.target.value })}
                    placeholder="Section heading"
                    aria-label={`Section ${i + 1} heading`}
                    className={`${inputClass} font-medium`}
                  />
                  <textarea
                    rows={Math.max(2, section.key_points.length)}
                    value={section.key_points.join('\n')}
                    onChange={(e) => updateSection(i, { key_points: e.target.value.split('\n') })}
                    placeholder="Key points, one per line"
                    aria-label={`Section ${i + 1} key points`}
                    className={`${inputClass} resize-y text-slate-600`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOutline((o) => ({ ...o, sections: o.sections.filter((_, j) => j !== i) }))}
                  className="h-10 rounded-lg px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove section ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => setOutline((o) => ({ ...o, sections: [...o.sections, { heading: '', key_points: [] }] }))}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          <Plus className="h-4 w-4" /> Add section
        </button>

        <div className="border-t border-slate-100 pt-5">
          <label htmlFor="outline-feedback" className="mb-1.5 block text-sm font-medium text-slate-700">
            Or ask for a new outline
          </label>
          <textarea
            id="outline-feedback"
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Add a section on costs, drop the history part"
            className={`${inputClass} resize-y`}
          />
          {!payload.can_regenerate && (
            <p className="mt-1.5 text-xs text-slate-500">Regeneration limit reached. Edit the outline directly instead.</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => submit({ action: 'regenerate', feedback: feedback.trim() })}
            disabled={submitting !== null || !feedback.trim() || !payload.can_regenerate}
            className={secondaryButton}
          >
            {submitting === 'regenerate' ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            Regenerate with feedback
          </button>
          <button type="button" onClick={approve} disabled={submitting !== null} className={primaryButton}>
            {submitting === 'approve' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            Approve & start writing
          </button>
        </div>
      </div>
    </Card>
  )
}

function ContentReview({ content, onSubmit }: { content: string; onSubmit: (decision: ContentDecision) => Promise<void> }) {
  const [draft, setDraft] = useState(content)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState<ContentDecision['action'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(decision: ContentDecision) {
    setSubmitting(decision.action)
    setError(null)
    try {
      await onSubmit(decision)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(null)
    }
  }

  return (
    <Card title="Review the draft" description="Edit it directly and approve, or describe what should change.">
      <div className="space-y-5">
        {error && <InlineError message={error} />}
        <MarkdownEditor markdown={draft} onChange={setDraft} />
        <textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="e.g. Make the intro shorter and add a code example in section 3"
          aria-label="Feedback on the draft"
          className={`${inputClass} resize-y`}
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => submit({ action: 'revise', feedback: feedback.trim(), content: draft })}
            disabled={submitting !== null || !feedback.trim() || !draft.trim()}
            className={secondaryButton}
          >
            {submitting === 'revise' ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            Request changes
          </button>
          <button
            type="button"
            onClick={() => submit({ action: 'approve', content: draft })}
            disabled={submitting !== null || !draft.trim()}
            className={primaryButton}
          >
            {submitting === 'approve' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            Approve
          </button>
        </div>
      </div>
    </Card>
  )
}

function FinalContent({ content }: { content: string }) {
  const [draft, setDraft] = useState(content)
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(draft) // the edited version, not the original
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card title="Your blog is ready" description="Edits here aren't saved. Copy the markdown before leaving the page.">
      <div className="space-y-4">
        <MarkdownEditor markdown={draft} onChange={setDraft} />
        <button type="button" onClick={copy} className={secondaryButton}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy markdown'}
        </button>
      </div>
    </Card>
  )
}

export function BlogDetailPage() {
  const { id = '' } = useParams()
  const [blog, setBlog] = useState<BlogDetail | null>(null)
  const [activity, setActivity] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()

    function handleEvent(event: string, data: unknown) {
      switch (event) {
        case 'progress':
          setActivity((a) => [...a, (data as { message: string }).message])
          break
        case 'review_required': {
          const payload = data as ReviewPayload
          const status = payload.type === 'outline_review' ? 'awaiting_outline_review' : 'awaiting_content_review'
          setBlog((b) => b && { ...b, status, pending_review: payload })
          setActivity((a) => [...a, payload.type === 'outline_review' ? 'Outline ready for review' : 'Draft ready for review'])
          break
        }
        case 'resumed':
          setBlog((b) => b && { ...b, status: 'running', pending_review: null })
          break
        case 'done':
          // Refetch so the final content comes from the checkpoint
          getBlog(id).then(setBlog).catch(() => undefined)
          setActivity((a) => [...a, 'Completed'])
          break
        case 'error':
          setBlog((b) => b && { ...b, status: 'failed', error: (data as { message: string }).message })
          break
      }
    }

    async function load() {
      setBlog(null)
      setActivity([])
      setLoadError(null)
      let detail: BlogDetail
      try {
        detail = await getBlog(id)
      } catch (err) {
        if (!ctrl.signal.aborted) setLoadError(errorMessage(err))
        return
      }
      if (ctrl.signal.aborted) return
      setBlog(detail)
      try {
        // The stream replays every event from the start, so the activity log is rebuilt too
        await streamBlogEvents(id, handleEvent, ctrl.signal)
      } catch (err) {
        // 404 = server restarted and live events are gone; the detail we loaded is still valid
        if (!ctrl.signal.aborted && !(err instanceof ApiError && err.status === 404)) {
          setLoadError(errorMessage(err))
        }
      }
    }

    load()
    return () => ctrl.abort()
  }, [id])

  async function submitOutline(decision: OutlineDecision) {
    await reviewOutline(id, decision)
    setBlog((b) => b && { ...b, status: 'running', pending_review: null })
  }

  async function submitContent(decision: ContentDecision) {
    await reviewContent(id, decision)
    setBlog((b) => b && { ...b, status: 'running', pending_review: null })
  }

  if (loadError && !blog) return <InlineError message={loadError} />
  if (!blog) return <FullPageSpinner />

  const badge = statusStyles[blog.status]
  const review = blog.pending_review

  return (
    <div className="space-y-6">
      <div>
        <Link to="/blogs" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> All blogs
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{blog.title}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
        </div>
      </div>

      {loadError && <InlineError message={loadError} />}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {blog.status === 'running' && (
            <Card title="Working on it">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Spinner className="h-5 w-5 text-indigo-600" />
                {activity.at(-1) ?? 'Starting…'}
              </div>
            </Card>
          )}
          {blog.status === 'awaiting_outline_review' && review?.type === 'outline_review' && (
            // key resets the editor when a regenerated outline arrives
            <OutlineReview key={JSON.stringify(review.outline)} payload={review} onSubmit={submitOutline} />
          )}
          {blog.status === 'awaiting_content_review' && review?.type === 'content_review' && (
            <ContentReview key={review.content} content={review.content} onSubmit={submitContent} />
          )}
          {blog.status === 'completed' && <FinalContent key={blog.content} content={blog.content ?? ''} />}
          {blog.status === 'failed' && <InlineError message={blog.error ?? 'The pipeline failed.'} />}
        </div>

        <Card title="Activity">
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {activity.map((message, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  {message}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}
