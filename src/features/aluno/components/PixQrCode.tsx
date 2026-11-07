import { QRCodeSVG } from 'qrcode.react'

/** Isolado em um componente próprio para o qrcode.react ficar só no chunk do Pix. */
export default function PixQrCode({ value }: { value: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <QRCodeSVG
        value={value}
        size={224}
        level="M"
        marginSize={0}
        role="img"
        aria-label="QR Code do Pix"
        className="h-auto w-56 max-w-full"
      />
    </div>
  )
}
