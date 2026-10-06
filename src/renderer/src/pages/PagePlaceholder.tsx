import type { JSX } from 'react'
import { useLang } from '../i18n'

export function PagePlaceholder({
  title,
  desc
}: {
  title: string
  desc?: string
}): JSX.Element {
  const { t } = useLang()
  return (
    <div className="page" style={{ paddingTop: 48 }}>
      <h1 className="h1">{title}</h1>
      <p
        className="muted"
        style={{ marginTop: 12, maxWidth: 540, lineHeight: 1.75 }}
      >
        {desc ?? t('misc.placeholderDesc')}
      </p>
    </div>
  )
}
