/** 本地最小类型声明：@deepseek-ai/schemastery（运行时依赖，仅本插件使用） */
declare module '@deepseek-ai/schemastery' {
  interface Chain {
    default(value: unknown): Chain
    description(text: string): Chain
    min(value: number): Chain
    max(value: number): Chain
  }
  interface SchemaStatic {
    object(fields: Record<string, Chain>): unknown
    string(): Chain
    natural(): Chain
    boolean(): Chain
  }
  const Schema: SchemaStatic
  export default Schema
}
