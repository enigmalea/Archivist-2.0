import Bottleneck from "bottleneck";

// Shared AO3 rate limiter, used bot-wide.
export const ao3Limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2500,
  reservoir: 20,
  reservoirRefreshAmount: 20,
  reservoirRefreshInterval: 60 * 1000,
});
