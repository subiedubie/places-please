# Side games (events) and rewards — shared spec (16 Nov. 2026)

Two developers work from this at once: logic (meta/) and screens (ui/). The owner's design, with every rule and the reasons, is in the owner's private design document (kept outside this repository), sections 5, 6 (all of 6.0–6.6) and 14: READ IT (read-only; never copy it into this public repo). This file fixes only the interface between logic and screens.

## Principles (from the owner)
- This is the heart of the game: about nine things running at once on the home screen, a new one appearing when one ends.
- Rivals and teammates are computer players. Each one's whole score schedule is fixed from a seed the moment an event starts, as a function of time, and NEVER reacts to how the player is doing. One visible setting (`save.settings.rivals`: 'relaxed' | 'even' | 'tough') picks the pace table. Nothing hidden.
- The player wins about 20 levels on a weekday and about 50 a day at weekends; size every target and pace from that (config).
- A reward is never applied silently: it goes to a tray; the player claims it or leaves it. Timed rewards ("30 minutes of free starting power-ups") can be banked up to 24 hours; their clock starts when activated; unclaimed ones expire after 24 hours. No lives exist; "unlimited lives" style rewards become timed free starting power-ups.
- Everything tunable is in config files with plain comments. All names shown come from config (theatre theme, DESIGN §14). No Royal Match names.
- All time comes from a `now` argument (milliseconds), never `Date.now()` inside logic, so tests can move the clock. Weeks run Monday–Thursday and Friday–Sunday in local time.

## Interface the screens use

```
session.events.list(now)        -> EventView[]   every event to show on Home, soonest-ending first
session.events.detail(id, now)  -> EventView     the same event with full rows
session.events.start(id, now)   -> void          for events in state 'offer' (sprint, first-to-finish, bracket)
session.rewards.tray(now)       -> RewardItem[]  unclaimed rewards
session.rewards.claim(id, now)  -> void          applies it (coins, boosters, card packs, or starts a timed boost)
session.rewards.active(now)     -> ActiveBoost[] timed boosts running now
session.album(now)              -> AlbumView
session.finish() / quit()       -> also return  eventLines: [{ title, text }]  (what this level added to each event)
                                    and           newRewards: RewardItem[]     (rewards just put in the tray)
```

```
EventView = {
  id, type,                 // type: 'race' | 'dash' | 'sprint' | 'streak' | 'ladder' | 'quota' | 'bracket' | 'season' | 'company' | 'missions' | 'chest'
  title, blurb,             // from config
  endsAt,                   // ms, or null
  state,                    // 'offer' | 'running' | 'won' | 'lost' | 'over'
  summary,                  // one short line for the Home list, e.g. "12th of 50", "4/7", "step 6/25"
  progress: { have, need } | null,
  rows:   [{ name, score, you, place, prize }] | null,    // leaderboards (race, dash, sprint, bracket round, company members)
  steps:  [{ need, reward, done, current }] | null,        // ladder, quota, season, missions
  lanes:  [{ name, have, need, you }] | null,              // staged streak race
  chests: [{ at, reward, open }] | null, total: { have, need } | null,   // company (shared pot)
  prizes: [{ place, reward }] | null,
}
Reward     = { coins?: number, boosters?: { [kind]: count }, packs?: number, boost?: { powers: [kind...], minutes } }
RewardItem = { id, title, from, reward: Reward, expiresAt }      // from = the event's title
ActiveBoost = { powers: [kind...], endsAt }
AlbumView  = { month, sets: [{ name, cards: [{ name, stars, owned }], done, reward }], owned, total, grandPrize, endsAt }
```

Booster kinds in rewards: `'spot'`, `'show'`, `'prism'` (pre-level: start with a Missile / Grenade / Magic Ball) and `'drill'`, `'stageleft'`, `'trapdoor'`, `'coinflip'` (in-level). They are counted in `save.inventory`. A running timed boost adds its `powers` to the start of every level (on top of the streak gift).
