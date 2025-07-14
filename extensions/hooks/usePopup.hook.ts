import { useState } from "react"

export interface BookmarkFolder {
  id: string
  title: string
  path: string // Đường dẫn đầy đủ của thư mục (ví dụ: "Bookmarks Bar > My Folder")
}

export default function usePopup() {
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false) // State để kiểm tra xem URL hiện tại đã được đánh dấu chưa
  const [bookmarkId, setBookmarkId] = useState<string | null>(null) // State để lưu ID của bookmark nếu đã tồn tại

  const handleSaveBookmark = async (title, url, selectedFolderId) => {
    if (!url || !title) {
      setMessage("URL hoặc tiêu đề không được để trống.")
      return
    }

    setLoading(true)
    setMessage("")

    try {
      // Tạo bookmark mới
      await chrome.bookmarks.create({
        parentId: selectedFolderId,
        title: title,
        url: url
      })
      setMessage("Bookmark đã được lưu thành công!")
      setIsBookmarked(true) // Cập nhật trạng thái
      // Sau khi lưu, tìm lại bookmark để lấy ID mới
      const existingBookmarks = await chrome.bookmarks.search({ url: url })
      if (existingBookmarks.length > 0) {
        setBookmarkId(existingBookmarks[0].id)
      }
    } catch (error) {
      console.error("Lỗi khi lưu bookmark:", error)
      setMessage(`Lỗi khi lưu bookmark: ${error.message || "Không xác định"}`)
    } finally {
      setLoading(false)
    }
  }

  // Hàm xử lý khi người dùng nhấn nút "Delete"
  const handleDeleteBookmark = async (url: string) => {
    if (!bookmarkId || !url) {
      setMessage("Không tìm thấy bookmark để xóa.")
      return
    }

    setLoading(true)
    setMessage("")

    try {
      // Xóa bookmark khỏi Chrome
      await chrome.bookmarks.remove(bookmarkId)
      setMessage("Bookmark đã được xóa thành công!")
      setIsBookmarked(false) // Cập nhật trạng thái
      setBookmarkId(null)
    } catch (error) {
      console.error("Lỗi khi xóa bookmark:", error)
      setMessage(`Lỗi khi xóa bookmark: ${error.message || "Không xác định"}`)
    } finally {
      setLoading(false)
    }
  }

  // Hàm xử lý khi người dùng nhấn nút "Open Sidepanel"
  const handleOpenSidepanel = async () => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0] && tabs[0].id !== undefined) {
          await chrome.sidePanel.open({ tabId: tabs[0].id })
          window.close() // Đóng popup sau khi mở sidepanel
        } else {
          setMessage("Không thể lấy tab hiện tại để mở sidepanel.")
        }
      })
    } catch (error) {
      console.error("Lỗi khi mở sidepanel:", error)
      setMessage(`Lỗi khi mở sidepanel: ${error.message || "Không xác định"}`)
    }
  }

  const handleSyncBookmarks = async () => {
    chrome.runtime.sendMessage({
      type: "SYNC_BOOKMARKS"
    })
  }

  return {
    loading,
    message,
    isBookmarked,
    bookmarkId,
    handleDeleteBookmark,
    handleOpenSidepanel,
    handleSaveBookmark,
    handleSyncBookmarks
  }
}
