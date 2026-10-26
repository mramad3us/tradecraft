# Playtests

What was played, how, what turned up and what was done about it: a dated log, newest first. Claude plays as the player while the user's away (scripted followers driving the real game in headless Chrome, and the sim at speed for the numbers); the user's own scores and notes go here too when they come.

How to play a test the same way: `node tests/run.mjs tail` (the bots, `tests/bots.mjs`; `TAIL_N=100` for 100 evenings), or in the browser, the dev server and `window.__tradecraft` (`?play=tail&seed=7`).

## 2026-10-26, v0.0.24: being tailed

**Played:** about 200 evenings at speed with three scripted players (oblivious, checker, pro), and a handful in the browser (an overt pair called off; a covert team that went unnoticed and burned him on the bench).

**Found and fixed:**
- The watchers started too far back and lost a walker in the first minute at night: they now start just off screen, keep closer in the dark, close in when they've lost sight, and keep their eyes on you whichever way they walk.
- They queued politely behind every slow walker and fell 40 m back. In a hurry, they now go round.
- Standing by the bench, you "recognised" the same sitters again and again: five false tails a run. A face now counts again only when both of you have moved on.
- The scripted players stalled at a waypoint they were told to reach within 0.4 m but stopped within 0.6 m, and walked the south walk into lamp posts. Waypoints now come along each zone's walking line.
- Pressing T while sitting with SOLOVEY sat you down again, and again.

**Still rough:**
- A covert team is hard to spot (on purpose). Since v0.0.25 a check that catches a face behind you going your way says so, which gives you something to watch for.
- No metro, cabs or trains yet: the lanes are the only way to lose them.
- The watchers walk through the boulevard's lawns where the railings let them, and cross the road anywhere; they don't care about being seen, which is right for the overt pair and wrong for the covert team.

## 2026-10-26, v0.0.21 to v0.0.23: perception, the tail rebuilt, the four sides

**Played:** the free walk by day, at dusk and at night; up side streets and alleys to the streets north and back; through parks and across the boulevard's far road; the tail on every kind of evening (dusk, night, the lunchtime crowd, wary), with naive, careful and trained followers, about 400 evenings at speed and a dozen in the browser with pictures.

**Found and fixed:**
- The first dimmed view drew a black street. The view's own clear() shadowed the line-of-sight test of the same name, and freed every section each frame.
- At night the eye reached 12–18 m, too short for a lit city street: the followers never saw him at all between the lamps. Reach is now 18 m + 34 m × the light (22 m in the dark, 34 m into a lamp's pool, 50 m by day).
- A shop window's glass showed a 60° slice behind you, which missed the pavement you stand on. It's now the whole street behind (170°).
- Keeping him was a Tracking roll every 4 s beyond 22 m, so a natural 1 lost him every minute or so in an empty street. It's now rolled only with people round him, the moment you'd really lose him.
- Tying a shoelace in the middle of his look was rewarded. Starting cover as he looks is now worse than nothing, and the instinct stops offering it once he's looking.
- The instinct flicked between two calm lines every few seconds. Lines now hold by tone (calm 7 s … urgent 2 s).
- The lookalikes appeared out of thin air beside you; they now come from off screen or out of a shop you can't see. They were also too many (more than one mix-up a run); now it's about one run in three.
- He walked up a side street into its bin and stood there for a minute. He now walks the pavement clear of its furniture.
- The instinct knew which lane he'd turned up even when you hadn't seen him turn, and said "he's in a shop" when you hadn't. It now knows what you saw.
- Leaving the street without him ended the evening as an unexplained "lost". It now says you went the wrong way.
- A statue in a park crashed the page (a sprite handed over the wrong way); the lane through the hedge was painted under the grass.
- The scripted followers had no feet: they walked into railings, lamp posts and parked cars and stood there. They now go round by the crossings and sidestep, so their numbers measure the game, not their own stupidity.

**Numbers now** (100 evenings): a naive tail (10 m behind, his pavement) is made 79–91 times. A careful one (the other pavement, 20 m back) sees the meeting 47–52 times; a trained one (careful, and doing what the instinct offers) 53–63. He turns up a lane in two evenings out of three, and the followers go after him most of the time. Lunch in broad daylight is the hardest evening (about 4 in 10 seen), dusk and night the easiest (6–7 in 10).

**Still rough:**
- He only ever turns off north. The lanes south (down from the far pavement) are walked by passers-by, not by him.
- Shops, arches and courtyards aren't enterable, for you; he goes into shops.
- No traffic on the roads, so crossing anywhere is safe (if conspicuous: +2 to his roll).
- The far pavement south of the boulevard is quieter than the north one: fewer people to hide among.
- The meeting is always on a boulevard bench, and the contact always comes from the east.
- The free walk's lessons repeat after a while.
