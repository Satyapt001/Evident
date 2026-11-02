import { Hammer } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import PageHeader from '@/components/common/PageHeader'
import Panel from '@/components/common/Panel'

export default function ModulePage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} telemetry={['MODULE NOT YET AVAILABLE IN THIS BUILD']} />
      <Panel title={title} flush>
        <EmptyState icon={Hammer} title="NEXT MILESTONE" message={description} />
      </Panel>
    </>
  )
}
