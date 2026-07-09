import { gotScraping } from "got-scraping";

const BASE_URL = "https://api.sofascore.com/api/v1";

async function sofascoreGet(path) {
  const res = await gotScraping(`${BASE_URL}${path}`, {
    responseType: "json",
    throwHttpErrors: false,
  });
  if (res.statusCode >= 400) {
    throw new Error(`SofaScore ${path} respondio ${res.statusCode}`);
  }
  return res.body;
}

// fractionalValue viene como "73/100" -> cuota decimal 1.73
function fractionalToDecimal(fractionalValue) {
  const [num, den] = fractionalValue.split("/").map(Number);
  return Number((num / den + 1).toFixed(2));
}

function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export async function searchEvent(query) {
  const data = await sofascoreGet(`/search/all?q=${encodeURIComponent(query)}`);
  const tokens = normalize(query).split(/\s+/).filter(Boolean);

  const candidates = data.results
    .filter((r) => r.type === "event")
    .filter((r) => {
      const name = normalize(r.entity.name);
      return tokens.every((t) => name.includes(t));
    });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aUpcoming = a.entity.status.type === "notstarted";
    const bUpcoming = b.entity.status.type === "notstarted";
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming
      ? a.entity.startTimestamp - b.entity.startTimestamp
      : b.entity.startTimestamp - a.entity.startTimestamp;
  });

  const best = candidates[0];
  return {
    id: best.entity.id,
    name: best.entity.name,
    tournament: best.entity.tournament?.name ?? null,
    status: best.entity.status.type,
    startTime: best.entity.startTimestamp,
    alternativesCount: candidates.length - 1,
  };
}

export async function searchTeam(query) {
  const data = await sofascoreGet(`/search/all?q=${encodeURIComponent(query)}`);
  const team = data.results.find((r) => r.type === "team");
  if (!team) return null;
  return {
    id: team.entity.id,
    name: team.entity.name,
    national: team.entity.national ?? false,
  };
}

function mapEvent(e) {
  return {
    eventId: e.id,
    homeTeam: e.homeTeam.name,
    homeTeamId: e.homeTeam.id,
    awayTeam: e.awayTeam.name,
    awayTeamId: e.awayTeam.id,
    tournament: e.tournament?.name ?? null,
    startTime: e.startTimestamp,
    status: e.status.type,
    scoreHome: e.homeScore?.current ?? null,
    scoreAway: e.awayScore?.current ?? null,
  };
}

export async function getTeamEvents(teamId) {
  const [next, last] = await Promise.all([
    sofascoreGet(`/team/${teamId}/events/next/0`).catch(() => ({ events: [] })),
    sofascoreGet(`/team/${teamId}/events/last/0`).catch(() => ({ events: [] })),
  ]);
  const upcoming = next.events.map(mapEvent).sort((a, b) => a.startTime - b.startTime);
  const recent = last.events.map(mapEvent).sort((a, b) => b.startTime - a.startTime);
  return { upcoming, recent };
}

export async function attachOdds(matches) {
  return Promise.all(
    matches.map(async (m) => {
      const odds = await getEventOdds(m.eventId).catch(() => null);
      return { ...m, ...odds };
    })
  );
}

export async function getEventInfo(eventId) {
  const data = await sofascoreGet(`/event/${eventId}`);
  const e = data.event;
  return {
    eventId: e.id,
    homeTeam: e.homeTeam.name,
    homeTeamId: e.homeTeam.id,
    awayTeam: e.awayTeam.name,
    awayTeamId: e.awayTeam.id,
    tournament: e.tournament?.name ?? null,
    startTime: e.startTimestamp,
    status: e.status.type,
    scoreHome: e.homeScore?.current ?? null,
    scoreAway: e.awayScore?.current ?? null,
  };
}

export async function getEventOdds(eventId) {
  const data = await sofascoreGet(`/event/${eventId}/odds/1/featured`);
  const market = data.featured?.default;
  if (!market || market.marketGroup !== "1X2") return null;
  const odds = {};
  const change = {};
  for (const choice of market.choices) {
    odds[choice.name] = fractionalToDecimal(choice.fractionalValue);
    change[choice.name] = choice.change ?? 0;
  }
  return {
    oddsHome: odds["1"] ?? null,
    oddsDraw: odds["X"] ?? null,
    oddsAway: odds["2"] ?? null,
    oddsHomeChange: change["1"] ?? 0,
    oddsDrawChange: change["X"] ?? 0,
    oddsAwayChange: change["2"] ?? 0,
    isLive: market.isLive,
    suspended: market.suspended,
  };
}
