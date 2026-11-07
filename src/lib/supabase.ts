/**
 * Cliente Supabase do front-end.
 *
 * Usa SOMENTE a chave pública (anon). Toda a segurança dos dados vem do Row Level
 * Security no banco (supabase/migrations). Nunca coloque a service role key aqui
 * nem em qualquer variável VITE_* — tudo que começa com VITE_ vai para o navegador.
 *
 * O cliente é criado sob demanda para que páginas públicas (landing, privacidade)
 * não carreguem nem dependam da configuração do Supabase.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

/** true quando VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão definidos. */
export const isSupabaseConfigured = url !== '' && anonKey !== ''

let client: SupabaseClient | undefined

/**
 * Retorna o cliente Supabase (singleton).
 * Lança erro em pt-BR se as variáveis de ambiente não estiverem configuradas.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (veja .env.example).',
    )
  }
  client ??= createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })
  return client
}
