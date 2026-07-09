import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  searchTeam,
  getTeamEvents,
  getEventInfo,
  getEventOdds,
  attachOdds,
} from "./sofascore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5055;
const MAX_ODDS_BATCH = 15;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/team-overview", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Falta el parametro q" });
  try {
    const team = await searchTeam(q);
    if (!team) return res.json({ team: null });

    const { upcoming, recent } = await getTeamEvents(team.id);
    const isLive = (m) => m.status === "inprogress";

    const live = upcoming.filter(isLive);
    const upcomingRest = upcoming.filter((m) => !isLive(m));
    const nextMatch = upcomingRest[0] ?? null;

    const [liveWithOdds, nextMatchWithOdds] = await Promise.all([
      attachOdds(live),
      nextMatch ? attachOdds([nextMatch]) : [],
    ]);

    res.json({
      team,
      live: liveWithOdds,
      nextMatch: nextMatchWithOdds[0] ?? null,
      upcoming: upcomingRest.slice(1),
      recentTotal: recent.length,
      recent,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/odds-batch", async (req, res) => {
  const eventIds = Array.isArray(req.body?.eventIds) ? req.body.eventIds.slice(0, MAX_ODDS_BATCH) : [];
  try {
    const results = await Promise.all(
      eventIds.map(async (id) => [id, await getEventOdds(id).catch(() => null)])
    );
    res.json(Object.fromEntries(results));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/match/:eventId", async (req, res) => {
  const eventId = Number(req.params.eventId);
  try {
    const [info, odds] = await Promise.all([
      getEventInfo(eventId),
      getEventOdds(eventId).catch(() => null),
    ]);
    res.json({ ...info, ...odds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Vista disponible en http://localhost:${PORT}`);
});
