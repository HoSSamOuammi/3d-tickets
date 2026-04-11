import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

export type PopupTone = 'success' | 'error' | 'warning' | 'info'

export interface PopupItem {
  id: number
  message: string
  tone: PopupTone
}

interface InAppPopupProps {
  items: PopupItem[]
  onDismiss: (id: number) => void
}

const popupIcon = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
}

const AUTO_DISMISS_DELAY_MS = 6000

function PopupCard({
  item,
  onDismiss,
}: {
  item: PopupItem
  onDismiss: (id: number) => void
}) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismiss(item.id)
    }, AUTO_DISMISS_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [item.id, onDismiss])

  const Icon = popupIcon[item.tone]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.98 }}
      className={`popup popup-${item.tone}`}
    >
      <div className="popup-icon">
        <Icon size={18} />
      </div>
      <p className="popup-message">{item.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="popup-close"
        aria-label="Fermer la notification"
      >
        <X size={16} />
      </button>
    </motion.div>
  )
}

export default function InAppPopup({ items, onDismiss }: InAppPopupProps) {
  return (
    <div className="popup-stack" aria-live="polite" aria-atomic="true">
      <AnimatePresence>
        {items.map(item => (
          <PopupCard key={item.id} item={item} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}
