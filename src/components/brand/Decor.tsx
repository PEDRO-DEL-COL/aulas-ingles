import type { CSSProperties } from 'react'

type Props = { className?: string; style?: CSSProperties }

/** Formas decorativas: sempre aria-hidden, sem interação. Cores via classes (text-*). */

export function Cloud({ className, style }: Props) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 120 64"
      className={className}
      style={style}
      fill="currentColor"
    >
      <path d="M30 56a22 22 0 0 1-3-43.800A28 28 0 0 1 80 14a20 20 0 0 1 12 38.500 14 14 0 0 1-4 3.500z" />
    </svg>
  )
}

export function Star({ className, style }: Props) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 32 32"
      className={className}
      style={style}
      fill="currentColor"
    >
      <path d="M16 2c1.200 7.500 4.500 11.800 14 14-9.500 2.200-12.800 6.500-14 14C14.800 22.500 11.500 18.200 2 16c9.500-2.200 12.800-6.500 14-14z" />
    </svg>
  )
}

export function Blob({ className, style }: Props) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 200 200"
      className={className}
      style={style}
      fill="currentColor"
    >
      <path
        d="M44 -54C56 -40 64 -20 61 -2C58 16 44 32 28 46C12 60 -6 72 -26 68C-46 64 -68 44 -72 22C-76 0 -62 -24 -46 -42C-30 -60 -12 -72 6 -72C24 -72 32 -68 44 -54Z"
        transform="translate(100 100) scale(1.350)"
      />
    </svg>
  )
}

/** Onda suave para separar seções. `className` define a cor (text-*) da área abaixo da curva. */
export function Wave({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={className}
      fill="currentColor"
    >
      <path d="M0 40C180 80 360 80 540 48C720 16 900 0 1080 24C1260 48 1350 56 1440 40V80H0Z" />
    </svg>
  )
}
