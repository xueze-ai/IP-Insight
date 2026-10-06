// i18n 基础类型：Lang 语言；TKey 为字典的全部叶子路径联合类型，
// 写错 key 会在编译期报错；en 字典用 `en: Dict` 约束，保证中英条目一一对应。

export type Lang = 'zh' | 'en'

export type Params = Record<string, string | number | undefined>

export type LeafKeys<T, P extends string = ''> = {
  [K in keyof T]: T[K] extends string
    ? P extends ''
      ? `${K & string}`
      : `${P}.${K & string}`
    : T[K] extends Record<string, unknown>
      ? LeafKeys<T[K], P extends '' ? `${K & string}` : `${P}.${K & string}`>
      : never
}[keyof T]
