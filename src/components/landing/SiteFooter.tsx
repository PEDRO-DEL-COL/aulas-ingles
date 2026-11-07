import { Link } from 'react-router'

import { brand } from '@/config/brand'

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const
const linkClass = 'underline underline-offset-4'

export function SiteFooter() {
  const { social, whatsapp } = brand
  return (
    <footer className="border-t bg-sand/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-serif text-lg font-semibold">{brand.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            © {new Date().getFullYear()} {brand.teacherName}. Todos os direitos
            reservados.
          </p>
        </div>
        <nav aria-label="Rodapé">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <li>
              <Link className={linkClass} to="/privacidade#privacidade">
                Privacidade
              </Link>
            </li>
            <li>
              <Link className={linkClass} to="/privacidade#termos">
                Termos de uso
              </Link>
            </li>
            <li>
              <Link className={linkClass} to="/login">
                Entrar
              </Link>
            </li>
            {whatsapp.link ? (
              <li>
                <a className={linkClass} href={whatsapp.link} {...ext}>
                  WhatsApp
                </a>
              </li>
            ) : null}
            {social.instagram ? (
              <li>
                <a className={linkClass} href={social.instagram} {...ext}>
                  Instagram
                </a>
              </li>
            ) : null}
            {social.youtube ? (
              <li>
                <a className={linkClass} href={social.youtube} {...ext}>
                  YouTube
                </a>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
