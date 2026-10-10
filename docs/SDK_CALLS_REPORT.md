# SDK_CALLS_REPORT.md

تقرير كامل لكل استدعاءات Base44 SDK في مشروع **رفيق الدواء**.
آخر تحديث: 2026-10-09 · المشروع: `copy-fab546cf`

> **القاعدة الذهبية:** كل ما يبدأ بـ `base44.` هو ارتباط بالمنصة. عند الفصل، كل صف في
> هذا الملف يجب أن يُستبدل أو يُعاد بناؤه. الأعمدة: الملف + **رقم السطر** كما في الكود الحالي.

---

## 0) الجدول الرئيسي (Master Table)

| # | SDK Call | الملف | السطر | الوظيفة | البديل المقترح بعد الفصل |
|---|---|---|---|---|---|
| 1 | `integrations.Core.InvokeLLM` | `base44/functions/extractMedicationFromImage/entry.ts` | 19 | قراءة الوصفة/العلبة بالرؤية + JSON | OpenAI `gpt-4o` vision / Gemini Vision |
| 2 | `integrations.Core.InvokeLLM` | `base44/functions/medicationAssistant/entry.ts` | 60 | مساعد الأدوية النصي | OpenAI Chat / Anthropic Messages |
| 3 | `integrations.Core.InvokeLLM` | `base44/functions/identifyPillFromImage/entry.ts` | 28 | التعرف على الحبة (رؤية) | OpenAI Vision |
| 4 | `integrations.Core.InvokeLLM` | `base44/functions/readBarcodeFromImage/entry.ts` | — | قراءة أرقام الباركود من صورة | OpenAI Vision |
| 5 | `integrations.Core.UploadPrivateFile` | `src/pages/ScanPrescription.jsx` | 45 | رفع صورة وصفة (خاص) | Firebase Storage (private) |
| 6 | `integrations.Core.CreateFileSignedUrl` | `src/pages/ScanPrescription.jsx` | 46 | رابط موقّع للصورة | Signed URLs (Firebase/S3) |
| 7 | `integrations.Core.UploadPrivateFile` | `src/pages/ScanMedicine.jsx` | 44 | رفع صورة علبة (خاص) | Firebase Storage |
| 8 | `integrations.Core.CreateFileSignedUrl` | `src/pages/ScanMedicine.jsx` | 45 | رابط موقّع | Signed URLs |
| 9 | `integrations.Core.UploadPrivateFile` | `src/pages/PillIdentifier.jsx` | 31 | رفع صورة حبة (خاص) | Firebase Storage |
| 10 | `integrations.Core.CreateFileSignedUrl` | `src/pages/PillIdentifier.jsx` | 32 | رابط موقّع | Signed URLs |
| 11 | `integrations.Core.UploadPrivateFile` | `src/components/scan/BarcodeScanner.jsx` | — | رفع صورة باركود (خاص) | Firebase Storage |
| 12 | `integrations.Core.CreateFileSignedUrl` | `src/components/scan/BarcodeScanner.jsx` | — | رابط موقّع | Signed URLs |
| 13 | `integrations.Core.SendEmail` | `src/pages/Family.jsx` | 85 | دعوة فرد للعائلة | Resend / SendGrid / Firebase Auth invites |
| 14 | `functions.invoke("extractMedicationFromImage")` | `src/pages/ScanPrescription.jsx` | 49 | OCR وصفة | HTTP → خدمتك |
| 15 | `functions.invoke("extractMedicationFromImage")` | `src/pages/ScanMedicine.jsx` | 47 | OCR علبة | HTTP → خدمتك |
| 16 | `functions.invoke("identifyPillFromImage")` | `src/pages/PillIdentifier.jsx` | 34 | التعرف على حبة | HTTP → خدمتك |
| 17 | `functions.invoke("lookupBarcodeProduct")` | `src/components/scan/BarcodeScanner.jsx` | — | بحث باركود (FDA/OpenFoodFacts) | HTTP → خدمتك |
| 18 | `functions.invoke("readBarcodeFromImage")` | `src/components/scan/BarcodeScanner.jsx` | — | بديل قراءة الباركود من صورة | HTTP → خدمتك |
| 19 | `functions.invoke("medicationAssistant")` | `src/pages/Chatbot.jsx` | 54 | شات المساعد | HTTP → خدمتك |
| 20 | `functions.invoke("syncMedicationCalendar")` | `src/pages/AddMedication.jsx` | 145 | مزامنة التقويم | Google Calendar API |
| 21 | `functions.invoke("syncMedicationCalendar")` | `src/pages/MedicationDetail.jsx` | 119 | تحديث أحداث التقويم | Google Calendar API |
| 22 | `functions.invoke("removeMedicationCalendarEvents")` | `src/pages/MedicationDetail.jsx` | 137 | حذف أحداث التقويم | Google Calendar API |
| 23 | `connectors.getConnection("googlecalendar")` | `base44/functions/syncMedicationCalendar/entry.ts` | 29 | توكن Google Calendar | OAuth يدوي |
| 24 | `connectors.getConnection("googlecalendar")` | `base44/functions/removeMedicationCalendarEvents/entry.ts` | 15 | توكن Google Calendar | OAuth يدوي |
| 25 | `auth.*` (19 استدعاء) | متعدد (انظر §4) | — | تسجيل دخول/خروج/جلسة | Firebase Auth |
| 26 | `entities.*` (اكثر من 80 استدعاء) | متعدد (انظر §3) | — | قراءة/كتابة البيانات | Firestore / SQL |
| 27 | `app.getPublicSettings()` | `src/lib/AuthContext.jsx` | 26 | إعدادات التطبيق العامة | متغيرات بيئة/إعدادات عندك |

---

## 1) InvokeLLM — الذكاء الاصطناعي

| # | الملف | السطر | النوع | واش يدير | البديل | ملاحظات |
|---|---|---|---|---|---|---|
| 1 | `base44/functions/extractMedicationFromImage/entry.ts` | 19 | Vision + JSON | يقرأ الوصفة أو العلبة ويُرجع مصفوفة أدوية + confidence | OpenAI `gpt-4o` مع `response_format: json_schema` | الخرج منظّم عبر `response_json_schema`. لا يخترع بيانات غير مرئية |
| 2 | `base44/functions/medicationAssistant/entry.ts` | 60 | نص + سياق | يجيب على أسئلة الأدوية بنفس لغة السائل | OpenAI Chat Completions | حقن سياق: **أسماء** أدوية المستخدم فقط، بدون جرعات. آخر 6 رسائل تمرّر كسياق |
| 3 | `base44/functions/identifyPillFromImage/entry.ts` | 28 | Vision + JSON | تخمين هوية الحبة (شكل/لون/نقش) | OpenAI Vision | أقصى 3 احتمالات مع confidence رقمي؛ يُرجع قائمة فارغة إذا الصورة غير واضحة |
| 4 | `base44/functions/readBarcodeFromImage/entry.ts` | — | Vision + JSON | بديل: يقرأ أرقام الباركود من صورة | OpenAI Vision | يُستخدم فقط عندما لا يتوفر `BarcodeDetector` في المتصفح |

> كلها تُستدعى **من السيرفر فقط** عبر `base44.asServiceRole.integrations.Core.InvokeLLM`.
> لا يوجد أي استدعاء AI من الواجهة.

---

## 2) الملفات — UploadPrivateFile / CreateFileSignedUrl

| # | الملف | السطر | Call | واش يدير | البديل | ملاحظات |
|---|---|---|---|---|---|---|
| 5 | `src/pages/ScanPrescription.jsx` | 45 | `UploadPrivateFile` | رفع صورة الوصفة | Firebase Storage (private) | الملفات **خاصة** — لا رابط عام |
| 6 | `src/pages/ScanPrescription.jsx` | 46 | `CreateFileSignedUrl` | رابط موقّع مؤقّت للـ AI | Signed URLs | صلاحية قصيرة (افتراضي) |
| 7 | `src/pages/ScanMedicine.jsx` | 44 | `UploadPrivateFile` | رفع صورة العلبة | Firebase Storage | خاص |
| 8 | `src/pages/ScanMedicine.jsx` | 45 | `CreateFileSignedUrl` | رابط موقّع | Signed URLs | |
| 9 | `src/pages/PillIdentifier.jsx` | 31 | `UploadPrivateFile` | رفع صورة الحبة | Firebase Storage | يُخزَّن الـ `file_uri` في `PillScan` |
| 10 | `src/pages/PillIdentifier.jsx` | 32 | `CreateFileSignedUrl` | رابط موقّع | Signed URLs | |
| 11 | `src/components/scan/BarcodeScanner.jsx` | — | `UploadPrivateFile` | رفع صورة الباركود (وضع fallback) | Firebase Storage | خاص |
| 12 | `src/components/scan/BarcodeScanner.jsx` | — | `CreateFileSignedUrl` | رابط موقّع | Signed URLs | |

**لا يوجد `UploadPublicFile` في المشروع بأكمله.**

---

## 3) Entities — قاعدة البيانات (اكثر من 80 استدعاء)

| الملف | السطر | Call | واش يدير | البديل |
|---|---|---|---|---|
| `src/lib/doseOperations.js` | 16 | `DoseLog.filter` | سجلات جرعات اليوم | Firestore query |
| `src/lib/doseOperations.js` | 58, 122 | `DoseLog.filter` | التحقق قبل التحديث (idempotency) | Firestore query |
| `src/lib/doseOperations.js` | 72, 135 | `DoseLog.update` | تأكيد/تخطي جرعة | Firestore update |
| `src/lib/doseOperations.js` | 80, 142 | `DoseLog.create` | إنشاء سجل جرعة | Firestore add |
| `src/lib/doseOperations.js` | 99 | `Medication.update` | خصم المخزون | Firestore update |
| `src/lib/doseOperations.js` | 105, 157 | `AuditLog.create` | تسجيل التدقيق | جدول audit |
| `src/lib/logActivity.js` | 6 | `ActivityFeed.create` | تسجيل نشاط | Firestore add |
| `src/lib/doseReminders.js` | — | `NotificationLog.create` | سجل الإشعارات المعروضة | Firestore add |
| `src/pages/Home.jsx` | 29 | `CareRecipient.list` | قائمة الأشخاص | Firestore query |
| `src/pages/Home.jsx` | 38 | `Medication.filter` | أدوية الشخص النشطة | Firestore query |
| `src/pages/Medications.jsx` | 43 | `CareRecipient.list` | قائمة الأشخاص | Firestore query |
| `src/pages/Medications.jsx` | 68 | `Medication.filter` (+`$regex` بحث) | بحث/فلترة على السيرفر | Firestore/`WHERE LIKE` |
| `src/pages/Medications.jsx` | 222 | `Medication.delete` | حذف دواء | Firestore delete |
| `src/pages/AddMedication.jsx` | 59 | `CareRecipient.list` | قائمة الأشخاص | Firestore query |
| `src/pages/AddMedication.jsx` | 125 | `Medication.create` | إنشاء دواء | Firestore add |
| `src/pages/AddMedication.jsx` | 131 | `AuditLog.create` | تدقيق | audit |
| `src/pages/ScanPrescription.jsx` | 26, 75, 87 | `CareRecipient.list` / `Medication.create` / `AuditLog.create` | حفظ نتيجة المسح | Firestore |
| `src/pages/ScanMedicine.jsx` | 26, 73, 85 | نفسها | حفظ نتيجة المسح | Firestore |
| `src/pages/PillIdentifier.jsx` | 54 | `PillScan.create` | حفظ مسح الحبة | Firestore add |
| `src/components/scan/BarcodeScanner.jsx` | — | `ScanHistory.create` | تسجيل كل باركود | Firestore add |
| `src/pages/Chatbot.jsx` | 26 | `ChatMessage.filter` | تحميل آخر 50 رسالة | Firestore query |
| `src/pages/Chatbot.jsx` | 41 | `ChatMessage.create` | حفظ رسالة | Firestore add |
| `src/pages/Chatbot.jsx` | 71 | `ChatMessage.deleteMany` | مسح المحادثة | Firestore batch delete |
| `src/pages/Emergency.jsx` | 33, 48, 78, 80 | `CareRecipient.list`, `EmergencyInfo.filter/update/create` | معلومات الطوارئ | Firestore |
| `src/pages/VitalSigns.jsx` | 34, 49, 95, 109 | `CareRecipient.list`, `VitalSigns.filter/create/delete` | العلامات الحيوية | Firestore |
| `src/pages/ActivityFeed.jsx` | 26 | `ActivityFeed.list` | سجل النشاطات | Firestore query |
| `src/pages/Family.jsx` | 34, 35, 65, 74, 107, 108, 125, 126 | `CareRecipient.list`, `FamilyMember.*`, `AuditLog.create` | إدارة العائلة | Firestore |
| `src/pages/History.jsx` | 20, 21 | `DoseLog.list`, `Medication.list` | السجل | Firestore |
| `src/pages/MedicationDetail.jsx` | 37, 57, 101, 102, 140, 141, 158 | `Medication.get/update/delete`, `CareRecipient.get`, `AuditLog.create` | تفاصيل الدواء | Firestore |
| `src/pages/Profile.jsx` | 26, 48, 49, 56, 57, 87, 89, 91, 92 | `CareRecipient.*`, `Medication.filter/delete`, `AuditLog.create` | الملف الشخصي | Firestore |
| `src/pages/Settings.jsx` | 27, 31, 55 | `NotificationSettings.list/create/update` | إعدادات الإشعارات | Firestore |
| `src/pages/Settings.jsx` | 73–78 | `Medication/DoseLog/CareRecipient/FamilyMember/Notification/NotificationSettings .filter` | تصدير البيانات | تصدير JSON |
| `src/pages/Settings.jsx` | 109–114 | `*.deleteMany` | حذف بيانات المستخدم | حذف جماعي |
| `src/pages/Settings.jsx` | — | `NotificationLog.filter` | سجل الإشعارات | Firestore query |
| `src/components/DoseReminders.jsx` | — | `NotificationSettings.list`, `CareRecipient.list`, `Medication.filter` | جدولة التنبيهات | Firestore |
| `base44/functions/syncMedicationCalendar/entry.ts` | 24, 49, 95 | `Medication.get/update` | حفظ أحداث التقويم | Firestore |
| `base44/functions/medicationAssistant/entry.ts` | 21 | `Medication.filter` | حقن أسماء الأدوية | Firestore |

> **مهم:** كل الـ RLS مُنفَّذ على السيرفر. عند الانتقال إلى Firestore يجب إعادة بناء
> نفس القواعد في Security Rules، وإلا صارت البيانات مفتوحة.

---

## 4) Auth — المصادقة

| # | الملف | السطر | Call | واش يدير | البديل |
|---|---|---|---|---|---|
| 1 | `src/lib/AuthContext.jsx` | 26 | `app.getPublicSettings()` | إعدادات التطبيق العامة | env/config |
| 2 | `src/lib/AuthContext.jsx` | 84 | `auth.me()` | المستخدم الحالي | `onAuthStateChanged` |
| 3 | `src/lib/AuthContext.jsx` | 111, 114 | `auth.logout(url)` | خروج + تنظيف التوكن | `signOut()` |
| 4 | `src/lib/AuthContext.jsx` | 120 | `auth.redirectToLogin(url)` | توجيه لتسجيل الدخول | redirect يدوي |
| 5 | `src/lib/logActivity.js` | 5 | `auth.me()` | اسم الفاعل | Firebase currentUser |
| 6 | `src/lib/appLock.js` | — | `auth.updateMe` | تخزين hash الـ PIN وإعدادات القفل | `updateProfile`/مستند المستخدم |
| 7 | `src/i18n/index.jsx` | 67 | `auth.updateMe({language})` | حفظ اللغة عبر الأجهزة | مستند المستخدم |
| 8 | `src/pages/Login.jsx` | 27 | `auth.loginWithProvider("google")` | دخول Google (Redirect) | Google provider |
| 9 | `src/pages/Register.jsx` | 32 | `auth.register` | إنشاء حساب | `createUserWithEmailAndPassword` |
| 10 | `src/pages/Register.jsx` | 45 | `auth.verifyOtp` | تحقق OTP | تحقق مخصص |
| 11 | `src/pages/Register.jsx` | 47 | `auth.setToken` | تخزين التوكن | SDK يتولى |
| 12 | `src/pages/Register.jsx` | 60 | `auth.resendOtp` | إعادة إرسال OTP | خدمة OTP |
| 13 | `src/pages/Register.jsx` | 71 | `auth.loginWithProvider("google")` | دخول Google | Google provider |
| 14 | `src/pages/ForgotPassword.jsx` | 19 | `auth.resetPasswordRequest` | طلب إعادة تعيين | `sendPasswordResetEmail` |
| 15 | `src/pages/ResetPassword.jsx` | 28 | `auth.resetPassword` | تعيين كلمة المرور | `confirmPasswordReset` |
| 16 | `src/pages/PageNotFound.jsx` | 14 | `auth.me()` | فحص الجلسة | currentUser |
| 17 | `src/pages/Settings.jsx` | 236 | `auth.logout()` | زر الخروج | `signOut()` |
| 18 | كل `base44/functions/*/entry.ts` | 6 أو 15 | `auth.me()` | التحقق من المستخدم داخل الدالة | تحقق من Firebase ID Token |
| 19 | `src/lib/app-params.js` | 9, 10 | `localStorage` توكن SDK | تنظيف التوكن | إدارة توكن Firebase |

---

## 5) functions.invoke — الدوال الخلفية

| # | الملف | السطر | الدالة | واش يدير | البديل |
|---|---|---|---|---|---|
| 1 | `src/pages/ScanPrescription.jsx` | 49 | `extractMedicationFromImage` | OCR وصفة | HTTP → خدمتك |
| 2 | `src/pages/ScanMedicine.jsx` | 47 | `extractMedicationFromImage` | OCR علبة | HTTP → خدمتك |
| 3 | `src/pages/PillIdentifier.jsx` | 34 | `identifyPillFromImage` | التعرف على حبة | HTTP → خدمتك |
| 4 | `src/components/scan/BarcodeScanner.jsx` | — | `lookupBarcodeProduct` | بحث باركود | HTTP → خدمتك |
| 5 | `src/components/scan/BarcodeScanner.jsx` | — | `readBarcodeFromImage` | قراءة باركود من صورة | HTTP → خدمتك |
| 6 | `src/pages/Chatbot.jsx` | 54 | `medicationAssistant` | شات | HTTP → خدمتك |
| 7 | `src/pages/AddMedication.jsx` | 145 | `syncMedicationCalendar` | مزامنة التقويم | Google Calendar API |
| 8 | `src/pages/MedicationDetail.jsx` | 119 | `syncMedicationCalendar` | تحديث التقويم | Google Calendar API |
| 9 | `src/pages/MedicationDetail.jsx` | 137 | `removeMedicationCalendarEvents` | حذف أحداث | Google Calendar API |

---

## 6) Connectors — الموصلات

| # | الملف | السطر | Connector | واش يدير | البديل |
|---|---|---|---|---|---|
| 1 | `base44/functions/syncMedicationCalendar/entry.ts` | 29 | `googlecalendar` | توكن لإنشاء الأحداث | OAuth يدوي + Google Calendar REST |
| 2 | `base44/functions/removeMedicationCalendarEvents/entry.ts` | 15 | `googlecalendar` | توكن لحذف الأحداث | نفس البديل |

الملف التعريفي: `base44/connectors/googlecalendar.jsonc`

---

## 7) SDK أخرى

| الملف | Call | واش يدير | البديل |
|---|---|---|---|
| `src/api/base44Client.js` | `createClient(...)` | إنشاء عميل SDK | تهيئة Firebase/Supabase |
| `src/lib/AuthContext.jsx` | `base44.app.getPublicSettings()` | إعدادات عامة | config/env |
| `src/lib/app-params.js` | `appParams.token` | قراءة التوكن من الرابط/التخزين | Firebase Auth |
| `base44/functions/*/entry.ts` | `createClientFromRequest(req)` | عميل داخل الدالة | Admin SDK |
| `base44/functions/*/entry.ts` | `asServiceRole` | تجاوز RLS داخل الدوال | Admin SDK |

---

## خلاصة الفصل (Migration Checklist)

1. **InvokeLLM** (4 مواضع) → مزوّد LLM مع Vision + JSON schema.
2. **UploadPrivateFile / CreateFileSignedUrl** (7 مواضع) → Firebase Storage + Signed URLs.
3. **entities.*** (اكثر من 80 موضعاً) → Firestore/SQL + **إعادة بناء كل قواعد RLS**.
4. **auth.*** (19 موضعاً) → Firebase Auth (Google provider) مع الحفاظ على Redirect flow
   (لا نوافذ منبثقة — لا تعمل في WebView).
5. **functions.invoke** (9 مواضع) → HTTP إلى Cloud Functions/API عندك.
6. **connectors googlecalendar** → OAuth مباشر + Google Calendar REST.
7. **NotificationLog / ScanHistory / PillScan / ChatMessage** كيانات جديدة تحتاج نفس المعالجة.

> ملفات مشابهة: `docs/AI_PROMPTS.md` (الـ prompts) و `docs/DATA_MODEL.md` (نموذج البيانات).