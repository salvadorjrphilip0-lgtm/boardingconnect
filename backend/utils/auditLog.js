import { supabase } from "../config/supabase.js";

// Helper to log activity (application/agreement changes)
export const logActivity = async (
  entityType,
  entityId,
  action,
  oldStatus,
  newStatus,
  changedBy,
  details = {},
) => {
  try {
    await supabase.from("activity_logs").insert([
      {
        entity_type: entityType,
        entity_id: entityId,
        action,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: changedBy,
        details,
      },
    ]);
  } catch (error) {
    console.error("Log activity error:", error);
    // Don't throw - logging failure shouldn't break the flow
  }
};

// Fetch activity log for entity
export const getActivityLog = async (entityType, entityId) => {
  try {
    const { data, error } = await supabase
      .from("activity_logs")
      .select(
        `
        *,
        changed_by_user:users!changed_by(id, full_name, email)
      `,
      )
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Get activity log error:", error);
    return [];
  }
};
