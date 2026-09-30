import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FilePenLine,
  FileSearch,
  FileText,
  ListTree,
  PenTool,
  Plus,
  Rocket,
  Send,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

interface Stat {
  label: string
  value: number
  icon: LucideIcon
  tone: string
}

// Wired to real data once the blogs API exists
const stats: Stat[] = [
  { label: 'Total blogs', value: 0, icon: FileText, tone: 'bg-indigo-50 text-indigo-600' },
  { label: 'Drafts', value: 0, icon: FilePenLine, tone: 'bg-amber-50 text-amber-600' },
  { label: 'Awaiting review', value: 0, icon: Clock, tone: 'bg-sky-50 text-sky-600' },
  { label: 'Published', value: 0, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
]

const workflow: { icon: LucideIcon; title: string; text: string; human?: boolean }[] = [
  { icon: FileSearch, title: 'Research', text: 'Web search & source synthesis' },
  { icon: ListTree, title: 'Outline', text: 'Structured H2/H3 plan' },
  { icon: UserCheck, title: 'Review outline', text: 'You approve or edit', human: true },
  { icon: PenTool, title: 'Write & humanize', text: 'Section-by-section drafting' },
  { icon: UserCheck, title: 'Review content', text: 'Final edits by you', human: true },
  { icon: Send, title: 'Publish', text: 'Save, export or publish' },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.name.split(' ')[0] ?? ''

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Here's what's happening with your content today.</p>
        </div>
        <Link
          to="/blogs/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          Create Blog
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Recent blogs */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent blogs</h2>
              <p className="text-sm text-slate-500">Your latest drafts and published posts</p>
            </div>
            <Link to="/blogs" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
              <FileText className="h-7 w-7 text-indigo-500" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">No blogs yet</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Start with a topic and a few keywords. We'll research, outline and draft it with you in the loop.
            </p>
            <Link
              to="/blogs/new"
              className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Create your first blog
            </Link>
          </div>
        </section>

        {/* Workflow */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">How it works</h2>
            <p className="text-sm text-slate-500">Every blog goes through this pipeline</p>
          </div>
          <ol className="px-5 py-5">
            {workflow.map(({ icon: Icon, title, text, human }, i) => (
              <li key={title} className="relative flex gap-4 pb-5 last:pb-0">
                {i < workflow.length - 1 && (
                  <span className="absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-px bg-slate-200" aria-hidden="true" />
                )}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                    human ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="pt-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    {title}
                    {human && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Tip banner */}
      <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white shadow-sm sm:flex-row sm:items-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Rocket className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Set up a voice profile</p>
          <p className="text-sm text-indigo-100">
            Save your tone, persona and writing rules once, then reuse them on every blog.
          </p>
        </div>
        <Link
          to="/voice-profiles"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
        >
          Get started <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
