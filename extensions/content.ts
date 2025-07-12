// // content.ts

// const iconsMap = new Map<Element, HTMLDivElement>()

// function createIconForElement(el: HTMLInputElement | HTMLTextAreaElement) {
//   // Nếu đã có icon cho element này rồi thì bỏ qua
//   if (iconsMap.has(el)) return

//   const rect = el.getBoundingClientRect()

//   const icon = document.createElement("div")
//   icon.innerHTML = `<svg class="w-6 h-6 text-gray-800 dark:text-white"
//         aria-hidden="true"
//         xmlns="http://www.w3.org/2000/svg"
//         width="24"
//         height="24"
//         fill="none" viewBox="0 0 24 24">
//           <path stroke="currentColor"
//             stroke-linecap="round"
//             stroke-linejoin="round"
//             stroke-width="2"
//             d="M12 18.5A2.493 2.493 0 0 1 7.51 20H7.5a2.468 2.468 0 0 1-2.4-3.154 2.98 2.98 0 0 1-.85-5.274 2.468 2.468 0 0 1 .92-3.182 2.477 2.477 0 0 1 1.876-3.344 2.5 2.5 0 0 1 3.41-1.856A2.5 2.5 0 0 1 12 5.5m0 13v-13m0 13a2.493 2.493 0 0 0 4.49 1.5h.01a2.468 2.468 0 0 0 2.403-3.154 2.98 2.98 0 0 0 .847-5.274 2.468 2.468 0 0 0-.921-3.182 2.477 2.477 0 0 0-1.875-3.344A2.5 2.5 0 0 0 14.5 3 2.5 2.5 0 0 0 12 5.5m-8 5a2.5 2.5 0 0 1 3.48-2.3m-.28 8.551a3 3 0 0 1-2.953-5.185M20 10.5a2.5 2.5 0 0 0-3.481-2.3m.28 8.551a3 3 0 0 0 2.954-5.185"/>
//         </svg>
//     `

//   Object.assign(icon.style, {
//     position: "absolute",
//     top: `${rect.top + window.scrollY + 4}px`,
//     left: `${rect.right + window.scrollX - 24}px`,
//     background: "#fff",
//     border: "1px solid #ccc",
//     borderRadius: "12px",
//     padding: "4px",
//     cursor: "pointer",
//     zIndex: "9999"
//   })
//   ;(icon as any)._targetElement = el

//   icon.addEventListener("click", () => {
//     let selectedText = window.getSelection()?.toString()?.trim()

//     if (
//       (!selectedText && el instanceof HTMLInputElement) ||
//       el instanceof HTMLTextAreaElement
//     ) {
//       selectedText = el.value.trim()
//     }

//     console.log("send message", selectedText)

//     chrome.storage.local.set({ selectedText }, () => {
//       chrome.runtime.sendMessage({ action: "OPEN_PANEL" })
//     })
//   })

//   document.body.appendChild(icon)
//   iconsMap.set(el, icon)
// }

// function attachIconsToInputs() {
//   const inputs = document.querySelectorAll("input, textarea")

//   inputs.forEach((el) => {
//     if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement))
//       return

//     // ❌ Bỏ qua nếu là input type="hidden"
//     if (el instanceof HTMLInputElement && el.type === "hidden") return

//     // ❌ Bỏ qua nếu không hiển thị (display: none, opacity: 0, ...), hoặc readonly/disabled
//     const isHidden = el.offsetParent === null || el.disabled || el.readOnly

//     if (isHidden) return

//     // ✅ Nếu hợp lệ → gắn icon
//     createIconForElement(el)
//   })
// }

// // Đặt lại vị trí icon khi scroll hoặc resize (nếu muốn)
// function repositionIcons() {
//   for (const [el, icon] of iconsMap.entries()) {
//     const rect = el.getBoundingClientRect()
//     icon.style.top = `${rect.top + window.scrollY + 4}px`
//     icon.style.left = `${rect.right + window.scrollX - 24}px`
//   }
// }

// // Gọi ngay khi content script load
// attachIconsToInputs()
// window.addEventListener("scroll", repositionIcons, true)
// window.addEventListener("resize", repositionIcons)

// // Nếu trang web dùng JS để thêm input sau (SPA), bạn có thể dùng MutationObserver để theo dõi thêm:
// const observer = new MutationObserver(attachIconsToInputs)
// observer.observe(document.body, { childList: true, subtree: true })
