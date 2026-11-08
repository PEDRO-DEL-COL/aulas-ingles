import { UserPlus } from 'lucide-react'

import { ComingSoon } from '@/features/shared/components/ComingSoon'

export default function Interessados() {
  return (
    <ComingSoon
      title="Interessados"
      icon={UserPlus}
      backTo="/app/professora/mais"
      backLabel="Voltar para Mais"
    >
      Aqui você vai acompanhar quem pediu informações sobre as aulas.
    </ComingSoon>
  )
}
