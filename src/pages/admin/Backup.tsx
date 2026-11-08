import { DatabaseBackup } from 'lucide-react'

import { ComingSoon } from '@/features/shared/components/ComingSoon'

export default function Backup() {
  return (
    <ComingSoon
      title="Backup e exportação"
      icon={DatabaseBackup}
      backTo="/app/admin/mais"
      backLabel="Voltar para Mais"
    >
      Em breve você poderá exportar os dados do app e guardar uma cópia de segurança.
    </ComingSoon>
  )
}
