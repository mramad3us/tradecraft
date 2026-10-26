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
- **Languages.** Text in a language the character doesn't know is undecipherable: it shows in its script, Cyrillic in Moscow. Five levels per language: none, basic, working, fluent, native. Between the levels, some words come through (Q120). Translation apps work on written text; support teams and real-time translation tech can handle speech and recordings.

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
- **No stealth system** (sight lines, noise). Sneaking assignments are played through disguise and the instinct: T does what it says ("Hide now!"), whenever there's something to hide behind.
- **Observation** (central) (Q142). Hold E to watch someone.
  - Time passes, and their sheet reveals itself by checks.
  - Staring too long risks their Awareness.
  - Meetings you witness are noted by themselves.
  - C takes a photo if you carry a camera.
- **Tailing** (Q143). The target walks on and the map extends with them. Too close raises their suspicion, too far loses them. Crowds help. The instinct warns before you lose them.
- **Tailing, the test** (v0.0.20; my calls, for the user to score). Gennady Orlov, a former GRU officer, walks east through a November dusk to a meeting on a boulevard bench; the street grows ahead of him. The numbers live in `src/sim/scenarios/tail.js`.
  - **Unseen.** At his moments (a look back, a shop window's reflection, coming out of a shop, crossing, doubling back) he rolls Pathfinding against our Deception if we're where he's looking. The modifiers are our choices: distance (under 5 m +6 to him, under 10 m +3, over 15 m −2, over 25 m −4, over 35 m −6), across the road (−3), people about us (alone +2, among people −2, a crowd −4), the light where we stand (dusk −2, dark −4), running (+6), stopping when he stops (+3), right behind him (+1), looking in a window (−2).
  - **Twice and you're made.** The first sighting sets him dry-cleaning: a little later he doubles back. The second ends the test.
  - **Keeping him** is a brass marker over his head. Beyond 22 m we roll Tracking every 4 s against a difficulty from the distance, the people round him and the dark, and again when he comes out of a shop or crosses with us more than 15 m off. Lost, the marker goes; within 16 m an Awareness roll finds him again; lost for two minutes, he's gone.
  - **The instinct** says what a trained eye would: too close, he's stopped, he's pulling away, he's in a shop. T does what it says when there's something to do (look in a shop window: a reason to stop).
  - **The meeting** is seen from within 18 m, with him in hand, for 15 s. Closer than 5 m, the contact rolls too.
  - **Balance**, by scripted followers over 30 evenings (`tests/tail.test.mjs`): tailing 10 m behind is made 9 times in 10; the other pavement, 20 m back, sees the meeting 6 times in 10. A player has more tricks (crowds, windows, the dark).
- **Travel.** Fast travel between points of interest by metro, bus, taxi or your own car. The way to the transport is flavoured: a driveway with the car, the subway entrance below the flat. Transit becomes a playable map when it matters (a tail, a brush pass); otherwise it's a cutscene (Q151). Traffic appears where it matters, and a taxi at the right moment can shake a tail.
- **CQC.** Rock, paper, scissors, second by second, with time paused until you choose: K hits, L grapples, M guards. Guard beats hit, hit beats grapple, grapple beats guard.
  - **The intent read:** a higher CQC gives a chance to see what the opponent will do next, scaling with the difference. Otherwise a "?" floats over their head.
  - **Advantage points:** a successful guard against a hit grants one, up to one per 10 CQC. A point does one of three things: doubles the damage of your next successful hit, cancels the damage of a hit taken, or fends off a grapple when guarding.
- **Knock out or kill.** The player chooses, and each attempt is a check. Low CQC can kill by accident when trying to knock out, or fail to kill when trying to (Q148). A death escalates the police and the opposition.
- **Guns.** G draws a gun, if there's one in the inventory; R reloads. Every draw, shot and reload is a Weapon handling check, with fumbles on failure; a natural 1 can mean a shot in the foot. Shooting is paused second by second, like CQC: pick a target, then a Weapon handling roll against distance and cover (Q146).
- **Health** is a few wounds before going down, more with Fitness. Serious wounds need care, and a hospital means exposure. Healing takes days (Q147).
- **Needs** are meters that cost check penalties (Q149):
  - tired (sleep);
  - hungry (every 6 h or so);
  - stressed: it rises with danger and falls with sleep and leisure, and high stress brings mistakes;
  - hurt.
- **Inventory.** Very limited and realistic: a bag holds what it holds, pockets if the clothes have them.
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
- **Maps are compact but larger than a screen.** The camera follows the player (Q153). **About 50 people on screen** at the busiest. A tail that reaches the edge of a map continues into a newly generated, similar section, so we need solid procedural variety.
- **The street** (the skeleton's map, my call): a Moscow street running east–west in sections of 45 m, each generated from the map's seed and its index, so a map can grow at either end as someone walks on. North to south: a terrace (pre-revolutionary plaster in ochres, pinks and greens with white trim, red brick, or a Stalinist block with a heavy base; shops with Cyrillic signs, entrances, arches to the courtyards; now and then a side street), a wide pavement with lamps, the road with parked cars and a zebra, the near pavement, a railing, and a boulevard (lawns with trees, a gravel path, benches facing it). Passers-by walk its lanes, look in windows, cross at the zebra, sit on benches, go into shops and arches: up to 40 per 100 m of street at the busiest hours, a handful in the small hours.
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
   - Character sheets with skills and weights; the gauges; heat.
   - A map renderer: a camera that follows, a crowd of 50 sprites, light from the clock.
   - A generated Moscow street to walk (see World size).
3. **Mechanic tests**, one map each, scored by the user:
   1. Tailing a target. Built (v0.0.20): the title's Mechanic tests. How it plays is below (Tailing, the test).
   2. Being tailed: spot it, lose it (a street and the metro).
   3. Watching and photographing.
   4. A conversation: approaches, gauges, hooks, leads.
   5. A brush pass and a dead drop under watch.
   6. A fight: CQC, then guns.
   7. A police stop.
   8. The desk and the mind map.
4. **Joining.**
   - The day (schedule, cover job, travel, needs) and chapters.
   - A minimal geopolitics: a few subjects; intelligence turns into events and news.
   - The Moscow posting generator, assignments, agency services, the hunted state.
5. **The content of 0.1.0** (the places, the posting's people, the nine kinds of assignment), then a release candidate when the user declares one.

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
- **The pick** (2026-10-26): "I like the smaller figures, but the new environment". So the game is drawn in **chibi people (sample 006's sprites) in the fine town (sample 007's finish)**: the 640 × 360 frame, a metre 16 pixels, the 116-colour palette and its warm grade, the bevelled, weathered surfaces. Seen together in sample 007 with `?people=chibi`. The art lives in `src/art/` now (pixelart.js, pixeltown.js, sprites.js, townsprites.js), shared by the game and the samples.
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
| F | Interact (a menu when there are several options) |
| I | Inventory |
| T | Do what the instinct says |
| E (hold) | Watch someone |
| C | Camera |
| K, L, M | Hit, grapple, guard. M is the key right of L, which QWERTY prints ";". |
| G | Draw a gun |
| R | Reload |
| Tab | Mind map |
| J | The log |
| Space | Pause |
| Esc | Menu |

The mouse is for menus.

## Open questions

- **After a lost character** (needed after 0.1.0, since 0.1.0 is one posting). **My lean:** the world carries on (same geopolitics, same date), and the next officer starts their own career. The lost officer's network goes dormant or is rolled up.
- **The other agencies and classes' weight tables:** when they're needed.
