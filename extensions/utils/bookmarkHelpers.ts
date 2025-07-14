export const findBookmarksToSync = (
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  supabaseUrls,
  bookmarksToSync
) => {
  nodes.forEach((node) => {
    if (node.url && !supabaseUrls.has(node.url)) {
      bookmarksToSync.push(node)
    }
    if (node.children) {
      findBookmarksToSync(node.children, supabaseUrls, bookmarksToSync)
    }
  })
}

export interface BookmarkType {
  url: string
  title: string
  id: string
  parendId?: string | null
}

export const getAllBookmarkUrls = (
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  urls: Set<BookmarkType>
) => {
  nodes.forEach((node) => {
    if (node.url) {
      // Nếu là một bookmark (có URL)
      urls.add({
        url: node.url,
        title: node.title,
        id: node.id,
        parendId: node.parentId
      })
    }
    if (node.children) {
      getAllBookmarkUrls(node.children, urls)
    }
  })
}
