import React, { useMemo } from "react"

interface MessageItemCheckGrammarType {
  correctedParagraph: string
  errorAnalysis: {
    originalText: string
    correctedText: string
    errorType: string
    explanation: string
  }[]
}

function extractJsonFromMarkdown(markdownString: string): any | null {
  try {
    // Loại bỏ dấu ```
    const cleaned = markdownString
      .replace(/^```json\s*/i, "") // bỏ dòng ```json (đầu)
      .replace(/```$/, "") // bỏ dòng ``` (cuối)
      .trim()

    return JSON.parse(cleaned)
  } catch (error) {
    console.error("Failed to parse JSON from markdown:", error)
    return null
  }
}

export default function MessageItemCheckGrammar({
  messageContent
}: {
  messageContent: string
}): JSX.Element {
  const { correctedParagraph, errorAnalysis } = useMemo(() => {
    return extractJsonFromMarkdown(messageContent)
  }, [messageContent])

  console.log("MessageItemCheckGrammar", correctedParagraph, errorAnalysis)

  return (
    <div className={`flex justify-start`}>
      <div className={`p-3 rounded-lg max-w-[85%] bg-blue-100 text-left`}>
        <strong>✅ CorrectedParagraph :</strong>
        <p className="my-1 italic text-sm">"{correctedParagraph}"</p>
        {errorAnalysis?.length > 0 && (
          <div className="bg-yellow-100 p-3 rounded-lg">
            <strong>🛠 {"Explanation"}:</strong>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              {errorAnalysis.map((err, idx) => (
                <li key={idx}>
                  <a href="#" className="font-bold">
                    {err.originalText}/{err.correctedText}:{" "}
                  </a>{" "}
                  {err.explanation}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
