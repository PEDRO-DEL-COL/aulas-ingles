/**
 * Tipos do banco, escritos à mão no formato de `supabase gen types typescript`.
 *
 * SUBSTITUIR pelo arquivo gerado quando houver projeto Supabase:
 *   supabase gen types typescript --linked > src/types/database.ts
 *
 * Para acrescentar tabelas antes disso: adicione uma entrada em `Tables`
 * (Row, Insert, Update, Relationships) e, se preciso, em `Enums` e `Functions`,
 * espelhando as migrations em supabase/migrations.
 */

export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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
      // Outras tabelas (students, plans, invoices, lessons...) entram aqui.
    }
    Views: {
      [_ in never]: never
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
    }
    Enums: {
      user_role: 'aluno' | 'responsavel' | 'professora' | 'admin'
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
