import { api } from "@/api/supabaseClient";

export async function logActivity(action, details = {}) {
  try {
    const user = await api.auth.me();
    await api.entities.ActivityFeed.create({
      // Leave the name empty when the account has none: the activity feed
      // renders an empty actor_name through its own localized "someone"
      // fallback, whereas baking an Arabic word in here would stay Arabic in
      // the en/fr UI too (it is persisted, not rendered at log time).
      actor_name: user?.full_name || user?.email?.split("@")[0] || "",
      actor_id: user?.id,
      action,
      target_name: details.targetName || "",
      recipient_name: details.recipientName || "",
      icon: details.icon || "activity",
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}