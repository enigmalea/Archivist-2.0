import type { Client, EmbedBuilder } from "discord.js";

import { ao3Embed } from "./baseEmbed.ts";
import { getGuildsWithOutageAlertsEnabled } from "./settings.ts";

// AO3 outage monitor — polls otwstatus.org's public Statuspage API.
const INCIDENTS_API_URL = "https://www.otwstatus.org/api/v2/incidents.json";
const COMPONENTS_API_URL = "https://www.otwstatus.org/api/v2/components.json";
const AO3_COMPONENT_NAME = "Archive of Our Own";
const POLL_INTERVAL_MS = 2 * 60 * 1000;

const GENERIC_STATUS_LABELS: Record<string, string> = {
  operational: "Operational",
  degraded_performance: "Degraded Performance",
  partial_outage: "Partial Outage",
  major_outage: "Major Outage",
  under_maintenance: "Under Maintenance",
};

const GENERIC_STATUS_COLORS: Record<string, number> = {
  operational: 0x2ecc71,
  degraded_performance: 0xf1c40f,
  partial_outage: 0xe67e22,
  major_outage: 0xe74c3c,
  under_maintenance: 0x3498db,
};

const UPDATE_STATUS_LABELS: Record<string, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  postmortem: "Postmortem",
};

const UPDATE_STATUS_COLORS: Record<string, number> = {
  investigating: 0xe74c3c,
  identified: 0xe67e22,
  monitoring: 0xf1c40f,
  resolved: 0x2ecc71,
  postmortem: 0x3498db,
};

interface AffectedComponent {
  name: string;
}

interface IncidentUpdate {
  id: string;
  status: string;
  body: string;
  affected_components?: AffectedComponent[];
}

interface Incident {
  id: string;
  name: string;
  shortlink: string;
  components: AffectedComponent[];
  incident_updates: IncidentUpdate[];
}

async function fetchAo3Incidents(): Promise<Incident[] | null> {
  try {
    const response = await fetch(INCIDENTS_API_URL);
    if (!response.ok) return null;
    const data = (await response.json()) as { incidents: Incident[] };
    return data.incidents.filter((incident) =>
      incident.components.some((component) => component.name === AO3_COMPONENT_NAME),
    );
  } catch (error) {
    console.error("Failed to fetch AO3 incidents from otwstatus.org", error);
    return null;
  }
}

function buildIncidentUpdateEmbed(incident: Incident, update: IncidentUpdate): EmbedBuilder {
  const label = UPDATE_STATUS_LABELS[update.status] ?? update.status;
  const color = UPDATE_STATUS_COLORS[update.status] ?? 0x2f3136;
  const isResolved = update.status === "resolved";

  return ao3Embed(color)
    .setTitle(`${isResolved ? "✅" : "⚠️"} ${incident.name} — ${label}`)
    .setURL(incident.shortlink)
    .setDescription(update.body);
}

async function fetchAo3ComponentStatus(): Promise<string | null> {
  try {
    const response = await fetch(COMPONENTS_API_URL);
    if (!response.ok) return null;
    const data = (await response.json()) as { components: { name: string; status: string }[] };
    return data.components.find((component) => component.name === AO3_COMPONENT_NAME)?.status ?? null;
  } catch (error) {
    console.error("Failed to fetch AO3 component status from otwstatus.org", error);
    return null;
  }
}

// Fallback notice for a status change with no published incident.
function buildGenericStatusEmbed(status: string): EmbedBuilder {
  const label = GENERIC_STATUS_LABELS[status] ?? status;
  const color = GENERIC_STATUS_COLORS[status] ?? 0x2f3136;
  const isRecovered = status === "operational";

  return ao3Embed(color)
    .setTitle(isRecovered ? "✅ AO3 is back to normal" : `⚠️ AO3 status: ${label}`)
    .setURL("https://www.otwstatus.org/")
    .setDescription(
      (isRecovered
        ? "Archive of Our Own's status has returned to **Operational**."
        : `Archive of Our Own's status changed to **${label}**.`) +
        "\n\n*No incident was published for this change — this is a fallback notice.*",
    );
}

// Already-posted incident update IDs, per incident.
const postedUpdateIds = new Map<string, Set<string>>();
let lastKnownComponentStatus: string | null = null;
let hasSeededInitialState = false;

async function pollAndNotify(client: Client): Promise<void> {
  const [incidents, componentStatus] = await Promise.all([fetchAo3Incidents(), fetchAo3ComponentStatus()]);
  if (!incidents || !componentStatus) return;

  if (!hasSeededInitialState) {
    for (const incident of incidents) {
      postedUpdateIds.set(incident.id, new Set(incident.incident_updates.map((update) => update.id)));
    }
    lastKnownComponentStatus = componentStatus;
    hasSeededInitialState = true;
    return;
  }

  const newUpdates: { incident: Incident; update: IncidentUpdate }[] = [];

  for (const incident of incidents) {
    const seen = postedUpdateIds.get(incident.id) ?? new Set<string>();
    // Post oldest-to-newest.
    for (const update of [...incident.incident_updates].reverse()) {
      if (seen.has(update.id)) continue;
      seen.add(update.id);
      newUpdates.push({ incident, update });
    }
    postedUpdateIds.set(incident.id, seen);
  }

  // Status changed but no incident update covers it — use the fallback.
  const statusChangedWithoutIncident = componentStatus !== lastKnownComponentStatus && newUpdates.length === 0;
  const genericStatus = componentStatus;
  lastKnownComponentStatus = componentStatus;

  if (newUpdates.length === 0 && !statusChangedWithoutIncident) return;

  const targets = await getGuildsWithOutageAlertsEnabled();
  if (targets.length === 0) return;

  const embedsToSend: EmbedBuilder[] = newUpdates.map(({ incident, update }) => {
    console.log(`AO3 incident update: "${incident.name}" -> ${update.status}`);
    return buildIncidentUpdateEmbed(incident, update);
  });

  if (statusChangedWithoutIncident) {
    console.log(`AO3 status changed with no incident published: -> ${genericStatus}`);
    embedsToSend.push(buildGenericStatusEmbed(genericStatus));
  }

  for (const embed of embedsToSend) {
    for (const { guildId, channelId } of targets) {
      // Skip guilds this shard doesn't own.
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) continue;

      await channel.send({ embeds: [embed] }).catch((error) => {
        console.error(`Failed to send outage alert to guild ${guildId} channel ${channelId}`, error);
      });
    }
  }
}

export function startOutageMonitor(client: Client): void {
  pollAndNotify(client).catch((error) => console.error("Initial outage status poll failed", error));
  setInterval(() => {
    pollAndNotify(client).catch((error) => console.error("Outage status poll failed", error));
  }, POLL_INTERVAL_MS);
}
