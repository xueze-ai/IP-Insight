import type { JSX } from 'react'

export function PagePlaceholder({
  title,
  desc
}: {
  title: string
  desc?: string
}): JSX.Element {
  return (
    <div className="page" style={{ paddingTop: 48 }}>
      <h1 className="h1">{title}</h1>
      <p
        className="muted"
        style={{ marginTop: 12, maxWidth: 540, lineHeight: 1.75 }}
      >
        {desc ??
          '该模块将在后续阶段完善；底层数据采集与各数据源 Adapter 已就绪并通过实测。'}
      </p>
    </div>
  )
}
