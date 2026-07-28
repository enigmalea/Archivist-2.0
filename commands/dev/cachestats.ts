import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { devOnlyError, isDevUser } from "../../utils/devUsers.ts";

export const data = new SlashCommandBuilder()
  .setName("cachestats")
  .setDescription("[Dev] Shows AO3 cache hit/request/error stats across all shards.");

// Shape returned by client.getCacheStatsByType() on each shard.
type StatsByType = Record<string, { cacheHits: number; ao3Requests: number; errors: number }>;

// Sums a single field of StatsByType across every shard's result and every
// resource type within it, e.g. sumField(perShard, "cacheHits").
function sumField(perShard: StatsByType[], field: "cacheHits" | "ao3Requests" | "errors"): number {
  let total = 0;
  for (const shardStats of perShard) {
    for (const typeStats of Object.values(shardStats)) {
      total += typeStats[field];
    }
  }
  return total;
}

// Merges the per-resource-type breakdown across all shards into one map,
// e.g. { work: { cacheHits, ao3Requests, errors }, series: {...}, ... }.
function mergeByType(perShard: StatsByType[]): StatsByType {
  const merged: StatsByType = {};

  for (const shardStats of perShard) {
    for (const [type, typeStats] of Object.entries(shardStats)) {
      if (!merged[type]) {
        merged[type] = { cacheHits: 0, ao3Requests: 0, errors: 0 };
      }
      merged[type].cacheHits += typeStats.cacheHits;
      merged[type].ao3Requests += typeStats.ao3Requests;
      merged[type].errors += typeStats.errors;
    }
  }

  return merged;
}

export const execute = async (interaction: ChatInputCommandInteraction) => {
  if (!isDevUser(interaction.user.id)) {
    await interaction.reply(devOnlyError);
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const perShard = (await interaction.client.shard!.broadcastEval(
    (c) => (c as any).getCacheStatsByType(),
  )) as StatsByType[];

  const merged = mergeByType(perShard);
  const totalCacheHits = sumField(perShard, "cacheHits");
  const totalAo3Requests = sumField(perShard, "ao3Requests");
  const totalErrors = sumField(perShard, "errors");
  const totalLookups = totalCacheHits + totalAo3Requests;
  const hitRate = totalLookups > 0 ? ((totalCacheHits / totalLookups) * 100).toFixed(1) : "0.0";

  const breakdown = Object.entries(merged)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([type, s]) =>
        `**${type}** — hits: ${s.cacheHits} · AO3 requests: ${s.ao3Requests} · errors: ${s.errors}`,
    )
    .join("\n") || "*No cache activity recorded yet.*";

  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle("Cache Stats (all shards)")
    .addFields(
      { name: "Cache Hits", value: `${totalCacheHits}`, inline: true },
      { name: "AO3 Requests", value: `${totalAo3Requests}`, inline: true },
      { name: "Errors", value: `${totalErrors}`, inline: true },
      { name: "Hit Rate", value: `${hitRate}%`, inline: true },
    )
    .addFields({ name: "By Type", value: breakdown })
    .setTimestamp()
    .setFooter({ text: "Since last restart — stats are in-memory, not persisted." });

  await interaction.editReply({ embeds: [embed] });
};