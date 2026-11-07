import { ExternalLink } from 'lucide-react'

import type { Material } from '@/features/aluno/api'
import { safeExternalUrl } from '@/features/aluno/lessons'

import { MATERIAL_TYPES } from './materialTypes'

export function MaterialItem({ material }: { material: Material }) {
  const { icon: Icon } = MATERIAL_TYPES[material.type]
  const href = safeExternalUrl(material.url)
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-lavender text-primary">
        <Icon aria-hidden={true} className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{material.title}</span>
        {material.description ? (
          <span className="line-clamp-2 block text-sm text-muted-foreground">
            {material.description}
          </span>
        ) : null}
      </span>
      {href ? (
        <ExternalLink
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      ) : (
        <span className="text-xs text-muted-foreground">Link inválido</span>
      )}
    </>
  )
  const cls =
    'flex items-center gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-sm'
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cls} outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50`}
    >
      {body}
      <span className="sr-only">(abre em nova aba)</span>
    </a>
  ) : (
    <div className={cls}>{body}</div>
  )
}
