const parseRefactoredMessage = (raw: string) => {
  const result = {
    refactored: "",
    explanationTitle: "",
    explanationList: [] as string[]
  }

  const match = raw.match(/\*\*(.*?)\*\*[:：]?\s*\n?/)

  if (match) {
    const [fullMatch, title] = match
    const index = match.index!

    // Phần refactored là trước đoạn "**...**"
    result.refactored = raw.slice(0, index).trim().replace(/^"|"$/g, "")
    result.explanationTitle = title.trim()

    // Phần còn lại là explanation
    const explanationBlock = raw.slice(index + fullMatch.length).trim()

    // Chia nhỏ theo từng bullet line bắt đầu bằng "*", "- ", "•" v.v.
    result.explanationList = explanationBlock
      .split(/\n[\*\-\•]\s+/) // phân tách theo dấu * hoặc - hoặc • đầu dòng
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
  } else {
    // Nếu không có match thì coi toàn bộ là refactored
    result.refactored = raw.trim().replace(/^"|"$/g, "")
  }

  return result
}

export default parseRefactoredMessage
