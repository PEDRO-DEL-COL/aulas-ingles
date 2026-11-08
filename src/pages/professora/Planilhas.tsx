import { Download, FileUp, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'
import { listActivePlans } from '@/features/professora/api'
import {
  buildImportPreview,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
  type ImportPreview,
  type ImportRow,
} from '@/features/professora/importStudents'
import {
  buildInvoicesExport,
  buildLessonsExport,
  buildStudentsExport,
  importStudents,
  listStudentEmails,
} from '@/features/professora/sheetsApi'
import { useTimezone } from '@/features/professora/useTimezone'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { downloadCsv, parseCsv } from '@/lib/csv'

const MAX_BYTES = 1024 * 1024

const TONE = {
  importar: 'success',
  ja_existe: 'muted',
  erro: 'destructive',
} as const
const LABEL = { importar: 'Importar', ja_existe: 'Já existe', erro: 'Erro' } as const

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

export default function Planilhas() {
  useDocumentTitle('Planilhas')
  const timezone = useTimezone()

  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [fileName, setFileName] = useState('')
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ created: number; skipped: number } | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    setPreview(null)
    setDone(null)
    setError(null)
    setFileName('')
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError('O arquivo é grande demais (máximo de 1 MB).')
      return
    }
    setReading(true)
    try {
      const text = await file.text()
      const [emails, plans] = await Promise.all([listStudentEmails(), listActivePlans()])
      setFileName(file.name)
      setPreview(buildImportPreview(parseCsv(text), emails, plans))
    } catch (e) {
      setError(errMsg(e, 'Não foi possível ler o arquivo.'))
    } finally {
      setReading(false)
    }
  }

  async function confirmImport() {
    if (!preview) return
    const students = preview.rows.flatMap((r) => (r.student ? [r.student] : []))
    if (students.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const created = await importStudents(students)
      setDone({ created, skipped: students.length - created })
      setPreview(null)
      setFileName('')
    } catch (e) {
      setError(errMsg(e, 'Não foi possível importar os alunos.'))
    } finally {
      setImporting(false)
    }
  }

  async function runExport(key: string, file: string, build: () => Promise<string[][]>) {
    setExporting(key)
    setExportError(null)
    try {
      downloadCsv(file, await build())
    } catch (e) {
      setExportError(errMsg(e, 'Não foi possível gerar o arquivo.'))
    } finally {
      setExporting(null)
    }
  }

  const importable = preview?.counts.importar ?? 0

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Planilhas</h1>
        <p className="text-sm text-muted-foreground">
          Importe alunos de uma planilha ou baixe seus dados para abrir no Excel ou no
          Google Planilhas.
        </p>
      </header>

      <section aria-labelledby="importar" className="space-y-4">
        <h2 id="importar" className="text-lg font-semibold">
          Importar alunos
        </h2>

        <div className="space-y-2 rounded-xl border bg-card p-4 text-sm shadow-sm">
          <p>
            Comece pelo modelo, preencha uma linha por aluno e salve como CSV.
            &quot;Nome&quot; e &quot;E-mail&quot; são obrigatórios.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Excel:</strong> Arquivo &gt; Salvar como
              &gt; CSV UTF-8.
            </li>
            <li>
              <strong className="text-foreground">Google Planilhas:</strong> Arquivo &gt;
              Fazer download &gt; Valores separados por vírgula (.csv).
            </li>
            <li>
              O e-mail deve ser o da{' '}
              <strong className="text-foreground">Conta Google</strong> do aluno: é com
              ele que a pessoa entra no site.
            </li>
          </ul>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv('modelo-alunos.csv', [TEMPLATE_HEADERS, ...TEMPLATE_ROWS])
            }
          >
            <Download aria-hidden="true" />
            Baixar modelo
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="arquivo">Arquivo CSV (até 1 MB)</Label>
          <Input
            id="arquivo"
            type="file"
            accept=".csv,text/csv"
            disabled={reading || importing}
            onChange={(e) => void onFile(e.currentTarget.files?.[0])}
          />
          {reading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Lendo o arquivo…
            </p>
          ) : null}
        </div>

        {error ? <Alert variant="destructive">{error}</Alert> : null}

        {done ? (
          <Alert variant="success">
            {done.created === 0
              ? 'Nenhum aluno novo foi criado: todos já estavam cadastrados.'
              : `${done.created} ${done.created === 1 ? 'aluno criado' : 'alunos criados'}.`}
            {done.skipped > 0 ? ` ${done.skipped} já existiam e foram ignorados.` : ''}{' '}
            <Link to="/app/professora/alunos" className="font-semibold underline">
              Ver alunos
            </Link>
          </Alert>
        ) : null}

        {preview?.fatal ? <Alert variant="destructive">{preview.fatal}</Alert> : null}

        {preview && !preview.fatal ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Prévia de <span className="font-medium text-foreground">{fileName}</span>
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Resumo da prévia">
              <Badge tone="success">{preview.counts.importar} para importar</Badge>
              <Badge tone="muted">{preview.counts.ja_existe} já existem</Badge>
              <Badge tone="destructive">{preview.counts.erro} com erro</Badge>
            </div>

            <ul className="space-y-2">
              {preview.rows.map((r) => (
                <PreviewItem key={r.line} row={r} />
              ))}
            </ul>

            <div className="sticky bottom-2 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 shadow-md">
              <Button
                onClick={() => void confirmImport()}
                disabled={importing || importable === 0}
              >
                <Upload aria-hidden="true" />
                {importing
                  ? 'Importando…'
                  : `Importar ${importable} ${importable === 1 ? 'aluno' : 'alunos'}`}
              </Button>
              <p className="text-xs text-muted-foreground">
                Só as linhas marcadas como &quot;Importar&quot; serão criadas.
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="exportar" className="space-y-3">
        <h2 id="exportar" className="text-lg font-semibold">
          Exportar
        </h2>
        <p className="text-sm text-muted-foreground">
          Os arquivos abrem direto no Excel. Datas e horas usam o seu fuso horário.
        </p>
        {exportError ? <Alert variant="destructive">{exportError}</Alert> : null}
        <div className="grid gap-2 sm:grid-cols-3">
          <ExportButton
            busy={exporting === 'alunos'}
            disabled={exporting !== null}
            onClick={() =>
              void runExport('alunos', 'alunos.csv', () => buildStudentsExport())
            }
          >
            Alunos
          </ExportButton>
          <ExportButton
            busy={exporting === 'aulas'}
            disabled={exporting !== null}
            onClick={() =>
              void runExport('aulas', 'aulas.csv', () => buildLessonsExport(timezone))
            }
          >
            Aulas
          </ExportButton>
          <ExportButton
            busy={exporting === 'pagamentos'}
            disabled={exporting !== null}
            onClick={() =>
              void runExport('pagamentos', 'pagamentos.csv', () =>
                buildInvoicesExport(timezone),
              )
            }
          >
            Pagamentos
          </ExportButton>
        </div>
      </section>
    </div>
  )
}

function ExportButton({
  busy,
  disabled,
  onClick,
  children,
}: {
  busy: boolean
  disabled: boolean
  onClick: () => void
  children: string
}) {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled}>
      <FileUp aria-hidden="true" />
      {busy ? 'Gerando…' : `Baixar ${children}`}
    </Button>
  )
}

function PreviewItem({ row }: { row: ImportRow }) {
  return (
    <li className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.name || '(sem nome)'}</p>
          <p className="truncate text-sm text-muted-foreground">
            {row.email || '(sem e-mail)'} · linha {row.line}
          </p>
        </div>
        <Badge tone={TONE[row.status]}>{LABEL[row.status]}</Badge>
      </div>
      {row.errors.length > 0 || row.warnings.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-sm">
          {row.errors.map((m) => (
            <li key={m} className="text-destructive">
              {m}
            </li>
          ))}
          {row.warnings.map((m) => (
            <li key={m} className="text-warning">
              {m}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}
