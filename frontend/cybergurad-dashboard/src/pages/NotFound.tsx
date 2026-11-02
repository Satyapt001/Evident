import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'

export default function NotFound() {
  return (
    <div className="panel">
      <EmptyState icon={SearchX} title="404 / ROUTE NOT FOUND" message="This address does not match any CYBERGUARD view." />
      <div style={{ textAlign: 'center', paddingBottom: 32 }}>
        <Link to="/" className="btn">BACK TO OVERVIEW</Link>
      </div>
    </div>
  )
}
