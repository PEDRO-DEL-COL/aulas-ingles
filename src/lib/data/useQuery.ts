import { useCallback, useEffect, useRef, useState } from 'react'

type State<T> = { key: string; token: string; data: T | undefined; error: unknown }

export type QueryResult<T> = {
  data: T | undefined
  /** Erro da última busca concluída para esta chave (null se não houve). */
  error: unknown
  /** true enquanto busca (inclui refetch; `data` antigo é mantido nesse caso). */
  loading: boolean
  refetch: () => void
}

/**
 * Hook simples de busca: loading/erro/dados/refetch, com cancelamento por flag
 * (resposta de busca antiga é ignorada). `key` identifica a consulta; mudar a chave
 * refaz a busca e descarta os dados da chave anterior.
 */
export function useQuery<T>(key: string, fetcher: () => Promise<T>): QueryResult<T> {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<State<T> | null>(null)
  const fetcherRef = useRef(fetcher)
  const token = `${key}#${tick}`

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    let active = true
    fetcherRef
      .current()
      .then((data) => {
        if (active) setState({ key, token, data, error: null })
      })
      .catch((error: unknown) => {
        if (active) setState((prev) => ({ key, token, data: prev?.data, error }))
      })
    return () => {
      active = false
    }
  }, [key, token])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  const sameKey = state?.key === key
  return {
    data: sameKey ? state.data : undefined,
    error: state?.token === token ? state.error : null,
    loading: state?.token !== token,
    refetch,
  }
}
