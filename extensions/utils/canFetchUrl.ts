export const canFetchUrl = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url, { method: "GET", mode: "cors" })
    console.log("access page test", res)
    return res.ok && res.headers.get("content-type")?.includes("text/html")
  } catch (err) {
    console.warn("⚠️ Cannot fetch:", url, err)
    return false
  }
}
