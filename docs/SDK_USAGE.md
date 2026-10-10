# SDK_USAGE.md

جرد كامل لكل استخدامات Base44 SDK في التطبيق، ومكان كل استخدام، والبديل المقترح
عند الفصل عن المنصة (OpenAI / Firebase / …).

---

## 1) الذكاء الاصطناعي — `base44.asServiceRole.integrations.Core.InvokeLLM`

> **قاعدة:** لا يُستدعى إلا داخل backend function. الواجهة لا تلمسه أبداً.

| المكان | الاستخدام | البديل المقترح |
|---|---|---|
| `base44/functions/extractMedicationFromImage/entry.ts` | قراءة الوصفة/العلبة (vision + JSON) | OpenAI `gpt-4o` / Google Gemini Vision + `response_format: json_schema` |
| `base44/functions/medicationAssistant/entry.ts` | مساعد الأدوية النصي | OpenAI Chat Completions / Anthropic Messages API |
| `base44/functions/identifyPillFromImage/entry.ts` | التعرف على الحبة (vision + JSON) | OpenAI `gpt-4o` vision / Gemini Vision |

**ملاحظة:** كلها تستخدم `response_json_schema` للحصول على خرج منظّم — استبدلها بـ
`json_schema` mode عند المزوّد البديل.

---

## 2) رفع الملفات — `base44.integrations.Core.*`

> `UploadPrivateFile` و `CreateFileSignedUrl` يمكن نداؤهما من **الواجهة** (client) مباشرة.

| المكان | Call | ملاحظات | البديل |
|---|---|---|---|
| `src/pages/ScanPrescription.jsx` | `UploadPrivateFile` + `CreateFileSignedUrl` | صورة الوصفة | Firebase Storage (private) + Signed URLs |
| `src/pages/ScanMedicine.jsx` | نفس الشيء | صورة العلبة | نفس البديل |
| `src/pages/PillIdentifier.jsx` ⭐ | `UploadPrivateFile` + `CreateFileSignedUrl` | صورة الحبة | نفس البديل |

**لا يوجد** `UploadPublicFile` في المشروع — كل صور المستخدمين **خاصة**.

---

## 3) قاعدة البيانات — `base44.entities.<Entity>.<op>`

| الملف | العملية |
|---|---|
| `src/lib/doseOperations.js` | `DoseLog.filter/create/update`, `Medication.update` |
| `src/lib/logActivity.js` | `ActivityFeed.create` |
| `src/pages/Home.jsx` | `CareRecipient.list`, `Medication.filter` |
| `src/pages/Medications.jsx` | `CareRecipient.list`, `Medication.filter`, `Medication.delete` |
| `src/pages/AddMedication.jsx` | `CareRecipient.list`, `Medication.create`, `AuditLog.create` |
| `src/pages/ScanMedicine.jsx`, `ScanPrescription.jsx` | `Medication.create`, `AuditLog.create` |
| `src/pages/PillIdentifier.jsx` ⭐ | `PillScan.create` |
| `src/pages/Chatbot.jsx` ⭐ | `ChatMessage.filter/create/deleteMany` |
| `src/pages/Emergency.jsx` | `EmergencyInfo.*` |
| `src/pages/VitalSigns.jsx` | `VitalSigns.*` |
| `src/pages/ActivityFeed.jsx` | `ActivityFeed.filter` |
| `src/pages/Settings.jsx` | `NotificationSettings.*`, حذف البيانات |
| `src/components/...` | قراءات مساعدة |

**البديل:** Firestore / Supabase / أي REST + طبقة repository.
انتبه: **RLS** تُنفَّذ حالياً على السيرفر — يجب إعادة بنائها في Firestore Rules أو RLS في Postgres.

---

## 4) المصادقة — `base44.auth.*`

| المكان | Call |
|---|---|
| `src/lib/AuthContext.jsx` | `me()`, `isAuthenticated()`, `logout()`, `redirectToLogin()` |
| `src/pages/Login.jsx` | `loginWithProvider('google', …)` (Google Sign-In) |
| `src/i18n/index.jsx` | `updateMe({ language })` لحفظ اللغة عبر الأجهزة |

**البديل:** Firebase Auth (Google provider) — نفس الـ flow، مع مراعاة أن
`updateMe` لحفظ اللغة يجب استبداله بحقل في مستند `users/{uid}`.

> **ملاحظة Android/WebView:** لا تستخدم نوافذ منبثقة لتسجيل الدخول
> (dead-end سابق) — استخدم Redirect-based flow فقط.

---

## 5) Functions — `base44.functions.invoke`

| المكان | Function | البديل |
|---|---|---|
| `src/pages/AddMedication.jsx` | `syncMedicationCalendar` | Google Calendar API مباشرة |
| `src/pages/MedicationDetail.jsx` | `removeMedicationCalendarEvents`, `syncMedicationCalendar` | نفس البديل |
| `src/pages/ScanMedicine.jsx`, `ScanPrescription.jsx` | `extractMedicationFromImage` | دالة على السيرفر تستدعي OpenAI |
| `src/pages/PillIdentifier.jsx` ⭐ | `identifyPillFromImage` | دالة على السيرفر تستدعي OpenAI Vision |
| `src/pages/Chatbot.jsx` | `medicationAssistant` | دالة على السيرفر تستدعي LLM |

---

## 6) Connectors

| Connector | المكان | البديل |
|---|---|---|
| `googlecalendar` (`base44/connectors/googlecalendar.jsonc`) | `syncMedicationCalendar`, `removeMedicationCalendarEvents` | OAuth يدوي + Google Calendar REST |

---

## خلاصة ما يحتاج استبدالاً عند الفصل

1. **InvokeLLM** (٣ مواضع) → مزوّد LLM خارجي بأوضاع JSON المنظّم + Vision.
2. **UploadPrivateFile / CreateFileSignedUrl** → Firebase Storage أو S3 مع Signed URLs.
3. **Entities** → Firestore/SQL + إعادة بناء RLS.
4. **Auth** → Firebase Auth (Google).
5. **Google Calendar connector** → OAuth مباشر.
6. **functions.invoke** → استدعاءات HTTP عادية إلى خدماتك (Cloud Functions / API).