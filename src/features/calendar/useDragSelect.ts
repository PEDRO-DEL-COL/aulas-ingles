import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

export type DragSelection<T> = { anchor: T; current: T }

type Options<T> = {
  /** Traduz uma posição da tela em um alvo (dia, minuto...); null = fora de alvo. */
  resolve: (x: number, y: number) => T | null
  /** Chamado ao soltar um arrasto válido. */
  onCommit: (anchor: T, current: T) => void
  /** Seletor de elementos que não iniciam arrasto (ex.: cartões de aula). */
  ignore?: string
  /** Toque longo (ms) para iniciar no touch; o mouse inicia ao mover. */
  longPressMs?: number
}

const MOVE_THRESHOLD = 5
const TOUCH_CANCEL_DISTANCE = 10

/**
 * Seleção por arrasto com mouse (arrastar) e touch (toque longo + arrastar).
 * Anexe `containerRef` e `handlers` ao elemento da grade. Use `shouldSuppressClick()` nos
 * onClick dos filhos para ignorar o clique gerado ao soltar um arrasto.
 */
export function useDragSelect<T>({
  resolve,
  onCommit,
  ignore,
  longPressMs = 450,
}: Options<T>): {
  bindContainer: (el: HTMLDivElement | null) => void
  selection: DragSelection<T> | null
  dragging: boolean
  handlers: {
    onPointerDown: (e: ReactPointerEvent) => void
    onPointerMove: (e: ReactPointerEvent) => void
    onPointerUp: (e: ReactPointerEvent) => void
    onPointerCancel: () => void
    onContextMenu: (e: React.MouseEvent) => void
  }
  shouldSuppressClick: () => boolean
} {
  const [container, bindContainer] = useState<HTMLDivElement | null>(null)
  const [selection, setSelection] = useState<DragSelection<T> | null>(null)
  const optsRef = useRef({ resolve, onCommit })
  useEffect(() => {
    optsRef.current = { resolve, onCommit }
  })
  const st = useRef<{
    anchor: T | null
    current: T | null
    active: boolean
    touch: boolean
    x: number
    y: number
    timer: number
    suppress: boolean
  }>({
    anchor: null,
    current: null,
    active: false,
    touch: false,
    x: 0,
    y: 0,
    timer: 0,
    suppress: false,
  })

  const reset = useCallback(() => {
    window.clearTimeout(st.current.timer)
    st.current.anchor = null
    st.current.current = null
    st.current.active = false
    setSelection(null)
  }, [])

  // Com o toque longo ativo, bloqueia a rolagem da página enquanto arrasta.
  useEffect(() => {
    const el = container
    if (!el) return
    const onTouchMove = (e: TouchEvent) => {
      if (st.current.active && e.cancelable) e.preventDefault()
    }
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onTouchMove)
  }, [container])

  useEffect(() => () => window.clearTimeout(st.current.timer), [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (ignore && (e.target as Element).closest(ignore)) return
      const anchor = optsRef.current.resolve(e.clientX, e.clientY)
      if (anchor === null) return
      const s = st.current
      window.clearTimeout(s.timer)
      s.anchor = anchor
      s.current = anchor
      s.active = false
      s.touch = e.pointerType !== 'mouse'
      s.x = e.clientX
      s.y = e.clientY
      if (s.touch) {
        s.timer = window.setTimeout(() => {
          s.active = true
          setSelection({ anchor, current: anchor })
          if (typeof navigator.vibrate === 'function') navigator.vibrate(12)
        }, longPressMs)
      }
    },
    [ignore, longPressMs],
  )

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const s = st.current
    if (s.anchor === null) return
    const dist = Math.hypot(e.clientX - s.x, e.clientY - s.y)
    if (!s.active) {
      if (s.touch) {
        // Moveu antes do toque longo: é rolagem, não seleção.
        if (dist > TOUCH_CANCEL_DISTANCE) {
          window.clearTimeout(s.timer)
          s.anchor = null
        }
        return
      }
      if (dist < MOVE_THRESHOLD) return
      s.active = true
    }
    const next = optsRef.current.resolve(e.clientX, e.clientY)
    if (next === null) return
    s.current = next
    setSelection({ anchor: s.anchor, current: next })
  }, [])

  const onPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const s = st.current
      window.clearTimeout(s.timer)
      if (s.active && s.anchor !== null) {
        const next = optsRef.current.resolve(e.clientX, e.clientY) ?? s.current
        s.suppress = true
        window.setTimeout(() => {
          st.current.suppress = false
        }, 60)
        const anchor = s.anchor
        reset()
        optsRef.current.onCommit(anchor, next ?? anchor)
        return
      }
      reset()
    },
    [reset],
  )

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (st.current.touch && (st.current.active || st.current.anchor !== null)) {
      e.preventDefault()
    }
  }, [])

  const shouldSuppressClick = useCallback(() => st.current.suppress, [])

  return {
    bindContainer,
    selection,
    dragging: selection !== null,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
      onContextMenu,
    },
    shouldSuppressClick,
  }
}
