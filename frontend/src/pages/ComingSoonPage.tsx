import { ArrowLeft, Hammer } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
          <Hammer className="h-6 w-6 text-slate-500" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900">Coming soon</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">This section is being built as part of the next phase.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>
    </div>
  )
}
