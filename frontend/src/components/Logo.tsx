import { PenLine } from 'lucide-react'

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
        <PenLine className="h-5 w-5 text-white" />
      </div>
      <span className={`text-lg font-semibold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
        BlogStudio
      </span>
    </div>
  )
}
