# AI_PROMPTS.md

كل الـ prompts المستخدمة في التطبيق، مع النموذج المتوقع وتنسيق الخرج.
All AI prompts used by the app, with the expected model, input and output format.

> **تنبيه:** كل نداءات الذكاء الاصطناعي تمر حالياً عبر Base44 Core Integration
> `InvokeLLM` (من داخل backend functions فقط). لا يوجد مفتاح مزوّد خارجي في الواجهة.
> أي migration لاحق يجب أن يحفظ **نفس الـ prompt ونفس الـ JSON schema**.

---

## 1) OCR — استخراج الأدوية من صورة

- **Function:** `base44/functions/extractMedicationFromImage/entry.ts`
- **Model:** `automatic` (vision-capable) — الافتراضي من InvokeLLM.
- **Temperature:** غير محدّد (الافتراضي). المطلوب خرج منظّم، لذا لا حاجة لدرجة حرارة عالية.
- **Input:** `{ imageUrl: string, scanType: "prescription" | "medicine" }`
  حيث `imageUrl` هو رابط موقّع قصير الأجل من ملف **خاص** (private).
- **Output:** JSON (عبر `response_json_schema`)

```json
{
  "medications": [
    {
      "name": "string",
      "strength": "string",
      "form": "string",
      "instructions": "string",
      "manufacturer": "string",
      "frequency": "string"
    }
  ],
  "confidence": "high | medium | low",
  "notes": "string"
}
```

**قواعد الـ prompt:** لا يخترع أي معلومة غير مرئية؛ الحقول غير المقروءة تُترك فارغة.
**مثال input:** صورة علبة "Doliprane 1000mg".
**مثال output:**
```json
{ "medications": [{ "name": "Doliprane", "strength": "1000mg", "form": "tablet", "instructions": "", "manufacturer": "Sanofi", "frequency": "" }], "confidence": "high" }
```

---

## 2) Chatbot — مساعد الدواء

- **Function:** `base44/functions/medicationAssistant/entry.ts`
- **Model:** `automatic` (نص فقط، بدون بحث إنترنت).
- **Temperature:** الافتراضي.
- **Input:** `{ question: string (<= 1000 حرف), history?: [{role, content}] (آخر ٦ رسائل) }`
- **Context injection:** أسماء أدوية المستخدم النشطة **فقط** (بدون جرعات)، حتى ٢٠ اسماً.
  → **لا تُمرَّر أي جرعة أو بيانات حساسة إلى النموذج.**
- **Output:** `{ "answer": "string" }` (نص حر، بنفس لغة السؤال).

**قواعد الـ system prompt (مختصر):**
1. اكتشاف اللغة تلقائياً (عربية / دارجة / فرنسية / إنجليزية) والرد بها.
2. إجابة قصيرة (٣–٦ أسطر)، معلومات عامة فقط.
3. ممنوع: تشخيص، جرعات محددة، وصف دواء.
4. ممنوع ذكر جرعات المستخدم.
5. الحالات الحرجة → توجيه للطوارئ/الطبيب فوراً.
6. خارج النطاق → اعتذار وتوجيه لمختص.
7. السؤال الغامض → طلب توضيح.
8. إخلاء المسؤولية الإجباري في كل رد:
   `⚠️ هذا ليس تشخيصاً طبياً. يرجى استشارة طبيب مختص.`

---

## 3) Pill Identifier — التعرف على الحبة

- **Function:** `base44/functions/identifyPillFromImage/entry.ts`
- **Model:** `automatic` (vision-capable).
- **Input:** `{ imageUrl: string }` (رابط موقّع لملف خاص).
- **Output:** JSON (عبر `response_json_schema`)

```json
{
  "possible_matches": [
    { "name": "string", "confidence": 0.0, "reason": "string" }
  ],
  "shape": "string",
  "color": "string",
  "imprint": "string",
  "confidence": "high | medium | low",
  "disclaimer": "string"
}
```

**قواعد الـ prompt:** تخمين بصري فقط، أقصى ٣ احتمالات، `confidence` رقم بين ٠ و١ لكل احتمال،
لا اختراع لأي نقش أو اسم، وإذا كانت الصورة غير واضحة تُرجع `possible_matches` **فارغة**
مع `confidence: "low"` بدل تأليف نتيجة.

**مثال input:** صورة قرص أبيض بيضاوي منقوش `500`.
**مثال output (ثقة عالية):**
```json
{ "possible_matches": [{ "name": "Paracetamol 500mg", "confidence": 0.82, "reason": "أبيض بيضاوي بنقش 500 وهو الشكل الشائع" }], "shape": "oval", "color": "white", "imprint": "500", "confidence": "high", "disclaimer": "This is a guess, not a medical diagnosis. Consult your pharmacist." }
```

> **تنبيه قانوني:** نتيجة التعرف على الحبة تخمينية دائماً. الواجهة تعرض إخلاء المسؤولية
> بثلاث لغات من i18n في **كل** نتيجة، ولا تحفظ النتيجة كدواء — فقط كسجل `PillScan`.

---

## ملاحظات للنموذج (Migration notes)

- للحصول على خرج JSON منظّم: أرسل `response_json_schema` (جذر `object` وليس `array`).
- الصور تمر كـ `file_urls: [signedUrl]` — أي مزوّد بديل يحتاج أن يقبل رابط صورة عام/موقّع.
- `add_context_from_internet` غير مستخدم (لا حاجة، ويقلّل التكلفة).