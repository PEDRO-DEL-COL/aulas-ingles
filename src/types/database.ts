/**
 * Tipos do banco, ESCRITOS À MÃO no formato de `supabase gen types typescript`,
 * espelhando supabase/migrations até 20261111000001_pix_txid_limit.sql.
 *
 * Por que à mão: gerar exige um Postgres com as migrations aplicadas — o projeto
 * remoto (`--linked`, só quem tem acesso ao painel deve rodar) ou um banco local
 * (precisa de Docker, ausente nesta máquina). Para regenerar (ver supabase/README.md):
 *   supabase gen types typescript --linked > src/types/database.ts      # remoto
 *   supabase start && supabase gen types typescript --local > src/types/database.ts
 * Depois rode `npm run typecheck`: o gerado é mais detalhado (Relationships, views
 * anuláveis), mas os aliases exportados no fim (Tables, TablesInsert, ...) são os mesmos.
 *
 * Ao criar uma migration que muda colunas, enums ou RPCs, atualize este arquivo no
 * mesmo commit: entrada em `Tables` (Row, Insert, Update, Relationships) e, se preciso,
 * em `Enums` e `Functions`. Checks/triggers (ex.: limites de texto) não aparecem nos
 * tipos; ficam validados no front (ver os arquivos validation.ts em src/features) e no banco.
 */

export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type UserRole = 'aluno' | 'responsavel' | 'professora' | 'admin'
type StudentStatus = 'ativo' | 'pausado' | 'saiu'
type LessonStatus =
  | 'agendada'
  | 'realizada'
  | 'falta_aluno'
  | 'cancelada_aluno'
  | 'cancelada_professora'
  | 'reposicao'
type InvoiceStatus = 'em_aberto' | 'pago' | 'atrasado' | 'cancelado'
type MaterialType = 'drive' | 'pdf' | 'audio' | 'video' | 'link' | 'outro'
type BillingModel = 'mensalidade' | 'pacote' | 'avulsa'
type LeadStatus = 'novo' | 'contatado' | 'convertido' | 'descartado'

type ScheduleRow = {
  id: string
  student_id: string
  weekday: number
  start_time: string
  timezone: string
  duration_minutes: number
  starts_on: string
  ends_on: string | null
  active: boolean
  created_at: string
  updated_at: string
}

type PrivateNoteRow = {
  id: string
  student_id: string
  lesson_id: string | null
  body: string
  created_by: string | null
  created_at: string
  updated_at: string
}

type PayerRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  profile_id: string | null
  created_at: string
  updated_at: string
}

type StudentGuardianRow = {
  id: string
  student_id: string
  guardian_profile_id: string | null
  guardian_email: string
  guardian_name: string | null
  relationship: string | null
  is_financial_responsible: boolean
  can_view_lessons: boolean
  created_at: string
  updated_at: string
}

type BlockedDateRow = {
  id: string
  starts_on: string
  ends_on: string
  reason: string | null
  created_at: string
  updated_at: string
}

type LeadRow = {
  id: string
  name: string
  contact: string
  message: string | null
  source: string | null
  status: LeadStatus
  consent: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

type StudentRow = {
  id: string
  full_name: string
  email: string
  profile_id: string | null
  birth_date: string | null
  is_minor: boolean
  level: string | null
  goal: string | null
  plan_id: string | null
  default_payer_id: string | null
  meet_link: string | null
  status: StudentStatus
  phone: string | null
  notes_public: string | null
  consent_by_guardian_at: string | null
  guardian_consent_name: string | null
  guardian_consent_notes: string | null
  created_at: string
  updated_at: string
}

type PlanRow = {
  id: string
  name: string
  billing_model: BillingModel
  lessons_per_month: number | null
  lessons_in_package: number | null
  lesson_duration_minutes: number
  price_cents: number
  currency: string
  active: boolean
  description: string | null
  created_at: string
  updated_at: string
}

type LessonRow = {
  id: string
  student_id: string
  schedule_id: string | null
  starts_at: string
  duration_minutes: number
  status: LessonStatus
  meet_link: string | null
  rescheduled_from: string | null
  cancel_reason: string | null
  canceled_at: string | null
  canceled_by: string | null
  makeup_eligible: boolean | null
  makeup_decided_by: string | null
  created_at: string
  updated_at: string
}

type LessonNoteRow = {
  id: string
  lesson_id: string
  content: string | null
  summary: string | null
  homework: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type MaterialRow = {
  id: string
  title: string
  type: MaterialType
  url: string
  description: string | null
  lesson_id: string | null
  student_id: string | null
  is_public_to_students: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

type InvoiceRow = {
  id: string
  student_id: string
  payer_id: string | null
  plan_id: string | null
  billing_model: BillingModel
  reference_month: string | null
  description: string | null
  lessons_count: number | null
  amount_cents: number
  due_date: string
  status: InvoiceStatus
  student_notified_paid_at: string | null
  paid_at: string | null
  confirmed_by: string | null
  /** 1 a 25 alfanuméricos (BR Code) ou null; ver isValidTxid em src/lib/pix.ts. */
  pix_txid: string | null
  created_at: string
  updated_at: string
}

type SettingsRow = {
  id: boolean
  pix_key: string | null
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null
  receiver_name: string | null
  receiver_city: string | null
  cancellation_policy_text: string | null
  cancellation_min_hours: number
  late_cancel_band_enabled: boolean
  late_cancel_band_min_hours: number
  max_makeups_per_month: number
  whatsapp_number: string | null
  business_name: string | null
  terms_version: string | null
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          role: Database['public']['Enums']['user_role']
          timezone: string
          active: boolean
          terms_accepted_at: string | null
          terms_version: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          email: string
          phone?: string | null
          role?: Database['public']['Enums']['user_role']
          timezone?: string
          active?: boolean
          terms_accepted_at?: string | null
          terms_version?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          phone?: string | null
          role?: Database['public']['Enums']['user_role']
          timezone?: string
          active?: boolean
          terms_accepted_at?: string | null
          terms_version?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: StudentRow
        Insert: Partial<StudentRow> & Pick<StudentRow, 'full_name' | 'email'>
        Update: Partial<StudentRow>
        Relationships: []
      }
      plans: {
        Row: PlanRow
        Insert: Partial<PlanRow> & Pick<PlanRow, 'name' | 'price_cents'>
        Update: Partial<PlanRow>
        Relationships: []
      }
      lessons: {
        Row: LessonRow
        Insert: Partial<LessonRow> & Pick<LessonRow, 'student_id' | 'starts_at'>
        Update: Partial<LessonRow>
        Relationships: []
      }
      lesson_notes: {
        Row: LessonNoteRow
        Insert: Partial<LessonNoteRow> & Pick<LessonNoteRow, 'lesson_id'>
        Update: Partial<LessonNoteRow>
        Relationships: []
      }
      materials: {
        Row: MaterialRow
        Insert: Partial<MaterialRow> & Pick<MaterialRow, 'title' | 'url'>
        Update: Partial<MaterialRow>
        Relationships: []
      }
      invoices: {
        Row: InvoiceRow
        Insert: Partial<InvoiceRow> &
          Pick<InvoiceRow, 'student_id' | 'amount_cents' | 'due_date'>
        Update: Partial<InvoiceRow>
        Relationships: []
      }
      schedules: {
        Row: ScheduleRow
        Insert: Partial<ScheduleRow> &
          Pick<ScheduleRow, 'student_id' | 'weekday' | 'start_time'>
        Update: Partial<ScheduleRow>
        Relationships: []
      }
      private_notes: {
        Row: PrivateNoteRow
        Insert: Partial<PrivateNoteRow> & Pick<PrivateNoteRow, 'student_id' | 'body'>
        Update: Partial<PrivateNoteRow>
        Relationships: []
      }
      payers: {
        Row: PayerRow
        Insert: Partial<PayerRow> & Pick<PayerRow, 'name'>
        Update: Partial<PayerRow>
        Relationships: []
      }
      student_guardians: {
        Row: StudentGuardianRow
        Insert: Partial<StudentGuardianRow> &
          Pick<StudentGuardianRow, 'student_id' | 'guardian_email'>
        Update: Partial<StudentGuardianRow>
        Relationships: []
      }
      blocked_dates: {
        Row: BlockedDateRow
        Insert: Partial<BlockedDateRow> & Pick<BlockedDateRow, 'starts_on' | 'ends_on'>
        Update: Partial<BlockedDateRow>
        Relationships: []
      }
      leads: {
        Row: LeadRow
        Insert: Partial<LeadRow> & Pick<LeadRow, 'name' | 'contact'>
        Update: Partial<LeadRow>
        Relationships: []
      }
      settings: {
        Row: SettingsRow
        Insert: Partial<SettingsRow>
        Update: Partial<SettingsRow>
        Relationships: []
      }
    }
    Views: {
      invoices_with_status: {
        // Colunas de view saem todas anuláveis no gen types.
        Row: { [K in keyof InvoiceRow]: InvoiceRow[K] | null } & {
          effective_status: InvoiceStatus | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_terms: {
        Args: { p_version: string }
        Returns: undefined
      }
      mark_invoice_as_paid_notice: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      cancel_lesson: {
        Args: { p_lesson_id: string; p_reason?: string; p_by_teacher?: boolean }
        Returns: LessonRow
      }
      generate_lessons: {
        Args: { p_from: string; p_to: string }
        Returns: number
      }
      decide_makeup: {
        Args: { p_lesson_id: string; p_eligible: boolean }
        Returns: LessonRow
      }
      schedule_makeup: {
        Args: { p_original_lesson: string; p_starts_at: string; p_duration?: number }
        Returns: LessonRow
      }
      makeups_used_in_month: {
        Args: { p_student: string; p_month: string }
        Returns: number
      }
    }
    Enums: {
      user_role: UserRole
      student_status: StudentStatus
      lesson_status: LessonStatus
      invoice_status: InvoiceStatus
      material_type: MaterialType
      billing_model: BillingModel
      lead_status: LeadStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
