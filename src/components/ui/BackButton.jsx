import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function BackButton({ to, label, className = '', onClick }) {
  return (
    <Link to={to} onClick={onClick}>
      <Button variant="outline" size="sm" className={`mb-4 ${className}`}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        {label}
      </Button>
    </Link>
  )
}
