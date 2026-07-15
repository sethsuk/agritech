// Static UI strings for the worker flow + login page (th/my/en).
// Task-definition content (labels, options) lives in the DB as I18nString already —
// this file only covers hardcoded JSX text.
import type { I18nString } from "@/types/database";

export const dict = {
  loginTitle: { th: "ระบบสวนทุเรียน", my: "ဒူးရင်းဥယျာဉ်စနစ်", en: "Durian Farm System" },
  loginSubtitle: { th: "กรุณาลงชื่อเข้าใช้", my: "ကျေးဇူးပြု၍ လော့ဂ်အင်ဝင်ပါ", en: "Please sign in" },
  emailLabel: { th: "อีเมล", my: "အီးမေးလ်", en: "Email" },
  passwordLabel: { th: "รหัสผ่าน / PIN", my: "စကားဝှက် / ပင်နံပါတ်", en: "Password / PIN" },
  loginButton: { th: "เข้าสู่ระบบ", my: "လော့ဂ်အင်ဝင်ရန်", en: "Sign in" },
  loginLoading: { th: "กำลังเข้าสู่ระบบ...", my: "လော့ဂ်အင်ဝင်နေသည်...", en: "Signing in..." },
  loginError: { th: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", my: "အီးမေးလ် သို့မဟုတ် စကားဝှက် မှားနေသည်", en: "Invalid email or password" },

  logout: { th: "ออกจากระบบ", my: "ထွက်ရန်", en: "Log out" },
  back: { th: "กลับ", my: "နောက်သို့", en: "Back" },
  appName: { th: "สวนทุเรียน", my: "ဒူးရင်းဥယျာဉ်", en: "Durian Farm" },

  scanPrompt: { th: "สแกน QR code ที่ต้นทุเรียน", my: "ဒူးရင်းပင်ရှိ QR ကုဒ်ကို စကင်ဖတ်ပါ", en: "Scan the QR code on the tree" },
  scanning: { th: "กำลังค้นหาต้นไม้...", my: "သစ်ပင်ကို ရှာနေသည်...", en: "Looking up tree..." },
  scanOr: { th: "หรือพิมพ์รหัสต้นไม้", my: "သို့မဟုတ် ပင်နံပါတ်ကို ရိုက်ထည့်ပါ", en: "Or type the tree ID" },
  scanSearch: { th: "ค้นหา", my: "ရှာဖွေရန်", en: "Search" },
  scanNotFound: { th: "ไม่พบต้นไม้รหัสนี้", my: "ဤပင်နံပါတ်ကို မတွေ့ပါ", en: "Tree not found" },
  scanError: { th: "เกิดข้อผิดพลาด ลองอีกครั้ง", my: "အမှားဖြစ်သွားသည် ထပ်စမ်းကြည့်ပါ", en: "Something went wrong, try again" },
  cameraUnavailableToast: { th: "ไม่สามารถเข้าถึงกล้อง ใช้การพิมพ์รหัสแทน", my: "ကင်မရာကို အသုံးမပြုနိုင်ပါ ပင်နံပါတ်ကို ရိုက်ထည့်ပါ", en: "Camera unavailable — type the ID instead" },
  cameraUnavailableTitle: { th: "ไม่สามารถเข้าถึงกล้อง", my: "ကင်မရာကို အသုံးမပြုနိုင်ပါ", en: "Camera unavailable" },
  cameraUnavailableHint: { th: "กรุณาใช้ช่องพิมพ์รหัสด้านล่างแทน", my: "အောက်ပါ ပင်နံပါတ်အကွက်ကို အသုံးပြုပါ", en: "Please use the ID field below instead" },
  cameraLoading: { th: "กำลังเปิดกล้อง...", my: "ကင်မရာဖွင့်နေသည်...", en: "Opening camera..." },

  treeNotFound: { th: "ไม่พบต้นไม้", my: "သစ်ပင်ကို မတွေ့ပါ", en: "Tree not found" },
  treeLoadError: { th: "โหลดข้อมูลต้นไม้ไม่สำเร็จ", my: "သစ်ပင်အချက်အလက် ရယူ၍မရပါ", en: "Failed to load tree data" },
  backToScan: { th: "กลับไปสแกน", my: "စကင်ဖတ်ရန် ပြန်သွားရန်", en: "Back to scan" },
  activeSets: { th: "ชุดผลที่กำลังพัฒนา", my: "ကြီးထွားနေသော အသီးအပွင့်များ", en: "Developing fruit sets" },
  fruitCountUnit: { th: "ผล", my: "လုံး", en: "fruit" },
  chooseTask: { th: "เลือกงานที่จะทำ", my: "လုပ်ဆောင်ရန် အလုပ်ကို ရွေးပါ", en: "Choose a task" },
  exitTree: { th: "ออกจากต้นนี้ · สแกนต้นใหม่", my: "ဒီပင်မှ ထွက်ရန် · အသစ်စကင်ဖတ်ရန်", en: "Exit this tree · scan a new one" },
  treeStatusActive: { th: "ใช้งาน", my: "အသုံးပြုနေသည်", en: "Active" },
  treeTitlePrefix: { th: "ต้น", my: "ပင်", en: "Tree" },
  rowLabel: { th: "แถว", my: "အတန်း", en: "Row" },
  positionLabel: { th: "ตำแหน่ง", my: "နေရာ", en: "Position" },

  formLoadError: { th: "โหลดฟอร์มไม่สำเร็จ", my: "ဖောင်ကို ရယူ၍မရပါ", en: "Failed to load form" },
  exitFormConfirm: { th: "ออกจากฟอร์มนี้? ข้อมูลที่กรอกไว้จะหายไป", my: "ဤဖောင်မှ ထွက်မလား? ထည့်ထားသောအချက်အလက်များ ပျောက်သွားပါမည်", en: "Leave this form? Your entered data will be lost" },
  photoRequiredError: { th: "กรุณาถ่ายรูปก่อนบันทึก", my: "မှတ်တမ်းတင်မီ ဓာတ်ပုံရိုက်ပါ", en: "Please take a photo before submitting" },
  fieldRequiredError: { th: "กรุณากรอก", my: "ဖြည့်ပါ", en: "Please fill in" },
  submissionRejected: { th: "ข้อมูลไม่ถูกต้อง", my: "အချက်အလက် မှားနေသည်", en: "Submission rejected" },
  submitError: { th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", my: "မှတ်တမ်းတင်၍မရပါ ထပ်စမ်းကြည့်ပါ", en: "Failed to save, try again" },
  submitFlagged: { th: "บันทึกแล้ว (มีข้อสังเกต)", my: "မှတ်တမ်းတင်ပြီးပါပြီ (သတိပြုရန်ရှိသည်)", en: "Saved (flagged for review)" },
  submitSuccess: { th: "บันทึกข้อมูลเรียบร้อย ✓", my: "မှတ်တမ်းတင်ပြီးပါပြီ ✓", en: "Saved successfully ✓" },
  submitButton: { th: "บันทึก", my: "မှတ်တမ်းတင်ရန်", en: "Submit" },
  submitting: { th: "กำลังบันทึก...", my: "မှတ်တမ်းတင်နေသည်...", en: "Submitting..." },
  photoAuditNotice: { th: "งานนี้ถูกสุ่มตรวจ — ต้องถ่ายรูป", my: "ဤအလုပ်ကို ကျပန်းစစ်ဆေးနေသည် — ဓာတ်ပုံရိုက်ရန် လိုအပ်သည်", en: "This task was randomly selected for audit — photo required" },
  photoRequiredNotice: { th: "งานนี้ต้องถ่ายรูป", my: "ဤအလုပ်အတွက် ဓာတ်ပုံရိုက်ရန် လိုအပ်သည်", en: "This task requires a photo" },

  photoTake: { th: "📸 ถ่ายรูป", my: "📸 ဓာတ်ပုံရိုက်ရန်", en: "📸 Take photo" },
  photoUploading: { th: "กำลังอัปโหลด...", my: "အပ်လုဒ်တင်နေသည်...", en: "Uploading..." },
  photoCompressing: { th: "กำลังบีบอัดรูป…", my: "ဓာတ်ပုံချုံ့နေသည်…", en: "Compressing photo…" },
  photoUploadingToast: { th: "กำลังอัปโหลดรูป…", my: "ဓာတ်ပုံ အပ်လုဒ်တင်နေသည်…", en: "Uploading photo…" },
  photoUploadFailed: { th: "อัปโหลดไม่สำเร็จ", my: "အပ်လုဒ်တင်၍မရပါ", en: "Upload failed" },
  photoUploadSuccess: { th: "อัปโหลดสำเร็จ", my: "အပ်လုဒ်တင်ပြီးပါပြီ", en: "Upload successful" },
  photoAlt: { th: "รูปที่ถ่าย", my: "ရိုက်ထားသောဓာတ်ပုံ", en: "Captured photo" },

  numericTapToSet: { th: "แตะเพื่อตั้งค่า", my: "တန်ဖိုးသတ်မှတ်ရန် နှိပ်ပါ", en: "Tap to set" },
  warnBelow: { th: "ค่าต่ำกว่าเกณฑ์ปกติ", my: "ပုံမှန်ထက် နည်းနေသည်", en: "Below normal range" },
  warnAbove: { th: "ค่าสูงกว่าเกณฑ์ปกติ", my: "ပုံမှန်ထက် များနေသည်", en: "Above normal range" },
} as const satisfies Record<string, I18nString>;

export type DictKey = keyof typeof dict;
