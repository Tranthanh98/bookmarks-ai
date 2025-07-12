function extractUsefulTextV2() {
  const ignoreTags = [
    "SCRIPT",
    "STYLE",
    "NAV",
    "FOOTER",
    "ASIDE",
    "FORM",
    "NOSCRIPT"
  ]
  const usefulTags = [
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "P",
    "SPAN",
    "STRONG",
    "LI",
    "TD",
    "TH",
    "BUTTON",
    "A",
    "DIV"
  ]

  const keywords = [
    "price",
    "plan",
    "feature",
    "title",
    "desc",
    "benefit",
    "offer"
  ]

  const result = []

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        const tag = node.tagName

        if (ignoreTags.includes(tag)) return NodeFilter.FILTER_REJECT

        const text = node.innerText?.trim()

        // Bỏ qua nếu không có text hoặc là text quá ngắn và không mang nghĩa
        if (!text || text.length < 2) return NodeFilter.FILTER_SKIP

        // Nếu là thẻ quan trọng hoặc có từ khóa trong class/id
        const isUsefulTag = usefulTags.includes(tag)
        const classId = (node.className + " " + node.id).toLowerCase()
        const hasKeyword = keywords.some((k) => classId.includes(k))

        if (isUsefulTag || hasKeyword || text.length > 40) {
          return NodeFilter.FILTER_ACCEPT
        }

        return NodeFilter.FILTER_SKIP
      }
    }
  )

  let node
  while ((node = walker.nextNode())) {
    const clean = node.innerText.trim()

    if (!result.includes(clean)) {
      result.push(clean)
    }
  }

  return result.join("\n\n")
}

export default extractUsefulTextV2
