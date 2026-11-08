import { Eye } from 'lucide-react'
import { useNavigate } from 'react-router'

import { useViewAs } from '@/lib/auth/useViewAs'
import { viewAsLabel } from '@/lib/auth/viewAs'

/** Faixa discreta enquanto o admin está vendo o app como outro papel. */
export function ViewAsBanner() {
  const { previewing, viewAs, setViewAs } = useViewAs()
  const navigate = useNavigate()
  if (!previewing) return null

  return (
    <div role="status" className="border-b bg-lavender text-xs text-primary">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-1.5">
        <span className="flex min-w-0 items-start gap-1.5">
          <Eye aria-hidden={true} className="mt-px size-3.5 shrink-0" />
          <span>Visualizando como {viewAsLabel(viewAs)} — só prévia</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setViewAs('admin')
            void navigate('/app/admin')
          }}
          className="shrink-0 rounded font-semibold underline underline-offset-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Voltar para Admin
        </button>
      </div>
    </div>
  )
}
