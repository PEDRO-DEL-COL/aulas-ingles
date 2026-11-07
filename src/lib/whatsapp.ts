/** Monta o link `wa.me` com mensagem pronta (apenas dígitos no número). */
export function buildWhatsAppLink(number: string, message: string): string {
  const digits = number.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
