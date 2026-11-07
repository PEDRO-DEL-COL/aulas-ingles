import { Badge } from '@/components/ui/badge'
import { invoiceStatusInfo, type InvoiceStatus } from '@/features/aluno/invoices'
import { lessonStatusInfo, type LessonStatus } from '@/features/aluno/lessons'

export function LessonStatusBadge({ status }: { status: LessonStatus }) {
  const { label, tone } = lessonStatusInfo(status)
  return <Badge tone={tone}>{label}</Badge>
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, tone } = invoiceStatusInfo(status)
  return <Badge tone={tone}>{label}</Badge>
}
