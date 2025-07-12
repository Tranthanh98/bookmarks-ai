import { createClient, type User } from "@supabase/supabase-js"

import { Storage } from "@plasmohq/storage"

// Khóa API
const API_KEY = process.env.PLASMO_PUBLIC_GEMINI_API_KEY
const supabaseUrl = process.env.PLASMO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.PLASMO_PUBLIC_SUPABASE_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const initSupabaseAuth = async () => {
  const access_token = await storage.get("access_token")
  if (!access_token) return

  await supabase.auth.setSession({
    access_token,
    refresh_token: "" // không cần refresh_token vì bạn chỉ cần auth 1 lần để insert
  })
}

const storage = new Storage({ area: "local" })

export const getUserId = async () => {
  const user = await storage.get("user") // key "user" như bạn đã set ở sidepanel
  return (user as unknown as User)?.id
}

async function generateEmbedding(text: string): Promise<number[]> {
  const apiUrl =
    "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"

  const payload = {
    model: "models/text-embedding-004",
    content: {
      parts: [
        {
          text
        }
      ]
    }
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(
        `Lỗi API: ${response.status} - ${errorData.error.message}`
      )
    }

    const result = await response.json()

    console.log("embedding result:", result)

    return result?.embedding?.values
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error)
    throw error
  }
}

async function summarizeAndExtractKeyInfo(
  text: string
): Promise<{ summary: string; key_info: Record<string, any> }> {
  const apiKey = API_KEY
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

  const prompt = `Trích xuất nội dung trang web dựa vào URL mà tôi cung cấp.
  **Hướng dẫn chi tiết:**
  3.  **Tóm tắt (Summary):** Tạo một bản tóm tắt súc tích, mạch lạc (khoảng 3-5 câu) bao gồm các điểm chính, chủ đề bao trùm và bất kỳ kết luận hoặc khuyến nghị nào từ trang.
  4.  **Từ khóa (Keywords):** Xác định các từ và cụm từ xuất hiện thường xuyên hoặc có ý nghĩa quan trọng trong nội dung, thể hiện chủ đề và các khái niệm cốt lõi. Cung cấp ít nhất 7 từ khóa.
  5.  **Ý chính (Main Points):** Phân tích cấu trúc và logic của bài viết để xác định 3-6 ý chính riêng biệt mà nội dung trang muốn truyền tải. Mỗi ý chính nên là một câu hoàn chỉnh và độc lập.

  Trích xuất các thông tin chính dưới dạng JSON.
  Ví dụ về cấu trúc JSON: {"keywords": ["keyword1", "keyword2"], "main_points": ["point1", "point2"]}.
  URL trang web cần phân tích: ${text}`

  const payload = {
    system_instruction: {
      parts: [
        {
          text: `Bạn là một AI có khả năng trích xuất thông tin thông minh từ các URL. Người dùng sẽ cung cấp một URL của trang web. Nhiệm vụ của bạn là phân tích nội dung trang và cung cấp.`
        }
      ]
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          summary: { type: "STRING" },
          key_info: {
            type: "OBJECT",
            properties: {
              keywords: { type: "ARRAY", items: { type: "STRING" } },
              main_points: { type: "ARRAY", items: { type: "STRING" } }
            }
          }
        },
        required: ["summary", "key_info"]
      }
    }
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Lỗi khi gọi Gemini API:", errorData)
      throw new Error(
        `Lỗi Gemini API: ${response.status} ${response.statusText}`
      )
    }

    const result = await response.json()
    if (
      result.candidates &&
      result.candidates.length > 0 &&
      result.candidates[0].content &&
      result.candidates[0].content.parts &&
      result.candidates[0].content.parts.length > 0
    ) {
      const jsonString = result.candidates[0].content.parts[0].text
      const parsedJson = JSON.parse(jsonString)
      return parsedJson
    } else {
      console.warn("Cấu trúc phản hồi từ Gemini API không mong muốn:", result)
      return { summary: "Không thể tóm tắt.", key_info: {} }
    }
  } catch (error) {
    console.error("Lỗi trong quá trình gọi Gemini API:", error)
    throw error
  }
}

// Lắng nghe tin nhắn từ content script hoặc side panel
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "ON_LOGIN") {
    const { email, password } = request.payload

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }
  if (request.action === "ON_BOOKMARKED") {
    sendResponse({ success: true, refactoredText: request.message })
  }
  if (["refactorText", "checkGrammar", "ask"].includes(request.action)) {
    console.log("Received request:", request)

    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    })
    console.log(tab.url)
  } else if (request.action === "openSidePanel") {
    // Mở bảng điều khiển bên
    chrome.sidePanel.open({ tabId: sender.tab.id })
    sendResponse({ success: true })
  }
})

// Thiết lập bảng điều khiển bên chỉ mở cho các tab cụ thể
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Set panel behavior error:", error))
})
// catch bookmark event
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log("Bookmark mới được tạo:", id, bookmark)
  const userId = await getUserId()
  if (bookmark.url) {
    try {
      // 2. Tóm tắt và trích xuất thông tin chính bằng Gemini API
      // const { summary, key_info } = await summarizeAndExtractKeyInfo(
      //   bookmark.url
      // )
      const { summary, key_info } = {
        summary: "Tom tat 123123",
        key_info: {
          keywords: ["123", "12334", "123"],
          main_points: ["okokokok"]
        }
      }
      console.log("Tóm tắt:", summary)

      // 3. Tạo embedding cho tóm tắt
      // const embedding = await generateEmbedding(summary)
      const embedding = [
        -0.025727293, -0.0010795525, -0.017857764, 0.03654388, 0.017839419,
        0.035459425, 0.072744675, 0.015197894, 0.02111122, -0.017567588,
        -0.04511376, 0.023055153, 0.014025419, 0.015134541, -0.049265586,
        -0.022577086, 0.0013130517, 0.008805189, -0.08221274, -0.018761104,
        0.015998363, 0.020911224, 0.056053676, -0.0029434902, 0.013535266,
        0.045771003, 0.016555917, -0.0538953, -0.0246921, -0.06728586,
        0.004911651, 0.028349793, -1.01489895e-5, 0.030522922, 0.025486195,
        0.04604734, -0.018174134, 0.05190071, 0.016883092, -0.043842264,
        -0.005418727, 0.015950223, 0.023322865, 0.03628838, -0.0022859424,
        -0.014371094, 0.009410116, 0.003430226, -0.025805505, 0.058498524,
        0.0062585077, 0.027024744, -0.049276154, -0.0461893, -0.046816714,
        -0.01608012, 0.0026163955, -0.05658828, 0.024616836, -0.04524104,
        0.009539742, 0.01189134, 0.0075041447, -0.057858605, -0.022178683,
        -0.012180896, -0.008033595, 0.047125123, -0.046203088, 0.06420056,
        -0.029576287, 0.0052031716, -0.054863296, 0.03726058, 0.025790108,
        -0.043727, 0.0054452955, 0.0012460545, 0.022527548, 0.050799105,
        -0.03255136, 0.0007918178, 0.0852979, 0.05398196, 0.054109782,
        0.042301495, 0.0790408, -0.04457945, -0.0669633, -0.031743187,
        0.11163899, 0.015605699, 0.0183982, 0.016842239, 0.042220637,
        0.016792906, -0.056550413, -0.120570295, 0.04556157, 0.076067254,
        -0.01584751, -0.0047794846, -0.010673101, -0.010247053, -0.020124177,
        -0.029166857, -0.048948135, -0.042088885, -0.048733857, -0.04643535,
        -0.05620313, -0.033625957, 0.0598263, 0.014643848, 0.022434484,
        -0.032861732, -0.0015136247, 0.0042071324, 0.014382075, 0.036942307,
        -0.020928837, -0.012108541, -0.038691208, 0.049542353, 0.006534391,
        0.016797964, -0.08358198, 0.003982475, -0.06833214, 0.015347158,
        0.06091211, -0.066438004, -0.013817232, -0.004551707, -0.037885837,
        -0.011511383, -0.005223748, 0.0076455185, -0.009670627, -0.0021316875,
        0.027630974, 0.023341643, -0.07214815, 0.018113693, 0.0013889398,
        0.016113045, -0.04865078, 0.042936023, -0.06126523, -6.179474e-5,
        -0.024459783, -0.036086854, -0.0141145615, -0.036330525, 0.001059006,
        0.015293301, 0.0055680224, -0.03474163, 0.05851265, -0.025314545,
        0.029448176, -0.029362394, -0.006861151, -0.012043969, -0.04591076,
        -0.011143609, -0.042196464, -0.032781225, 0.028992454, 0.018549077,
        -0.031269584, 0.0008642426, 0.08695505, -0.03136791, 0.034623273,
        0.030529764, -0.025068337, -0.014382328, -0.02403329, 0.016212393,
        0.019685622, 0.03551214, -0.029507002, 0.0054947576, -0.031829003,
        0.0012546062, -0.0051406673, 0.016199326, 0.027414849, -0.018365368,
        -0.022098912, -0.025638053, -0.042353917, 0.10376696, -0.07396963,
        -0.001055336, 0.05641012, 0.01158333, -0.04527438, -0.020036785,
        0.081214264, 0.03387636, -0.0074736145, -0.020725679, -0.062743485,
        0.036449414, -0.017777426, -0.030971939, -0.0017237834, -0.005781218,
        -0.033645634, 0.0533596, 0.001607259, -0.04982731, 0.013077875,
        0.017574484, 0.0653203, 0.0051995865, 0.01768046, -0.023317631,
        -0.008751226, 0.017845929, -0.0040898942, 0.013814329, 0.0075904164,
        0.0009130845, -0.014906564, -0.058390718, -0.008911569, -0.067823336,
        -0.049268045, 0.022059023, 0.0032766284, -0.012368141, -0.040863432,
        -0.043662082, 0.050498903, -0.03571525, -0.024274405, -0.018220559,
        0.08407242, 0.039234057, 0.005679136, 0.010794846, -0.0430576,
        0.0073977425, 0.04876977, 0.034989607, -0.00744086, -0.03161378,
        -0.036591463, -0.013392653, 0.086072646, -0.02254641, -0.058533862,
        -0.015045057, 0.06431463, -0.050900895, -0.044719525, -0.005175407,
        0.015914584, 0.01806993, -0.04664183, -0.032903496, -0.028849509,
        -0.0954593, 0.0298034, 0.015957614, 0.02158311, -0.04651139,
        -0.04579073, -0.031955283, 0.018054888, 0.00898573, -0.011788283,
        0.0071839984, -0.0025021804, 0.037838507, -0.03508306, -0.045611765,
        0.0125046205, 0.0032869778, -0.0028751849, -0.0026469864, 0.03074499,
        -0.06760518, 0.024815233, 0.023988135, -0.057969198, -0.012155909,
        0.018479858, 0.03028874, 0.037842657, -0.037512638, -0.0022435484,
        0.010811681, -0.0059315334, 0.002704028, -0.002175051, 0.006212746,
        0.04517483, 0.050055478, 0.0061662444, 0.006479728, -0.0045312336,
        -0.028603325, 0.0025487063, -0.030861387, 0.0225251, -0.005732597,
        -0.020060334, 0.04120933, -0.008020591, -0.03233167, -0.020988757,
        -0.0061978176, -0.11811586, -0.013361725, -0.0050373045, 0.009759948,
        0.021287039, 0.0017265463, -0.00018173753, -0.0007565998, 0.040056814,
        -0.01101333, 0.01315921, 0.027902167, 0.022907933, 0.0198531, 0.0275547,
        -0.0013255496, -0.0024952504, -0.043257028, 0.010368051, -0.025835637,
        -0.02357587, -0.0067682774, 0.08224221, 0.032084864, 0.032455623,
        0.041519593, 0.006142632, 0.0014377115, -0.015110731, -0.0690397,
        -0.034137737, -0.013937412, 0.04661986, -0.046573587, 0.0027073335,
        0.021781968, 0.051773895, -0.0403647, 0.009207287, -0.029591098,
        0.013605939, 0.030884761, 0.0668294, -0.020924259, -0.008558135,
        0.097159505, -0.028072223, 0.031393617, 0.015392876, -0.038716596,
        -0.0040450185, 0.014794243, 0.020145848, -0.0019376355, 0.030797282,
        0.028723149, -0.0067137317, 0.01148649, -0.0069578136, -0.00953604,
        -0.0018642499, 0.023088595, 0.0034868722, -0.03789414, -0.065175205,
        -0.043768317, -0.032581467, 0.009202073, -0.010052165, 0.035488892,
        -0.045492794, 0.011032766, 0.022402516, 0.046922527, -0.013564219,
        0.074606605, 0.037243374, 0.011155703, -0.009786142, 0.05582061,
        -0.0015097118, 0.075632736, -0.01287544, 0.052953124, -0.041625727,
        -0.031516526, 0.106761836, -0.05955899, 0.004203504, -0.0115265725,
        0.06842716, 0.017404467, 0.005378139, -0.020446232, -0.0049386774,
        -0.021526046, 0.0013390724, 0.003324176, -0.09985121, -0.010638978,
        0.027595792, -0.018354518, -0.0044843378, 0.014208632, -0.046042584,
        0.01743985, -0.0040426506, -0.017939052, 0.009832412, -0.03867382,
        0.030962022, -0.020357043, 0.030839331, -0.008919686, 0.026603868,
        0.07395801, -0.014499413, -0.03104781, -0.019088319, -0.010776465,
        0.022157487, 0.0038037132, -0.016155595, -0.058810484, -0.0039821514,
        -0.005992395, 0.012329611, 0.018350672, 0.0046579977, 0.01793262,
        0.062034853, 0.040035773, 0.017638685, -0.01726177, -0.009688592,
        -0.03922697, 0.009367481, -0.04043664, -0.07659515, 0.019509993,
        -0.00095819996, 0.021930154, -0.021040196, 0.025548492, 0.039904274,
        -0.047946487, 0.06600635, -0.011307468, 0.0062979423, -0.03715863,
        -0.014820322, 0.029950125, -0.01719104, 0.062694, -0.018514162,
        0.061002146, 0.05703103, 0.019828023, -0.07493204, 0.01993985,
        0.018264255, 0.02051898, 0.00052766566, 0.006162663, -0.010625677,
        0.009258279, 0.0024543977, 0.0133612435, 0.02142661, -0.06533373,
        -0.055617724, 0.0014618712, 0.049321413, -0.0039875424, 0.034551654,
        0.063943334, -0.006667234, -0.04522602, -0.015746633, -0.011393099,
        0.0332822, -0.03311177, -0.009099103, 0.0168641, 0.052896068,
        -0.006495918, -0.044169147, -0.042344216, -0.030743562, -0.011188553,
        -0.041122835, -0.07478291, 0.0008469668, -0.08592754, 0.010635667,
        -0.01507844, -0.019283386, -0.014006009, -0.031045092, 0.036454234,
        -0.08098679, -0.024678454, 0.0028823016, -0.042210173, 0.052308638,
        0.024468388, -0.01635547, -0.055626024, -0.0030203722, -0.007840108,
        0.031595577, 0.0070118327, 0.05418874, -0.03201139, -0.037662994,
        -0.0074112182, 0.004523378, 0.039521992, -0.020232283, 0.043269902,
        0.0810901, 0.007588373, 0.017783294, -0.0247787, 0.027886739,
        -0.013964299, -0.0119502125, 0.010262101, -0.003291256, 0.005169291,
        0.031159868, -0.0016097849, 0.03778786, 0.025833359, -0.049850933,
        0.035739884, -0.011289061, -0.08063753, -0.0350619, 0.00524656,
        0.015095796, -0.060605176, -0.042339068, 0.02689148, -0.017449262,
        -0.033729035, 0.0105578825, 0.021121563, 0.015954586, 0.009011829,
        -0.006708232, 0.11407208, 0.031178107, -0.025169654, 0.00017231435,
        0.015121715, -0.003311008, -0.030985113, 0.0746119, 0.026599435,
        -0.07921924, -0.0027702202, 0.095347285, -0.053654898, -0.043303456,
        0.04759181, 0.090244144, 0.020874858, -0.00036384418, 0.045746915,
        0.004838679, -0.02249055, 0.021874335, 0.010909625, 0.013372761,
        0.0547047, 0.021000523, -0.0765216, 0.06653591, -0.009947462,
        0.0011878817, -0.032122348, 0.002399986, -0.04950079, -0.026216462,
        -0.035830542, 0.004822138, -0.027541453, -0.039836932, -0.05244495,
        -0.014931756, -0.023596395, 0.042858437, -0.048957847, -0.024855066,
        0.02104994, -0.02798993, -0.04173258, 0.0048226453, -0.024871675,
        -0.030734435, -0.06762298, 0.02798106, -0.023004508, 0.023380645,
        0.06540679, -0.0034654082, -0.019567445, -0.08930037, 0.008628309,
        -0.017401246, -0.052646562, -0.08012825, -0.01748196, -0.08825883,
        0.013990525, -0.017037049, -0.06961536, -0.031805146, 0.05034347,
        0.026609408, -0.0012759105, 0.025093213, 0.006789504, -0.025511205,
        0.011378968, 0.0740645, -0.007600978, -0.024969716, 0.04036259,
        0.044145823, 0.03408883, -0.0011609322, 0.03817656, -0.012484149,
        0.03923531, -0.0541927, 0.018118655, 0.023315668, 0.010252735,
        -0.07971672, -0.004741475, 0.023469962, 0.02899971, -0.00907569,
        0.0010556969, 0.01638732, -0.031723693, 0.008901072, -0.026381532,
        -0.031125657, 0.016971476, -0.02326791, -0.057906564, 0.080455184,
        0.00041823115, 0.008678689, 0.051708177, -0.0097249085, 0.013839784,
        0.005694167, -0.0016009156, -0.020004025, -0.019129125, -0.0019754188,
        -0.0058236565, 0.029833412, -0.019383274, -0.033612918, -0.03254407,
        0.04859086, -0.033252634, -0.03527703, 0.0034976848, 0.045667894,
        -0.015270259, -0.009173407, 0.031630524, -0.02007917, 0.06712226,
        -0.040937636, 0.024550872, -0.013299846, -0.0035774915, -0.02609324,
        0.017959993, -0.042282525, -0.010997311, -0.03739046, -0.011165674,
        0.02467518, -0.0086188065, 0.0056199464, 0.0030088078, -0.04847374,
        0.02078996, -0.0074903117, 0.0024239083, 0.008175988, 0.012117898,
        -0.004916855, -0.021058552, -0.028270274, -0.024752285, 0.0135534955,
        -0.019134223, 0.01551241, 0.051193044, 0.02464198, -0.04169209,
        -0.021099841, 0.0019339852, -0.011233565, -0.013238806, 0.033014987,
        0.0021122172, -0.010708176, -0.0010827327, 0.012182668, -0.044323087,
        -0.0013529127, -0.024244647, -0.016880019, 0.014031043, 0.050624974,
        0.02614677, -0.003180441, -0.025033165, 0.014472956, 0.031244779,
        -0.03960646, 0.008799666, -0.014261134, -0.04713896, -0.045250367,
        0.05002835, 0.031687293, 0.0578106, 0.021650648, 0.05293763,
        -0.013317854, -0.056943245, 0.07045282, -0.015923578, -0.07375603,
        0.035902373, 0.038011186, -0.024643596, -0.05836051, 0.030367147,
        -0.012023745, 0.009706027
      ]
      console.log("Embedding được tạo.")
      // 4. Lưu vào Supabase
      const { data: bookmarkData, error } = await supabase
        .from("bookmarks")
        .insert([
          {
            user_id: userId, // Thay thế bằng ID người dùng thực tế
            url: bookmark.url,
            title: bookmark.title,
            summary: summary,
            key_info: key_info,
            embedding: embedding,
            browser_bookmark_id: id
          }
        ])
        .select()
        .maybeSingle()

      const { error: errorTags } = await supabase.rpc("insert_bookmark_tags", {
        p_bookmark_id: bookmarkData.id,
        p_user_id: userId,
        p_tag_names: key_info.keywords
      })

      if (error) {
        console.error("Lỗi khi lưu bookmark vào Supabase:", error)
      } else {
        console.log(
          "Bookmark đã được lưu thành công vào Supabase:",
          bookmarkData
        )
      }
    } catch (error) {
      console.error("Lỗi trong quá trình xử lý bookmark:", error)
    }
  }
})

chrome.bookmarks.onRemoved.addListener(async (id) => {
  console.log("Process xoá bookmark id:", id)
  const userId = await getUserId()
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("browser_bookmark_id", id)
    .eq("user_id", userId)
  if (error) {
    console.error("Xoá bookmark bị lỗi", error.message)
  }
})
