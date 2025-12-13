/**
 * Agent Assignment Logic
 * Assigns calls/appointments to agents based on:
 * 1. Territory (zip code matching)
 * 2. Availability (calendar check)
 * 3. Round-robin (if no match)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface Agent {
  id: string;
  name: string;
  territory_zip: string | null;
  calendar_sync_enabled: boolean;
  agency_id: string;
}

interface Lead {
  id: string;
  address: string;
  agency_id: string;
}

/**
 * Extract ZIP code from address
 */
function extractZipCode(address: string): string | null {
  // Try to find ZIP code in address (various formats)
  const zipPatterns = [
    /\b\d{5}(-\d{4})?\b/, // US ZIP: 12345 or 12345-6789
    /\b\d{4}\b/, // European ZIP: 8001
    /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i, // UK postcode
  ];

  for (const pattern of zipPatterns) {
    const match = address.match(pattern);
    if (match) {
      return match[0].replace(/\s/g, "");
    }
  }

  return null;
}

/**
 * Check if agent is available (has calendar sync enabled)
 * For now, we assume they're available if calendar is connected
 * In the future, we can check actual calendar availability
 */
async function isAgentAvailable(agentId: string, scheduledTime?: string): Promise<boolean> {
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("calendar_sync_enabled")
    .eq("id", agentId)
    .single();

  if (!agent || !agent.calendar_sync_enabled) {
    return true; // If no calendar, assume available
  }

  // TODO: Check actual calendar availability if scheduledTime is provided
  // For now, just return true if calendar is connected
  return true;
}

/**
 * Assign an agent to a lead based on territory, availability, or round-robin
 */
export async function assignAgentToLead(
  lead: Lead,
  scheduledTime?: string
): Promise<string | null> {
  try {
    // 1. Get all agents for the agency
    const { data: agents, error } = await supabaseAdmin
      .from("agents")
      .select("*")
      .eq("agency_id", lead.agency_id)
      .order("created_at", { ascending: true });

    if (error || !agents || agents.length === 0) {
      console.log("No agents found for agency");
      return null;
    }

    // 2. Extract ZIP code from lead address
    const leadZip = extractZipCode(lead.address || "");

    // 3. Try territory-based assignment first
    if (leadZip) {
      const territoryMatch = agents.find(
        (agent) => agent.territory_zip === leadZip
      );

      if (territoryMatch) {
        const available = await isAgentAvailable(territoryMatch.id, scheduledTime);
        if (available) {
          console.log(`✅ Assigned agent ${territoryMatch.name} by territory (${leadZip})`);
          return territoryMatch.id;
        }
      }
    }

    // 4. Try availability-based assignment (agents with calendar sync)
    const availableAgents = agents.filter(
      (agent) => agent.calendar_sync_enabled
    );

    if (availableAgents.length > 0) {
      // Round-robin: Get agent with least appointments
      const { data: appointmentCounts } = await supabaseAdmin
        .from("appointments")
        .select("agent_id")
        .eq("agency_id", lead.agency_id)
        .eq("status", "scheduled")
        .in(
          "agent_id",
          availableAgents.map((a) => a.id)
        );

      // Count appointments per agent
      const counts: Record<string, number> = {};
      availableAgents.forEach((agent) => {
        counts[agent.id] = 0;
      });

      appointmentCounts?.forEach((apt) => {
        if (apt.agent_id) {
          counts[apt.agent_id] = (counts[apt.agent_id] || 0) + 1;
        }
      });

      // Get agent with least appointments
      const leastBusyAgent = availableAgents.reduce((prev, curr) => {
        return (counts[curr.id] || 0) < (counts[prev.id] || 0) ? curr : prev;
      });

      console.log(`✅ Assigned agent ${leastBusyAgent.name} by availability (round-robin)`);
      return leastBusyAgent.id;
    }

    // 5. Fallback: Round-robin all agents
    const { data: appointmentCounts } = await supabaseAdmin
      .from("appointments")
      .select("agent_id")
      .eq("agency_id", lead.agency_id)
      .eq("status", "scheduled")
      .in(
        "agent_id",
        agents.map((a) => a.id)
      );

    const counts: Record<string, number> = {};
    agents.forEach((agent) => {
      counts[agent.id] = 0;
    });

    appointmentCounts?.forEach((apt) => {
      if (apt.agent_id) {
        counts[apt.agent_id] = (counts[apt.agent_id] || 0) + 1;
      }
    });

    const leastBusyAgent = agents.reduce((prev, curr) => {
      return (counts[curr.id] || 0) < (counts[prev.id] || 0) ? curr : prev;
    });

    console.log(`✅ Assigned agent ${leastBusyAgent.name} by round-robin`);
    return leastBusyAgent.id;
  } catch (error: any) {
    console.error("❌ Error assigning agent:", error);
    return null;
  }
}


