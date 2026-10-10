import { api } from "@/api/supabaseClient";
import { todayStr, compareTime, getTimePeriod } from "./medicationUtils";

// توليد جدول جرعات اليوم من الأدوية النشطة + السجلات الموجودة
export async function buildTodaySchedule(medications, recipientId) {
  const today = todayStr();
  const activeMeds = medications.filter(
    (m) => m.active && m.recipient_id === recipientId &&
    (!m.end_date || m.end_date >= today) &&
    m.start_date <= today
  );

  if (activeMeds.length === 0) return [];

  // جلب سجلات اليوم
  const logs = await api.entities.DoseLog.filter({
    recipient_id: recipientId,
    scheduled_date: today,
  });

  const logMap = {};
  for (const log of logs) {
    logMap[`${log.medication_id}_${log.scheduled_time}`] = log;
  }

  const schedule = [];
  for (const med of activeMeds) {
    const times = med.scheduled_times?.length ? med.scheduled_times : [];
    for (const time of times) {
      const key = `${med.id}_${time}`;
      const existingLog = logMap[key];
      schedule.push({
        doseLogId: existingLog?.id || null,
        medication_id: med.id,
        medication_name: med.name,
        medication: med,
        recipient_id: recipientId,
        scheduled_time: time,
        scheduled_date: today,
        status: existingLog?.status || "pending",
        taken_at: existingLog?.taken_at || null,
        confirmed_by_name: existingLog?.confirmed_by_name || null,
        skip_reason: existingLog?.skip_reason || null,
      });
    }
  }

  schedule.sort((a, b) => compareTime(a.scheduled_time, b.scheduled_time));
  return schedule;
}

// تأكيد جرعة (تم الأخذ)
export async function takeDose(dose, user) {
  const today = todayStr();
  const now = new Date().toISOString();

  // التحقق من عدم وجود سجل مسبق (idempotency)
  const existing = await api.entities.DoseLog.filter({
    medication_id: dose.medication_id,
    scheduled_date: today,
    scheduled_time: dose.scheduled_time,
    recipient_id: dose.recipient_id,
  });

  if (existing.length > 0 && existing[0].status === "taken") {
    return existing[0]; // idempotent - already taken
  }

  let log;
  if (existing.length > 0) {
    // تحديث السجل الموجود
    log = await api.entities.DoseLog.update(existing[0].id, {
      status: "taken",
      taken_at: now,
      confirmed_by_id: user.id,
      confirmed_by_name: user.email,
    });
  } else {
    // إنشاء سجل جديد
    log = await api.entities.DoseLog.create({
      medication_id: dose.medication_id,
      medication_name: dose.medication_name,
      medication_dosage: dose.medication?.dosage,
      recipient_id: dose.recipient_id,
      scheduled_time: dose.scheduled_time,
      scheduled_date: today,
      status: "taken",
      taken_at: now,
      confirmed_by_id: user.id,
      confirmed_by_name: user.email,
      decremented_inventory: true,
    });
  }

  // خصم من المخزون
  const med = dose.medication;
  if (med && med.remaining_quantity > 0) {
    const newQty = Math.max(0, med.remaining_quantity - 1);
    await api.entities.Medication.update(med.id, {
      remaining_quantity: newQty,
    });
  }

  // تسجيل في سجل التدقيق
  await api.entities.AuditLog.create({
    actor_id: user.id,
    actor_email: user.email,
    action: "dose_taken",
    target_type: "DoseLog",
    target_id: log.id,
    target_name: `${dose.medication_name} - ${dose.scheduled_time}`,
    details: `تم تأكيد جرعة ${dose.medication_name} في ${dose.scheduled_time}`,
  });

  return log;
}

// تخطي جرعة
export async function skipDose(dose, user, reason = "") {
  const today = todayStr();

  const existing = await api.entities.DoseLog.filter({
    medication_id: dose.medication_id,
    scheduled_date: today,
    scheduled_time: dose.scheduled_time,
    recipient_id: dose.recipient_id,
  });

  if (existing.length > 0 && (existing[0].status === "skipped" || existing[0].status === "taken")) {
    return existing[0]; // idempotent
  }

  let log;
  if (existing.length > 0) {
    log = await api.entities.DoseLog.update(existing[0].id, {
      status: "skipped",
      confirmed_by_id: user.id,
      confirmed_by_name: user.email,
      skip_reason: reason,
    });
  } else {
    log = await api.entities.DoseLog.create({
      medication_id: dose.medication_id,
      medication_name: dose.medication_name,
      medication_dosage: dose.medication?.dosage,
      recipient_id: dose.recipient_id,
      scheduled_time: dose.scheduled_time,
      scheduled_date: today,
      status: "skipped",
      confirmed_by_id: user.id,
      confirmed_by_name: user.email,
      skip_reason: reason,
      decremented_inventory: false,
    });
  }

  await api.entities.AuditLog.create({
    actor_id: user.id,
    actor_email: user.email,
    action: "dose_skipped",
    target_type: "DoseLog",
    target_id: log.id,
    target_name: `${dose.medication_name} - ${dose.scheduled_time}`,
    details: `تم تخطي جرعة ${dose.medication_name} في ${dose.scheduled_time}`,
  });

  return log;
}

// تجميع الجدول حسب فترة اليوم
export function groupByPeriod(schedule) {
  const groups = { morning: [], afternoon: [], evening: [], night: [] };
  for (const dose of schedule) {
    const period = getTimePeriod(dose.scheduled_time);
    groups[period].push(dose);
  }
  return groups;
}