// popup.tsx
// Đây là giao diện người dùng của tiện ích mở rộng popup.

import React, { useEffect, useState } from "react"

import "./style.css"

import { Storage } from "@plasmohq/storage"
import { useStorage } from "@plasmohq/storage/hook"

// Định nghĩa kiểu dữ liệu cho một thư mục bookmark
interface BookmarkFolder {
  id: string
  title: string
  path: string // Đường dẫn đầy đủ của thư mục (ví dụ: "Bookmarks Bar > My Folder")
}

const Popup = () => {
  const [title, setTitle] = useState("") // State cho tên bookmark
  const [url, setUrl] = useState("") // State cho URL của trang hiện tại
  const [selectedFolderId, setSelectedFolderId] = useState("1") // State cho ID thư mục được chọn (mặc định là "1" cho Bookmarks Bar)
  const [folders, setFolders] = useState<BookmarkFolder[]>([]) // State cho danh sách các thư mục bookmark
  const [loading, setLoading] = useState(false) // State để hiển thị trạng thái tải
  const [message, setMessage] = useState("") // State để hiển thị thông báo cho người dùng
  const [isBookmarked, setIsBookmarked] = useState(false) // State để kiểm tra xem URL hiện tại đã được đánh dấu chưa
  const [bookmarkId, setBookmarkId] = useState<string | null>(null) // State để lưu ID của bookmark nếu đã tồn tại

  const [isShowSyncMessage, setIsShowSyncMessage] = useState(true)

  const [user] = useStorage({
    key: "user",
    instance: new Storage({
      area: "local"
    })
  })

  const [unsyncBookmarks] = useStorage({
    key: "unsyncBookmarks",
    instance: new Storage({
      area: "local"
    })
  })

  // useEffect để lấy thông tin tab hiện tại và các thư mục bookmark khi popup được mở
  useEffect(() => {
    chrome.runtime.sendMessage({ action: "INIT_SYNC" })
    // Lấy thông tin tab hiện tại (URL và tiêu đề)
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const currentUrl = tabs[0].url
        setTitle(tabs[0].title || "")
        setUrl(currentUrl)

        // Kiểm tra xem URL hiện tại đã được đánh dấu chưa
        try {
          const existingBookmarks = await chrome.bookmarks.search({
            url: currentUrl
          })
          if (existingBookmarks.length > 0) {
            setIsBookmarked(true)
            setBookmarkId(existingBookmarks[0].id) // Lấy ID của bookmark đầu tiên tìm thấy
            // Đặt thư mục cha là thư mục của bookmark hiện có nếu tìm thấy
            if (existingBookmarks[0].parentId) {
              setSelectedFolderId(existingBookmarks[0].parentId)
            }
          } else {
            setIsBookmarked(false)
            setBookmarkId(null)
          }
        } catch (error) {
          console.error("Lỗi khi tìm kiếm bookmark hiện có:", error)
          setMessage("Lỗi khi kiểm tra trạng thái bookmark.")
        }
      }
    })

    // Lấy tất cả các thư mục bookmark
    const getBookmarkFolders = (
      nodes: chrome.bookmarks.BookmarkTreeNode[],
      path: string = ""
    ) => {
      let folderList: BookmarkFolder[] = []
      nodes.forEach((node) => {
        if (node.id && node.title !== undefined && !node.url) {
          // Nếu là một thư mục (không có URL)
          const currentPath = path ? `${path} > ${node.title}` : node.title
          folderList.push({ id: node.id, title: node.title, path: currentPath })
        }
        if (node.children) {
          folderList = folderList.concat(
            getBookmarkFolders(
              node.children,
              path ? `${path} > ${node.title}` : node.title
            )
          )
        }
      })
      return folderList
    }

    chrome.bookmarks.getTree((tree) => {
      // Bắt đầu từ các node gốc (Bookmarks Bar, Other Bookmarks, Mobile Bookmarks)
      const rootFolders = getBookmarkFolders(tree)
      // Thêm các thư mục gốc vào danh sách nếu chúng chưa có
      // Mặc định, Chrome sẽ có '1' (Bookmarks Bar) và '2' (Other Bookmarks)
      const defaultFolders: BookmarkFolder[] = [
        { id: "1", title: "Bookmarks Bar", path: "Bookmarks Bar" },
        { id: "2", title: "Other Bookmarks", path: "Other Bookmarks" }
      ]
      // Kết hợp và loại bỏ trùng lặp nếu có
      const combinedFolders = [
        ...defaultFolders,
        ...rootFolders.filter(
          (f) => !defaultFolders.some((df) => df.id === f.id)
        )
      ]
      setFolders(combinedFolders)
    })
  }, [])

  // Hàm xử lý khi người dùng nhấn nút "Save"
  const handleSaveBookmark = async () => {
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
  const handleDeleteBookmark = async () => {
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
    setIsShowSyncMessage(false)
    chrome.runtime.sendMessage({
      action: "SYNC_BOOKMARKS"
    })
  }

  if (!user) {
    return (
      <div className="flex flex-col p-4 w-80 bg-gray-50 font-sans text-gray-800 rounded-lg shadow-lg">
        <h1 className="text-xl font-bold text-center text-blue-700 mb-5">
          Bookmark with AI
        </h1>
        <h2 className="text-sm font-bold text-center text-grat-500 mb-2">
          Login để sử dụng
        </h2>
        <button
          onClick={handleOpenSidepanel}
          className="bg-gray-200 text-gray-800 p-2.5 rounded-md font-semibold hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200 shadow-md">
          Mở Sidepanel để login
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col p-4 w-80 bg-gray-50 font-sans text-gray-800 rounded-lg shadow-lg">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; }
        `}
      </style>
      <h1 className="text-xl font-bold text-center text-blue-700 mb-5">
        Bookmark with AI
      </h1>

      {message && (
        <div
          className={`p-2 mb-3 text-sm rounded-md ${message.includes("Lỗi") ? "bg-red-100 text-red-700 border border-red-400" : "bg-green-100 text-green-700 border border-green-400"}`}>
          {message}
        </div>
      )}

      {unsyncBookmarks?.length > 0 && isShowSyncMessage && (
        <>
          <div
            className={`p-2 mb-1 text-sm rounded-md bg-yellow-100 text-yellow-700 border border-yellow-400`}>
            Bạn có {unsyncBookmarks.length} bookmarks cần đồng bộ hoá
          </div>
          <button
            onClick={handleSyncBookmarks}
            disabled={loading}
            className="flex mb-4 justify-center gap-2 bg-yellow-600 text-white p-2.5 rounded-md font-semibold hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
            <svg
              className="w-6 h-6 text-white "
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m16 10 3-3m0 0-3-3m3 3H5v3m3 4-3 3m0 0 3 3m-3-3h14v-3"
              />
            </svg>
            <p className="pt-1">Đồng bộ ngay</p>
          </button>
        </>
      )}

      <div className="mb-3">
        <label
          htmlFor="bookmarkName"
          className="block text-sm font-medium text-gray-700 mb-1">
          Tên:
        </label>
        <input
          id="bookmarkName"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm"
          placeholder="Tên bookmark"
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="parentFolder"
          className="block text-sm font-medium text-gray-700 mb-1">
          Thư mục cha:
        </label>
        <select
          id="parentFolder"
          value={selectedFolderId}
          onChange={(e) => setSelectedFolderId(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm">
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.path}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {isBookmarked ? (
          <button
            onClick={handleDeleteBookmark}
            disabled={loading}
            className="bg-red-600 text-white p-2.5 rounded-md font-semibold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
            {loading ? "Đang xóa..." : "Xóa Bookmark"}
          </button>
        ) : (
          <button
            onClick={handleSaveBookmark}
            disabled={loading}
            className="bg-blue-600 text-white p-2.5 rounded-md font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
            {loading ? "Đang lưu..." : "Lưu Bookmark"}
          </button>
        )}

        <button
          onClick={handleOpenSidepanel}
          className="bg-gray-200 text-gray-800 p-2.5 rounded-md font-semibold hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200 shadow-md">
          Mở Sidepanel
        </button>
      </div>
    </div>
  )
}

export default Popup
