# Design

The game as settled with the user, through the design debrief (round 1, Q1–Q101, and round 2, Q102–Q162, 2026-10-26: https://claude.ai/artifact/F3YQnnfxy2WcybuczDZJDY). Everything here is decided unless marked **my call**: details I settled after round 2 to close holes it left, which stand until the user says otherwise. What's still open is under Open questions. Question numbers point back to the debrief.

## Pitch

A spy game. Single player, present day, one character controlled: a spook, an intelligence officer. Not the analyst, not the special forces, though we work with both. The player is always in the field collecting intelligence, and the shape of the work changes with rank: from a recruit doing counter-intelligence legwork at home to an illegal living for decades as a citizen of the target country.

- **Tone.** Grounded and procedural (le Carré, Le Bureau des Légendes, The Americans). The character is squishy, counter-intelligence is unforgiving, and tradecraft is what keeps a spook from getting burned. Mistakes carry a real price. The humour is in the words: dry, dark, situational, Slow Horses-like dialogue and internal monologue.
- **The feeling.** After a good session the player doesn't want to stop: there is always another step, another assignment, another hill to climb.
- **Touchstones.**
  - *Papers, Please*: the cold, half-serious tone, and the papers themselves: sheets you move about, read and file.
  - *Stoneshard*: the art and animation style, if possible (see Look).
  - *Heat Signature*: one character at a time, and another when they're lost.
- **Never.** A shooter (though there is combat) or a hero story. Ethics take a back seat to the mission and to survival. You can fight and kill with almost anything, but being burned is a nightmare, and security forces are overwhelming.

## Pillars

1. **Tradecraft decides.** Success rests on the character's skill more than the player's reflexes. The player's craft is choosing what to try, where and when: each task has a few approaches and some puzzle in it, and the dice settle the execution.
2. **Mistakes cost.** No karma, no good/bad score: only efficiency and consequences. A lie that's caught costs a person's trust; a careless meeting raises the heat; a lost character stays lost.
3. **Always another step.** A direct task, longer goals behind it, several assignments in parallel. The loop must never leave the player with nothing worth doing.
4. **Text carries it.** Dialogue, monologue, briefs, chat apps, the log of rolls. Medium reading, abundant flavour.
5. **Generated, but it should feel authored.** Geopolitics produces postings, postings produce assignments, and assignments produce places and people. Characters who matter persist; the rest are throwaway.

The user's worries are the guardrails: **clunky mechanics, an inconsistent experience, empty gameplay**. So:
- Every mechanic feeds the loop.
- Every number means the same thing everywhere: one shared helper per quantity, as in longhaul.
- Each mechanic is built first as a playable test the user scores, before the mechanics are joined (Q161; see Road to 0.1.0).

## The player's loop

- **Seconds (a map).** Walk; run (which draws attention). Watch people, follow them, notice who's following you, blend in, talk (choose an approach, roll a check), hand over or pick up, hide when the instinct says so, fight when it comes to that.
- **Hours (a day).** A schedule: the cover job, meetings, training, errands. Travel jumps from place to place with a flavoured transition. Actions that take time (sleep, read a brief, work out, do the cover job, wait in a café) jump the clock. An active day takes **20–40 real minutes** (Q105).
- **Days to weeks (an assignment).** Investigate until you know who or what holds the intelligence, get access (approach people, collect hooks, recruit), obtain it, and get out clean. Most assignments have deadlines.
- **Months to years (a posting), in chapters** (Q104). A posting is a country, a city, a goal (intelligence on a subject), a legend and a role to play, a handful of assets, persistent people, safe houses, and the heat. It is played in **chapters**: the key days are played in full, and the stretches between them are summarised.
  - **My call:** a day is key when something on it needs the player: a meeting, a deadline, a briefing, an event, a summons. The player can also choose to play any day.
  - **My call:** a summary is a paper on the desk, with what the days brought: the cover job done, pay, needs, gauges drifting, heat cooling, small events. Before it the player sets how the time is spent: train, work the cover, lie low, see people, rest. So a quiet stretch is a choice, not a wait.
- **A career.** Tradecraft grows, and harder kinds of posting open. It ends in retirement, or in injury, death, capture, firing, or being burned beyond repair.

## World and setting

- Present day: smartphones, CCTV, social media. Chat apps (fictional versions of real ones) carry a lot of the communication and the gameplay. They carry the cover life and other people's lives, read through SIGINT and OSINT, never the spy work itself (Q157). Hacking exists, but HUMINT stays the main source.
- Eventually a dozen cities with dozens of locations each. We start in **Moscow**, as the **CIA**. The agency is one of many to come, so agencies are data.
- The opposition: foreign intelligence services, terrorist networks, organised crime.
- No home city. There is the agency and its building, and safe houses everywhere (each can be burned). Postings move the player between countries.
- **The world moves.** A simple, balanced backbone of geopolitics gives interests, and interests give postings and assignments.
  - What we bring in changes it. The agency's knowledge of a subject grows with our intelligence. Enough of it turns into events (sanctions, arrests, an expulsion, a raid by allied special forces), which shift tensions and create new subjects and assignments (Q102).
  - The player sees the world move in the news (papers, TV, chat apps) and in briefings at the agency or the station (Q103).
- **Languages.** An illegal is native in the language of the country they're posted to: no accent, nothing (the user, 2026-10-26). Text in a language the character doesn't know is undecipherable: it shows in its script, Cyrillic in Moscow. Five levels per language: none, basic, working, fluent, native. Between the levels, some words come through (Q120). Translation apps work on written text; support teams and real-time translation tech can handle speech and recordings.

## Career: ranks and classes

One ladder, leading to the illegal. Risk rises with rank. A rank is less a title than a fact: whether you've taken and completed enough assignments of that kind. The early ranks come mostly from Tradecraft level, the later ones from completed assignments. The player can refuse an assignment of the next kind, illegal postings included. There are no technical or support careers.

| Rank | Where | The work |
|---|---|---|
| Recruit | Home country | Counter-intelligence support, almost never alone (a member of a team tailing a target, without knowing why), lots of training in the schedule, no agents. |
| Officer | Home country | Counter-intelligence with your own cases; the first sources. |
| Handler | Abroad, official cover (an embassy job) | Runs a network of agents. Diplomatic immunity: if caught, expelled rather than jailed. |
| Undercover | Abroad, under a legend (e.g. a translator at a news agency) | Runs the work from inside a fake life. No immunity. The cover job matters, and losing it fails the posting. |
| Illegal | Abroad, as a citizen of the target country | A legally earned identity, never an obviously spooky post. Years to decades. Few contacts with a handler (a retired illegal, deep undercover too). Uses their own analysis to find their own assignments. |

"Agent" was the user's first name for the second rank. It became Officer because agents are the people we recruit (Q109).

- **Failure.** Bad reviews pile up and lead to a desk job or firing. A high rank can be knocked down a rank and lose access to that kind of posting for a while. A Handler caught under official cover is expelled (persona non grata), and the asset pays the price. The posting ends and the career goes on elsewhere, burned for that country; it hurts the career, possibly costing a rank (Q131). The player as a double agent is a later major update.
- **A good review** weighs the intelligence brought in against what was expected, the exposure caused, the cover kept, the assets kept safe, the time taken, and the collateral (police, injuries, deaths) (Q107).
- **Classes.** Only spooks are playable. Every class has an **over-skill**, 0 to 100, which multiplies the skills that matter to the class. Civilians have none, so their skills sit much lower.

| Class | Over-skill | Top tier |
|---|---|---|
| Spooks | **Tradecraft** | The illegal: fights at tier-2-operator level. |
| Soldiers | **Warfighting** | The tier 1 operator, who still most likely kills an illegal in a straight fight. |
| Cops (police, investigators) | **Intuition** | The special agent (Q112). |
| Criminals (organised crime) | **Streetwise** | The *vor v zakone*, the thief-in-law. |

## Postings, assignments and the day

- **Work.** Procedural, out of the geopolitics. Each posting is a long-running mission to get intelligence on a subject. Within it run several assignments, each with a direct task and longer goals; this gets more entangled with rank.
- **Tasking.** It depends on the posting.
  - Counter-intelligence postings get a lot of briefings at the agency.
  - Illegals hear from their handler through dead drops or, most often, direct contact.
  - Electronic communication is almost never used: in enemy territory it can be listened to all the time.
- **Failure.** At low rank a failure costs a bad review; at high rank it can mean death, or being burned. Reporting is flavour: an assignment is complete when its completion point is reached.
- **The day.** It depends on rank.
  - A recruit lives their own life at home: wakes up, takes the subway (a cutscene), swipes into the agency building, follows the day's planning (a sheet on the phone), does some spooky work or training, and goes home.
  - An undercover officer runs the same day inside a fake life. The job is the cover, lying is a skill, enough mistakes in a day can burn them, and the real work has to be stolen out of the expected one.
  - An illegal's day is the same with a deeper identity, over years.
- **The cover job.** Its duties sit in the schedule and feed a **cover standing** gauge. Neglect brings reprimands, then recall (official cover) or firing (a legend, which fails the posting) (Q140).
- **Colleagues.** Paired with other officers only on a few assignments, mostly at low rank (group surveillance, event security). No office politics, rivals or budgets at HQ.

## Time

- Real time, one second for one second. Pause any time. No speed controls; time moves through actions that take time: sleeping (an alarm on a clock or phone; usually 7–8 h, and can be disturbed), travel (much longer when flying abroad), the cover job (skips a good part of the working day), reading, training, and waiting on a bench or in a café. Longer stretches pass between chapters (above).
- A full calendar: weekdays, seasons, office hours. Some things need a time of day, others a date. Most operations are time-critical.
- Only permanent characters keep routines (a schedule, habits, relationships, a home). Everyone else is throwaway.

## Intelligence and leads

- **Intelligence** is literally "intelligence": a blue object named intelligence, never specific, so it generates easily. It is rare, found in many ways and many quantities, and finding it should feel like a "YEAH" moment. It is never wrong and never expires. If you get it, you have it; what can expire are the opportunities that lead to it. It is fungible.
- **Leads** are the specific, usable knowledge that investigation needs: this man meets that one on Thursdays at this café; she has a secret. They point to the next step, and secrets become hooks (Q106). Intelligence stays the abstract reward.
- Assignments are almost always about collecting intelligence; some only improve our position to get it later.
- Every source exists: SIGINT (phones, computers, networks; abstracted as a Tech check and time), HUMINT (conversation without them knowing they told, recruitment, coercion or blackmail, interrogation, overhearing, and more), surveillance, OSINT, physical evidence, documents. Who holds it must be found by investigation.

## Characters: skills and checks

- **Skills only.** No attributes (no STR or INT), only skills, plus the class's over-skill. A spook's skills:

  | Skill | What it's for |
  |---|---|
  | Tradecraft | The over-skill. |
  | Deception | Blending in, staying unseen, lying, being hard to remember, and the inconspicuous things that aren't drawn: a hood pulled up, a cap put on. |
  | Tracking | Finding a target and keeping them. |
  | Pathfinding | Spotting a tail and losing it. |
  | Awareness | Noticing (Q117). |
  | Social | Reading people and working them. |
  | Analysis | How smart we really are: an analyst's work. It matters most at high rank, far from the agency's support. |
  | Tech | SIGINT and devices (Q117). |
  | Medicine | Wounds and their care (Q117). |
  | CQC, Weapon handling, Fitness | Fighting, guns, and the body. |
  | Languages | Each language separate, at levels. |

  More may come and some may merge, so the list must scale.
- **A check** is a d20 plus the skill, plus modifiers, against a difficulty. A natural 1 always fails and a natural 20 always succeeds. The roll is shown in the log, with a line of flavour: *"Social check: 12 + 8 = 20, success. …"*. The modifiers:
  - the target's gauges toward us;
  - a hook spent;
  - needs;
  - the environment: night, darkness, crowds, distance (Q116). The light at a spot comes from the same helper that lights the scene, so what you see is what's rolled.
- **Contested actions are opposed rolls**, both shown in the log (Q116). The totals decide, naturals included, and **ties go to us** (my calls). If naturals won outright, every contest would fail at least one time in ten whatever the skills, and a tail is a handful of contests.

  | Situation | Our roll | Theirs |
  |---|---|---|
  | Tailing someone unseen | Deception | Pathfinding |
  | Keeping them | Tracking | Pathfinding, when they try to lose us; otherwise a difficulty from distance and crowd |
  | Spotting our own tail | Pathfinding | Deception |
  | Losing that tail | Pathfinding | Tracking |
  | Doing something covert in view (a drop, a pass, a photo, staring) | Deception | Each observer's Awareness |
  | A lie | Deception | Social (Q125) |
  | Other social approaches | Social | A difficulty, plus their gauges |
- **The scale** (Q115).
  - The trained base runs from 0 to 20: untrained 0, a course 5, advanced 10, expert 15, master 20. Practice adds 0 to 3; rust takes it back to 0.
  - The over-skill runs from 0 to 100.
  - A skill is (trained base + practice) × (1 + weight × over-skill / 100), so it can reach 46.
  - Difficulties: easy 10, average 15, hard 20, very hard 25, expert 30, elite 40.
  - A civilian sits around 0–8, an illegal's CQC near 30, enemy special forces near 40.
- **Tradecraft's weights** (Q113: Deception, Tracking and Pathfinding are more Tradecraft-heavy than Analysis and Social). **My call**, to be tuned in playtests:

  | Weight | Skills |
  |---|---|
  | 1 | Deception, Tracking, Pathfinding, Awareness |
  | 0.6 | Social, Analysis |
  | 0.5 | CQC, Weapon handling (an illegal's fighting comes mostly from training) |
  | 0 | Fitness, Languages, Tech, Medicine |

  Other classes get their own weight tables.
- **Growth.**
  - Tradecraft grows with training, with experience from spook checks (more for harder ones), and with a bonus per completed assignment (Q118).
  - Formal training happens in three places: in the schedule at low rank, in courses at HQ between postings (weeks skipped), and in cover-friendly practice abroad, like a gym, a language tutor or a boxing club (Q119).
- **Hidden traits.** Secrets, loyalties, motivation (money, ideology, coercion, ego), relationships.
- **Reading people.** People are discovered by interaction and surveillance. How much you learn is governed by your relevant skill, and Analysis speeds it up. Fighting someone reveals bounds: a karate master who beats you in a training bout shows a CQC above 20, and nothing more.
- **The player character.** Procedurally generated; hundreds of hours per character. Needs: sleep, stress, food, injury and health (below). A private life per posting, real or cover.

## People: bonds and persistence

- **Three social gauges**, each from −5 to +5, added to the relevant checks and saves:
  - **Fear:** how wary someone is of acting against us, and how they react to our hostility. A terrified civilian can be talked out of reporting something. Negative fear makes them likely to turn aggressive if they also dislike us.
  - **Trust:** how likely they are to believe us and do what we say. Suspicion is negative trust. Falling trust hurts checks with them, and makes them more likely to report us when they catch us in something illegal.
  - **Affinity:** whether they like us. People who like us are less likely to turn hostile.

  They move ±1 for a notable exchange and ±2–3 for a big moment, and drift back toward 0 over weeks without contact (Q123): **one step a week** (my call).
- **Hooks.** Surveillance surfaces secrets, and secrets become hooks: single-use, tied to one person, fungible like intelligence.
  - Spending a hook **halves the difficulty** of one check with that person that it bears on (Q122). Against an opposed roll, it halves their total.
  - A hook isn't an approach of its own: it's spent on one.
- **Conversation approaches** (Q124): charm, convince, elicit, lie, intimidate, bribe, ask a favour, reassure, threaten, pitch (recruit). Each leads to a check. Cover relationships can turn romantic, off-screen, through the gauges (Q126).
- **Persistence.** Each assignment carries its own people, and they persist with it. A posting carries its own: cover friends, a few colleagues at the cover job. Some belong to the character for life: family and friends, who matter less once an illegal disappears from their lives.

## Cover, heat and the hunt

- One legend per posting, generated from the posting.
- **What strains a cover.** Being seen in the wrong place, contradicting your story, who you're seen with, document checks.
- **Heat** is one number (Q128). It rises when the authorities learn things about us: a witness reports (a guard who saw us and got away, a crowd in a commotion), and Deception limits what they get. It falls when we lie low. The player never sees the number (Q129). The instinct's flavour text describes the signs: the same car twice, a neighbour asked questions. High skill reads them in time to get out or lie low until it cools. Low skill may be burned without noticing, until special agents knock at the door.
  - **My call:** there's one heat per legend per country, from 0 to 100. As it climbs, the other side does more: occasional surveillance (20+), then regular tails and provocations (40+), then an investigation (60+), special agents on it (80+). At 100 we're blown. Lying low cools it 2 a day, going about the cover 1 a day, never below where the cover started.
  - **My call:** official cover starts warm. The other side presumes embassy staff are spooks and tails them from time to time, so a Handler in Moscow begins with some surveillance and has to find the gaps.
- **Per-person suspicion** is that person's trust (above), separate from heat.
- **Tails are the core activity.** Tradecraft sharply raises Deception and Pathfinding, so you shake tails, and Tracking, so you keep your targets. Shaking a tail too obviously is not punished as such: part of tradecraft is knowing how to do it right, and that's the roll (Q130).
- **What's at hand is the engine's** (v0.0.36, the user: "stuff like benches offers and all these elements should not be linked to the scenario we pick in the main menu, it's a game engine thing"). Wherever you are, in any scene, the instinct's line ends with what you can do there, and T does it: look in a shop window, sit on a free seat, cross at the zebra (`src/sim/acts.js` affordance()). A scene adds its own lines, and acts of its own over the engine's (sit down with him, call it off, a shoelace as he looks); an urgent line gets no offer (as he looks, stopping is what he'd see).
- **Disguise.** Clothes and disguises matter, and clothes changes are drawn (hats, coats, glasses). Subtle things like a hood or posture are abstracted into Deception (Q156). High Tradecraft brings the **instinct**, a voice in the head that warns when to change route, step clear or buy clothes. The T key does what it says.
- **Blown.** The game switches to the **hunted** state (Q133). You get to a predefined extraction point across generated map sections, with safe houses as stops to regroup and get resources. It lasts from hours to a few days. If the stakes are high, the opposition's special forces come after you. Capture is game over.
- **Ordinary law.** Police patrol and react.
  - A stop is a scene, Papers, Please-like (Q134). They read your papers, ask questions (Deception), and may search your pockets. A hidden compartment needs a search check to be found.
  - An arrest is survivable unless it also blows the cover, which will be under scrutiny. Captured alone costs time: deadlines pass, and posting objectives can fail badly. Captured and burned is game over.

## Networks and handling

- A simplified cycle: approach, recruit, handle. Targets are posting-level characters we know can lead to intelligence. They persist at least until we have it.
- **Motives.** Money, coercion, ideology, ego, revenge, friendship or romance. Social checks and surveillance hint at what will work on someone, which improves the recruitment check.
- **Handling.** Regular meetings, payments, keeping their nerve and trust, tasking them, protecting them. Assets can lie, be doubled, or be arrested.
- **A doubled asset** stops yielding intelligence and may lead you into a trap (Q136). Intelligence is so rare that working hard to get it isn't suspicious, so a turned asset doesn't show until they betray us openly or our skills catch something off in their behaviour.
- **Covert comms.** Dead drops, brush passes, safe houses, car pick-ups, burner phones.
- A handful of agents per posting, more in the most complex postings.

## The agency, analysts and special forces

- **Services.** Analysts are the agency's workforce, a resource on call. They give us:
  - a background check on a person;
  - a translated recording;
  - an exploited device (SIGINT);
  - forged documents;
  - a surveillance team;
  - allied special forces to capture a target or rescue an agent;
  - extraction.

  Services are asked for only from secure places (the station's secure room, a safe house), never by phone. Each takes time. They cost **credits**: each operative has an allowance that refills over time, and it's larger at high rank, because a senior officer is more precious (Q137, Q138).
- **Money.** Two purses (Q139):
  - a salary;
  - an operational fund, for payments, taxis, clothes and bribes, checked at review.
- **Special forces.**
  - Allied special forces run high-risk kinetic operations for us: capturing a high-value target we identified, freeing a captured agent, and, rarely, pulling us out if we're captured before we're burned. The player meets them only at a black site, before interrogating a target they caught.
  - Enemy special forces are the bogeyman. A squad that makes contact means almost certain death: their CQC and weapon handling are near the maximum. The goal is to evade them.

## Moment to moment

- **Movement.** Walk; Shift to run, which draws attention. No sneaking; Deception covers it. No driving: a car is fast travel, with its tail risk (Q150).
- **F** is context-sensitive, with a drop-down menu when there are several options.
- **Talk.** Abstract, so it generates: pick an approach (above) and roll the check.
- **Perception** (the user, 2026-10-26: "a notion of where we're looking and what characters are aware of"). It replaces the first design's "no sight lines". Everyone faces a heading; we control only where we walk and where we face (looking is passive). The numbers live in `src/sim/perception.js`.
  - **What a character sees:** a cone ahead (100°, plus 2° a point of Awareness), as far as the light allows (10 m plus 42 m × the light level: 52 m by day, 30 m into a lamp's pool at night, 15 m into the dark: the night street is islands of light; v0.0.40, the user: "at night we don't get a malus to sight?", it was 22 m); on screen, what isn't seen is dimmed by day and near black at night, so the edge of sight is a shadow; all round, a radius of situational awareness (2.5 m, plus 0.2 m a point of Awareness); and, looking in a shop window, the street behind in its glass (v0.0.32, the user: "it would also not show as much as when looking directly since we act as a barrier to what's directly behind us"). The glass is a mirror: what the eyes' cone takes in of the street's reflection, through the pane and no further, out to three quarters of the range (the way there and back). Straight in, it shows the road behind; slanted along the glass (up to 60°), the pavement behind, on the side the glass runs. Straight behind, 24° wide, the reflection is your own back. You look in a window by standing at its pane (within 1.5 m) with your eyes into it, however you got there: T, or walking up to it; E held turns the eyes along it. Buildings block the line of sight (in the glass, from the street to the pane); people, cars and trees don't.
  - **On screen:** what the character isn't aware of is dimmed (darker, greyer, colder), with a dithered edge, and frozen as it was last seen: people out of sight stand where they were seen, mid-step, until that spot is looked at again, and then they've moved on or gone. A building lights up when its wall is seen. The same function draws the screen and decides the dice.
  - **Everyone else** sees by the same rules. A check against us needs us in the checker's sight. What a character has just become aware of shows over their head while we watch them (? half-noticed, ! seen us), and passers-by turn their heads to someone running past, or to someone staring at them from close by (E held, 1.5 s).
  - **Knowing what happened:** we learn of what we see. A target's look back we didn't see isn't narrated; the result paper tells it afterwards ("what you didn't see"), and the change in him may be noticed later (Awareness).
  - **Looking back** (E tapped) is an action: our eyes go over our shoulder for a second, walking on. Whoever has us in sight may notice it (our Deception against their Awareness): someone who checks behind them has something behind them.
- **No sneaking system** (noise, crouching). Sneaking assignments are played through perception, disguise and the instinct: T does what it says ("Hide now!"), whenever there's something to hide behind.
- **Advanced tradecraft** (the user, 2026-10-26), to build with test 2 (being tailed) and after: crossing streets, cabs, trains, the metro. Some techniques are evasive but conspicuous: running, jaywalking, a sudden cab, doubling back. They lose a tail and tell it you're a professional.
- **We only know what we know** (the user, 2026-10-26). What a tail writes down, what a target saw while we weren't looking, whether a meeting was watched: the character doesn't know, so the player isn't told. If we catch them at it (a roll), the line is hedged ("she may have seen you check"). A result paper says what the character knows and believes; the rest comes later, as the world tells it (a signal missed, an arrest in the papers, a car outside the building), and in full only in debug mode.
- **Skill reads the signs** (the user, 2026-10-26). An isolated, incompetent spy can be burned without noticing and arrested arriving at work; a spook with high Tradecraft sees the signs and goes dark before being burned, or notices being burned and starts the hunted mode to escape. So the signs of heat are rolled for (Pathfinding, Awareness), and a failed roll reads exactly as a month without signs: no hedging ("as far as you can tell") and no other clue to what hasn't reached the character (the user).
- **Semi-overt surveillance** (the user, 2026-10-26). In Russia the FSB follows people of interest, diplomats among them, and doesn't much hide it. Being seen to act as a professional (dry-cleaning visibly, losing them with a conspicuous move) costs cover: heat rises and the watchers take more interest. Often the right play is to look oblivious, and do the operational thing another day.
- **Observation** (central) (Q142). Hold E to watch someone.
  - Time passes, and their sheet reveals itself by checks.
  - Staring too long risks their Awareness.
  - Meetings you witness are noted by themselves.
  - P takes a photo if you carry a camera.
- **Tailing** (Q143). The target walks on and the map extends with them. Too close raises their suspicion, too far loses them. Crowds help. The instinct warns before you lose them.
- **Tailing, the test** (v0.0.21, across the city since v0.0.30, no arrow over him since v0.0.31; my calls, for the user to score). Gennady Orlov, a former GRU officer, walks to a meeting on a boulevard bench ten to twelve streets away (some 1.1–1.4 km, near 20 minutes), by a way of his own planned across the city (The background game, below), a little roundabout, much more so on a wary evening. We start on his pavement, behind his first way along it. The numbers live in `src/sim/scenarios/tail.js` and `src/sim/habits.js`. It's played through perception: we see what our character's eyes take in, and so does he.
  - **Evenings:** each run draws one: dusk (16:45), night (19:40), the lunchtime crowd (13:05), or a wary evening (17:30, dark, him jumpy: more checks, less warning).
  - **His checks** are a careful man's habits on his way (`sim/habits.js`): a look back every 55–100 m of pavement (35–65 m wary); along a row of shops, a chance of a window's glass (3 in 10; 4 in 10 wary: at the end of the pane ahead of him, his look slanted 50° back along it the way he came) or of going into one (about 1 in 8, once a walk) and coming out looking both ways; a glance both ways at a zebra (35%; 60% wary) and back along the street at a lane's mouth before he turns into it (45%; 75% wary); now and then a pause on his phone, which is no check but a test of nerve. Some 14 checks on a calm walk, 23 on a wary one (a check at every corner would be one every half-minute). Most come with a **tell** (1.6–2.6 s: he slows, drifts to the glass, glances at the kerb; 1–1.8 s when wary). If we're watching him, an Awareness roll reads it, and the instinct warns. Seen once, he **dry-cleans**: back the way he came 14–22 m, then on by a longer way round.
  - **The check is a scan:** for its length he looks a way, and the first moment we're in his sight he rolls Pathfinding against our Deception. The modifiers are our choices: distance (under 5 m +6 to him, under 10 m +3, over 15 m −2, over 25 m −4, over 35 m −6); across the road (−3); right behind him (+1); people about us (alone +2, among people −2, a crowd −4); the light where we stand (dusk −2, dark −4, a lamp's pool at night +2); running (+6); crossing away from the zebra (+2); looking back over our shoulder (+2); stopping when he stopped (+3); standing about with nothing to do (+2); looking straight at him (+2); our back to him (−1); what we were doing (a shop window −3, a bench −3, a shoelace −1, waiting to cross −1, but starting it as he looks +2); his alertness (up to +4); having seen us once (+2 within 15 m).
  - **Twice and you're made.** A near thing raises his **alertness** (0–100), which brings his checks closer together.
  - **Cover (T):** the instinct offers what fits where we stand: look in a shop window (its glass shows the street behind us; to keep him in it, slant your eyes along it his way: T puts you at the end of the pane away from him), sit on a bench, tie a shoelace (not twice in 40 s), cross at the zebra.
  - **Pace:** he walks at 1.2–1.4 m/s; we walk at 1.45, stroll at 0.95 (Alt held), run at 3.6.
  - **No arrow over him** (the user): a marker shows him for his first 30 s out of the door, then the instinct says it's our eyes from here. A **close look** (E held, eyes on a grey coat for 2 s, within 24 m) rolls Awareness (against distance, the crowd round them, the light) and tells him from a twin: "That's him: the fedora, the briefcase", "Not him: a cap, not a fedora", or "From here, it could be anyone's". Found again by the dice, the instinct says where ("by the shops, a way off, to your left").
  - **Keeping him:** whom we take for him (the character's belief, which the instinct speaks from) (hollow when he's out of sight, where we last saw him). Beyond 22 m with people round him, Tracking every 6 s keeps him. A few men in grey coats and hats walk the street, most overtaking him on his pavement; when one passes close by him, Tracking (−3) keeps our eyes on the right one. Failing, we follow the wrong man until we're within 9 m (5.4 m in the dark) and see it. Lost, Awareness finds him among the grey coats in view, nearest first, and the wrong one may pass. Not seen for 90 s, he's gone.
  - **The instinct** speaks all the time, the voice of training, with dry humour now and then (the user): the gap and its trend, his tells and checks, the light, the crowd, crossing, where to stand. Its border shows how pressing it is.
  - **Its rules** (v0.0.46, the user: "we need a serious instinct overhaul, it is mostly useless, giving advice that doesn't even apply to some situations"; `src/sim/instinct.js`): a scene's instinct is a list of rules, each yielding its line when it applies; all are tested every tick, and the line shown stays while its rule still fires and nothing more pressing does, and goes the moment it stops applying (it used to hold up to 7 s regardless). Rules for the street (the other pavement, a crossing, the street emptied) fire on the street, not in a lane: a lane has its own (narrow, empty: let him clear the far end). A zebra is near only from the street it crosses, never from up a lane. Lost, or out of sight, it says nothing about a gap it can't know. Where nothing else applies, it says how things stand: the gap in metres, closing, steady or opening, and how many people are between you. The free walk's instinct names the place and the way (a lane and where it goes, a zebra, a window, a bench) or says nothing; its rotating lessons are gone, as are being tailed's.
  - **Through the lanes:** his way goes street to street by the side streets and alleys, north or south. Seen going into one, the instinct names it; follow him through, or he's lost. Inside, the lane is narrow and empty: give him the corner. Through it, he's ahead of you by what he's walked since.
  - **The meeting** is seen with both of them in view, within 20 m, for 12 s. Closer than 6 m, the contact may look. Not seen by the time he gets up (75 s), it's missed.
  - **Balance**, by the game's own follower (autoplay, 20 m back; `node tests/run.mjs skill`), skill against skill, 30 evenings a cell. The share of evenings the meeting is seen, our trained base (Deception, Tracking, Awareness) down, his (Pathfinding, Awareness) across:

    | | his 5 | 10 | 15 | 20 |
    |---|---|---|---|---|
    | **ours 5** | 23% | 7% | 3% | 0% |
    | **10** | 63% | 23% | 13% | 3% |
    | **15** | 97% | 83% | 23% | 3% |
    | **20** | 100% | 100% | 73% | 17% |

    Nearly all the rest are made (the follower lost him outright 2 evenings in 480; a few meetings were missed). At equal bases he wins three evenings in four, though our tradecraft gives us a few points more (16 against 13 at base 10): two sightings end it over a long walk, and d20 against d20 is a wide spread. A player who uses the street (cover, the crowd, the far pavement) does better than the game's follower. Playtests are logged in `docs/PLAYTESTS.md`.
- **Being tailed, the test** (v0.0.24; my calls, for the user to score). A surveillance detection run: SOLOVEY, a source in the Ministry of Defence, sits on a bench in a park a street or two away for eight minutes, five to six and a half minutes from the start. The player walks there. The numbers live in `src/sim/scenarios/sdr.js`.
  - **The evening** decides who's behind you: nobody (3 in 10); an **overt** FSB pair (a little over a third), 8–13 m back, barely hiding, an overt one standing facing you when you stop; or a **covert** team of three (a little over a third), 17–26 m back on your pavement and across the road, handing over every 70–110 s. Heat starts at 22, 34 or 44 to match. At afternoon, dusk or night.
  - **Watchers follow by perception:** they keep you in sight (closer in the dark, closer still when they've lost sight of you), go where you go by the crossings and lanes (`sim/nav.js`), and push past slow walkers. Not one of them seeing you for 40 s (overt) or 30 s (covert), they've lost you. Up a lane, only those who saw you go in come up after you, a little behind; if none did, they've lost you and never know how.
  - **Spotting them:** at the moments people check their back, every face in view gets our Pathfinding against their Deception (overt 5, covert 18, a passer-by 2): a glance over the shoulder (+2), crossing the road (+1), a shop window's glass (as you come to it, and every 6 s you stay: the look after the stop has counted as a move shows who stopped with you), standing a while (−1), and weakly all the time (−3, within 12 m). The instinct offers a shop window whenever there's one at hand; T puts you at the end of its pane ahead of you, so the glass runs back the way you came (straight in, it shows the road behind; slanted along it, the pavement you walked). Coming up a lane after you: +4. Twice is "seen before"; three times is "a tail". Typed slips over them say so.
  - **What counts as seen again** (v0.0.31, now the crowd goes places too, by the same lanes): following, not merely going the same way. A face counts again when it's copied a move of ours it had no reason to copy: moving when we stopped 5 s (at a window or anywhere), and stood since, behind us on our side within 30 m; behind us on the side of the road we crossed from, and after us (not beside us) on ours now; going our old way when we turned back, and our new way now. Or it's simply stayed with us (90 s and 100 m on), which makes it familiar, never a tail. Not from ahead of us, and not for taking the same lane: people going places do. So confirming a tail takes moves that test it, which is the trade's own rule: stop, cross, double back, and see who does it too.
  - **What they write down** (each kind at most twice, seen by a watcher): running, a glance back (our Deception against their Awareness), using a shop window to check (v0.0.32, the user: "without being as conspicuous (still a check but with better odds)": the same roll with +5 on our side, people do look in windows; +1 at another within 60 s), crossing away from the zebra, doubling back after a steady stretch. A covert watcher who stops at a shop window watches us in its glass. Each costs 3 heat. We don't know what they wrote, unless we catch them at it (our Awareness against their Deception, with them in view): a hedged line, and their face counts as seen again.
  - **What we know at the end** is what the character knows: whether we sat with him, the faces we marked, what we think they caught us at. The epilogue tells the rest the way the world would: SOLOVEY's next signal, or an arrest in the papers weeks later; and the signs of what they made of us (a car outside the building, a face twice on the way to work), which only a Pathfinding roll notices.
  - **The ending:** T by the bench sits you with him for 20 s. A watcher's eyes on you then, and he's burned (+10 heat), whether or not you notice them (Awareness against their Deception). T calls it off when the instinct says you're followed. The stamp says what you know: met, called off, missed.
  - **Balance**, by scripted players over 30 evenings (`node tests/run.mjs "walking straight"`; v0.0.32, shop windows as mirrors): walking straight there burns him 7 times in 9 with an overt pair, 7 in 12 with a covert team. A checker (glances, and windows, its eyes slanted back along the glass) calls it off rightly with 5 overt pairs in 9 and 5 covert teams in 12 (2 before the glass was a mirror with a look after the stop), and is written down 1.3 times a walk: a team that doesn't care shows itself; a professional one only to moves that test it. A pro (stops, a lane they can't see it take, the mouth watched) calls off rightly with 8 overt pairs in 9, and with a covert team calls off rightly 2 times or shakes them and meets clean 7 times in 12. With nobody behind them, all three meet clean 8 times in 9 (no false alarm left: the ninth missed him).
- **Travel.** Fast travel between points of interest by metro, bus, taxi or your own car. The way to the transport is flavoured: a driveway with the car, the subway entrance below the flat. Transit becomes a playable map when it matters (a tail, a brush pass); otherwise it's a cutscene (Q151). Traffic appears where it matters, and a taxi at the right moment can shake a tail.
- **CQC.** Rock, paper, scissors, second by second, with time paused until you choose: K hits, L grapples, M guards. Guard beats hit, hit beats grapple, grapple beats guard.
  - **The intent read:** a higher CQC gives a chance to see what the opponent will do next, scaling with the difference. Otherwise a "?" floats over their head.
  - **Advantage points:** a successful guard against a hit grants one, up to one per 10 CQC; zero-sum (v0.0.44, the user's): if the other side holds any, it takes one of theirs away instead. A point does one of three things: doubles the damage of your next successful hit, cancels the damage of a hit taken, or fends off a grapple when guarding.
  - **Built** (v0.0.35, `src/sim/cqc.js`; the numbers my calls). Each exchange: their move is chosen first, then ours. A guard against a hit blocks it and earns an edge. A hit against a grab lands clean (×1.5, the head more often). A grab against a guard is a throw (3–5 to the torso). The same move both ways is an opposed CQC roll, ties to us: the winner's hit lands, the winner's grab throws; two guards circle. A hit does 2–5 points to a part (the torso 45%, the head 30%, the arms and legs the rest), plus 1 for each 5 points of CQC the hitter has over the other; hurts then cost that fighter's CQC (Health).
  - **Techniques** (v0.0.37, the user: "we could also hit with other body parts depending on the CQC level, beginners would only punch"; levels my call, `TECHNIQUES` in `src/sim/cqc.js`). The move is chosen; how it's done is the fighter's level. A hit: under 7 CQC a slow, wide swing; from 6 a jab, from 8 a cross, 11 a hook, 13 a front kick, 17 an elbow and a knee, 19 a low kick (staggers), 22 a palm to the jaw (may stun), 26 a kick to the head (may stun). A grab: under 9 a shove (staggers, no throw), from 9 a hip throw, 14 a sweep, 21 an arm lock, 27 a choke (may stun). A cover: a block, from 12 a parry, from 20 a slip (both may leave the attacker off balance). Each has its targets and weight.
  - **Staggered, dazed, stunned**, each a handicap for the next exchange (v0.0.40, the user: "stuns and dazes should have effects like preventing blocks or hit or grab"): staggered (a blow taking 30% of what a part can take, a low kick, a shove, a parry, a slip): no grab, −3; dazed (a blow to the head taking 25%, 50% of the time; a riposte, always; a palm, a head kick, a choke, likelier): no cover, −4; stunned (a blow to the head taking half, 60%): nothing at all, whatever comes lands. None of them reads anyone. A move a handicap forbids does nothing; the move panel greys it out.
  - **The riposte** (v0.0.40, the user: "when you block normally you get an advantage, when you block with shift, you keep the advantage point and also hit back"): a cover with Shift held, an edge in hand, that meets a hit answers it at once: 1.5 times a hit's damage, mostly to the head, and the hitter is dazed; the edge is kept. A plain cover earns an edge. Hitting every time into someone far better (CQC 8 into 26) now ends a bout in under four exchanges, two of them ripostes; it used to be a stalemate of covers.
  - **Their edges** (the user: "AI doesn't use their advantage… using it when you can't read the opponent"): not reading you, they spend one on their move 70% of the time; reading your hit coming, they cover with it, a riposte; holding all they can, they spend one now and then. In a bout, never on someone stunned (that would be a foul).
  - **Fight enders** (v0.0.43, the user: "when hitting a stunned opponent with advantage, we attempt a fight ender since they can't defend …"; `src/sim/cqc.js` finish()): Shift with a hit or a grab on someone stunned is a CQC check against 4 + their CQC + half their Fitness (between equals, 75%; CQC 10 on 20, 26%; Moscow's 30 on 24, 96%). A hit knocks them out. A grab breaks an arm or a leg from CQC 21 (and they give up), below that it's a charge that slams them into the floor (down). Failed, it still does double a blow's damage, and breaks something nearly every time: a fracture (45%: a broken jaw, a fractured eye socket, broken ribs, a fractured forearm or shin; −3 to what the part does, the jaw −2 to everything, six weeks) or a crack. A knockout or a slam can kill: 2% on someone fresh, plus half of how beaten up they were past 35% (head and torso, averaged; someone at 60%: 14.5%), at most 60%; botched, half that. They do it to you too when you're stunned and they hold an edge, in a real fight (a grab 40% of the time from a fighter who can break an arm). In a bout it's a foul: nothing pulled, the bout lost, Hale's opinion with it; a classmate killed ends the course ('dismissed').
  - **Reading them, fighting** (v0.0.44, the user: "during combat it should automatically do READ against our opponent"): a fight makes the Read (below) as you square up, and every four exchanges; F in a fight shows it. A drill reads nobody.
  - **How things stand** (v0.0.43, the user: "instinct reminders about dazed (us or opponent), staggered and stunned"; `src/sim/fight.js` statusLine()): whenever you or they are stunned, dazed or off balance, the instinct says so and what it means (no cover, no grab, whatever comes lands; them stunned, the keys to finish it, or in a bout that it's a foul), in any fight, in place of the scene's own line.
  - **The picture** (v0.0.37, the user: "animations should be sped up and have more impact", "take CQC level into account"; `src/sim/cqcshow.js`): each exchange is a timeline of ticks: a wind-up (long for a beginner, a flick for an expert), the strike with a step in, the impact held 3 ticks (0.15 s) with the picture jolting 1–3 pixels, the one struck knocked back 0.35–0.85 m by how hard, reeling, staggering or standing dazed; a throw puts them down 0.7 m back, and they get up through a kneel. An exchange runs 0.45 s (an expert's blocked kick) to 0.95 s (a beginner thrown). No sparks (the user).
  - **The words** (`src/sim/cqctext.js`): each exchange told from our side in lines picked from many, by technique, outcome, part and how hard (light, solid, heavy, brutal); theirs as it looks, ours as it feels.
  - **Edges** are spent with the move, Shift held, and only if they do something: with a hit, double if it lands; with a grab, a punch walked into does nothing; with a guard, a throw is stopped.
  - **Reading** both ways: 6% a point of CQC over the other's, at most 90%. Ours shows over them before we choose (their move, or "?"); theirs answers our move with what beats it. Only the better fighter reads at all. The other side's choice otherwise: its style's mix (even, striker, wrestler, careful), turned against the move we lean on (2% a point of their CQC, at most 70%).
  - **The end:** a fight when someone is out cold, down or can't stand; a bout (sparring: blows pulled to half) at three points, a hit one and a throw two, or stopped when a head or torso is wounded.
  - **Balance**, bouts to three, our side answering what it reads and guessing otherwise (`node tests/run.mjs cqc`): CQC 8 against 2 wins 83%, against 8 53%, against 14 17%, against 30 1%; 20 against 10, 98%.
  - **The dojo** (v0.0.35, the user: "a demo starter in a CIA dojo where young agents are taught how to fight, it will serve as a tutorial for CQC"; `src/sim/scenarios/dojo.js`): the Farm, week six of the course. Hale, the instructor, calls each move in drills (cover a punch, grab a cover, hit a grab, the three mixed, then an edge spent), then bouts to three with a weaker classmate (you read them about a third of the time), an even one (you read nothing), a better one (CQC 11 to your 8: v0.0.41) and Hale (CQC 30, who reads you nine times in ten). Hurt badly enough, you're sent to the bench. The bruises stay on your sheet. The Farm is 2007, nineteen years before Moscow.
  - **The Farm, remembered** (v0.0.41, the user: "once we did it once, remember it so next time … snap flash forward to the last part about fighting the three trainees and Hale, then change of scenery"): once the lesson's been had (the browser remembers it), the title offers the Farm as a memory: straight to the four bouts, and when Hale's ends, you hit the floor, and it isn't the mat. A white flash, and Moscow, three in the morning, nineteen years on: on your back on the cobbles of a side street, somebody having hit you hard enough to send you back there. The same character, an illegal now (the trade's skills, and Hale's own combat training: CQC 30, as good as Hale was then), against an FSB officer (CQC 24: strong, but not as good). You get up; it's no bout, nobody stops it; it ends with one of you down. The whole lesson stays on the title.
- **What you can do with someone (F)** (v0.0.40, the user's; `src/sim/interact.js`), the engine's, in any scene, with whoever's within reach (1.8 m; a key shows over them): a menu, numbers or a click.
  - **Talk:** a conversation, time standing still as in a fight (the user: "talk should pause the game, like combat"): ask the time, the way, small talk, leave; their answers by how they feel about you (afraid, cold, neutral, warm: their gauges). A KLM-style minigame will come for some conversations; conversation proper is mechanic test 4.
  - **Violence:** an opening, the first exchange of a fight on the spot (the engine's fight, `src/sim/fight.js`, the dojo's too): a hit; a sucker punch (they mustn't see it coming: out of their sight, or your Deception against their Awareness; it lands on them open with an edge spent: double); a push (a shove); a grab (CQC 9 and over); a stab (greyed: no blade). Caught unawares, they're open. After every exchange, someone who won't fight on runs (a civilian, hurt, outclassed); out cold, they lie a minute. Whoever saw it remembers a face: heat, 1 a witness up to 6. They'll be afraid of you afterwards.
  - **Read** (the user: "display the guessed character sheet of someone else, analysis skill drives how good we are at it, as well as what we discovered about them"; `src/sim/know.js`): an Analysis check (DC 12; −2 at a distance, −3 in the dark) on what shows at a glance: Fitness, CQC, Awareness, Weapon handling, each a range that holds the truth (±8 on a bare success, narrower the better the read, 12 wide on a failure), never centred on it; every read narrows them; a margin of 4 tells what they are (a civilian, police, a soldier, one of the trade), 12 how well trained. The rest of a sheet doesn't show at a glance. A fight tells bounds: beaten, their CQC is near yours or above; beating them, not far above. Kept between encounters, shown on their sheet as you guess it.
- **Knock out or kill.** The player chooses, and each attempt is a check. Low CQC can kill by accident when trying to knock out, or fail to kill when trying to (Q148). A death escalates the police and the opposition. Built so far (v0.0.43): the fight enders (above), which can kill; someone dead lies where they fell for good; a killing seen in the street is four times the heat; the player killed gets the engine's paper ('DEAD'). With a weapon in hand, Shift with a hit on someone stunned will be an attempt to kill (the user; with the weapons).
- **Knives and what's to hand** (v0.0.45, the user: "create variety of knives and improvised weapons to populate the world with, fight is still CQC and works the same"; numbers my call: `src/sim/weapons.js`, `src/sim/items.js`, the fight's rules in `src/sim/cqc.js`).
  - **Nineteen of them.** Six knives (a penknife, a box cutter, a switchblade, a kitchen knife, a finka, a combat knife): balanced, no drawback, 2.2–2.9 times a fist's blow, and what they hit is cut and bleeds. What's to hand, each with its cost: a screwdriver, a bottle (it breaks into a broken one), half a brick, a hammer (cracks bones), a spanner, a length of pipe, a crowbar, a stick, an umbrella, a snow shovel, a bike lock, a chain.
  - **In a fight**, armed, a hit is mostly the weapon's: a slash, a stab, a club, a thrust with the end of something long (the trained 75% of the time, kicks and knees and elbows the rest, never a punch with the knife hand; the untrained 92%). A cover is held with the weapon if it's any good for it. Blocking a blade, or anything heavy, with less than a pipe or a crowbar across it, is a CQC roll for a clean block (a hammer or a stick across it helps); lost, it comes through the guard, mostly into the forearms, 40% of a blow, never past a wound (between equals, 46% of the time; for the better blocker 12%, the worse 83%). A grab with a hand full costs the roll and may fumble (a pipe 21%, a knife never); with a snow shovel, no grab at all. Something awkward (a brick, a chain, a shovel) costs every roll and comes a tick slower. A grab that lands may knock the weapon away (an arm lock 50%, a throw 15%), and it lies where it fell. Armed, Shift with a hit on someone stunned is an attempt to kill (the user): the same check as a fight ender; failed, a terrible wound, and it may kill anyway. An armed fighter hits more and grabs less. CQC 10 with a penknife against 10 bare-handed wins 50% (35% bare); 20 bare-handed against 10 with a kitchen knife, 80%.
  - **Lying about**, made from the street's seed (never inside anything), by what the street has there: bottles by the bins, pipes and bricks down the alleys, a shovel by a courtyard's arch, a stick under the trees, a box cutter by a shop door, junk along the hedge: two or so every 45 m. One picked up is gone from there for good; one dropped lies where it fell.
  - **Carried** (the user: "no backpack or similar yet, so only pockets and weapons can be shoved in our beltline"): in a pocket (two in the trousers, two more in a coat or a jacket), tucked in the beltline (two), or held. T picks up what's within reach, into the hand; G takes out the next one, or puts it away (in a fight, that exchange you only cover); I shows what you carry (take out, put away, drop). What's in your hand shows under the watch, and in it.
  - **Others:** a passer-by mostly carries nothing (about one man in fifteen a penknife, a switchblade, a box cutter or a screwdriver). Someone carrying a blade draws it when the fight turns against them ("Steel"): a criminal at once; with a blade in the hand they rarely run.
- **Guns.** G draws a gun, if there's one in the inventory; R reloads. Every draw, shot and reload is a Weapon handling check, with fumbles on failure; a natural 1 can mean a shot in the foot. Shooting is paused second by second, like CQC: pick a target, then a Weapon handling roll against distance and cover (Q146).
- **Health** is a few wounds before going down, more with Fitness. Serious wounds need care, and a hospital means exposure. Healing takes days (Q147).
  - **Part by part** (v0.0.34, the user: "health bodypart by bodypart"; the numbers my call, `src/sim/health.js`). Six parts, each taking damage against what it can take: the head 6 points, the torso 12, an arm 8, a leg 9, more with Fitness (× 1 + Fitness / 20). A part is unhurt, bruised (any damage), hurt (a third), wounded (two thirds: serious, it needs care), or out: an arm or a leg broken, the torso down, the head out cold.
  - **What it costs:** a hurt head −1 to every check, wounded −3 (dazed); hurt ribs −1 to CQC and Fitness, a torso wound −3; a hurt arm −1 to CQC and Weapon handling, wounded −3, broken −4 to CQC, −6 with a gun, and no grappling; a hurt leg −1 to CQC, wounded −2 and a walk at 0.8, broken −4 and a hobble at 0.5. Shown in the log like any modifier.
  - **Mending:** bruises and hurts heal by a fifth of what the part takes a day; a wound or worse waits for care (Medicine), which comes later.
  - **Blood** (0.1.0-rc1, the user: "work on the bleeding out system, with blood-pressure health stat"; numbers my call, after the textbook's classes of haemorrhage; `src/sim/health.js`): what's left of it, % of the body's. Whatever bleeds bleeds at its rate a minute: a bloody nose 0.1, a split lip 0.15, a shallow cut (through the guard) under 1, a blade that lands clean 1 + 8 × how hard (× the weapon's bleed: a clean kitchen-knife stab, 5.5), and a cut artery (15% + of a deep cut to a limb or the neck) 10–15. Shallow cuts stop on their own; deep ones and arteries only with care. Below 85% pale (−1 to everything), below 70% in shock (−3, no running), below 55% collapsed (down), below 45% dead (bled out). Untended, a clean stab kills in about 10 minutes, an artery in 4.5. It comes back by half a percent an hour once nothing bleeds. Through a skip of the clock, it goes on bleeding.
  - **First aid** (0.1.0-rc1, the user: "bandaging, splinting and other kinds of medical first aid … the right skills to drive how good we are with medical stuff"; `src/sim/aid.js`): H for yourself, F (First aid) for someone at hand. Press on it (no roll: while you hold still it bleeds at 35%); dress it (a strip of your shirt, −2: Medicine against 8 shallow, 12 deep, 16 an artery; made, a cut stops and an artery slows to 30%; missed, it soaks through, 70%); a tourniquet on an arm or a leg (your belt, −2, against 10: it stops, and the limb's no use until a hospital); a splint for a broken limb (something rigid: a stick, a pipe, an umbrella, a crowbar; against 12: the break costs half). On yourself −2; one-handed −4. It takes its time (45 s, 25 s, 2 min) stooped over it. Medicine 5 dresses a deep cut on someone else about two times in three, on yourself less; Medicine 15, 93%. The sheet shows your blood; the screen's edges darken as it goes; the instinct says when you're bleeding and how fast. Supplies (a pharmacy's bandages, a kit) come with money.
  - **Injuries** (v0.0.38, the user: "a lot of damage could trigger cracks and some types of damages can cut (not bare handed) and blood can be drawn from getting hit in the face hard enough"; numbers my call, `src/sim/health.js`). Besides the damage, a blow taking half of what a part can take may crack it (a cracked rib, forearm, shin, cheekbone: −2 to what the part does, −1 to everything for the cheekbone; three weeks to knit). A hard blow to the face may split the skin (30%: a brow or a lip; bleeds 2–5 minutes, a week to mend) or bloody the nose (20%: bleeds a minute or two, a day to mend). An edge (a blade, glass; when there are any) cuts anywhere. Listed under their part on the sheet.
  - **Blood** (the user: "pixel level blood splatter on the ground and lingering blood traces on the damaged part"; `src/sim/blood.js`, `src/render/blood.js`): a blow that draws it, or lands on a face already bleeding, flings a spatter the way it went, a few big drops near and fine ones far, pixel by pixel; whoever bleeds drips where they stand every 3–7 s. It stays where it fell and darkens as it dries. On the person, it's worn on the face (or the clothes, for a cut) until a day has washed it off.
- **Needs** are meters that cost check penalties (Q149):
  - tired (sleep);
  - hungry (every 6 h or so);
  - stressed: it rises with danger and falls with sleep and leisure, and high stress brings mistakes;
  - hurt.
- **Inventory.** Very limited and realistic: a bag holds what it holds, pockets if the clothes have them. The user (2026-10-26): "very little storage space, no magic inventory, volumes and pockets. Concealed weapons only when concealable", clothes that can be changed, clothes shops to buy a change of clothes when tailed, no backpack yet, and money. Begun in v0.0.45 with the weapons (pockets by the clothes, the beltline, no bags); volumes, clothes and money to come.
- **The phone.** One tool, used anonymously. Using a smartphone is bad tradecraft 90% of the time.
- **The mind map and the papers** (Q144).
  - The **mind map** (Tab) is what the character knows, open anywhere: people, places, links, traits found, hooks, leads, the network.
  - **Papers** are physical: briefs, photos, documents. They're read, moved and filed at a desk (home, office, safe house), Papers, Please-style. Carrying papers is a risk in a search.

## Presentation

- English. Medium reading: most information is abstracted, but text is abundant in the interface and in flavour.
- No portraits. Persistent characters already have a face, their sprite; a discreet app shows only an initial.
- **HUD.** A clock only if the character carries something that tells the time. The instinct's prompts when relevant, with the key that does it.
- **Light** is continuous, from the clock. Weather comes later, but the system must take it. Sound much later.

## World size and maps (scale)

- **No city simulation.** What's simulated is geopolitics and the persistent characters. The places an assignment needs are generated pieces of city: points of interest with the city's flavour, generated from a base plus variation where that serves, fixed where that serves. A building, or part of one, that the player can enter is its own map; only the relevant ones exist.
- **Maps are compact but larger than a screen.** The camera follows the player (Q153). It leans where the eyes go (v0.0.39, the user: "the top-down view is shorter than the left right … targets up and down are out of the field of view"): 1 m east–west and 2.5 m north–south walking, 1.5 m and 8 m looking with E held (the picture is shorter north–south); and in the tail, toward him while he's in sight, so a man up a lane stays in the picture. Never past what the crowd's rule allows (nobody comes or goes on screen: 24 m east–west and 22 m north–south of you), eased over a third of a second; the fog still says what's seen. **About 50 people on screen** at the busiest. A tail that reaches the edge of a map continues into a newly generated, similar section, so we need solid procedural variety.
- **The street** (the skeleton's map, my call; every side leads somewhere since v0.0.22, the user's ask). The city is rows of east–west streets, each its own map, generated in sections of 45 m from the city's seed, the row and the section's index, so a map can grow at either end as someone walks on. North to south:
  - a terrace (pre-revolutionary plaster in ochres, pinks and greens with white trim, red brick, or a Stalinist block with a heavy base, each in a dress of its own: plaster classical, pedimented, rusticated, with pilasters, Art Nouveau or constructivist; brick plain, dressed in white, yellow, arched or painted over; the Stalinist block plain, ornate or tiled, or a late-Soviet panel or white-brick block in its place; shops with Cyrillic signs, entrances, arches to the courtyards), cut by **side streets** (10 m, a road between pavements) and **alleys** (3 m, setts, dark) that run to the map's north edge and on to the next street north;
  - a wide pavement with lamps, the road with parked cars and a zebra (at a side street's mouth when there is one), the near pavement, a railing;
  - **the south band**, a stretch of four sections at a time: a **boulevard** (lawns with trees, a gravel path, benches facing it, a railing) with its **far road** (a zebra, parked cars) and **far pavement** beyond; or a **park** (lawns and trees, the same path, paths down to a south walk on the far pavement's line, and one thing to see: a pond, a fountain, a bronze man on a plinth, a kiosk, flower beds);
  - a hedge, with gaps where the next street's side streets and alleys come up to meet it, leading on south.
  - **No two stretches alike** (the user: "environments reuse exactly the same elements, please generate at least three more kinds of everything"). Every element comes in makes, drawn from streams of their own so the street's geometry never moves (`sim/map/street.js`, the looks): per stretch of four sections, a scheme (the pavements: slabs, squares, granite, pavers, tarmac; kerbs: granite, concrete, worn, painted black and white; the asphalt and its centre line; the lamps of each line: lantern, crook, twin, modern, globe, three-globe torch; railings: spears, hoops, cast iron, pipe, mesh; benches; bins; the boulevard's trees), changing only at a crossing's line; per crossing, its zebra (white, white and yellow, faded, fresh with tactile paving, raised); per lane or alley, its surfaces and lamps; per run of hedge, its plants; per building, a dress of its style (above), its doors, arches, shopfronts, signs, awnings, balconies, pipes, posters, scaffolding and roof; per car, its make (a taxi now and then); per park, its pond, fountain, bronze, kiosk or beds in one of four or five versions. Puddles, manholes, litter and fallen leaves lie where each section's dice put them.
  - **November** (the posting's month): the broadleaves are bare (limes, maples, poplars, birches; an oak keeps its brown leaves, a birch or a poplar a few yellow ones), the spruces green, leaves on the pavements and in the gutters, the fountains off, the beds put to bed (spruce boughs over them, ornamental cabbages, cut-back stalks). The trees, hedges and fallen leaves follow the clock's month, so a posting in another season dresses itself.
  - A row's ways north and the next row's ways south are the same lanes, so a way out of one map is a way into the next. Walking off through one, you arrive at its other end, on the next street; an autosave marks the change. Streets, boulevards, parks and lanes have Moscow names (Pokrovka, Chistoprudny Boulevard, Kolpachny Lane…), shown under the watch.
  - **Passers-by** (v0.0.31, `sim/crowd.js`) are agents too, going somewhere real: a door (a shop, a block of flats, a courtyard's arch) 2–5 streets from where they appear and 120–600 m along (the user: "a destination in mind… where the tail would end if it were an actual mission"), by a way of their own, with a civilian's habits on it (a shop window, a bench on the boulevard, a call). Up to 40 per 100 m of street at the busiest hours, a handful in the small hours. They never appear where the player would see it happen, and never vanish there: they leave by their door, off the map up a lane, or off the screen.
  - **The bubble** (the user): passers-by live on the player's street and the streets either side, within 45 m along them. Whoever was on our street when we crossed to the next is still about behind us, and lives on there; whoever crosses after us arrives; the street we come to was already full of people going about their business. Crossing again, the street two back is let go: only a scenario's people, the posting's and the character's are kept beyond. So anyone can be tailed, and the tail ends at their door.
  - **Benches** (the user): two seats 1.65 m apart (2.65 m long; the figures are drawn 1.25 m wide), or a third of the time three (4.3 m). Two people meeting take the ends, room between them.
- **The background game** (the user, 2026-10-26: "formalize where NPCs are going, pathfinding that works 100% of the time"). The people who matter (a target, a team of watchers, a source on his way to a bench, the player in autoplay) are **agents**, and they go places across the city whether or not their street is the one loaded.
  - **The city graph** (`sim/city.js`): every street's walking lines (the far pavement, the near pavement, the boulevard's path, the far pavement south) joined by the lines the generator keeps clear: zebras, the railing's gap and the park paths, the side streets and alleys to the next street. A route is planned on it (A*), so every step of it is walkable by construction, and the tests prove the corridors clear.
  - **Routes are randomised** per walker (each sees the city's costs a little differently), and a careful walker plans a roundabout one: by way of points off the straight line, doubling back across streets, through alleys and parks, with stops at windows and shops. A far destination is ten streets or more away, so even the direct route changes map ten times.
  - **Off the loaded street**, an agent walks its route in the background, by the clock; when its street is loaded it's where it would be. The loaded street follows the focus (the player, or whoever the camera follows).
  - **Two behaviours, for anyone:** a **target** walks a route and makes its checks; a **follower** follows someone by what it sees (`sim/agents.js`): in their footsteps, as far as it has seen them, never further back than 60% of the eye's reach in the open air (31 m by day, 11 m at night: they'll walk out of the lamplight); looking away when they stop to check where they could see it; walking on ahead when they come its way; cutting across where their trail loops back. Out of sight it hurries, goes right up to where it last saw them, and guesses: up the lane they were in or walking straight at (from their heading); into the door they were seen going in by (waited on 2 minutes); not on the street after a look both ways, into one of the shops near there (it watches the shopfronts from the pavement). Then it's lost them. Orlov is a target and the FSB's watchers followers; in autoplay the player's own character is either, so the tests are played AI against AI.
  - **Reliable** (`tests/agents.test.mjs` and sweeps): a follower after a careful man across ten streets and more, by day, dusk and night, 10 to 30 m back (half of them on seeds it was never tuned on): 960 chases out of 960 on the empty streets of v0.0.30, and 959 out of 960 through v0.0.31's living crowd (it squeezes past people in a lane when it's hurrying): never blocked, never more than 41 m behind. The one loss was at night, 30 m back: he stepped into a short lane south just out of its sight, and it guessed he'd walked on.
- **What this means for the engine.** The groundwork is smaller than first proposed (2026-10-25). There's no city streaming and no simulated population. What's needed:
  - one sprite sheet and one draw for a crowd of 50;
  - lights per map, a dozen or two;
  - a camera that follows the player;
  - a generator for map sections, from kits plus variation;
  - a store for a few hundred persistent characters.

## Saves and losing a character

- **Autosaves** on every map change, on major events (obtaining intelligence), every 30 in-game minutes, and on exit. They're for continuing, not for undoing.
- **Losing.** Death, capture or firing loses the character. The player then picks a new one among generated candidates; a higher career rank reached offers candidates past the recruit stage (Q132, Q51).
- **Debug mode** (in the settings) allows manual saves and loading a save after a loss.
- No difficulty settings.
- From CLAUDE.md: saves can be exported and imported as a JSON file from day one, so any bug can be replayed.

## The first playable (0.1.0)

- **The posting.** A CIA officer, a **Handler**, at the US embassy in Moscow, with a cover identity and a job at the embassy (Q98, Q110). **A few weeks of the posting, 5–10 hours of play** (Q159). The full game's start (a recruit's basic training ending, then a scripted tutorial assignment) comes later.
- **Places** (Q154):
  - the embassy (lobby, offices, the secure room);
  - the flat in the diplomatic compound;
  - generated streets;
  - a metro station and its train;
  - a park with dead drop sites;
  - a café and a restaurant;
  - a market;
  - a reception hall;
  - a hotel lobby;
  - a target's office.
- **Assignments** (Q158):
  - a surveillance detection run to a meeting;
  - a brush pass;
  - loading or emptying a dead drop;
  - an asset meeting (pay, task, reassure);
  - spotting and assessing at a reception;
  - developing a candidate (gauges, hooks);
  - the pitch;
  - surveilling a target and photographing a meeting;
  - an emergency: exfiltrating a blown asset, like Gordievsky in 1985.
- **Three moments it must have** (Q160):
  - **The grey coat.** The instinct notices the same man on the metro and at the café, and you lose him so naturally he never knows you tried.
  - **Two seconds on the platform.** A brush pass in a crowded metro station, with surveillance on you.
  - **The pitch.** You recruit a source with the hook you spent weeks earning. The roll lands in the log.

## Road to 0.1.0

**My call**, from Q161: each mechanic is built first as a small playable test the user scores (like the look samples), and the mechanics are joined only after.

1. **The look.** Picked by the user (2026-10-26): sample 006's chibi people ("I like the smaller figures") in sample 007's fine environment. See Look.
2. **The skeleton.** Built (v0.0.19), played as the free walk:
   - A pure sim: clock and calendar, the tick order, the seeded rng, saves with export and import, `window.__tradecraft`.
   - Input by physical keys.
   - The check helper and the log.
   - Character sheets with skills and weights (shown on C since v0.0.34, with health part by part); the gauges; heat.
   - A map renderer: a camera that follows, a crowd of 50 sprites, light from the clock.
   - A generated Moscow street to walk (see World size).
3. **Mechanic tests**, one map each, scored by the user:
   1. Tailing a target. Built (v0.0.20), rebuilt on perception (v0.0.21), across the city on the background game (v0.0.30): the title's Mechanic tests. How it plays is above (Moment to moment, Tailing, the test).
   2. Being tailed: spot it, lose it. Built on the street (v0.0.24): a surveillance detection run to a meeting, with no team, an overt pair or a covert team (Moment to moment, Being tailed, the test). Still to come: the metro, cabs and trains, and more of the techniques evasive but conspicuous.
   3. Watching and photographing.
   4. A conversation: approaches, gauges, hooks, leads.
   5. A brush pass and a dead drop under watch.
   6. A fight: CQC (built v0.0.35, its tutorial the dojo), then guns.
   7. A police stop.
   8. The desk and the mind map.
4. **Joining.** Begun in 0.1.0-rc2 (the user, 2026-10-27: "Start working on campaign mode … the onion that is Character life > Posting > Assignment generation with the mission types that we tested"): see The campaign, below.
   - The day (schedule, cover job, travel, needs) and chapters.
   - A minimal geopolitics: a few subjects; intelligence turns into events and news.
   - The Moscow posting generator, assignments, agency services, the hunted state.
5. **The content of 0.1.0** (the places, the posting's people, the nine kinds of assignment), then a release candidate when the user declares one.

## The campaign (0.1.0-rc2)

Built so far (`src/sim/campaign.js`, the hub `src/sim/scenarios/campaign.js`; numbers my call):
- **The character.** Three generated officers to pick from (the title's Campaign), each a Handler: a name, an age, a background (Army intelligence, Treasury, State, a city detective, a Navy corpsman, a correspondent) that lifts the skills it would, Tradecraft 30–45, the posting's language at working or fluent. The pick is yours for the posting: wounds, blood and what you carry go with you from scene to scene.
- **The posting.** A city (Moscow; London, Beirut and Cairo next), the cover (Second Secretary at the embassy, official cover, immunity), a goal (a subject the station wants: in Moscow sanctions evasion, the hypersonic programme or Unit 29155), the network (one or two assets, codenamed, each with a role, a motive, a trust from −5 to +5 and a yield), the opposition's man to watch (an officer under commercial cover), the flat, the embassy (the street the missions start from), two safe houses, and the gauges: heat (how much the opposition knows), cover standing (the embassy's view of you), intelligence, money (a salary, $7,200 a month, and the operational fund, $2,500).
- **The assignments**, planned a week ahead, day by day, from the mission types tested: for each asset a meeting every 3–6 days (being tailed, to the bench: a 15-minute window, an evening after work or a weekend afternoon; the opposition's team by the heat: nobody, an overt pair, a covert team), for the target a tail every 4–8 days (his evening). One a day at most (two meetings in an evening is how networks get rolled up), never two at once, only the posting's own people and places: about four a week. Missed, they cost (an asset's trust; an evening unwatched).
- **Outcomes, folded back.** A meeting met clean: intelligence (the asset's yield), trust up. Met with a tail on you: the intelligence, but heat +10 and the asset compromised. Called off rightly: nothing lost; needlessly: trust down. A tail that saw the meeting: a lead and intelligence; made or blown: heat up, the target wary from then on.
- **The day** (the hub): from your door in the posting's city, the campaign's clock. Tab is the desk: the date, the gauges, the network, what's ahead (go now, or go at the time it starts: the clock skips to it), the places (the flat, the embassy, the safe houses: travel by foot, metro or taxi, the minutes it takes, and you're at that door on that street), and the day's choices: go to work (till 18:00 on a weekday: cover standing +6), sleep (till 7:00), lie low (a day: heat −6). A working day missed costs 10 of cover standing. Pay on the 1st, and on Sunday night the week's review (intelligence against expected, heat, cover, the network). The instinct says what's next and when to leave for it.
- **The arc** (0.1.0-rc3): the posting is done when the station has the intelligence it wanted (10: six or seven good operations, two or three weeks done well): POSTING COMPLETE. A tail that sees the meeting is a **lead**: the station names the man he met, and he becomes a target of his own (up to three), the next step. An asset at trust 4 or more brings twice as much.
- **What heat costs** (0.1.0-rc3): an asset met with a tail on you is compromised, and each day after may be arrested (25% a day): the evening news, gone from the network, heat +10. Heat at 95 and the posting's over: persona non grata (official cover: expelled, not jailed), the posting's paper. Lying low cools 6 a day, 10 at a safe house. Heat cools 1 a day on its own.
- **Fatigue** (0.1.0-rc3; DESIGN.md, Needs): sixteen hours awake and every skill is down 1, twenty and it's down 3, until you sleep; the instinct says so, and the sheet. (Hunger and stress to come.)
- **To come:** London, Beirut and Cairo; the hunted state (for postings under a legend, where there's no immunity: safe houses are its stops); moving traffic and taxis to shake a tail; needs (fatigue's cost); the other kinds of assignment as they're built (a brush pass, a dead drop, photographing a meeting, the pitch, the assassination the user proposed); events and news from the intelligence brought in.

## Look

What the references (Disco Elysium, local copies in `ref/`, not committed) are for: the **angle** (a high, near-isometric camera looking down into streets and rooms, with cutaways so interiors read from above) and the **level of realism** (grounded people and places, small on screen, readable by silhouette and light). Not its painted style: this is not a Disco Elysium clone, and the look is ours to find.

How it gets found: many small look samples (a street corner, a room, a few people, different treatments of light, material and colour), and the user picks the ones that land.

Explored so far:
- **Realistic** (samples 000-004): MPFB people, CC0 photographic materials, PBR light; motion from Mixamo (samples 001, 004).
- **Cartoonish 3D iso** (sample 005, after a pixel-art reference from the user, 2026-10-25). One street, rendered by `samples/lib/looks.js` in four ways, each with a chibi option (heads 1.5×):
  - `pixel`: 3D pixel art (low resolution, orthographic, toon light, outlines, quantised colour);
  - `pixel-chunky`;
  - `toon`: a flat palette, bands, outlines;
  - `flat`: a low-poly toy.

  The pixel family reads best. Toon and flat still show people as dark silhouettes: stylised people need their own palette, not averaged photo textures.
- **Chibi town** (sample 006, 2026-10-25). None of the above passed the user's "sniff test". They asked to simplify: "pixel art 100%, but simple, almost 2D", a handheld RPG (Pokémon-like) with big heads and almost invisible legs, barely modelled. Their reasoning: few animations, lots of freedom, and it scales very easily. The references were a top-down pixel RPG camp and close-ups of its 32-px characters: heavy dark outlines, faces of a few pixels, beards, boots. Built as pixel art from simple 3D:
  - **The frame** is 480 × 270, scaled by a whole number with hard pixel edges.
  - **The camera** looks straight on and 45° down, orthographic, so a metre is 16 px on the ground, up a wall and across.
  - **One 50-colour palette**; every pixel snaps to it.
  - **Outlines** are inked where parts meet: dark at a silhouette, lighter between touching parts.
  - **People are pixel sprites**, about 28 px tall.
    - Each part (head, face, hair, hat, beard, glasses, body by kind of top, arms, legs) is a small template in three views: front, back and side, with the other side mirrored.
    - Each person is recoloured from palette ramps and shaded by rule, as a pixel artist would: light from the upper left, shadow under hair and chin, darker lines where parts overlap, an ink outline.
    - Frames are poses of the parts (bob, arm swing, step, stride, run, sit) at 8 a second, so a new hat or coat animates for free.
    - In the street a person is an upright card. At this camera a metre is 16 px both up and across, so a card shows its sprite one texel to one pixel.
  - **Trees and props** are sprites too: leaf clumps shaded round from the upper left, a bark trunk; a post box, shrubs, bistro furniture, a bicycle, pigeons. Their cards cast the sun's shadow: the silhouette flattened on the ground.
  - **Facades, signs and the ground** are painted pixel textures on boxes, flower boxes and posters included.
  - **Night** lights the windows, signs and lamps, with hard-edged pools of lamplight; a sprite takes the light of the pool it stands in.
  - **The user's scores.** For the first build, with box people (2026-10-25): camera angle 95/100, night colour shift 90, environment 80 ("tree needs work, things lack flair"), characters 35. Head-to-body ratio good; front views "too boxy"; some profiles good. After the sprites and trees: "trees are fixed, characters are now a solid 70", and the approach is the right one; "objectively, this would be a 90-95%" with room to improve. The kid's run was off and was redrawn (v0.0.15).
- **Stoneshard** (Q3, Q155): named for the art and animation style, "if possible". I first described its people as taller, with heads about a fifth of the body. That was wrong. Measured on its screenshots, they're about 33 px with a 14-px head: 2.4 heads tall, close to our chibi. What sets Stoneshard apart is the finish, and the user asked for a sample to compare.
- **Fine town** (sample 007, 2026-10-26): sample 006's street, in Stoneshard's finish.
  - **The view** is 640 × 360, wider, as Stoneshard shows more world around its people.
  - **People** are drawn finer (`samples/lib/finepeople.js`):
    - a 24 × 40 cell, the head 12 × 12;
    - faces with glinting eyes, brows, a nose shadow, cheeks and a mouth, and a blink;
    - legs, boots and hands that show;
    - six hue-shifted tones a colour, the outline softened on the lit side;
    - limbs between joints, giving an 8-frame walk, a 6-frame run, and a breathing idle.
  - **Surfaces** are bevelled brick by brick and slab by slab. Plaster is weathered down to the brick in places. There's ivy, plus puddles, weeds, litter and moss in the joints.
  - **Colour:** a 116-colour palette and a warm grade.
  - **What to compare:** sample 006 (chibi: simple, big-headed, 50 colours) against sample 007 (the fine finish).
- **The pick** (2026-10-26): "I like the smaller figures, but the new environment". So the game is drawn in **chibi people (sample 006's sprites) in the fine town (sample 007's finish)**: the 640 × 360 frame, a metre 16 pixels, the 116-colour palette and its warm grade, the bevelled, weathered surfaces. The picture fills the window (v0.0.33, the user: "why is the game not taking the whole window"): scaled by any amount, sharp-bilinear (every pixel the same size, a seam between two blended over one screen pixel), and on a window of another shape a little more street on its longer side, up to 736 × 430 (as far as the street is kept alive off screen), a border only beyond that. Seen together in sample 007 with `?people=chibi`. The art lives in `src/art/` now (pixelart.js, pixeltown.js, sprites.js, townsprites.js), shared by the game and the samples.
  - **In the game** (my calls, from building it):
    - The asphalt is one tone with a sparse grain: the fine mottling snapped into blotches under the palette, worst at night.
    - Shops are lit at night only; by day their glass is glass.
    - Windows light up house by house through dusk; the lamps come on as the sun goes.
    - The sun's direction stays the art's (from the upper left): the sprites are shaded that way. Its height, colour and strength follow the real sun over Moscow.
    - A tree or a post box in front of the player is seen through (every other pixel left out), so it never hides who you're playing.

## Stack

- In the browser if it stays the most convenient, like longhaul: the same save logic (IndexedDB, a save schema, additive upgrades on load), the same method (CLAUDE.md).
- three.js (0.186.1), vendored as ES module files in `vendor/three/` (`tools/vendor-three.mjs`) and loaded through an import map, so there is still no build step, no network and no package install to play. A departure from longhaul's hand-written WebGL2, made for skinned characters, glTF, shadows and post-processing.
- Content is made by scripts (see docs/PIPELINE.md). The pixel look needs no Blender or MPFB: sprites and textures are drawn by code.
- **The code** (v0.0.19): `index.html` and `src/main.js` (the loop), then:
  - `src/sim/`: the pure sim. Time is whole milliseconds since 2026-01-01 00:00 Moscow time; the tick is 50 ms (20 a second), in a fixed order (`sim/game.js`); the sun and the light from it (`sim/light.js`), shared by the renderer and the checks; skills, checks, people, heat; the street (`sim/map/street.js`), the world at runtime (`sim/world.js`), the crowd (`sim/crowd.js`); scenarios (the free walk now, each mechanic test as it's built).
  - `src/render/`: the view (`render/view.js`), the street's meshes (`render/town.js`), everyone in one instanced draw (`render/crowd.js`).
  - `src/ui/`: keys, the screens (title, HUD, log, menu), saves (IndexedDB and files).
  - `src/art/`: the look's painters and sprites.

## Controls

Keyboard first. Keys are read by physical position (`KeyboardEvent.code`), so they work on any layout, and labels on screen show the player's own layout (`navigator.keyboard.getLayoutMap()` where the browser has it). Named here as the user's AZERTY keyboard prints them:

| Key | Does |
|---|---|
| Z Q S D | Move |
| Shift | Run |
| Alt (Option on a Mac) | Stroll, while held: a slower walk, to keep a pace without stopping (my call) |
| F | Interact (a menu when there are several options) |
| I | Inventory |
| T | Do what the instinct says |
| E (hold) | Stop and look: the move keys turn your eyes. Later, watch someone. |
| E (tap) | Glance back over your shoulder, walking on (the user, 2026-10-26) |
| C | Character sheet: the over-skill, the skills, health part by part (the user, 2026-10-26) |
| P | Camera (was C) |
| K, L, M | Hit, grapple, guard. M is the key right of L, which QWERTY prints ";". Shift held with one: spend an edge (an advantage point). |
| G | Draw a gun |
| R | Reload |
| Tab | Mind map |
| J | The log |
| Space | Pause |
| Esc | Menu |

The mouse is for menus.

## Balancing objectives (for later, as we play)

- **Following alone is harder than spotting a tail** (the user, 2026-10-26: "it may make sense"; my view too). In the trade a lone tail on a trained officer seldom lasts, which is why surveillance is a team's job; and spotting a tail is what the player does before every meeting, so it has to reward good play reliably, where tailing alone is the rarer, riskier job. What to guard: the player's choices should count for more than the dice. Now (v0.0.30, the game's own follower): at equal trained bases the watcher wins three evenings in four (Tailing, the test). We'll see in play whether to even it (the lever I'd reach for first: his second sighting counting only some while after the first).

## Later

- **The tutorial** (the user): it plays much like mechanic test 1, a target in a grey coat and fedora (the trope); at the end he changes into ordinary clothes and makes a joke about spies looking like everyone else. In the game proper, nobody dresses like a spy.

## Open questions

- **After a lost character** (needed after 0.1.0, since 0.1.0 is one posting). **My lean:** the world carries on (same geopolitics, same date), and the next officer starts their own career. The lost officer's network goes dormant or is rolled up.
- **The other agencies and classes' weight tables:** when they're needed.
