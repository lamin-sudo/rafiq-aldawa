# DATA_MODEL.md

نموذج البيانات الكامل للتطبيق (Base44 Entities). كل سجل يحتوي تلقائياً على
`id`, `created_date`, `updated_date`, `created_by_id` (لا تُصرَّح في الـ schema).

---

## Core

### CareRecipient
الشخص الذي تُتابع أدويته (نفس المستخدم أو فرد من العائلة).

| field | type | notes |
|---|---|---|
| name | string | **required** |
| relationship | enum(self,parent,spouse,child,sibling,grandparent,other) | default `self` |
| date_of_birth | date | |
| gender | enum(male,female,unspecified) | |
| notes | string | |
| photo_url | string | رابط صورة |
| shared_with | string[] | user ids |

**RLS:** read = owner ∪ `shared_with` ∪ admin · create/update/delete = owner ∪ admin.

### Medication
| field | type | notes |
|---|---|---|
| name | string | **required** |
| generic_name | string | |
| dosage | string | **required** |
| dosage_unit | enum(حبة,ملغ,مل,قطرة,بخة,حقنة,أخرى) | |
| form | enum(أقراص,كبسولات,شراب,حقن,كريم,قطرة,بخاخ,أخرى) | |
| frequency_per_day | number 1..12 | **required** |
| scheduled_times | string[] | "HH:MM" |
| start_date | date | **required** |
| end_date | date | |
| instructions | string | |
| notes | string | |
| quantity | number | |
| remaining_quantity | number | |
| refill_threshold | number | default 5 |
| active | boolean | default true |
| recipient_id | string | **required** — FK → CareRecipient |
| recipient_name | string | denormalized |
| color | string | |
| shared_with | string[] | user ids |
| calendar_event_ids | string[] | Google Calendar event ids |

**RLS:** read = owner ∪ `shared_with` ∪ admin · create/update/delete = owner ∪ admin.

### DoseLog
سجل جرد الجرعات (موصوفة/مأخوذة/متخطاة/فائتة).

| field | type | notes |
|---|---|---|
| medication_id | string | **required** — FK → Medication |
| medication_name | string | denormalized |
| medication_dosage | string | |
| recipient_id | string | **required** — FK → CareRecipient |
| scheduled_time | string | **required** "HH:MM" |
| scheduled_date | date | **required** |
| status | enum(pending,taken,skipped,missed) | **required** |
| taken_at | datetime | |
| confirmed_by_id | string | |
| confirmed_by_name | string | |
| skip_reason | string | |
| decremented_inventory | boolean | default false |

**RLS:** read = owner ∪ confirmed_by ∪ admin · create = owner · update/delete = owner ∪ admin.

### NotificationSettings
| field | type | default |
|---|---|---|
| dose_reminders | boolean | true |
| missed_dose_reminders | boolean | true |
| low_stock_alerts | boolean | true |
| family_notifications | boolean | true |
| daily_summary | boolean | false |
| notification_sound | boolean | true |
| reminder_lead_minutes | number 0..60 | 0 |
| missed_dose_delay_minutes | number 5..120 | 30 |

**RLS:** owner فقط (كل العمليات).

### Notification
| field | type | notes |
|---|---|---|
| type | enum(dose_due,dose_overdue,low_stock,refill_reminder,family_activity,system) | **required** |
| title | string | **required** |
| message | string | **required** |
| is_read | boolean | default false |
| related_id | string | |
| related_type | string | |

**RLS:** owner فقط.

### FamilyMember
| field | type | notes |
|---|---|---|
| invited_email | email | **required** |
| invitee_id | string | يُملأ عند قبول الدعوة |
| invitee_name | string | |
| relationship | string | |
| permission_level | enum(view_only,view_and_confirm,manage) | **required** |
| status | enum(pending,active,revoked) | default `pending` |
| recipient_id | string | **required** — FK → CareRecipient |
| recipient_name | string | |

**RLS:** read/update = owner ∪ invitee ∪ admin · create = owner · delete = owner ∪ admin.

### AuditLog
سجل تدقيق (يُستخدم من الـ OCR والإضافة اليدوية).
| field | type |
|---|---|
| actor_id | string |
| actor_email | string |
| action | string **required** |
| target_type | string |
| target_id | string |
| target_name | string |
| details | string |

**RLS:** read/update/delete = admin فقط · create = أي مستخدم موثّق.

---

## Health

### EmergencyInfo
| field | type |
|---|---|
| blood_type | enum(A+,A-,B+,B-,AB+,AB-,O+,O-,unknown) |
| chronic_diseases | string |
| allergies | string |
| current_medications | string |
| emergency_contact_name | string |
| emergency_phone | string |
| recipient_id | string **required** — FK → CareRecipient |
| recipient_name | string |

**RLS:** read/update/delete = owner ∪ admin · create = owner.

### VitalSigns
| field | type | notes |
|---|---|---|
| recipient_id | string | **required** — FK → CareRecipient |
| recipient_name | string | |
| type | enum(blood_pressure,blood_sugar,weight) | **required** |
| systolic | number 0..300 | for blood_pressure |
| diastolic | number 0..200 | for blood_pressure |
| value | number 0..1000 | for blood_sugar |
| weight | number 0..500 | for weight |
| recorded_at | datetime | **required** |
| notes | string | |

**RLS:** owner ∪ admin.

### ActivityFeed
| field | type | notes |
|---|---|---|
| actor_name | string | |
| actor_id | string | |
| action | enum(dose_taken,dose_skipped,medication_added,vital_recorded,emergency_updated,member_invited) | **required** |
| target_name | string | |
| recipient_name | string | |
| icon | string | default `activity` |

**RLS:** read = owner ∪ admin · create = owner · update/delete = admin.

---

## الجديد / New entities

### PillScan  ⭐ جديد
سجل كل عملية «التعرف على حبة». **لا يُنشئ دواءً أبداً** — مجرد أرشيف للمراجعة.

| field | type | notes |
|---|---|---|
| image_url | string | **required** — `file_uri` للملف الخاص (بدون بادئة عامة) |
| recipient_id | string | FK → CareRecipient (اختياري) |
| recipient_name | string | |
| shape | string | الشكل المرصود |
| color | string | اللون المرصود |
| imprint | string | النقش المقروء |
| confidence | enum(high,medium,low) | default `low` |
| possible_matches | array<{name:string, confidence:number, reason:string}> | أقصى ٣ |
| notes | string | |

**RLS:** read = owner ∪ admin · create = owner · update/delete = owner ∪ admin.

```json
{
  "image_url": "private/xxxx/pill.jpg",
  "shape": "oval",
  "color": "white",
  "imprint": "500",
  "confidence": "high",
  "possible_matches": [{ "name": "Paracetamol 500mg", "confidence": 0.82, "reason": "أبيض بيضاوي بنقش 500" }]
}
```

### ChatMessage  ⭐ جديد
رسائل مساعد الدواء (محفوظة لكل مستخدم على حدة).

| field | type | notes |
|---|---|---|
| role | enum(user,assistant) | **required** |
| content | string | **required** |

**RLS:** owner فقط (كل العمليات) — لا يرى أحد محادثة غيره، ولا حتى admin.
**Indexes مقترحة:** `created_by_id + created_date` (لجلب آخر ٥٠ رسالة).

---

## ملاحظات Migration

- كل العلاقات حالياً **بالـ id كنص** (لا Foreign Keys صارمة) → عند النقل إلى Firestore/SQL
  يجب تحويلها إلى مراجع حقيقية أو الحفاظ على الـ denormalized names للعرض السريع.
- الحقول `recipient_name`, `medication_name`, `actor_name` مخزّنة مرتين (denormalized)
  لتسريع العرض وتقليل الاستعلامات.
- `calendar_event_ids` مرتبطة بحساب Google Calendar الخاص بمنشئ الدواء.
- ترتيب مقترح عند التصدير: CareRecipient → Medication → DoseLog → VitalSigns →
  EmergencyInfo → FamilyMember → NotificationSettings → ActivityFeed → PillScan → ChatMessage.