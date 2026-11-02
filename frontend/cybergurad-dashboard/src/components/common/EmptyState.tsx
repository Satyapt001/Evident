import { Inbox, type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  title: string
  message: string
  icon?: LucideIcon
}

export default function EmptyState({ title, message, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="state">
      <Icon />
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  )
}
