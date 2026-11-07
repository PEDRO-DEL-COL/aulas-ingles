import { File, FileText, FolderOpen, Headphones, Link2, Video } from 'lucide-react'
import type { ComponentType } from 'react'

import type { Material } from '@/features/aluno/api'

export const MATERIAL_TYPES: Record<
  Material['type'],
  { label: string; icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }> }
> = {
  drive: { label: 'Google Drive', icon: FolderOpen },
  pdf: { label: 'PDFs', icon: FileText },
  audio: { label: 'Áudios', icon: Headphones },
  video: { label: 'Vídeos', icon: Video },
  link: { label: 'Links', icon: Link2 },
  outro: { label: 'Outros', icon: File },
}
