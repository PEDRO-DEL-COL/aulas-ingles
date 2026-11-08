import { User } from 'lucide-react'

import { ComingSoon } from '@/features/shared/components/ComingSoon'

export default function Perfil() {
  return (
    <ComingSoon
      title="Meu perfil"
      icon={User}
      backTo="/app/professora/mais"
      backLabel="Voltar para Mais"
    >
      Em breve você poderá editar seus dados e preferências por aqui.
    </ComingSoon>
  )
}
