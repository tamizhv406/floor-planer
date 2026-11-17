import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from './Input'

export function parseLength(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '').replace(',', '.')
  if (!s) return null

  // Feet and inches: e.g. 5'6", 5ft6in, 5'6, 5ft 6
  const ftInMatch = s.match(/^(\d+)(?:'|ft)(?:(\d+(?:\.\d+)?)(?:"|in)?)?$/)
  if (ftInMatch) {
    const feet = Number(ftInMatch[1])
    const inches = ftInMatch[2] ? Number(ftInMatch[2]) : 0
    return Math.round(feet * 304.8 + inches * 25.4)
  }

  // Inches only: e.g. 36", 36in
  const inMatch = s.match(/^(\d+(?:\.\d+)?)(?:"|in)$/)
  if (inMatch) {
    return Math.round(Number(inMatch[1]) * 25.4)
  }

  const m = s.match(/^(-?\d*\.?\d+)(мм|mm|см|cm|м|m)?$/)
  if (!m) return null
  const v = Number(m[1])
  if (!Number.isFinite(v)) return null
  const unit = m[2]
  if (unit === 'мм' || unit === 'mm') return Math.round(v)
  if (unit === 'см' || unit === 'cm') return Math.round(v * 10)
  if (unit === 'м' || unit === 'm') return Math.round(v * 1000)
  return m[1].includes('.') || (Math.abs(v) < 30 && v > 0) ? Math.round(v * 1000) : Math.round(v)
}

type Props = {
  value: number
  onCommit: (mm: number) => void
  min?: number
  step?: number
  showSteppers?: boolean
  label?: string
  title?: string
}

export function LengthField({ value, onCommit, min = 0, step = 50, showSteppers, label, title }: Props) {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const commit = () => {
    if (draft === null) return
    const mm = parseLength(draft)
    if (mm === null || mm < min) {
      setInvalid(true)
      return
    }
    setDraft(null)
    setInvalid(false)
    if (mm !== Math.round(value)) onCommit(mm)
  }

  const stepDown = () => {
    const next = Math.max(min, Math.round(value - step))
    setDraft(null)
    setInvalid(false)
    if (next !== Math.round(value)) onCommit(next)
  }

  const stepUp = () => {
    const next = Math.round(value + step)
    setDraft(null)
    setInvalid(false)
    if (next !== Math.round(value)) onCommit(next)
  }

  const inputEl = (
    <Input
      size="sm"
      label={showSteppers ? undefined : label}
      title={title ?? t('lengthField.title')}
      suffix={t('units.mm')}
      invalid={invalid}
      value={draft ?? String(Math.round(value))}
      onChange={(e) => {
        setDraft(e.target.value)
        setInvalid(false)
      }}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit()
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === 'Escape') {
          setDraft(null)
          setInvalid(false)
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          stepUp()
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          stepDown()
        }
      }}
    />
  )

  if (!showSteppers) return inputEl

  return (
    <div className="length-stepper">
      {label && <span className="length-stepper__label">{label}</span>}
      <div className="length-stepper__controls">
        <button
          type="button"
          className="length-stepper__btn length-stepper__btn--sub"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            stepDown()
          }}
          disabled={value <= min}
          title={`-${step} mm`}
          aria-label={`Decrease by ${step} mm`}
        >
          −
        </button>
        <div className="length-stepper__input">{inputEl}</div>
        <button
          type="button"
          className="length-stepper__btn length-stepper__btn--add"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            stepUp()
          }}
          title={`+${step} mm`}
          aria-label={`Increase by ${step} mm`}
        >
          +
        </button>
      </div>
    </div>
  )
}
