import { Badge } from '@/components/ui/badge'
import type { LessonStatus } from '@/features/aluno/lessons'

import { teacherStatusInfo } from '../lessons'

export function TeacherStatusBadge({ status }: { status: LessonStatus }) {
  const { label, tone } = teacherStatusInfo(status)
  return <Badge tone={tone}>{label}</Badge>
}
