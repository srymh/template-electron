import { createAddKnowledgeTool } from '@repo/ai/ollama/tools'

/**
 * 添付文書を知識として保存する。知識保存ツールと同じ実装と保存先を使う。
 * 保存失敗はツールの実行結果として返るだけで、この関数は reject しない。
 * @param text - 保存する本文
 * @param getRagDbPath - 保存先の RAG DB パスを返す関数
 */
export async function ingestDocumentAsKnowledge(
  text: string,
  getRagDbPath: () => string,
): Promise<void> {
  const addKnowledgeTool = createAddKnowledgeTool({ getDbPath: getRagDbPath })
  const addKnowledge = addKnowledgeTool.execute
  if (!addKnowledge) {
    throw new Error('Add knowledge tool is not available')
  }
  await addKnowledge({ content: text })
}
