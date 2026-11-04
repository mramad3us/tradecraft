# Changelog

One entry per release, newest first: what changed for the player, and the numbers that moved. Write it under Unreleased as the work happens; `tools/release.sh` stamps it with the version and the date.

## Unreleased

## v0.1.31 (2026-11-04)

- **Police stations and hospitals look like themselves.** Their windows no longer show a shop's goods on shelves. A station's has its blinds down and two notices on the frosted glass under them; a hospital's has frosted glass to over head height with a green band along its top, and the corridor's lights above. Both are lit a cool white all night, not a shop's yellow, and never shuttered. In all four cities.
- **London's street-name plates keep off the shop signs.** A lane's plate went at the same spot on its corner whatever was there, and on one corner in five it covered a shop's board (a police station's, in the case you saw). It now goes where the wall is clear: at the corner under the band, on the building across the lane, or on the wall just above a shop's board. About 1 lane in 50 has none, where both corners are a pub or a full parade of shops (the lane's name still shows by the clock when you're in it).
- **Mansion blocks' names fit between their shops.** The name over a mansion block's door ran under the boards of the shops either side on a third to a half of them. It now takes the wall between them, shortened to its first word where the whole name doesn't fit (ALBANY for ALBANY MANSIONS), or is left off (about 1 in 20).

## v0.1.30 (2026-11-04)

- **The police take you in, and you see it happen.** An arrest is no longer instant. With your hands empty, the nearest officer comes in to cuff you, after you if you walk off, while the others shout at you to stand still (not to drop a gun you no longer hold). When he's at your side, time stops and it's your choice: down on your knees; shove him off and run (your CQC against his, harder the second time); fight him; your gun; or nothing. Then he takes you down: you face down on the pavement, him kneeling on your back, for six seconds. A paper follows (ARREST): what they had you for, how you went, what they took, the hours at the station and what it cost.
- **What they had you for sets the price.** A description: 2 hours, heat +15, the ambassador's view of you −20. A gun seen: 3 h, +25, −30. Shots fired: 5 h, +35, −40. Someone hit by your rounds: 8 h, +50, −55. Someone dead by them: 14 h, +80, −80, and the Foreign Ministry hears of it. Resisting (a shove, a fight, a run, a gun) adds 20 to the police's file.
- **A dead officer arrests nobody.** Officers who are dead, down, or knocked flat no longer count for the order, the arrest, or coming in to cuff you. Bending over the officer you'd shot no longer got you arrested by him.
- **The street is quiet after an arrest.** The alarm, the armed response, the takedown and the police's description of you are all closed with the arrest. Nobody is still screaming at you when you come out.
- **The police line reads as one.** The tape now has posts every couple of metres, and on the pavement under the buildings it's tied off to the wall: along the kerb, and across the pavement at both ends. It's striped all the way. The black outline used to swallow the parts that ran up the picture, so they looked like lamp posts. It also stays visible after dark.
- **No ambulance for being cuffed.** Lying face down under an officer's knee no longer makes a passer-by call an ambulance.
- **Police stations and hospitals on every city's streets.** There's one of each every 650 to 950 m or so: 24 to 27 stations and 18 to 24 hospitals over 17 km of street. Their boards are in the city's words: ПОЛИЦИЯ, POLICE STATION, قسم شرطة; БОЛЬНИЦА, HOSPITAL A&E, مستشفى. A station's board is navy and a hospital's white and green, and London's stations have their blue lamp, lit at night. Inside, there's a front desk behind glass, with an officer in his country's uniform or a nurse at it, chairs to wait on, and a notice board with a clock. Both are on the mind's map.
- **Let out at the station.** After an arrest you come out on the steps of the nearest police station, on its street, and the paper and the log name it.
- **A hospital's desk sees to you.** "Get yourself seen to" takes hours by what's wrong: a broken arm 3 h, a stab wound and a broken arm 4¼ h, a bullet through the chest bleeding inside 8¼ h. You're stitched and set, the bleeding inside is stopped and the blood put back, and you walk out of its doors. An official hospital costs heat (+2 for its records; a gunshot or knife wound is reported, +8 more and +12 on the police's file). If the police have your description, an officer is waiting in the corridor. With nothing wrong, the desk says so.
- **The ambulance takes you to a real hospital.** Its patient gets the same care and costs, and comes out after the hours in front of the hospital nearest where they fell. The first-aid menu's "A hospital, A&E" is a taxi to the nearest one now, with its desk's care, hours, costs and doors.
- Tests: armed (the takedown: the pin, the paper, the quiet after, out at the station; a dead officer; a shove that works); services (counts per city, the nearest door, a walk-in's treatment, the ambulance's patient out at a hospital); medicine (A&E at a real hospital); reflex (the cuffs' moment). The cities' golden hash re-set on purpose (stations and hospitals in the hashed sections; a door dump showed nothing else moved).

## v0.1.29 (2026-11-04)

- **Smoother on a slow machine, and when you run.** A performance pass on the heaviest street (Moscow at rush hour in the rain, running, the machine slowed six times over to stand in for a slow one). The sim was never the cost: 0.13 to 0.36 ms a tick. The hitches were the view's, painting the next street whole in a frame. Now the street's ground is painted a layer a frame, a building's front a few of its parts a frame, the furniture a few pieces a frame. The night faces come in as dusk falls, a step at a time, 2 ms a frame (one whole façade in a frame was 54 ms at that speed). A street built after dark paints its night faces as it's built. New faces in the crowd come in one a frame on a slow machine, more on a fast one, and a sign turning into English is painted one a frame. The worst frame running in Moscow went from 133 ms to 50, in Beirut from 133 to 83; walking holds 60 fps, the 99th percentile 16.8 ms. The view keeps what each part of its frame cost (`window.__tradecraft.view.stats`), for the next pass.
- **A voice you can't see says where it is.** An officer out of the picture who shouts at you to drop it, or fires at you, is placed: "Right behind you, 7 m off, a shout: …", and the plaque at the picture's edge points to them for a few seconds (POLICE). If a patrol is already on the street when someone calls the police, the call's line says it won't wait for the call.
- **A shop's board stays out of the shop.** In a city whose signs turn into English for you, the board over a shop you'd walked into (a Moscow bookshop's BOOKS) was drawn over its inside. It goes with the front now.
- Tests: armed (an officer out of sight is placed by the shout).

## v0.1.28 (2026-11-04)

- **No more streaks.** Someone put somewhere new in a tick (a passer-by brought back in at the street's edge, someone out of a door) used to be drawn gliding from where they'd been, a streak up or down the screen. Anyone who moves further than 1.5 m in a tick, more than anyone can run, is now drawn where they are.
- **Nothing in front of the vendor.** Nothing along a shop's back wall deep enough to stand over whoever serves (a drinks fridge, a fitting room) goes behind the counter any more; the shelves still do.
- **A bookshop's grammars read as what they are.** Each was labelled with the city's language, so London's three read "A grammar of Russian" three times. Now each says its own: Russian, Chinese, Persian.
- Tests: training (a shelf's grammars all different); the cities' golden hashes re-set on purpose (the shops' back walls).

## v0.1.27 (2026-11-04)

- **Hale is the first station's.** His welcome call, his exercises and his number by the phone come with the first tour, in London, and only there. A posting of your own starts with its posting's paper instead, and nobody rings. A saved game from before that's already past its first tour stays quiet too.
- **Magazines take their time, and you see it.** Filling or emptying one at the kitchen table or a range's bench is a round at a time, by your Weapon handling: about 3.5 s a round untrained, 2.8 at 5, 1.3 for an expert, emptying faster. It's lived rather than skipped: you sit at it with the clock running, and the card comes back when you're done. The line says how long it took ("40 seconds, the thumb sore by the last"). Longer jobs, like stripping and cleaning, still skip.
- **Double and triple taps.** Press 1 (or click) again while a shot's still playing out, before the muzzle's back down, and you fire a quick follow-up at the same aim. Weapon handling 8 and up gives a double tap, 18 and up a triple; below 8, it's one shot at a time. Each follow-up takes the muzzle's climb against it, less in a better hand: × 1.24 at Weapon handling 4, × 0.92 at 12, × 0.44 at 24. Bursts now get the same steadier hand. It works on semi-automatics and revolvers, not bolts or pumps.
- Tests: interiors (a first tour's call, a posting's silence); shooting (the taps by skill); the range's scripted shooter waits out the bench.

## v0.1.26 (2026-11-04)

- **The world's business, over the years.** A station's tasking now comes from what its country is caught up in at the time. Each issue rises, matters for a year and a half to four, and is settled, and another has risen by then. It's built procedurally: a country's profile says what kinds of business it has (a weapons programme, sanctions, a succession, armies for hire, a rival's money or spies, arms routes, hostages, a bank collapse, a border war, an insurgency, a river, arms deals, smuggling) and the names they need. The world's seed picks the rest and lays it out in time. Back at a station after years away, the posting's paper says what changed while you were gone.
- **A campaign is a world, and it goes on.** When an officer is lost (dead, or expelled) or retires, the result offers the next officer, in the same world. The new posting starts eight weeks later, on a Monday, with the same date running and the same world's business. The title offers it too, after the browser's been closed. New game starts a new world.
- **Retirement.** An officer past 60 retires at the end of a posting, never in the middle of one, and the next officer takes over. A posting completed (not only a promotion) now leads to the same officer's next station.
- **Flights land you fed and rested:** a trip abroad starts with you fed and rested, and the morning home finds you in the flat the same way.
- **Lying low on a working day is a sick day.** The button says "Call in sick". The section takes the call, and nobody counts the day as missed. The first in a month is free; the next costs 2 of your standing at the embassy.
- Tests: career (the timeline by country, procedural; the next officer and retirement; sick days and flights).

- **Hale's eighth lesson: at the range.** An evening behind a range's door, played for real at its lanes, Hale at your shoulder this time rather than in your ear (his box says HALE · BESIDE YOU). From the title's tutorial it's Moscow's (or `?city=`'s); in a campaign it's booked like his other exercises, at the range nearest your flat (ranges are few on the streets, so where none is within six streets, it's the range down under the nearest gym or fight club), at 19:30 on a working day or in a day off's afternoon (14:00, 15:30, 17:00).
  - **The club's gun, from the desk**, as the city's law has it: Moscow's Makarov; London's club .22 (a new gun: an Anschütz 1416, bolt-action, five rounds, .22 Long Rifle; handguns are banned there); Beirut's Glock 17; Cairo's CZ 75. It comes empty and unchecked, with two empty magazines and a box of 30. Anything of your own that shoots goes in the club's locker until you leave.
  - **Lane three**: a booth, a bench where you fill your magazines (T), and paper on stands at 7, 15 and 25 m: a chest silhouette, or a rifle club's bull's-eye card in London. You aim at the paper as you'd aim at anyone, with the mouse. A hit makes a hole in the ring your roll earns (beat the DC by 13 or more: an X; by 10: a ten; then a ring every three), and the holes stay on the paper. A miss goes into the trap. Nobody bleeds, nobody runs, nobody calls the police, and nothing is written down.
  - **The lesson**: check the gun is clear at the line; fill both magazines, load one and chamber a round; shoot a group of five at 7 m; reload with the other magazine. Hale has slipped a dummy round into it a few rounds down: it clicks, and you clear it (tap, rack, back on the paper). Then five at 15 m, five at 25 m, and the gun unloaded, shown clear and handed back at the desk. He scores each group (out of 50, the Xs, how many rounds hit the paper, the spread in cm) as you shoot it, and again afterwards.
  - **Range safety** ends the evening. Point the muzzle back up the range (more than 100° off downrange; past 60° he warns you first), aim at a person, fire down another lane (aiming at one gets a warning), let a round go off you didn't mean, or keep the gun out of the booth for more than 8 seconds: the gun's taken off you, and Hale tells you why. Drop the gun and it's picked up for you: nobody grabs for a falling gun.
  - Measured with the Makarov at 7, 15 and 25 m: Weapon handling 6 puts 95%, 75% and 18% of rounds on the paper; 18 puts 90%, 100% and 98%. The groups at 7 m: 21 cm against 3.
  - Folded into the campaign: a session of Weapon handling (every roll at the lanes adds a little more), a little Tradecraft, nothing on the record.
- **Hale's lines in shooting mode.** While time stands still for your choice, his lines go on being read, so a lesson with shooting in it doesn't pile them up behind you. His box no longer covers shooting's steps. A line about a moment that's passed (the 7 m paper, once you've shot it) isn't said late, and his words on the steps you've done come in the order you did them.
- **Bolt-action guns** say "a spent case in the chamber", not "a case stuck in the port", after a shot.

## v0.1.25 (2026-11-04)

- **The years go by between postings.** Asking for a station when you're promoted now costs time. First come three weeks' home leave. Then, if the station's language isn't yours to working level, the Foreign Service Institute, full time, for as long as it takes. By the State Department's categories that's 30 weeks for French, 36 for German, 44 for Russian and 88 for Arabic, less what you already have: a junior with basic Russian needs 33 weeks for Moscow, and one with no Arabic 1.7 years for Beirut. The posting starts that much later. Your officer is older by then (ages now follow a birth date), the language is on their file, and the school is in their record. The orders come as a paper listing each phase and how long it takes. The station picker says how long each station would take. Once it's no longer 2026, the year shows on the clock.
- **An illegal's training is planned** (for 0.2's postings): the language to fluent, and every skill to the post's floors: master in the core four, 18 in CQC, Fitness and Weapon handling, 14 in the rest. Each phase is with the people who'd teach it: the Secret Service, the Farm's long course, Delta, Ground Branch, a trauma bay, the DS&T. A legend's takes 2.5 years for Beirut, a regular officer's 13.6, and the paper opens: "You're very good. At this level, over there, you'll be dead in a month."
- Tests: `tests/career.test.mjs` (the weeks by language; promoted to Beirut and to Moscow; an illegal's plan).

## v0.1.24 (2026-11-04)

- **Helmets.** The armed response wears ballistic helmets in Moscow, Beirut and Cairo; London's still wears caps. The helmet is drawn on the street and on the close figures: a matte dome to the brow, down over the ears. It takes 55% of hits to the head (the face is bare) and turns nearly every pistol round: of head hits at 10 m from a Makarov or a Glock, half are turned, and the deaths halve (61% to 28%). It turns a rifle's round 1% of the time. A turned round leaves no wound, only a daze for 2 to 6 seconds: an officer loses his aim for that long, and you stagger. The read shows "a ballistic helmet".
- **Their armour, off them.** On someone who's down: "Take their plate carrier" (a minute), their helmet (15 s more), or the soft vest from under their top (two minutes, and only once you know it's there, by a search or a read). It's yours then: worn, with its last owner's stopped rounds still in it.
- Tests: armour (the helmet against four guns; Moscow's response); downed (a carrier and a helmet taken; a soft vest only after the search).

## v0.1.23 (2026-11-04)

- **The chief's office has an armoury.** T at the chief's office now opens a card:
  - **What's on:** the mind's Ahead, as before.
  - **A sidearm, and a permit to carry it,** where the law lets a diplomat carry one. In Beirut, the security office files with the Ministry of Defence and the permit comes back in three days; collect it at the chief's office: the station's SIG on the belt, a spare magazine, a box of fifty, and a permit good for a year. In Cairo, the Interior Ministry takes a week, and the chief only asks when your heat is 60 or more. In Moscow and London the chief says no, and why.
  - **A vest** from the security office's stores, where the post keeps them (Beirut, Cairo), worn under your clothes.
- **A permit at a stop.** A Lebanese police search that finds the gun your permit names reads the permit twice, copies its number, and hands both back. Without a permit, they take the gun.
- Tests: `tests/armoury.test.mjs` (the sidearm and the vest, city by city; Beirut end to end); police (a gun on a permit at a Beirut stop).

## v0.1.22 (2026-11-04)

- **The black market.** A gun is a whole thing to come by now:
  - **Finding a seller.** A quiet word at a bar's counter (a London pub; a Cairo ahwa) asks for what you can't buy in a shop. It takes 25 minutes and a round. It's a Social roll, harder where guns are rare: DC 9 in Beirut, 13 in Cairo, 14 in Moscow, 18 in London. Got, the barman writes a number on a beer mat. Missed, he watches you to the door, and in Moscow or Beirut the opposition hears of the question.
  - **The order.** The seller is in the mind's People, under Off the books, with what he has and his price. Beirut is cheap and well stocked: a Canik for $100, an AKM for $300. London is dear and thin: a converted blank-firer, or a Glock. Ring him from a burner. From your own phone, a diplomat's number is on a gun dealer's bill, which costs you heat and the police's interest.
  - **The drops.** He names two dead drops on the posting's streets, park benches: the envelope behind one's leg by the next night, and the goods behind the other from the day after, for two days. At each bench, T. The goods are used, with a spare magazine and a box of twenty, in a carrier bag that you put away in the flat.
  - **What can go wrong** is settled when you ring. A scam (9% in Beirut, 18% in Cairo, 21% in Moscow, 29% in London): nothing behind the bench, and the money's gone. A sting (2% in Beirut, 12% in Cairo, 15% in Moscow, 25% in London): plain-clothes police waiting at the second bench, the station, the ambassador told, cover −30, heat +30. Leave the envelope too late, and the deal's off.
- **The police keep their own file on you.** It's separate from the opposition's heat:
  - **What adds to it:** your name taken at a stop (+2), a search (+4, or +15 when it finds something), walking off as a diplomat (+6), being taken in (+30), your description going out after violence (+20), a gun dealer rung from your own phone (+10), a sting (+50).
  - **What it costs:** a patrol is likelier to stop you, twice as likely at 40 and three and a half times at 100.
  - It cools by 2 a day.
- **The character sheet, less wordy.**
  - **Fitness** is a picture now: the number, seven cells round your base showing how far above or below it you're keeping, and this week's training as a bar, with a tick where it keeps you as you are and one where it makes you fitter.
  - **Tradecraft** is its bar and a thin bar of XP toward the next point.
  - What these mean is on an infocard when you hover: what Tradecraft multiplies and what it lets you feel; what the skills' marks and rust mean; how the fitness picture reads.
- **The sheet shows the legend you're under.** When you're under a false identity (Blown's translator), the sheet's Your legend says the name, what you are on paper, the passport, and what happens if it breaks: no immunity, and nobody will say you were ours. Under the embassy's cover, the posting says your own name, a diplomatic passport, and expelled rather than jailed.
- Tests: `tests/market.test.mjs` (each city's odds and prices; the whole buy in Beirut; a sting in London; an envelope never left; the police's heat doubling a stop's odds at 40).

## v0.1.21 (2026-11-04)

- **Shooting ranges.** Some of the martial-arts clubs are ranges now; nothing else on the streets moved. What a visitor may shoot follows each country's law:
  - Moscow's ТИР: a pistol under an instructor ($30), or the AK ($45).
  - London's rifle clubs: a club .22 as a member's guest ($15). Handguns have been banned since 1997.
  - Beirut: a club Glock ($35), or the M4 ($50).
  - Cairo's shooting club: a day pass with a CZ ($25), or trap with a shotgun ($30).

  A session takes an hour and a quarter. It keeps Weapon handling from rusting and trains it up to 14 (12 with London's .22). In Moscow, where the FSB watches embassy staff, the man at the desk takes your passport details slowly: heat +3 (+1 in Beirut).
- **An umbrella is an umbrella.** In your hand, it no longer counts as "something in your hand" to anyone looking: not to a patrol deciding whether to stop you, and not to a search, which no longer takes it. The same goes for a bottle, a walking stick and a bike lock. A knife in your hand still multiplies a patrol's odds of stopping you by 4.5, and they take it. When they search you, they now say only what showed: the blood, or the thing in your hand, not both.
- **In the flat, what's at hand comes first.** At the window, the armchair, the basin or the table, the instinct offers that spot, and T does it. Before, an assignment's "be off by" or tiredness took its place, so the window had no T. The reminder now follows on the same line.
- **The books card, redone.** One row per book: its title, its subject, where it is (on you, in the bag, on the shelf), and a bar of how far you've read. Its number, or a click, reads it for ten minutes. At the armchair a small button takes it with you or leaves it on the shelf. Books still to finish come first, finished ones at the bottom, and a long shelf scrolls.
- Tests: clubs (a range in four cities), police (the umbrella and the knife), and `tests/armour.test.mjs`.

- **Body armour.** Two kinds, covering the torso only.
  - **A soft vest** goes under your top and isn't drawn. Three torso hits in four land on it. It stops nearly every handgun round: a Makarov, a 9 mm, a .38 or a .45 98–100% of the time, a .357 95%, buckshot 95%. A Tokarev's round gets through more than half the time up close (45% stopped within 10 m, 80% from 40 m). The MP7's and the Val's rounds, made for this, go through nine times in ten, and no rifle round is stopped at all. So of torso hits from a Makarov, a Glock or a 1911, about three in four are stopped; from any rifle, none.
  - **A plate carrier** goes over your top and is drawn there, on the street and on the close figures: plates front and back, straps, three pouches, POLICE across the chest on police ones. The plates take half the torso hits and its soft panels a quarter more. They stop every pistol round, and rifle rounds 85–96% of the time (5.45 95%, 7.62×39 96%, 5.56 92%, 7.62×51 90%, the SVD's 7.62×54R 85%). So of torso hits from an AK-74M, an AKM or an M4, nearly half are stopped; from an SVD, 43%. A round that goes through either kind is slowed (85% of its damage through a vest, 60% through a plate), and each round stopped wears that layer a little.
  - **A stopped round still hurts.** No bleeding, but a bruise behind it: about 1.6 points on the torso for a 9 mm into a vest, 3.2 for an AK round on a plate, 4.4 for the SVD's (hurt ribs). A cracked rib one time in twenty for a 9 mm, one in eight for an AK round, one in four for the SVD's. And a moment's knock: an officer loses his aim for a few seconds, and is knocked off his feet one time in five by an AK round on his plate. You stagger, and your aim's gone.
  - **First aid and your read say what happened.** Anyone sees a hole in the clothes with no blood under it. A look (Medicine) finds "a bruise the size of a fist, where the vest stopped a round", or "a black bruise the size of a hand, where a plate stopped a rifle round". The close figure marks it as a hole with no blood, the lead grey in it.
  - **Blades**: a plate stops what lands on it. A soft vest turns 70% of slashes (the rest cut shallow), a quarter of knife thrusts and one point in ten (a screwdriver goes through the weave). A carrier spreads a blunt blow (0.7 of it); a vest takes a tenth off. In knife fights to the end, deep torso wounds fall from 0.40 a fight to 0.22 in a vest and 0.17 in plates. The knife still wins about as often: the head and the arms are bare.
  - **What it costs**: a carrier slows the walk and the run (×0.92) and makes a kilometre on foot 1.5× the training. It's warm: in a jacket in 30 °C sun, the core settles 0.5 °C hotter in a vest and 1 °C in a carrier (too hot); in the cold it helps a little. And it's seen: +4 to anyone looking for you, and to a patrol's odds of stopping you.
  - **Who wears it**: every armed response, in carriers over the uniform. Beirut's response is the army now: soldiers in olive with coyote carriers. Patrol officers wear a soft vest under the shirt by their country (London 95%, the US 85%, Beirut 30%, Moscow 20%, Cairo 10%). The umbrella's minder wears one about one time in three.
  - **Noticing a vest**: a carrier anyone sees. A soft vest only up close, by your Awareness, the distance, what's over it and the light. At arm's length, Awareness 10 catches it under a jumper 80% of the time and under a coat 44%; Awareness 3, 45% and 9%. A round of yours stopped by it, a grip on them in a fight, or a search tells you too. Your read and first aid show it ("Under the jumper: the stiff, square line of a vest…"), and your sheet and your pockets (I) say what you wear.
  - **The embassy's arch** rings for a carrier's steel plates (off, through the X-ray, back to you; no cover lost), not for a soft vest.
  - **Where to get one**: the free walk puts a soft vest on you (`&armour=heavy` a plate carrier, `&armour=none` nothing). In the flat, the wardrobe puts either on or takes it off (4 minutes), and a carrier comes off at the door.
- Tests: `tests/armour.test.mjs` (torso hits from ten guns on no armour, a vest and a carrier; blades and knife fights; the costs; noticing a vest; who wears it; the read and first aid's words; you shot in a vest; the wardrobe and a save; the carrier drawn).

## v0.1.20 (2026-11-04)

- **Hale's exercises are booked, not jumped into.** On the phone, Hale offers to book them: all seven, or one at a time until you've enough. He doesn't send you into the lessons there and then any more.
  - **On his first call**, the station gives you the days before your desk to settle in. The lessons go one a day from tomorrow, each at its own hour: tailing at 16:30, being tailed at 19:00, the photograph at 13:00, the brush pass at 18:30, the dead drop at 15:00, Blown at 18:45, the umbrella at 18:00. Your desk at the embassy starts the day after the last one, and the station's assignments start after that. Nobody at the embassy expects you on those first days.
  - **Booked later**, a lesson takes the first free slot from tomorrow: an evening after the desk on a working day, or a day off at its own hour, the morning or the afternoon. One a day, and at least two hours from any assignment.
  - **Each is an assignment**: in Ahead on the mind, walked to (a door, a bench or a café on your streets), begun there with T, and played on the posting's own streets at its hour, as your officer is, in the real weather, with Hale in your ear.
  - **The lessons speak the city's language**: Moscow, the FSB, Lefortovo and "November" become the city you're in, its opposition, its prison and the month it is. A legend's first lesson opens as Hale's evening "to watch".
  - **Afterwards**: Hale's debrief, a little Tradecraft (0.4 of a real assignment's), and the core four kept up. Nothing goes on the record: no heat, no intelligence. Miss one, and he waited and went home.
  - The Farm's mat stays in the title's tutorial, as a memory.
- **The embassy's Marine is a Marine.** The guard at the desk reads as a well-trained soldier now (Warfighting 50; close combat 14, weapon handling 16, fitness 16, awareness 12), not as a little-trained civilian.
- Tests: `tests/lessons.test.mjs` (the first call's booking before the desk, a later one's free slot, each lesson played on Moscow's and London's streets in their words, folded); the browser test books the first lesson from the phone and begins it as an assignment; interiors (the Marine).

## v0.1.19 (2026-11-04)

- **Hailing a taxi from either kerb, with one alongside.** You count as at the kerb within 2 m of its edge (it was 1.2), on the south pavement as on the north. A free taxi right next to you or just past you can be hailed now. Before, it had to be 12 to 90 m off. It pulls in a little ahead, where it can stop, and you're asked where to once you've walked to its door.
- **Language schools teach more than one language.** Moscow's and London's teach Russian, Arabic, French, German, Spanish, Chinese and Persian; Beirut's and Cairo's Arabic, French, Russian, German and Spanish. A bookshop keeps grammars of three of them: the city's own, and two others. A grammar bought before is still the city's language.
- **Community centres and their clubs.** Some of the language schools are community centres now: Moscow's House of Culture, London's community centre, Beirut's centre culturel, Cairo's Palace of Culture. Nothing else on the streets moved. At the desk is the week's timetable:
  - the amateur dramatics (Deception and Social; Tue and Thu 19:00);
  - the chess club (Analysis; Mon and Fri 18:30);
  - the radio club (Tech; Wed 18:00);
  - the first-aid course (Medicine; Tue and Fri 18:00);
  - the dance class (Social; Wed and Sat 19:30);
  - the walking club (Pathfinding; Sat 09:00);
  - the photography club (Awareness and Tracking; Sun 10:00).

  A club is open from an hour before it starts to 15 minutes after; you wait for the start, then sit it out. A session keeps its skill from rusting (two a month do it, and each takes a level of rust off) and trains it a little, up to 12. The dance class and the walking club count toward your fitness too. When a skill rusts, the note now says what keeps it up.
- **Any assignment keeps the core four.** Going on an assignment, however it goes, takes all the rust off Deception, Tracking, Pathfinding and Awareness, and counts as that month's practice for them. Before, only the skills you rolled were kept up.
- **Bus stops are at least 300 m apart on a street.** A line's stop that would be closer joins the one already there, and the lines share it. Parked cars and notice boards move with them; nothing else does.
- **Park kiosks sell what their signs say.** A newsstand is signed as one; the others are coffee, tea, ice cream, flowers, ka'ak or cold drinks, with matching goods behind the glass, and that's what you buy there.
- **The umbrella from behind:** the hand holding it no longer shows through your back.
- Tests: `tests/clubs.test.mjs` (a centre's week, a session, a club not meeting, in four cities); fitness (fieldwork clears the core four); taxi (the south kerb, a taxi alongside); the cities golden hashes re-set on purpose (a centre where a school was; the stops apart).

- **The character sheet (C), redone.** It's dark now, like your read of someone and the first-aid card, and in four columns:
  - **On you:** your figure as you look right now, with your wounds drawn on it and numbered, and a line for each, as on the read. Below that, your blood and how long it gives you, pain, cold or heat, tiredness, hunger, how fit you are and this week's training, and what you're carrying. A crack or bleeding inside only shows once you've had a look at yourself (H), as with anyone else.
  - **What you are:** Tradecraft, with the XP to the next point and what it lets you feel, then the skills table: level, practice, the × Tradecraft column, the value, and the rusty and kept-up/let-go marks.
  - **The file:** age, sex, languages, background, and for a legend why they came back. In the campaign it also has the posting (rank, station, since when and which day it is, the cover, the tasking and how much you've delivered, the network, how the heat and the embassy look to you), the postings before it, the assignments done and missed (the last four, each ending as you know it, so a target you spooked without seeing it shows as "he was spooked"), and the weekly reviews. In the free walk it's you and your cover.
  - It fits a 1280×720 window. On a smaller one the file moves under the rest, in three columns.
- Tests: `tests/campaign.test.mjs` (the file's record: postings before, assignments done and missed, a spooked target as the officer knows it, the reviews).

## v0.1.18 (2026-11-03)

- **The coat off at the door.** Coming into the flat, your coat goes on the hook by the door (its pockets still yours while you're in) and the umbrella in the stand. You wear what you wear indoors: the last top you had on inside, else a jumper from the wardrobe. Going out, the door asks which coat (the one on the hook, any in the wardrobe, or none) and whether you take the umbrella. The coat you leave behind goes in the wardrobe. Step away from the door to stay in.
- **Groceries.** The flat's kitchen starts with six meals in it, and each meal at the table takes one. When it's bare, you need a grocer's: food for a few days (3 meals) or a week's (7), carried home in the shop's bag and put away as you come in.
- **Legends are good at everything.** Every skill has a floor now: 18 for the field skills, close combat and the gun, 16 for fitness, 12 for analysis, tech and medicine. A legend you're playing is raised once, when the save loads.
- **Across the road, properly.** Your quarry's check now knows the street's two roads: across either one from him is −3 to his eye, and the boulevard's railings between you −1. Before, only the north pavement counted as the other side.
- **Sunglasses come off after dark,** on anyone wearing them.
- **An umbrella keeps you short of damp in calm air,** and short of wet through in a strong wind. In a gale it's no use.

## v0.1.17 (2026-11-03)

- **Keeping fit.** Fitness, the skill, is now your base. Your effective fitness, what your body actually does, sits up to 3 above or below it depending on how you train. The week's training is counted:
  - **The load:** a gym session is 10 points, a class at the club 7, each kilometre walked 0.6 and run 2.5.
  - **Week's end:** at base 10, 45 points (four sessions and a little walking) put effective up a point, under 22 it drops one, and in between it holds.
  - **Two weeks at an edge move the base.** Two weeks running at +3 raise the base a point and leave effective where it is, so you're +2 and can climb again. Two weeks at −3 lower it the same way.
  - **Higher is harder:** base 14 asks 63 points to climb, 18 asks 81. Near the top there's less room above, and at the top (24) you can never be above your base: holding it takes seven sessions a week and plenty of walking.
  - The gym now gives a week's training rather than base fitness directly. Your sheet shows your base, where you are against it, and this week's load against what it asks.
- **Rusty skills.** A skill above 15 needs two practice sessions in each four weeks: a class at the club is one for close combat, a fight in the street two, and every roll a quarter of one, so what you use in the field keeps. Short of that, it's a step rustier each month, up to three, each step costing a sixth of what it's above 15. A legend's CQC of 30 left alone three months fights at 22, and each session takes a step back. Fitness has its own keeping, and this only runs in the campaign.
- **Out early, with cover.** When you leave the embassy early for an assignment, the chief's assistant reminds you of your "appointment" loud enough for the section to hear: the dentist, a reception, the plumber at your flat.
- Tests: `tests/fitness.test.mjs` (the weeks of training up and down, the top of the scale, rust by the month and its practice back).

## v0.1.16 (2026-11-03)

- **Fixed: a hood from the side still showed the jaw and neck.** It stopped two rows short of the head's bottom. It now comes down to the collar, the face showing only in its opening (brow, eye, nose), and a beard stays inside it.
- **Shop signs you can read turn into English.** If your character reads the language of a sign (Russian in Moscow, Arabic in Beirut and Cairo, French in Beirut), the sign turns into English every so often and back again. A dithered wipe crosses it the way the words read (right to left for Arabic), so the sign stays itself and you can still see it isn't English. ОБУВЬ turns into SHOES, PHARMACIE into PHARMACY, ОБМЕН ВАЛЮТ into EXCHANGE. Each sign keeps its own time: about 9 seconds in its words, 3½ in English. On a two-script sign only the half you read turns. Letters on bare wall keep the wall behind them, and shop boards keep their style and their glow at night. A language you don't read stays as it is.

## v0.1.15 (2026-11-03)

- **Hoods, redrawn.** From the side, a hood now closes under the chin and runs down the back of the neck to the collar, with a rim round the face. Before, it stopped at the jaw and read as hair over a bare neck. From behind it has a seam.
- **Headscarves, redrawn.** An oval round the face, wrapped closed under the chin and draped smooth over the shoulders: no more knot in front. No hair shows outside the scarf, or as a fringe inside its opening.
- **Glasses, redrawn.** Spectacles are thin grey frames round each eye, with the eye showing, a bridge, and arms to the temples. Sunglasses are the same frames with dark lenses and a glint. Before, they sat a pixel off and covered the eyes: a grey band across the face.

## v0.1.14 (2026-11-03)

- **The emergency services.** Someone down in the street (shot, knocked flat, collapsed, dead, you included) and seen by passers-by gets called in. The caller stands on the phone for a while.
  - **When they come:** police and an ambulance, each in its city's minutes. Moscow's police take 8 to 15 and its ambulance 12 to 25 (its legal norm is 20). London's police take 6 to 14, its ambulance 6 to 12. Beirut's police are slow, 10 to 25, and the Red Cross ambulance quicker. Cairo's both take 10 to 30.
  - **Your instinct's timer:** if you see or hear the call made, the watch shows how long they'll be. At Tradecraft 70 and over it's to the minute ("police: 6 min · ambulance: 9 min"), from 40 it's "about" so many, and under that it's "a few minutes", "any moment", "a while yet". The guess is off by more the less Tradecraft you have.
  - **They come by car:** an ambulance and a police car in the city's colours (Battenburg in London, the white and blue ПОЛИЦИЯ in Moscow, the Red Cross in Beirut), lights flashing, pulling up at the kerb.
  - **The paramedics** kneel and work (what's bleeding on the outside gets dressed), then stretcher the casualty away, the dead under a sheet. In hospital, the bleeding inside is stopped. If it's you, it's eight hours there; if the police have your description, there's an officer in the corridor.
  - **The police** tape the place off for a day, leave an officer posted at the tape ("Police line. Back, please."), and take statements. The tape and its officer are still there when you come back to that street.
- **Your description.** If you were seen at it (a shot, a killing, a fight) in the two minutes before the call, the caller describes you: what you were wearing, your hat, your hair. Every officer in the city has it for four days. One who sees you dressed like that knows you, with the order, the cuffs, and the armed response if you're armed; in the campaign your cover standing drops 35, once. Change your coat, hat or hair, and they don't.
- **Fixed: the flickering stripes up the buildings.** A façade took its fog of view from the rooms behind its front, seen through its windows or not, which striped it top to bottom and shifted as you walked. Now a wall reads as the pavement in front of it.
- **Umbrellas and bags, held as people hold them.** With the umbrella up, the arm is bent and the fist is at the chest, holding a shaft that runs up to the canopy's middle, still as they walk. A closed umbrella hangs from the hand, its tip by the ankle. A shop's plastic bag, a briefcase or a newspaper hangs from the fist wherever the arm swings (from the other hand when one's on the umbrella). Before, a bag or a paper was a white block on the chest.
- Tests: `tests/emergency.test.mjs` (the call and the minutes, the guess by Tradecraft, the ambulance and the police at work, the description and a change of coat).

## v0.1.13 (2026-11-03)

- **Fixed: police shot from the ground, and kept shooting you when you were down.** An officer who's been shot down stays down and doesn't fire. With you down, or your hands empty, they cover you without firing, and the nearest comes in to cuff you. You can't go into shooting mode lying down, or with both arms out.
- **Aiming without a list.** The mouse over someone in the picture puts the brackets on them, with how long the aim takes. A click aims; a click on whoever you're aimed at fires. The arrows move the brackets to the next one along, and Enter aims. Only what's in the picture can be aimed at.
- **Someone on the ground:** no punches or talk. Tie them up with their own belt and laces (a minute; they stay down after they come round), search them (their weapons come to you if there's room), or kill them with what's in your hand:
  - a blade across the throat (4 s);
  - something heavy (8 s);
  - the gun to the head, which is heard like any shot;
  - bare hands, strangling them (two and a half minutes, longer if your CQC roll fails).

  Each takes its time crouched over them, and moving away first undoes it. Anyone who sees counts it as a killing.
- **Bullet wounds bleed at a human pace.** A chest wound bled at an artery's pace; now it's about 3% a minute. Two rounds in the chest, untreated, put someone down in about 8 minutes and kill in about 10: time for first aid. The bleeding inside the chest is now one bleed, faster for each bullet, and takes about two hours to kill without a hospital.
- **Your sheet counts its wounds.** The same wound twice reads once with how many ("a gunshot wound in the chest (×10)").
- **Legends are armed.** Every legend came through the Farm, so CQC and Weapon handling are 18 at least: about 30 with their Tradecraft. A legend you're already playing is raised once, when the save loads.
- **Cars in your blind spot aren't drawn,** as people there aren't.
- **Knocked out comes round again.** A man laid out in a fight gets up on his clock, as before; only what really keeps someone down (blood lost, both legs gone, a bullet in the skull, the chest gone) keeps them there.

- **A look at the wounded.** Reading someone hurt, or opening first aid on them (or on yourself, H), shows them close up, drawn as the inventory draws you, with every wound marked where it is: the bullet hole and the blood soaking the coat, drips as long as it bleeds fast, a cut, a split lip, a black eye, a bandage, a tourniquet, a splint, a ring round the belly where it bleeds inside. Each wound has a numbered plaque beside the figure, and the same number on its line in the list and on first aid's options for it.
- **Medicine reads a body.** Anyone can see where the wounds are, whether someone's down, bleeding badly, pale. A Medicine roll (against 10) finds more, the better it's made: what made each wound (a bullet, a graze that didn't go in), how fast it bleeds, an artery, a break; then whether a bullet came out or is still in, a cracked rib, what it'll take (a dressing, stitches, a splint, a hospital); and, made by 8, bleeding inside, how much blood is left and how many minutes that gives. A failed look says so, and says the safe thing: you can't tell what's inside, treat it as bad. Over 400 looks at a woman shot twice in the chest: untrained (Medicine 0), the look's made 56% of the time and finds the bleeding inside 14%; Medicine 10, 93% and 66%; Medicine 20, 96% and 96% (a natural 1 fails anyone). Looking again a minute later rolls again; what you've seen, you keep.
- **Your read, reworked.** The figure and the wounds on the left, what you see of their body in the middle (up or down as they are right now, not as they were), your read of their skills on the right. If they're hurt and within reach, a First aid button (H) takes you straight to first aid for them.
- **First aid only lists bleeding inside once you've found it,** and names wounds as far as you know them ("a wound in the chest" until a look says it's a bullet's). Your own blood stays to the per cent.
- **Bullets go through or stay in.** A pistol round stays in a chest about 60% of the time, and goes through an arm or a leg more often than not; heavier rounds go through more.

## v0.1.12 (2026-11-03)

- **Guns are drawn as they're held.** Anyone holding a gun, you or an officer, carries it low, pointed at the ground. Aiming, the arms come up toward the target: a handgun held out in both hands, a long gun at the shoulder, angled up or down the picture when that's where the target is. Each round kicks the muzzle up and flashes, and at night the flash lights the shooter's face. Tests: `tests/gunpose.test.mjs` (the pose by the actor's state).

## v0.1.11 (2026-11-03)

- **Fixed: picking up a dropped magazine broke the game.** Anything lying about is now named the same way everywhere.
- **No gun at the start of a campaign.** Debug mode no longer puts a pistol on you in a campaign. The free walk, the sandbox, now always starts you with one: a SIG P229, a spare magazine and a box of 9 mm. Anywhere else, it takes debug mode and `?gun` in the address. A save made before this release loses the pistol, magazine and rounds that came from debug mode or the old issue. The "box of unknowns" was those rounds, shown without their calibre: that's fixed too.
- **Aim, then fire.** Fire waits on an aim. Aim… asks what at: a list of the seven people and things most in front of you, each with its distance, its side (ahead, 30° right, behind you) and how long the aim takes. The arrows move the brackets along the list, and a digit or Enter aims. On screen, brackets frame what's picked (pale) or aimed at (red), with the part, the odds once aimed, and the distance.
- **The safety, the selector, the decocker.** They're near instant in skilled hands: an expert's safety takes 0.13 s, a Handler's 0.6, the untrained 1 s. The SIG P229 and P226 have no safety, as the real ones don't; instead they're carried decocked. The slide cocks the hammer, and Decock lets it down to put it away. The first pull is double-action (a touch slower and less sure), and a fumble with the hammer down is less likely to fire. A gun with no safety says so.
- **Muzzle discipline.** A gun that goes off in a fumbling hand was pointed somewhere safe, the ground or the floor, if the hand was trained: never untrained, 29% at Weapon handling 10, 71% at 20, 97% from 28.
- **The kitchen table.** With a gun, magazines or rounds on you, the flat's kitchen table offers the gun's work:
  - unload: the magazine out, then the chamber cleared;
  - load: a magazine in, a round chambered, made safe;
  - strip and clean (20 min);
  - fill a magazine from the box, or empty one into it;
  - recondition a magazine: its spring and lips (10 min).

  Each is a Weapon handling roll, and fumbles cost something. Untrained hands fire a round into the table now and then (the building hears it), lose rounds under the furniture, put a gun back together wrong, or bend a magazine's lip so it feeds badly. Over 400 tries each, an expert did none of it. Worn magazines jam more.
- **The embassy's metal detector.** A gun, a magazine or rounds on you ring the arch in the lobby, whether you walk through it or come in for the day's work. The security office takes them, the chief gets a report, and your cover standing drops 25. A knife goes through the X-ray tray and comes back.
- **Shot people stay down.** Someone who can't stand now stays down, whatever the clock. Before, the shot got up after a minute.
  - Hit in the body: down for 10 to 40 minutes. A leg: 1 to 4. The trained get up four times sooner.
  - A chest wound also bleeds inside, which first aid can't stop.
  - A head shot kills 60% of the time. The rest are grazes (dazed, bleeding) or a bullet in the skull: out cold and bleeding inside, dead within the hour without a hospital.
- **Wounds slow everyone, you included.** Hurt legs, a hurt torso, blood lost and a fresh bullet wound slow the walk, and badly hurt or in shock, nobody runs.
- **Fleeing people run.** Before, they walked very fast.
- **Blood washes away.** Rain clears it from the street, a downpour in under an hour. In dry weather it fades over days. Blood spilt indoors stays.
- **No rain inside a shop.** Nothing falls on what's under the roof of the shop you're in.
- **First aid:** two wounds of the same kind are told apart ("the first gunshot wound in the chest", "the second"). A bleed inside says nothing can be done for it there.
- Tests: `tests/gunwork.test.mjs` (the table's jobs and their fumbles by hand, the decocker and the thumb's speed, muzzle discipline, the arch, the wounded staying down, head shots).

## v0.1.10 (2026-11-03)

- **The reflex.** When you see something coming, time stops and a card asks what you do about it. Nothing is always one of the choices, and closing the card is nothing. It comes up three ways:
  - **Your quarry about to check behind him.** When you read his tell, you're offered the covers at hand: the shop window, a bench, your phone, a shoelace. Or walk on.
  - **A hand reaching for you**, a hunter's or the umbrella minder's. It's your Awareness against their Deception, harder each time. Step back and the hand closes on air. Run, and you're off before it closes. Meet it, and the fight's first edge is yours. Or go for your gun, if you carry one.
  - **An officer going for his gun**, or bringing his rifle up. Drop yours and show your hands (he holds, and you're taken in rather than shot), aim at him, or run.
- Tests: `tests/reflex.test.mjs` (the tell's covers, time standing, the hand made to miss, met with the edge, the officer's draw and the gun dropped).

## v0.1.9 (2026-11-03)

- **Armed police.** Patrols now carry their country's sidearm in a holster: a Makarov or a PL-15K in Moscow, a Browning or a Glock in Beirut, a CZ, a Helwan or a 686 revolver in Cairo. London's patrols carry nothing. A gun in your hand sends the passers-by who see it running, and now and then one calls it in; so does a shot that's heard (not a suppressed one). An officer who sees it, or hears it, shouts the order, in the country's words. Put it away or drop it, keep your hands empty, and you're taken in: the gun taken, three hours at the station until the embassy's man comes, +25 heat, cover standing −30. Keep it in your hand past the order, or fire, and an armed officer draws and shoots, going through the same steps you do, in real time (a Moscow patrolman fired 3.8 s after his order). An unarmed one holds back.
- **The armed response.** A call, an officer's or a passer-by's, brings the country's armed unit within its minutes: London's in 4 to 8, Moscow's in 6 to 12. Three officers arrive at the end of the street, long guns up (an MCX or a G36C in London, an AK-74M in Moscow, an M4 in Beirut, an MP5 in Cairo), and they stand down after a minute without seeing you.
- **Out early for an assignment.** An assignment that starts before six on a working day used to be lost to the day's work. Now the work ends in time to get there, ten minutes to spare beside the trip, with an excuse for the section (a dentist, a call from a friend's school…), and the cover standing it earns is the share of the day you worked.
- Tests: `tests/armed.test.mjs` (patrols armed by country, the order and the shot, taken in, the armed response); the early finish for an assignment.

## v0.1.8 (2026-11-03)

- **Dry indoors.** In a shop, the floor no longer takes the street's rain: no wet sheen, no puddles, no snow or frost on it. And an umbrella comes down, a hood goes back, under a roof.
- **Sleeplessness keeps costing.** Past 20 hours awake you were −3 to every skill however long it went on. Now it keeps chipping away, a point more every three hours: −4 at 24 hours, −6 at 30, −8 at 36 ("dead on your feet"), −12 from 48 ("seeing things for want of sleep"). Sleep wipes it.
- **One hard session a day.** After a session at the gym or a class at the club, the next one waits 18 hours: it's on the list, greyed, with the reason ("you trained today: your body needs a day of it").

## v0.1.7 (2026-11-03)

- **Taking out a gun means using it.** G (or Take out in the pockets screen) with a gun no longer just puts it in your hand as you walk. Time stops and you're in the shooting sequence, with the draw as the first step. A knife's G is as it was.
- **Fumbles have consequences, by your hand.** Missing an action's roll by a little is a fumble that costs time. Missing by more drops the gun or the magazine at your feet. Missing badly, with the gun ready to fire, means it goes off, and the round flies. Drawing, it goes into your own leg a third of the time (holstering, nearly half). Otherwise it goes where the gun was pointing and can hit whoever's in its line. A natural 1 depends on the hand: an untrained one drops the gun or fires it, a Handler's sometimes drops it, an expert's only fumbles. Over 2000 draws of a chambered Glock: the untrained dropped it 56 times and fired it 28; a Handler dropped it 34 times; an expert never did. The words say what happened ("It slips out of your hand and clatters on the ground").
- **Ammunition by its calibre.** Loose rounds come in boxes named for their cartridge (9×19 mm Parabellum, .38 Special, 5.45×39 mm…), and magazines for their gun and calibre ("a SIG P229 magazine, 9×19 mm Parabellum"). A box can be put down from the pockets screen and picked up again, and left in the flat's drawer and taken out again.

## v0.1.6 (2026-11-03)

- **Waiting for a bus, just by waiting.** A bus only ever came for someone sat in the shelter (R at it). Now standing still at a stop for a few seconds is waiting too: you take a seat in the shelter, and when the bus pulls in it asks where to. Pick a stop with its number; the card's last line is standing by the doors to step off as they close.
- **No gun by default.** The station's pistol is no longer in the flat's drawer: guns are rare and, in most places, illegal, and getting one will be its own undertaking (the law where it allows it, the black market where it doesn't). Debug mode still puts one on you to try them.
- **Stations, one file each.** Nothing changes in play: the same words, the same dice, the same streets, and saves load as they did. Under it, the rest of what each city had in other modules' tables now lives in its profile: its targets and assets, its opposition's names in the briefs and the scenes, its metro, buses and station fronts, its flats and its embassy, the free walk's words, its lines on the title and the promotion paper, and the first tour (London's) and the trips abroad. Adding a station is now its city file and, if its country is new, a country file (DESIGN.md, Stations and countries); only the weather's climate and a few drawing touches are still elsewhere.

## v0.1.5 (2026-11-03)

- **Dress for the day.** Each day has its feel from its temperature, freezing to hot, and the city's passers-by dress for it: coats and beanies in a Moscow freeze, T-shirts and dresses in a Cairo heat, a mix on a mild day. Robes and uniforms stay as they are. You're held to it too: dressed for another season, you're easier to pick out (+1 a step, up to +3: a T-shirt in a freeze is +3, a coat in the heat +2), and so is an umbrella in your hand under a clear sky (+1).
- **Your warmth.** You have a body temperature now. Out of doors it drifts by the air, the wind's chill, how wet you are, the midday sun and what you're wearing. Running warms you, and inside you come back to normal. Below 36 °C you shiver, below 35 it's hypothermia (slower, −3 to every roll), below 31 you go down, below 28 you die. Above 39.5 it's heat exhaustion, above 41 heat stroke. Your body holds what it can: overdressed on a warm day you're too hot, and no worse. At −15 °C in a breeze, a T-shirt gives you some 17 minutes before hypothermia; a coat and a hat keep you going for hours. Wet through in a jumper at 5 °C in the rain, about three and a half hours. A coat in Cairo's 38 °C midday sun, an hour and a half to heat exhaustion. The log, the sheet and the watch (the temperature is on it now) keep you told.
- **Streets that remember the weather.** The ground now remembers ten days, so a cold spell keeps its snow. Old snow goes grey as it lies, roads first, roofs last, and a fresh fall whitens it again. The puddles painted into the streets (London had extra) are gone: puddles now appear only where the ground is actually wet, so a dry week has none.
- **Hats sit on short hair.** Under a hat, a short cut drew tufts a pixel outside the head, which under a police cap read as long hair. Now a crew cut shows nothing under a hat, and a short cut a pixel at the temples, inside the outline.
- Tests: `tests/thermal.test.mjs` (the cold and the heat by clothing, wind and wet, and what they do; passers-by dressed for the day; dressed for another season and an umbrella in the sun; old snow, and a dry July). The sepsis test now waits it out indoors: twenty November days outdoors, the cold got them first.

## v0.1.4 (2026-11-03)

- **The city map, readable.** Tab's city leaf showed every street you knew at once, crushed into the box. Now it's a window on your street and two either side, centred on you (on the flat's or the embassy's door when you're inside), about 350 m across, drawn big enough to read. The arrows (on screen, or the arrow keys) move it, + and − zoom (five steps, 240 to 790 m across), and C centres it on you again. It stays where you left it between openings.

## v0.1.3 (2026-11-03)

- **Tradecraft grows of experience, slowly, and slower as it climbs.** A legend went from 95 to 97 on one tail. Now an assignment earns XP by its class, how it went, how hard it was (the target's craft, the team on you) and how risky (the station: Moscow 1.4, Beirut 1.3, Cairo 1.2, London 0.8; and your heat). Shaking off a team that was on you earns more than an evening nobody followed you (+6 an overt pair, +10 a covert team), and every roll of yours that goes your way earns a little (+0.1). Each point of Tradecraft costs more than the last: 8 XP at 20, 50 at 40, 312 at 60, some 7,700 at 95. So a beginner gains a point from a good tail, an officer at 40 needs four or five in London (fewer in Moscow), and a legend barely moves. The debrief says what you earned and how near the next point is.
- **Beginners and officers.** A first tour's three officers start round Tradecraft 20 (17–23), a posting's round 40 (35–44).
- **Legends, for everyone.** The Tradecraft 95 file no longer needs debug mode: it's under LEGENDS in the picker, with "Another legend" for the next.
- **Words that read one way.** Results said "SEEN", which could mean you'd been seen; a roll said "made", which in this trade is what you are when they've spotted you. Now a tail's result reads MEETING OBSERVED, YOU WERE MADE, HE WAS SPOOKED, LOST HIM, MEETING MISSED, COVER BLOWN; a photograph's SEEN, NOT PHOTOGRAPHED; a capture CAPTURED, an escape GOT OUT, a missed asset MISSED HIM, and the debriefs' titles say the same. A roll reads "passed" or "failed", and an opposed one "you win" or "they win", the right way round even when the roll was theirs (a watcher's Tracking against your Deception). A face you've noticed before is "familiar", not "seen before".
- **Countries and stations as data.** A station is a city's profile and its country's (`src/sim/countries/`). The countries carry their currency, their police and its arms, their gun laws, their black market and their ranges, from research on Russia, the UK, Lebanon and Egypt. The cities carry their station: its risk, how closely you're watched, the embassy and the cover, the opposition, what the agency wants there. The rest moves in the next releases.
- Tests: `tests/xp.test.mjs` (the cost of a point by level, tails a point by station, how it went, how hard and how risky, a team shaken off, a roll, the debrief); the legends' test reads XP.

## v0.1.2 (2026-11-03)

- **The arsenal: 43 guns.** 19 pistols (among them the Makarov, the PL-15K, the Yarygin, Glocks, SIGs, the Beretta 92, the CZ 75, the Browning, the Helwan, the Tokarev, the 1911, the PPK, the Canik, a converted blank-firer that misfires and jams four times as often, and a traumatic pistol whose rubber rounds bruise rather than wound). 2 revolvers. 7 submachine guns (the MP5 and the suppressed MP5SD, the Uzi, the Bizon, the PP-2000, the Skorpion, the MP7). 11 assault rifles and carbines (the AK-74M, AK-12, AKS-74U, AKM, the suppressed AS Val, the M4, M16A4, HK416, SIG MCX, G36C, FN FAL). The SVD and a bolt-action hunting rifle. The Remington 870 pump and the Saiga-12.
- **Each works as it does.** Magazines fit their family: an AK-74 magazine fits the AK-74M, the AKS-74U and the AK-12. A revolver swings out, empties, takes a round at a time and shuts; a dud just clicks on to the next chamber. A pump or a bolt-action leaves its case in the chamber until it's worked. Selectors go round in the lever's order (an AK's safe, auto, semi), and on auto a pull is a short burst of 4 (an M16's burst 3, an AK-12's 2), each round rolled separately as the muzzle climbs. An AK doesn't lock back on its last round. Calibres hit harder up the scale, and suppressed guns are heard a fraction as far: an AS Val burst sent 2 people running where an AK-74M's sent 29.
- **Long guns** go on a sling (one, and always seen) or in the hand, never in a pocket. They're 15% slower to handle and slower to aim and to come round, but they reach: an expert hits 95% at 50 m with an M4 and 60% at 100 m with an AK-74M, where a Glock is down to 5% at 50 m. A shotgun's spread helps inside 12 m.
- Tests: the arsenal (every model whole, loaded new, ready and firing), a revolver's cylinder, a pump, an AK's selector, magazine families, the sling; reach by kind, a burst, a suppressed gun heard close only, a rubber round.

## v0.1.1 (2026-11-03)

- **Guns.** A gun is a real thing now, with its own parts and state. It has a magazine with its rounds counted, a chamber that can hold a round (with or without a magazine in), a dud or a spent case, and it can jam with a double feed. The slide locks back on an empty magazine. It has a safety where the model has one, and a condition that wears with every round. Below 0.6 it misfires and jams far more often; below 0.25 it won't fire until it's serviced. The state goes wherever the gun goes: dropped, it's the same gun when picked up, and someone else's is a question until you check it. The pistols: the Makarov PM and the Yarygin, the Glock 17, the SIG P229, the Browning Hi-Power, the Helwan and the Tokarev TT.
- **Every action on a gun takes time and a roll** against Weapon handling: the draw (a holster at the beltline 1 s, a coat pocket 1.6, a trouser pocket 2.3, all times a pace), the safety, racking the slide, a magazine out or in, the slide release, the jam drill, a press-check, a round in by hand. The pace runs from the untrained at 1.6× to a master at half. A fumble costs 60% more time. A bad fumble in a poor hand is a mishap: the gun or the magazine dropped, or, with a round chambered and the safety off, a shot. From the beltline the untrained take 1.9 s, a Handler 1.4 s, an expert 0.9 s and a master 0.6 s.
- **Shooting, in stop motion.** X enters it: time stands still while you choose a step (the digits; the panel gives each step's time), and the world runs for that step's time as you take it, then stops again. Left and right pick the target across the picture (people, or things lying about); up and down the head, body or legs. A red plaque over the target gives the part, the odds and the distance. The aim takes longer the further off your front: behind you, a Handler needs 2.7 s and a master 1.2. Held, it follows them and steadies. A shot is a roll against the distance (a pistol gets hard past 15 m), the light, their movement, the aim and your body. A hit is a real wound: it bleeds, it can find an artery, to the head it often kills. A miss can hit whoever's behind. Everyone within 70 m runs from the sound, and in the campaign a shooting costs heat. X again leaves it.
- **G with a gun** outside the mode draws it or puts it away in its time, as you walk. A gun rides in a holster at your belt under a coat or jacket. The station's SIG P229 is in the flat's drawer from day one. In debug mode it's on you.
- Tests: `tests/firearms.test.mjs` (every part through its actions, stoppages and their drills, times and mishaps by skill, wear, the state carried with the gun), `tests/shooting.test.mjs` (time standing still, each step's time, the aim by angle and skill, hit rates by distance and skill, a bullet's wound, the street running).

## v0.1.0 (2026-11-03)

- **Alpha 1.** The release candidate validated by the user (2026-11-03: "promote the current version as 0.1.0, this is Alpha 1 worthy"): 0.1.0-rc56 as it was, the career from a first tour to a posting of your own, the tested missions on its streets, and the city round them. Work goes on in 0.1.x.

## v0.1.0-rc56 (2026-11-03)

- **The team that tails you knows only what it has seen.** Before, whoever was on you walked to wherever you really were, seen or not. Up a lane none of them saw you take, at night, they came and stood over you. In 12 evenings, an officer who walked up a lane and waited was never lost, even when nobody saw them go in. Now the team goes by radio: where one of them last saw you, and which way you were going. Out of sight, they make for that spot and on 4 s the way you were heading, looking about, and after 30 s (covert) or 40 s (overt) with nobody seeing you, they've lost you.
- **Losing sight of you is a roll.** When they lose you after having you a while (at most one roll in 10 s), the best tracker among those who had you rolls Tracking against your Pathfinding. The dark (−3), people round you (−1 to −3) and the distance (−2 a way off, −4 far off) are on your side; running is on theirs (+2); ties go to you. If they win, they saw where you went, round the corner or in at a door, for 6 s. If you win, all they have is where you were. Out of every eye and moved 30 m on, a master (Pathfinding 45) was lost 6 times in 6 and never came for; so was a Handler, the team reading where they'd gone once in 6.
- **Time passing doesn't keep them on you by itself.** In your own hours, a class or a book keeps the team on you only if they had you when it began (in sight, or watching the door of the shop they saw you go into). Before, any time skipped renewed them.
- Tests: being tailed, out of sight and moved (a master lost every time and never come for; a Handler's roll counted).

## v0.1.0-rc55 (2026-11-03)

- **Debug mode's files are masters of what made them.** Each Tradecraft 95 file now has a master's 20 in every skill its reason gives it, where some had 15 or 18: the illegal in Tracking and Social as well as the street, the defector in Analysis and CQC, the Farm's instructor in Social, CQC, Weapon handling and Fitness, the Berlin veteran in Analysis, the hostage in Pathfinding, the Naples pickpocket in Social and Fitness, the A4 watcher in Awareness, the one out of Tehran in Deception, Fitness and CQC, the embassy child in Awareness, the deaf officer in Tracking, Social and Analysis. Remote viewer and chess prodigy were already there. A small extra (the hostage's Medicine 10) stays small, and what a reason takes away (the old Berliner's legs, the remote viewer's fists) stays gone.
- **Why they're back.** Each file now says why someone like that is starting again, under its background: retired and back, burned and forgotten, pensioned and back with a lawyer, written off as dead. The Berliner is alone in the house since the spring; the one out of Tehran sat ten years at a desk while Tehran forgot the face; the defector is dead in the SVR's own files.
- **Hale knows who he's talking to.** His day-one call to a file from the basement is nothing like a new officer's. He has a line for each of them: he's taught from the defector's syllabus for fifteen years, sat down the corridor from the Farm's instructor, tried to lose the A4 watcher on the Northern line in '99, and to the one who walked out of Tehran he lets slip the timber lorry. He says what the paper makes of them: on a first tour, "the only way back onto the books: at the bottom, like everyone"; on a posting, a network like anyone's, and only the chief knows. He offers the exercises as something they don't need ("The exercises anyway"). The deaf officer's call comes through the relay service. Called back, he'd enjoy watching. The first tour's paper makes them its most junior officer "for the record", and the tutorial's directory has them back at work, not in their first weeks.
- **Time passing brings a new crowd.** An hour at the gym, ten minutes of a book, a meal: anything that skips two minutes or more now lets the street's passers-by go, along with your memory of where they were, and fills the streets with the new hour's people, at its count. Before, everyone stood where they'd been when the clock jumped and walked on as if nothing had happened. Under two minutes, the same people. In the browser, an hour skipped at noon: 0 of 87 the same, 93 for one o'clock.
- **One plaque over a face.** A face already felt as eyes on you had a "seen before" plaque under its "Eyes" one, a pixel lower, showing at its edge. Now it's "Eyes" alone; and a face you've marked as a tail is "tail" alone, without "Eyes" stacked on it.
- Tests: the files' masters (every skill a file raises to expert or past is 20); each file's reason, and Hale's 24 different calls to them (his line for each, the rung's words, the relay; the ordinary call as it was); the crowd after time skipped (a minute: the same people; an hour: all new, none remembered).

## v0.1.0-rc54 (2026-10-31)

- **You can feel it now.** Tradecraft and your skills give you a sense that the dice decide. When someone has their eyes on you, an Awareness roll can lift the fog round them, through walls and in your blind spot, in a cold blue tint; whoever's there is drawn, and a blue plaque names them, or sits at the picture's edge the way they lie. The same for whoever you're following, by Tracking: where he's gone, out of sight, up a lane, on another street, with a dim trail of the way he went.
- **It climbs steeply.** A Handler (Tradecraft 38) gets a flash of a covert team now and then, reaches 48 m, and can be wrong. At 60 it's often. At 80 it's every roll, out to 215 m; at 95, 420 m. A master knows a covert team is a tail in about 50 s without making a single move they could write down, can follow from beyond 45 m where the target has no look to roll, and the things they do go unremarked. Past 50 it widens the edge of the eye too: +4.5 m at 80, +10 m at 95. A face felt beyond doubt counts as a face that followed you (short of that, a Handler still has to test what they feel); a grey coat taken for him is put right; his tells read from far off; a meeting read from further away. The character sheet says what yours comes to.
- **Tradecraft grows.** It never did. +2 for a clean meeting, a tail that saw the meeting or a sharp photograph; +1 for a soft print or a meeting rightly called off.
- **Read a book, for as long as you like.** Sat on a bench or in a bus shelter, at a café's or a bar's ledge with a coffee, or in the flat's armchair: R (T at the armchair) opens your books, ten minutes at a time, the hours teaching what they teach. Not on a dark bench, nor in the rain. Finished books can be read again; there are novels now, which teach nothing. In a tail or a meeting nothing's skipped: an open book is your cover.
- **Books take room.** They'd been left out of last release's rule: a paperback needs a coat's pocket, or goes in the shop's bag and onto the flat's shelf, where the armchair lets you take it again.
- **Debug mode: a fourth file.** A Tradecraft 95 officer in the career's picker, and "Another file from the basement" for the next: twelve different reasons, each with its own skills, ages and languages.
- Tests: `tests/sense.test.mjs` (the ladder's numbers, what's felt on the map and in the rolls, a covert team felt, a stood-still tail, the files, Tradecraft's growth, reading on a bench, what stops it, where a book goes, a book as cover); training's reading now ten minutes at a time.

## v0.1.0-rc53 (2026-10-31)

- **Everything you carry takes room.** The cash, the phone, burners and first-aid supplies were only counted, outside the pockets, so they took no space at all. Now each sits in a pocket and fills it, and I shows them there. Your wallet (0.1 L) and phone (0.1 L) go first, and always in the same two places; then the rest, biggest first, each where it won't show if there's such a place, so a wallet and a phone alone never bulge a pocket. A burner is 0.07 L; a bandage 0.08 L each; antiseptic 0.12 L a bottle of 6 uses; painkillers 0.04 L a packet of 10; a suture kit and a tourniquet 0.12 L; a poultice 0.08 L; antibiotics 0.04 L; a folding splint 0.4 L and 24 cm, so a coat pocket or nothing. Only weapons go in the beltline. In jeans and a jumper, a wallet, a phone and four bandages fill you up, and pockets that full bulge (+1 for anyone looking for you, as any stuffed pocket does). What won't fit goes in the shop's bag: it's on you, so first aid can use what's in it and a burner in it can call, and at home supplies go in the bathroom cabinet and things in the drawer. Changing to a top with fewer pockets sends what's left over to the bag, or put away if you're at home. Supplies and burners have a Bin button in I, by a click only, so a stray digit can't cost you your bandages.
- **Washing no longer empties the cabinet.** T at the basin took everything in the bathroom cabinet and put it in your pockets, unasked. Now it asks: a wash, or the cabinet, taking what you choose one thing at a time if there's room, or putting back what's on you. A wash takes nothing. With nothing in the cabinet and nothing to put back, T just washes.
- **The Farm in gym kit.** The tutorial's hand-to-hand put your officer on the mat in their campaign coat. You now wear the class's kit, with your own face and hair and no hat. Your campaign clothes are untouched.
- **I: you, properly drawn.** The figure on the inventory is new (`src/art/doll.js`), a proper pixel figure rather than a few rectangles, in what you're wearing. A coat, a jacket or a suit hangs open, so every pocket has its real place on you: the outside pockets on its skirts, the inside one on its lining, the belt and the trousers' pockets between. Each is gold with something in it, rust where it shows. What's in your hand hangs from your hand at its real length, and a shop's bag from the other.
- Tests: inventory (everything takes room; never a bulge from a wallet and a phone; how much fits; the bag still on you; the cabinet, one thing at a time; what a smaller top sheds; 118 figures whole), interiors (the basin played through: T asks, a wash takes nothing), tutorial (the Farm's kit on the officer's own face).

## v0.1.0-rc52 (2026-10-29)

- **Every mission its own.** Targets now have a file. Each has a name from his city (Egyptians in Cairo, Lebanese in Beirut, Russians from the residency in London) and a role with a cover from 27 by city: a GRU colonel in a defence plant's procurement office, TASS's London correspondent, a GIS colonel at Military Production, Hezbollah's man at the port, an arms broker, a money-changer, and others. He has an age, a workplace (his office door on the map says what it is), and a look of his own with something to know him by: the coat's colour, a hat or his hair, a briefcase or a newspaper, glasses, a beard. He has his own contact, and his own craft.
  - **Craft changes how he walks.** A careless man barely looks back. A trained one checks at corners. A sharp one uses every window. A jumpy one takes a winding way and starts alert.
  - **Briefs are written from these facts:** who he is, one of ten reasons the station wants him tonight, how to know him, his craft, where and when (with the real light at that hour and the weather forecast), and how to go about it. For an asset meeting, his motive, what he's bringing and the opposition at your current heat. Each part has several wordings, and one man's next brief never repeats his last; over a thousand test briefs held 2,331 different paragraphs. Tab shows the next brief in full; it's also the paper when you begin.
  - **The tail plays the file.** You follow his look. The three men who could be him are built from his look, each differing in one thing (no briefcase, a darker coat and twenty years younger, a cap instead of a fedora…). Every line of the scene uses his words and his city: no more grey coats and Moscow in Cairo. The photograph uses his face and his contact's, the man from the bench, and that contact keeps the same face when he becomes a lead.
  - New postings' assets have roles from their city: a cipher clerk at the Foreign Ministry, an oligarch's driver, a customs officer at Alexandria, a nurse in the southern suburbs, and others.
  - Meeting benches and photo cafés never repeat another assignment's within two weeks either side, and a bench is named by its park and its street, since parks can share a name.

## v0.1.0-rc51 (2026-10-29)

- **Missions where they happen.** Every assignment in your posting's city now has a place on its streets, and you go there yourself: the target's office door for a tail (the same door each time), a bench in a park or on a boulevard for an asset meeting, a café, bar or restaurant for a photograph. They're spread over the dozen streets round your flat, not all on the embassy's street as before. Tab's Ahead lists each with its place and a "Make it the waypoint" button instead of Go; the city map shows them. The instinct tells you when to be off (by how many streets away it is: "GRACH at 19:07: a bench in the Ivanovsky garden, 3 streets south. Be off by 18:41."), the pointer leads there from three hours before, and at the place in its hour T begins it, played where you stand. For a tail you wait across from his door till he comes out. An asset meeting's team is now whoever is on you when you arrive, or nobody: the walk there is the surveillance detection run, so losing them on the way counts. Arrive too late and it's missed. Only the trips abroad are still launched from Tab ("Fly out"), since you can't walk to Beirut.

## v0.1.0-rc50 (2026-10-29)

- **No more fast travel from Tab.** The mind's day had "Go to work, till six" and "Home, and sleep till seven" from wherever you stood, and its city map a "Go there" for your flat, the embassy and the safe houses: each skipped the street, and whoever was on it to shake. They're gone; the day's one choice is lying low. You work at your desk in the embassy and sleep in the flat's bed, and get to them (and to the safe houses) yourself: on foot, by bus, metro or taxi. The pointer still leads to the embassy on a working morning and home late or tired, and the instinct says so ("Home, and to bed: the pointer has the way") instead of pointing at Tab.

## v0.1.0-rc49 (2026-10-29)

- **Fixes from a bug hunt.** A fresh agent played this build headlessly for several in-game days in four cities (the campaign's own hours, transit, shops, police, the phone, the mind, assignments and the tutorial) and reproduced eleven problems; all are fixed below.
- **Crash: a taxi with watchers behind you.** Hailing a cab with being tailed's team in sight, and catching one of them noting it, threw an error: the fare was taken and the ride never came. Since rc43 in test 2; rc48's watchers brought it to the campaign. The line for it is written now ("…at the kerb behind, looking at its plate, not for a cab of their own").
- **Heat never cooled in the campaign.** The days going by, lying low, and an arrested asset's +10 were all put back a second later by the street's copy of the heat, so heat only ever went up. Now three days lying low and four nights take 50 to 25, as the design says.
- **Stuck after the desk from the flat's window.** Travelling, a day's work or bed chosen from the window left you frozen behind the curtain wherever you arrived. Fixed.
- **No one within reach from behind the curtain.** F at the window could start a fight with a passer-by below. Not any more (nor from anywhere you're hidden).
- **The desk mid-fight.** Tab during a street fight let you go home to bed and land outside the flat's walls. The desk now waits till the fight's over.
- **A tutorial lesson from the flat's telephone no longer replaces the campaign's save.** Quitting a lesson and pressing Continue loaded the lesson, with the campaign gone. Continue now brings back the flat, as you left it.
- **The posting's end paper no longer offers "Back to the posting"** after you're expelled (it looped).
- **A safe house is its door.** Lying low counted as "at the safe house" anywhere on its street (your own flat on it too), and a blown one still counted. Now you must be at its door, and a blown one doesn't.
- **The calls.** Bringing a meeting forward could land it later the same day; now only to a free evening before it, or the option's greyed ("no free evening before it"). Putting one off past the asset's own next meeting now simply cancels it, and that one's next.
- **The Underground's map.** Station names ran into each other and were cut at 15 letters, and two stations could share a name (a line across the streets named all its stations for the side street it runs up). Now every station's name is its own, and each is placed where it fits, whole.
- A first tour's weekly review said "The network: ."; it now says you run nobody yet.
- Tests: phone (forward only before; off past theirs), transit (no two stations alike), taxi (a cab hailed looking back at them), campaign (the hub: heat cools; the window; the desk waits out a fight).

## v0.1.0-rc48 (2026-10-29)

- **Watched in your own hours.** In the campaign, going out of your flat or the embassy, the opposition may now be on you, as the design always said heat should do: in Moscow, at the starting heat, about one time in six, one in three as it warms, and nearly always (mostly a covert team) when you're hot; Cairo and Beirut a little less, London seldom. It's being tailed's team, playing as it does in the test: you check your back and mark faces the same ways, and everything conspicuous they see you do costs heat at once (3 each). Look out of the flat's window first, and whoever's waiting for you is standing by the kerb below. A trip from the desk may shake them or not (on foot, the metro, a taxi, each its own odds); lie low at a safe house with them on you and the station's cable the next morning says it's blown; and an asset meeting you set off for with them still on you has them along.
- Tests: watched (the odds by heat and city; the window, the door, following and what they write down; trips and safe houses; an asset meeting inherits them).
- **Fixed:** in your own hours, the instinct's "Next: …" line ended with how hot you really are ("Heat: noticed"), which only your officer's guess should say (the mind's, since rc35). It's gone from the line; the station's papers (the week's review, a debrief) still give the station's own view.

## v0.1.0-rc47 (2026-10-29)

- **Being tailed: the metro.** Taking the metro used to lose the surveillance team every time, with nothing written down. Now it works as it does for anyone following you: whoever of them saw you go down goes down too (an overt pair both; a covert team only one, since its car can't follow a train), and each leg of the ride is your Deception against their Tracking. Kept, they come up the steps behind you a few seconds later, their faces easier to pick out. Stepping off as the doors close loses them more often, but whoever went down after you writes it down. In the tests' evenings, 5 of the 11 who went down after you were still with you at the other end; stepping off as the doors closed, none of 8.
- Tests: riders (being tailed's team on the metro).
- **Performance, a little more.** The fog of what you can see (which spots your eyes take in, 12,288 of them round you) was worked out again 20 times a second even while you stood still; now only when your eyes move, turn or change (at a shop window, a bus stop, a café, it costs nothing). The HUD no longer measures its speech balloons' layout every frame when nobody is talking. At 4× CPU slowdown the main thread is now about 57% idle while walking and turning, with no long frames.

## v0.1.0-rc46 (2026-10-29)

- **Fixed: the stagger on turning (Windows).** Every time someone new came into view (and a turn brings several into sight at once), the game re-sent its whole 64 MB atlas of people's sprites to the graphics card. On a Mac that's quick. Chrome on Windows took up to a second over it, so each turn froze the picture. Now only the new person's sheet goes up (half a megabyte), and their fight poses are only painted the first time they fight. No more than two new faces are painted in a frame; anyone else in sight appears a frame or two later, while still coming out of the dark, and your own figure is never held back. A street's shaders also start compiling when the street is built, not when it first comes on screen, which on Windows was another hitch the first time you met a railing or a bin. Measured here with the CPU slowed six times: the worst frame while turning went from 67 ms to 33 ms, and the atlas uploads while walking and turning from six (64 MB each) to none.

## v0.1.0-rc45 (2026-10-29)

- **A parked car's window.** The last of the places to watch from on your list: on the pavement by a parked car, R bends you to its window as if to set your hair right, and its glass shows the pavement and the shop fronts behind you, the way a shop window shows the street. E held slants your eyes along it (left and right; down brings them back). A shop window still comes first where there's one, unless you're right at the kerb, and standing at the kerb by a car to hail a taxi isn't looking in it. Being tailed, it's a check like a shop window's, with less cover (+2, not +5): a man bent to a car's window is a little odder than one looking at the goods.
- Tests: perception (a car's window: the pavement behind, slanted along it, not past its end; R looks in it, the kerb alone doesn't).

## v0.1.0-rc44 (2026-10-29)

- **Who rides the bus with you.** Anyone following you who saw you get on, close enough to make the doors, now gets on too, and gets off behind you a few seconds after you. Before, a bus lost everyone but being tailed's team. The bus card has a new last line: stand by the doors and step off as they close. Each follower aboard must beat your Deception (+4, +2 more in the rush hours' crush) with their Tracking, or be carried on to the next stop. In the tests, an even follower (10 v 10) stays with you 20% of the time, a better one (18) 49%, against a better officer (18) never. Being tailed, the team's riders face the same roll (12 of 13 were carried on), but whoever was aboard writes it down.
- Tests: buses (who gets on with you, off as the doors close, a watcher getting off behind you; being tailed's riders at the doors).

## v0.1.0-rc43 (2026-10-29)

- **Follow that cab.** A taxi no longer shakes everyone. Whoever was following you and saw you get in needs a car: someone on foot needs a free cab to come by (fewer at the rush hours), while a surveillance team has its own car. Then it's their Tracking against the cabbie's way through the traffic. Kept, their car comes along the lane behind yours a few seconds later and stops a way back, and they get out and follow on. A cab pulling in behind yours is the tell, if you look back. The taxi's card has a new last line: the long way round, losing anyone behind us ($5 and 3 minutes more), which pits your Pathfinding against them instead (an officer who knows the streets nearly always loses them; a stranger to the city does worse than the driver). In the tests: a follower on foot keeps your cab 12% of the time; being tailed, a covert team keeps you 44% of evenings (19% the long way round), an overt pair 17% (0%). Before, a taxi lost them all.
- Tests: taxi (follow that cab: the rates, the long way, a watcher's cab pulling in behind yours; being tailed's team by taxi).

## v0.1.0-rc42 (2026-10-29)

- **Someone who knows what they're doing.** First aid (H) now offers a professional when you're badly hurt. At the embassy on a working day, the Health Unit's nurse sees to everything in an hour, discreetly, though an artery is beyond her. Out in the city, a hospital's A&E sees to everything, tourniquet and all, but it takes four to six hours, and a knife wound gets reported: a policeman with questions, +8 heat.
- Tests: medicine (the nurse and A&E: what each does, the hours, the heat).

## v0.1.0-rc41 (2026-10-29)

- **Shops have customers.** Passers-by now go into shops now and then, and anyone who does (the man you're tailing too) walks in through the door, round the furniture to the counter, stands there a while, and walks back out, instead of vanishing at the door. Follow someone in and there they are. (Tailing got a little easier for a good follower: in the tests' evenings, a follower of 15 against a careful man of 10 saw the meeting 88% of the time, against 75% before; against a man of 20, 13% against 4%.)

## v0.1.0-rc40 (2026-10-29)

- **The police.** Officers walk the streets in pairs, in each city's uniform: often in Moscow and Cairo, seldom in London. One who sees you weighs what shows on you (blood, something in your hand or at your belt, a bulge, a sneeze), the city's habit of asking foreigners for their papers, and how hot you are, and may stop you: "Documents, please." Show your diplomatic passport (handed back, but your name goes in a notebook), answer their questions (Deception; blood or a weapon in your hand makes it harder; fail and they search you), or walk on (you're a diplomat: the embassy hears of it). Searched, what shows is found and what's in a pocket may be; a weapon is taken and reported, and the ambassador hears. In the free walk and your own hours in the campaign, not in the mechanic tests.
- Tests: police (patrols by city; what draws them; papers, walking on, questions by Deception, a knife found or not).

## v0.1.0-rc39 (2026-10-29)

- **The Underground doesn't lose a tail for free any more.** A follower close behind who saw you go down can get on your train. Each line you ride is your Deception against their Tracking, and a change of line is another chance to lose them. The rush hour's crowd helps you, and so does the old trick: the map's second button has you step off as the doors close and take the next train (five minutes more). If they keep you, they come up the steps a few seconds after you; glance back. Even-matched, a follower stays with you about two times in five on one line, one in six through a change. More than 25 m back, or out of sight, and they lose you at the barrier.
- Tests: riders (who stays with you by skill, a change, the doors, too far back; up the steps after you and following on).

## v0.1.0-rc38 (2026-10-29)

- **Calling your network.** In the mind (Tab), on People, each of your assets has a Call…: bring the next meeting forward (to tomorrow evening, or the first free one), put it off three days, or a word to keep them warm (trust up a step, not again for three days). From a burner it's one burner gone and nothing to trace. From your own phone it's +4 heat, and the hotter you already are, the likelier the opposition looks at who you rang and compromises the asset (one in ten at heat 20, two in five at 80); call a compromised asset's line from your own phone and it's +10. The call takes 40 seconds, head bowed over the phone.
- Tests: phone (forward, off, a word, burners spent; your own phone's heat and risk by how hot you are, a burner's none).

## v0.1.0-rc37 (2026-10-29)

- **Getting wet.** Out in the rain you soak through: light rain takes twenty minutes, heavy six or seven, a downpour four; snow half as fast. Your umbrella keeps nearly all of it off (less in a strong wind), a hood about half. Out of it you dry slowly, indoors or in a shop much faster, and dry clothes at home (the wardrobe, or the basin) dry you at once. The log tells you when you're damp, wet through, soaked.
- **The cold.** Wet through below 10° and you shiver: −1 to everything until you're dry or inside. Shivering, you can catch a cold (the less fit, the likelier): four to seven days of −1 to everything (painkillers lift it while they work), and sneezes on the street that turn heads: for a few seconds after one, anyone looking for you has it easier.
- Tests: wet (soaked by the rain's strength, under an umbrella, under a hood; drying; shivering; who catches a cold; a cold's cost, its sneezes, painkillers, its end).

- **More menus on the glass.** The menu (Esc), the log (J) and your read of someone (F in a fight, or F → Read) are on the same dark glass as the mind, each under a plaque. The log reads as a list with the time beside each line, the instinct's lines in gold, a failed roll's in red and its numbers under it. Your read draws each skill you've read as a bar on the skills' scale, the range you've narrowed it to lit, so a better read shows as a thinner bar.

## v0.1.0-rc36 (2026-10-28)

- **Medical supplies.** A chemist's counter sells bandages, antiseptic, a suture kit, a splint, a tourniquet, painkillers, an arnica poultice, a course of antibiotics, and a first-aid kit ($28: four bandages, three antiseptic, four painkillers, a poultice); a grocer's, bandages and painkillers. They go in a pocket, and the inventory lists them. Your flat's bathroom cabinet has two bandages, antiseptic and painkillers on the first day: take them at the basin.
- **First aid with them (H, or F for someone else), each where it fits.** A bandage on what bleeds (no −2 for a strip of shirt, and it's clean); a bandage put on or changed on an open wound (a day old, it's dirty). Antiseptic on an open wound. Stitches on a deep cut (Medicine against 13; an artery tied off, 18; the face −2): the bleeding stops, it knits faster, no scar; clean it first. A proper tourniquet, and a way to loosen one. A broken arm or leg set (against 14) and splinted. A poultice on what's bruised, hurt or wounded. Painkillers. Antibiotics. The first-aid card lists your wounds and their care, and what you carry to tend them.
- **Wounds want care, or they go bad.** An open wound can get infected, more likely the deeper and dirtier it is: bandaged it's less likely, cleaned far less, cleaned and stitched hardly ever. Infected, it's your body against it (Fitness), and antibiotics: feverish (−1 to everything), a high fever (−2), delirious (−4), and left long enough, sepsis kills. In the tests, a deep cut on an unfit officer left open for three weeks killed 45%; bandaged and changed daily 15%; cleaned, stitched and bandaged 1%; antibiotics when it turns, nobody. A gash open to the air won't close; an unsplinted break knits at half the pace; a wounded part mends only once it's been tended.
- **Pain.** Hurts and injuries add up to pain: in pain (−1), bad pain (−2), agony (−3), on every roll but a fight's (adrenaline: you feel it after). A splint or a poultice halves its part's; painkillers take most of it away for six hours. A broken arm now costs your talk a point until you take something for it.
- **Scars.** A break that knits without being set knits crooked: −1 to what that limb does, for good. A deep cut never stitched leaves a scar.
- **The instinct says what your wounds want**: an infection, a gash left open, a dressing to change, a break unsplinted, a tourniquet on too long, pain. Your wounds age as you play, a minute at a time, and through every skip of the clock.
- **The Underground's map.** At a station's door, R opens the network's map instead of a list: the lines in their colours, every station named, the changes ringed, you in yellow; under it the streets, and on them everything you know (your flat, the embassy, the safe houses, the shops you've passed) and your waypoint's flag. Pick a station with a click or the arrows: its card gives the lines and changes, the minutes, the fare, and what you know near it; Enter (or the button) rides. Beside the map, the way to your places: the station nearest your flat, the embassy, each safe house and your waypoint, with the minutes and the walk from it, a number key each.
- **The menus, off the paper.** What you carry (I) is pocket by pocket now, in the mind's dark glass: your clothes drawn small with their pockets on them (gold where something's in one), each pocket a tile with what's in it drawn in the game's pixels and how full it is (and whether it bulges or shows), the thing in your hand first (1); beside it your money, your phone and burners, your first-aid supplies with their own little pictures, the shop's bag. First aid (H) and the choice cards (a shop's counter, a taxi, a bus, the bed, the wardrobe) are on the same glass, each headed by a plaque. Briefs, cables, calls and your personnel file stay paper: they're papers.
- **Fixed: the embassy's street door** (and the flat's front door) only let you out if you happened to be in the doorway at the moment the game looked, once a second; walking out at an ordinary pace you'd often end up pressed against the dark just past it. The whole step out of the doorway counts now. And a shoulder caught on a door's frame (or any corner) is eased round it, instead of holding you there.
- Tests: browser (what you carry: the pockets, the hand's thing first, a key does it); browser (the Underground's map: opened at a station, a station picked with the arrows, ridden with Enter); medicine (each supply offered for the wound it fits, and none where it doesn't; infection by care, with the numbers; sepsis in the game; breaks set or not, splinted or not; tended wounds, poultices, a tourniquet left on; the counters and the cabinet); interiors (out of both doors by walking, every way at them).

## v0.1.0-rc35 (2026-10-28)

- **Your umbrella.** Hold it (it's in your hand when you buy it; G takes it out if you've put it away) and when it rains or snows it's up over your head; in a gale it stays furled. You used not to be able to open one at all, and were sometimes drawn under one you didn't own.
- **Hoods only on hooded clothes.** You put a hood up only if what you're wearing has one: the olive parka on a clothes shop's rail does, and so does a new navy anorak. Other people's hoods come with their coats, jackets and jumpers, some of them.

- **The mind (Tab).** Tab no longer opens a desk of papers: it opens your officer's mind, in the HUD's dark glass, on four leaves (1 to 4). Ahead: the assignments and the day's choices. The city: a map of London as you know it, drawn in the game's own pixels, the streets you've walked with their names and the lanes off them, and every shop, bank, club, school, station and stop you've passed, coloured by kind (each kind can be hidden); you, and your waypoint. People: your network, the men you watch, your colleagues. Where you stand: below.
- **Waypoints.** Pick a place on the mind's map and make it your waypoint: the pointer at the edge of the picture leads there, street by street, and clears when you're at its door. Your flat, the embassy and the safe houses also offer the way there (the metro or a taxi).
- **You learn the city.** A street becomes known as you walk it (whatever's within forty metres of you), with everything on it; your flat, the embassy and the safe houses are known from day one. A trip abroad doesn't add to your London.
- **What your officer believes.** Heat and cover standing aren't numbers on a gauge any more: they're your officer's read, in words ("A face or two you've seen more than once. Probably nothing."), and how sure they are of it. A junior on day one is guessing; weeks on the posting, a posting of their own, a sharp eye and good Tradecraft make the read truer and surer. It can be wrong.

- **Phones.** People on the street stop for their phones now: head down, both hands at the chest, the screen lit. And so can you. "Look at your phone" is cover, offered by the instinct before a shoelace: up to twenty seconds, or till you move, and to someone looking back it reads as ordinary as a shop window nearly does (a shoelace twice looks like a story; a phone doesn't, but not twice in half a minute). The man you're tailing pauses on his phone too. (It makes tailing a careful man a little easier: in the tests' evenings he made a follower of a Handler's skill 13% of the time, against 25% before.)
- **Burners.** A phone shop sells burners: a prepaid phone, no name on it. You carry them (the inventory counts them); what they're for, calling your people, comes with the network.
- Tests: knowledge (the posting's places known from the start; a street walked known, its shops with it; the waypoint where the pointer leads, cleared there); belief (words, not numbers; a junior guesses, surer with weeks; a Handler surer); browser (Tab opens the mind).

## v0.1.0-rc34 (2026-10-28)

- **Your account.** The posting's bank account opens with your first month's salary already in it (a junior's $5,400, a Handler's $7,200), salary is paid in on the 1st as before, and on promotion the account comes with you. Cash on you is what pays on the street.
- **Banks.** At a bank's counter, R: draw $100, $500 or $1,000 from the account, or pay in what you're carrying but $50. The desk shows what's in the account.
- **Memberships.** A gym or a martial-arts club sells a month's membership ($45, $70): for thirty days its sessions cost you nothing. The counter shows you're a member.
- Tests: shops (the account opens with the first month's pay; drawn from at a bank, paid into; a gym's month, then a session free).

## v0.1.0-rc33 (2026-10-28)

- **The embassy keeps its day.** Its people come and go now. The Marine is on the desk round the clock. On working days the chief is in from about eight till after six, and your colleagues arrive between half past eight and a quarter past nine and leave around six (now and then one stays late). Between times they get up from their desks: the water cooler, the cabinets, a word at the chief's door. The visa section is open nine till one: applicants come in off the street, sit, wait to be called, stand at the window a few minutes and go; after one the room's empty, the consular officer gone. At six, after your day's work, the station empties round you. Weekends, only the Marine.
- **Blown: the car is there.** The station's driver used to stand alone on a pavement, so "reach the car" left you looking for a car that wasn't drawn. He now waits at the back door of a parked car on his street.
- **Fixed:** the hunger line still sent you to a shop's door (T); it now says to go in and use the counter (R).
- Tests: interiors (the embassy's day: everyone in by half past ten, applicants in and out, the visa room shut and empty after one, most gone by half past six, the Marine alone at the weekend; every post, seat and errand reachable from the street door).

## v0.1.0-rc32 (2026-10-28)

- **Fixed: hunger stood still overnight.** A night's sleep ended in an automatic breakfast, so you always woke fed and the hunger meter looked frozen through the night. Now sleep calms you but doesn't feed you: you wake as many hours from your last meal as it's been (dinner at seven, up at seven: hungry), and the kitchen table at home, a café or a bakery is where breakfast comes from.

## v0.1.0-rc31 (2026-10-28)

- **A wardrobe at home.** Every flat has its wardrobe (in the studio, its drawers). T there: put on a coat, a jacket, a jumper, a hat or glasses you own, take off a hat or glasses, leave something you're carrying in the drawer, or take it back out. A change of clothes takes four minutes.
- **Clothes and things to buy.** A clothes shop's counter has its rail (coats in charcoal, camel and navy, a beige trench, an olive parka, black and brown leather jackets, jumpers) and its hats (a flat cap, beanies, a fedora); an optician has reading glasses and sunglasses. You choose the piece, put it on there and then, and what it replaced goes into the shop's bag. A clothes shop sells umbrellas, a tobacconist penknives, a grocer a bottle of wine or a kitchen knife: into your hand, a pocket, or the bag if there's no room.
- **The bag comes home.** A shop's bag shows in your hand, and the inventory says what's in it. Back in the flat it's unpacked: clothes into the wardrobe, things into the drawer.
- **Fixed:** buying a coat changed your clothes in the game but not on screen: your sprite was drawn once and kept. A change of clothes now shows at once.
- Tests: clothes (a coat off the rail worn out, the old one bagged; an umbrella in hand; home, unpacked; the old coat back on at the wardrobe; the umbrella into the drawer and out; an optician's glasses); shops (the coat chosen off the rail).

## v0.1.0-rc30 (2026-10-28)

- **Hale's lessons are your officer's.** From the flat's telephone, the exercises used to drop you in Moscow whatever your posting, and their first line named a stranger with someone else's job. Now every lesson runs in your posting's city (London for a first tour; Hale's words follow: Moscow, the FSB and Lefortovo read as your city, its service and its prison) and you play your own officer from the first word: their name, face, coat, skills and background, under your posting's cover. The Farm is your own past: this spring for a junior, years back for a Handler. "On your own" from the tutorial page plays the same way.
- **Fixed:** the umbrella lesson in London could put Kostin's minder inside a terrace's front railings, and the lesson failed to start. He now stands at the first spot by the door he can walk from.
- Tests: tutorial (from the flat, every lesson in the posting's city, the officer named in its first line, their look, sheet and cover; the Farm in their own past).

## v0.1.0-rc29 (2026-10-28)

- **R: what's at hand.** T did two jobs: what the instinct's line offered (call off the meeting, the pass, sit with him) and, when the line offered nothing, whatever was at hand (a shop window, a bench, a shop's counter). When the scene had something of its own, the thing at hand couldn't be reached at all: a brush pass you could call off left you no way to look in a window. Now they're two keys. T is the instinct's line; R uses what's at hand, shown after the line as its own chip whatever the line offers. R covers the shop windows, benches, zebras, kiosks, phone boxes, bus shelters, taxis, metro doors, a shop's counter, window ledge, basin and back door, and anything lying within reach. (R was set aside for reloading guns, which aren't in yet; reloading will get a key of its own.) Hale's lessons say R where they mean it.
- Tests: the ones that used what was at hand press R; perception (R works beside the scene's own offer on T).

## v0.1.0-rc28 (2026-10-28)

- **The way out of the flat, marked.** A plaque on the wall over the front door (FRONT DOOR, an arrow), the same pixel plaques as the places on the street; the embassy's street door has one too (THE STREET). In the corridor flat a standing mirror had been put in front of the front door, and in two layouts a shoe rack overlapped it, so the door read as a wardrobe: the door's clear now in every flat. By the door the instinct says it's the way down to the street, and on a working morning it says to go out by the front door in the hall (it used to say "its door", meaning the embassy's).
- Tests: interiors (nothing stands before any flat's front door, in every layout and city).

## v0.1.0-rc27 (2026-10-28)

- **Fixed: stuck at the counter.** Buying something in a shop (a book, a coat, a bite), a minute's browse, the basin, the yard out the back: each held your feet for its full time in real time, minutes of nothing with no way out, and buying a book looked like never coming out. Now each is an action that takes time: the clock jumps on (three minutes for a book) and you can walk at once. The coffee at a café's window is still lived through, since watching the street is the point of it, and now you can walk away from it whenever you like, leaving half the coffee.
- Tests: shops (a book bought: three minutes of the clock in a tick, free at once; the window's coffee lived, and moving ends it; a browse and the yard skipped).

## v0.1.0-rc26 (2026-10-28)

- **A first tour.** New officers start at the bottom now: a junior fresh from the Farm (24 to 29, a little greener on the street), Station London, under cover in the embassy's Office of the Legal Attaché: on paper the FBI's, in fact the station's liaison with MI5. No network of your own: with MI5's watchers you follow two of the Russian residency's officers to whoever they meet, and photograph them at it.
- **Trips abroad.** Twice in the tour another station borrows you for an evening, flown out that morning: Moscow (meet one of their assets for them, clean), Beirut (a photograph), Cairo (a tail), each on that city's own streets, the opposition there treating you as a visitor. The night flight home, and you wake in your London flat; the days away count as worked.
- **Promoted.** Get the tour's work done (intelligence 6) and you're promoted: the paper asks which station you want, Moscow, London, Beirut or Cairo, and the same officer starts a posting of their own as a Handler a fortnight later, a network to run.
- **Starting higher.** The new-game screen asks where to start: a first tour, or a posting of your own once one of your games has completed a posting (the record is kept in the browser). Till then a posting of your own is reached by promotion. Debug mode opens both.
- Tests: campaign (a first tour: juniors, Station London, two trips planned abroad, a trip's scene on its own city's streets, credited, home the morning after; promoted, and a posting of one's own for the same officer); browser (the campaign from the title starts a first tour, a posting of your own locked).

## v0.1.0-rc25 (2026-10-28)

- **The embassy, inside.** At its door, T, and you're in past the Marine: the lobby with his desk (dress blues, the white cover), the arch of the metal detector, the X-ray's belt, the flags; the consular waiting room off it, its rows of chairs and the visa window; through the arch, the corridor, and off it the chief's office, the station behind its vault door, and the tank. People at their places: the Marine, the consular officer, applicants waiting, colleagues at their desks, the chief at his.
- **Your desk.** One of the station's four is yours. T at it on a working day: sat down, the day's cables, and it's six o'clock, and you're still there; walk out when you like. T in front of the chief's desk: what's on (the desk and its assignments). Out by the street door, onto the embassy's street. Any day, at any hour, the Marine lets you in; only a working day has work in it.
- Tests: interiors (the embassy in every city: every spot reached from the street door round the furniture and the people; the campaign's: in from its door, to the desk and the day's work there till six, the chief's office, out onto its street).

## v0.1.0-rc24 (2026-10-27)

- **Shops you walk into.** Every shop along the street has its ground floor now, and you walk in at its door: the building opens like a dollhouse round you (the shop's slot cut out of it from the pavement to the roof; either side, the building as it stood), and there's the shop. A grocer's shelves, fridges and aisle; a bakery's display case and bread racks, its oven in the back; a café's counter and espresso machine, a ledge along its window, the kitchen and the toilet at the back; a clothes shop's rails, fitting room and mirror; a bookshop's shelves; a florist's buckets. Someone's behind every counter. A stock room or a kitchen behind a staff door, and in many, a back door.
- **What's done in a shop is done where it's done.** T at the counter: a minute's look round, a bite, a coat put on there and then, a book, the gym's or the club's or the school's hours. T at a café's window: a coffee stood at the ledge, the street going by on the other side of the glass (or an hour with your book). T at the basin at the back: the blood off your face. T at the back door: across the yard and out of its gate, out of sight, into the lane beside the building. No more menu at the door.
- **Seen through the glass.** The walls hide you; the window doesn't. Whoever's on the pavement can see in, and at night a shop's lights are on whoever's inside: stood in a lit café after dark, you're on show to the street. Followers don't come in after you: they wait on the pavement a few metres along, where they can see the door, and the wait starts over whenever they see you through the window. Out the back, they're waiting for nothing. Out in a new coat, they may look straight past you.
- **Fixed:** an hour and a half at the gym (two at the club, ninety minutes at the school, an hour's reading over a coffee) passed in real time, so you waited it out at the keyboard. The hours now go by at once, as any action that takes time.
- Tests: shops (walked in at the door, to the counter, a minute's browse in sight through the window, to the back door, across the yard and up the lane; the scene hears in and out; a follower waits on the door outside; being tailed, the team watches the door and loses you out the back; a café's basin; a coat worn out of the door); training (the gym, the club, the school, the bookshop and a café's ledge walked to); Moscow's generation hashes set again on purpose (the shops' floors in their buildings, their lights).

## v0.1.0-rc23 (2026-10-27)

- **Taxis, hailed for real.** A taxi is one of the cars on the road now, its roof light lit when it's free and dark when it's taken (fewer free ones at the rushes). At the kerb, T offers a hail only when a free one is coming along your side of the road: an arm goes up, it brakes, pulls over by you and asks where to. You get in, it pulls away with you, and at the other end it pulls in at the kerb and you get out of it. A taken taxi drives straight past; walk off from one you've hailed and it goes.
- **Buses on lines.** Each city has its bus network: numbered lines (Moscow's 15 and 904, London's 28 and 452) running along a street a few stops at a time, then up a side street to another, every street in the middle of the city on one. Shelters stand where a line stops, its numbers on the sign, the bay kept clear of parked cars. The bus that comes says its line and where it's going, and takes you only to its own next stops.
- **The metro.** Where the city has one (London's Underground, Moscow's metro, Cairo's; not Beirut), its stations are buildings of their own: London's ox-blood tiles and the roundel, Moscow's pale pavilion under the red M, Cairo's concrete front under METRO and مترو. At the door, T: every station on the network, the quickest way with its changes and minutes; pay, and you come up the steps at the one you chose. Whoever was following on foot loses you down there.
- **Time buys something.** Every city now has gyms, martial-arts clubs (Moscow's teaches sambo) and language schools among its shops. An hour and a half at the gym trains fitness and leaves you hungry; a two-hour class trains close combat; ninety minutes at the school teach the city's language (London's teaches Russian, since you have the English). Each costs its fee. Bookshops have three books on their shelves, each teaching a subject (First Aid Manual, Thinking Fast and Slow, The Art of Memory…), and a grammar of the language: read them an hour at a time in your flat's armchair, or over a coffee at a café's window table. Training is slower the better you get (eight hours for a point at an ordinary level, four classes), and a teacher or a book only takes you so far.
- **Out of the window.** Your flat has a window on the street side. T there and you're looking down at the street outside your door from behind the curtain: who's about, who's waiting. Nobody sees you. T again to step back.
- Tests: training (hours in, points out, slower higher up, no further than the teacher; a language by levels; the gym, the club, the school and a book in every city; reading at a café and at home).
- Tests: brush pass judged on 48 evenings (a team sees a walking pass one time in seven or so: a dozen was too few to say); transit (a bus on every street; the metro in three cities, every station reachable from every other, each a building with its door; a ride to the farthest station, up its steps, paid); buses (shelters where the lines stop and nowhere else; on a bus, only its own line's stops); taxis (hailed only with a free one coming, the ride, the drop; a taken one drives by; walk off and it goes).

## v0.1.0-rc22 (2026-10-27)

- **The campaign is the way in.** New game on the title is the officer's file: three officers, the posting's city chosen on the same page. Pick one, and day one starts in their flat at seven, the boxes not unpacked.
- **Your flat, as rooms you walk.** The first interior, cut away like a dollhouse so every room shows, and furnished from a new kit of 67 pieces drawn in the game's style (beds and wardrobes, sofas, kitchens, baths; shop and embassy pieces for what's next). No two flats alike: three layouts (two bands of rooms, a corridor flat, a studio), each city's way of keeping house (Moscow's papered walls, herringbone parquet and a carpet over the bed; London's painted walls and carpets; Cairo's and Beirut's plaster and patterned cement tiles), pictures, mirrors, clocks and calendars on the walls, a light that's warm, soft or a kitchen's cool tube; and the first days, moving boxes in the corners. T does what the instinct's line offers, walking you there round the furniture: the bed (sleep till seven), the telephone, the basin (the blood off, a clean shirt), the kitchen table (something to eat). Out of the front door: down the stairs, onto the street at your door; at your door, T and you're back up. The desk's Sleep takes you home to bed; a day's work leaves you at the embassy's door at six. Indoors the lamps are on, whatever the hour.
- **Hale calls.** Twelve seconds into day one the telephone rings: Hale, with his exercises or straight in. The exercises are the tutorial, now played by your officer (their name, their look, their skills: a Marine's hands at the Farm). From the tutorial, back to the flat as you left it, or Begin the posting. Let it ring, and his number's on the pad by the telephone: T there, and he offers them again.
- **In at the embassy's door.** T at its door on a working day: in to work till six (early, the coffee's on), out at its door at six. The instinct says so from the moment you're up.
- **The bed by day**: a nap (an hour, four hours' tiredness gone), lying down (half an hour, the nerves settle), or the night.
- **The info cards, redrawn.** The labels over the picture (your doors' plates, the faces you've marked, the way to where you're going at the picture's edge) were browser text in boxes; now they're small enamelled plaques drawn in the game's own pixel lettering, the one the shop signs use, on the picture's own grid: a glyph each (a star for the embassy, a house for home, a key for a safe house, an eye on a face, an arrow for the way), a notch pointing at what they name, how far in a quieter tone.
- **Out the back of a shop, into the lane beside it.** It used to put you on the next street north, as if you'd come out of its hedge. Now it's through the stock room and the yard, out of its gate into the nearest side street or alley, a few metres up it, out of sight of the shop's door; a shop with no lane beside it has no back way. A team watching the door is still on the street, watching it.
- **The tutorial lives behind the campaign now**: it's gone from the title. The mechanic tests stay reachable from the tutorial's "On your own".
- Tests: interiors (360 flats, every layout in every city: rooms closed but for their doors, every spot reached from the front door, 178 looks in 180; day one, Hale's call answered by walking to the telephone, out of the door and back, to bed, a save and a load); the browser tests go in by the new way (the campaign through Hale's call; the tutorial from the telephone, played by the officer picked).
- Fixed: a street's cars, still about after you'd gone indoors, stood invisible in the flat where the lanes would be.
- Removed from the repo: a stray pointer to a scratch copy (`.claude/worktrees/`), now ignored.

## v0.1.0-rc21 (2026-10-27)

- **The embassy and your flat, where you can find them** (in Cairo there was no embassy to find, nor a flat: the taxi left you at some shop's door). The embassy is now a building of its own on its street, in every city: dressed stone, barred windows, a portico at its one door, UNITED STATES EMBASSY over it, and the flag. Your flat and the safe houses each have their own front door (a safe house never a few doors from the flat), with a brass plate over it: Home, Safe house, US Embassy. The taxi and the metro leave you at that door. On a working morning a pointer shows the way to the embassy if it's off the picture; late at night, or tired, the way home.
- **Hale has a past**, or people say he does. At the Farm a classmate passes it on from the bench; the briefs and the tutorial's page carry the canteen's version; on the earpiece, once a lesson, something slips out of him. He's the same man now at the Farm and on the earpiece.
- **The keys behind "?"** (whatever key makes "?" on your keyboard: on AZERTY, Shift and the comma). The bar at the bottom folds to a small "? keys" until you want it; your choice is kept.
- **Backgrounds count.** A life before the Agency gives up to +4 in a skill: a Marine starts with CQC 12 and weapons 12 where others have 7 or 8. New backgrounds: a Marine, an NSA engineer, a college wrestler. On the sheet, a background's points show as ◆, practice as •; where you choose the officer, each lists what its background brought.
- **Fixed: slanting your eyes in a shop window** (E held, "slants the wrong direction (up instead of left)"). At the glass, left or right turned you away from it, and the picture leaned up onto the building. Now left and right slant your eyes along the glass, a little at a time (70° a second, as far as 60°), up brings them back to straight in, down turns you away; and the picture leans to what the glass shows: the street behind you, on the side you slant to.
- **Fixed: a speech balloon over the tag it should leave clear.** At the Farm, Hale's words covered the move he was about to make; a balloon now rises clear of a fighter's move, a key, a ? or a !. The mat's long centre line, which read like part of the balloon, is two start tapes.
- **Fixed: lines across people's heads.** Where two parts of a building met behind someone (a shop window's sill, a wall's edge), the outline was drawn across them too.
- Tests: the posting's places (the embassy's building and its one door, the flat's and the safe houses' doors, the same after a load, the taxi to the door; a town with no posting unmarked).

## v0.1.0-rc20 (2026-10-27)

- **The tutorial.** The mechanic tests on the right of the title are now one entry, "The tutorial", which opens like a folder: eight lessons, from hand to hand at the Farm to the umbrella. Your first month at the station: Hale, who taught you at the Farm, takes you through the work on the street with an earpiece in your ear, the station's own people playing the parts. He talks you through it as it happens: what's coming, why the instinct says what it says, what you just did right or wrong. His lines come over the earpiece, in their own box just above the instinct's, paced so they never pile up. A checklist under the watch shows what the lesson is for, ticking as you do each thing. Afterwards, his debrief (and who was really out there), then again with Hale, on your own (the plain test), or the next lesson. The first version: tell me what's unclear, and what's too much or too little.
- **The people waiting at Kostin's stop** (the umbrella) no longer stand in a heap: they're spread as people at a stop are, a pace apart, more so one behind another, some sat in the shelter.

## v0.1.0-rc19 (2026-10-27)

- **Mechanic test 6: the umbrella.** An assassination, Cold War style. Colonel Pavel Kostin of the GRU has poisoned two defectors abroad and flies out on Friday for a third. Nobody signs for it; an umbrella with a pellet in its tip came in a pouch addressed to no one. He walks from his office to his bus stop, his minder a few paces behind. Tail him from his door, or be at his stop first, waiting like everyone else, and pick him out from the grey coats when he comes. At arm's length, T: a press of the tip against his leg, a sting like a wasp's. Where you do it is everything: alone with him on an empty pavement, he turns and sees your face and his minder sees your hand two times in three; among the people at his stop in the rain, rarely. Then walk away, and never run. If his minder saw, he comes for you. Be sure it's him: a grey coat that isn't him is a stranger who dies on Sunday.
- **Fixed: some watchers' rolls were read the wrong way round.** In the watch test, the minder made you when he *failed* to notice you; in the brush pass and the dead drop, a watcher who saw it was told he hadn't. Now they read right. The watch test's results barely moved; the brush pass is now safer against a covert team than the dead drop, as it should be.

## v0.1.0-rc18 (2026-10-27)

- **Pockets by volume.** Everything you carry has a length and a bulk, and goes where it fits: the trousers' pockets (a penknife, a box cutter), a coat's or a jacket's two pockets and its inside one (a bottle, a finka, half a brick), the beltline (a kitchen knife, a hammer: one thin thing in each of two places). A pipe, a crowbar, a shovel: the hand or the ground. No coat, no coat pockets. I shows where each thing is and the room left.
- **What shows counts.** A knife tucked at your belt with no coat or jumper over it is seen (+2 for anyone looking for you, between a stuffed pocket's +1 and a weapon in your hand's +3), and being tailed, it's written down like one in your hand.

## v0.1.0-rc17 (2026-10-27)

- **Traffic.** Cars on the road, a lane each way on the city's side (London's on the left), every few seconds by day and a trickle at night: the city's makes and colours, its taxis, and its buses (Moscow's white and green, London's red double-decker, Beirut's van, Cairo's white and blue), their lights on after dark. They stop for anyone on a zebra, and short of anyone in the road; they never stop on a crossing; they ease round someone standing in the way, and let a bus out of its stop. People walk round them, and go round the end of one that's stopped. Step out under a car's nose and it stops, just: a horn, and you're shaken.
- **The bus you wait for is the one you see**, pulling in at the shelter with its doors at it, a little early, and waiting while you choose. Buses on the line also stop at the shelters they pass.
- Shelters now stand only where a bus pulled in at them stays off the zebra.

## v0.1.0-rc16 (2026-10-27)

- **Buses and bus shelters.** A shelter stands at the far kerb every hundred and fifty metres or so, in each city's colours and words (ОСТАНОВКА in Moscow, BUS STOP in London, BUS in Beirut, موقف in Cairo, and the line), its fascia lit at night. T at it: you sit on its bench and wait, the street going by in front of you, a natural place to watch from for as long as the bus takes. The bus comes on the stop's timetable (every 6 to 12 minutes, half as often at night), going north or south by turns; the card asks how far (one, two or four streets, 100 ₽ / £1 / $1). Unlike a taxi, nobody writes a bus down. But a tail on foot can get on too: an overt pair runs for it and rides with you; a covert team's nearest man gets on if he's close, and their car may follow the bus. Watch who gets off at your stop.
- **Notice boards** in half the parks and boulevards, at the path's edge: T reads the notices (30 s), the path at the corner of your eye.

## v0.1.0-rc15 (2026-10-27)

- **Mechanic test 5: a brush pass and a dead drop** (5a and 5b on the title), both on being tailed's evening, the team or none.
  - **The brush pass:** SOLOVEY doesn't sit. At the minute he comes along the park's path with a newspaper under his arm and walks on. Be on his path, walking his way, and as you pass at arm's length, T: the paper's yours, neither of you breaking step. A watcher who can see it may see it (the closer, the likelier; a covert team's eye best of all; stopping to do it gives it away).
  - **The dead drop:** nobody to meet. A tin behind a bench's leg (T at the bench: six seconds on its end, retying a shoelace), then a chalk mark on a lamppost along the path (T at the post) to tell him it's there. Whoever of them saw you at it rolls once you're done: the load seen is burned, the chalk seen written down.
  - Check your back first: walking straight there with a team on you, they see it about half the time.

## v0.1.0-rc14 (2026-10-27)

- **Hoods up, umbrellas open.** In rain and sleet a share of the street opens an umbrella (a fifth in light rain, more the harder it comes), others put a hood up; in snow it's mostly hoods. Nobody holds an umbrella in a gale, or with something else in their hand. The same people, the same way, every time: who they are decides it.
- **Hanging signs light up at night**, their letters glowing as the shopfronts' do (the env's open point). And the trees in the cities' walled lots go with the month like the others.

## v0.1.0-rc13 (2026-10-27)

- **Weather** (your ask: snow, rain and wind, light to extreme, real effects). Every city has its own climate now, and every day its own weather, the same for the same game and date: Moscow's November is low grey cloud, light snow or sleet often, now and then a heavy fall, rarely a clear frost; London drizzles and sometimes pours; Beirut has showers and the odd storm; Cairo is sun, with haze and dust some days. A front comes and goes: the snow starts light, thickens, thins, and the log says so; the watch says what it's like ("Sleet, and a raw wind off the river").
- **You see it.** Rain streaks down slanted by the wind and splashes on the pavement; snow falls in flakes, settles on the pavements, the roofs and the cars, and churns grey on the road; wet streets darken and stand in puddles that mirror the sky and the lamps; a frost silvers everything and glints; fog and dust swallow the far end of the street, and the lamps wear halos in them. Under cloud the light goes flat and grey, and dusk comes a little sooner.
- **It counts.** Heavy rain or snow cuts how far anyone sees (fog much more: heavy fog 18 m, thick fog 10); fewer people come out in it (a downpour or a blizzard empties the street); hoods and umbrellas make faces harder to know, yours and theirs (−1 to −3 on Orlov's looks, the hunters', your checks of faces behind you); deep snow is slower going, and running on snow or ice you may slip. The free walk's instinct says when it matters. `?weather=snow-heavy-gale` pins it, for shots.
- The watching test feels it too: the minder's eyes and your photographs (shorter reach and softer frames in rain, snow and fog).

## v0.1.0-rc12 (2026-10-27)

- **Photographs in the campaign.** A target you've seen meet someone on a tail brings a photograph to take a few days on: his café, his minder, his name. A sharp print is worth two of intelligence, a soft one or the meeting witnessed one; made by his minder, heat, and he's careful.
- **The tail at night is winnable** (from the review: night evenings were almost never seen). In the dark between lamps a face behind him is a shape: his look at you is −5 for the dark (−4 before), and being close counts +1, not +3, unless you're right behind him. By the game's own follower, 14 m back, night evenings seen 42% (17% before); dusk and day as they were.

## v0.1.0-rc11 (2026-10-27)

- **More haircuts** (your ask). Women: a bob, a ponytail (seen from the front by its knot and its end past the neck). Men: a crew cut, a side part. Of the long and the short, about a third take the new cuts; women's and men's still never the same. Who's about doesn't change, only how their hair's cut.
- **Mechanic test 3: watching and photographing** (the design's next test). A man from the defence ministry meets someone outside a café on this street, some time in the next quarter of an hour; you have a camera (P). The FSB's minder across the road looks at faces: stand about in the open, stare, or raise a camera where he can see it, and he may make you, and the meeting walks on past. Find a reason to be where you are (a shop window, a kiosk, a café's table), watch (E held), and when they're together, the photograph: both faces, steady, close enough for the light. The result paper shows your print: the frame you took.
- **Night chases hold** (the losses the cities' check found). A follower starts with eyes on the man for its first 20 seconds, as a team that had his door does: at night from 25 m back, a man who went from his door straight into a lane used to be lost before he was ever seen (7 chases in 108); now 1, and that one mid-chase.
- **Who the instinct means.** When its line names someone in sight ("the woman in the brown coat: seen before"; in Blown, the hunter who has you), a small white mark bobs over their head.
- **The last lines are read.** The result paper quotes the scene's last lines, which it used to cover as it came up.
- **The HUD scales with the screen** (from the UI review). The picture already did; now the words do too: the log's lines, the instinct, the keys, the watch, the sheets and the papers are half as big again at 1920×1080 as at 1280×720, and a little smaller at 1024 wide, where they used to crowd the picture.

## v0.1.0-rc10 (2026-10-27)

- **Money, and a coat to change into** (your asks: clothes shops for a change of clothes when tailed, and money). Cash on you, shown in the city's money (roubles, pounds, dollars in Beirut, Egyptian pounds), on the sheet (C): about $300 to start. A bite costs, a taxi's fare too (shown on the card: 650 ₽ for two streets), and short of it, no ride. A clothes shop sells a coat off the rail (about $120: 11 400 ₽ in Moscow), worn out of the shop in a colour you weren't wearing, the stained one left behind. Being tailed: watching the door for the old coat, they look straight past you half the time (overt; a covert team 3 times in 10), or they see the change and write it down. In Blown, the description they carry no longer fits.
- **Places to watch from** (your ask: lateral observation spots). A kiosk (Moscow's, Cairo's paper stalls): T, a paper, the front page read standing, the street over the top of it. A London phone box: a call to nobody, the glass all round. A café's, a bar's, a restaurant's window table: a coffee and three minutes watching the street from inside, out of its sight: whoever stops when you do, you'll see. They're natural stops: in the tail they're cover (the phone box best), being tailed they're checks of the faces about (the café's and the phone box's the best of them). Bus shelters and notice boards to come with the streets' furniture.

## v0.1.0-rc9 (2026-10-27)

- **Hunger and stress** (your ask; the design's needs). Six hours after you ate you're hungry (−1 to every roll), at fourteen starving (−2): a café, a bakery, a shawarma place, a grocer's (T at the door: a bite, two minutes) feeds you, and in the campaign so do the embassy's canteen, breakfast at home and a day lying low. Stress rises with danger (a fight +12, a blow taken +3 and more if it wounds, the man you're following seeing you +8, a hunter knowing you +10, a watcher caught catching you +6) and eases by itself, faster sitting on a bench or inside, with a meal, a rest, a night's sleep. On edge (50): −1 to Deception, Social and Awareness. Frayed (75): −2, and the mistakes it brings: now and then a glance back over your shoulder you didn't mean, which the scenes count like any other. The sheet (C) and the instinct say how you are.
- **Into a shop to shake a tail** (your ask). At a shop's door, T: in. A minute among the shelves and out the front (whoever followed waits where they can see the door, and has you again), or, where there's a way out the back (a café's kitchen, a grocer's yard; not a bank), through the stock room and a yard onto the street behind. Out the back, anyone on foot is left waiting on a door; being tailed's team, if they saw you go in, loses you and writes it down (a covert team has the back covered now and then). In Blown, the hunters who had you wait at the front.
- **The campaign in any of the four cities.** The title's campaign has a button per posting (Moscow, London, Beirut, Cairo): the station's, the candidates' language that counts there, the posting paper and the papers after named for it; the opposition as the city has it (the Russian residency in London, Hezbollah's security in Beirut, the GIS in Cairo), in the words of the scenes too.
- **Blood shows** (your ask: conspicuous wounds). Blood on your face (or your coat) is noticed: people who see it remember the face, and the heat creeps up (+1 for every 20 s of being seen with a bloody face, half as fast with a stained coat, at most 6 a day). Orlov and Blown's hunters look harder (+4 for a face, +2 for a coat), the FSB writes it down. The instinct says so. A café's, a bar's or a restaurant's toilet washes your face clean (T at the door: the toilet); a coat's stain scrubs down to something that passes for dirt.

## v0.1.0-rc8 (2026-10-27)

- **The scenes notice what you do to their people** (from the gameplay review). In the tail, a word with Orlov or his contact makes you, face to face, and a blow blows it (once the fight's over), where before he got up and walked on. Being tailed: a word with one of the watchers tells them you've made them, a blow is an incident (+12 heat, written down, and they don't lose you for it), and turning on SOLOVEY ends it: INCIDENT. In Blown, a blow on a hunter and he knows you and radios it; a word, and he looks at you from arm's length.
- **A weapon in your hand shows.** Orlov and Blown's hunters get +3 looking at someone holding one; the FSB writes it down.
- **Being tailed: running away has a cost.** Lose a team that's already caught you at two evasive things (running and a blow count twice), and there's an even chance a car or a post sees the bench anyway; you won't know until SOLOVEY misses his signals. Running from an overt team, the meeting's burned 3 evenings in 12 now, from none; from a covert team 6, from 2.
- **Being tailed: you can call it off on a face seen once before** ("seen before … or T call it off, to be safe"), where you had to be sure first.
- **The fight AI is harder to farm.** It reads what you lean on with your latest moves counting most, and when your last move beat its own (you're reading it), it often thinks a step further. Playing what beats its counter wins 61% of even bouts now (68% before), 57% of real fights (67%).

## v0.1.0-rc7 (2026-10-27)

- **Smoother** (the performance pass, from the review). Street changes no longer freeze: the next street is built while you walk up the lane, and arriving takes 50–60 ms instead of half a second. Dusk and night no longer hitch every few seconds: the worst frame running is 19 ms instead of 59, none over 33 ms (there were six in 40 s). The sun's shadows are drawn only when the camera has moved 2 m (333 draw calls a frame instead of 962). A game is ready in 0.8 s instead of 1.6, a new one starts in 0.2 s; twenty new games in a row no longer lose the picture to "too many WebGL contexts" or grow the memory to 180 MB. Windows light at dusk without a stall (a night face 3 ms to paint instead of 20); the once-a-second crowd update costs 2.7 ms instead of 4.6. The game plays exactly as before: saves byte for byte the same.
- **Wounds weigh on every roll**, not just a fight's: pale −1, in shock −3, a hurt head, a broken jaw, on a tail, a meeting, a read or a dressing (the reviewer: a shocked player tailed at full skill).
- **Everyone can fight a little now**: passers-by 0–8 at CQC (most never had a lesson), the FSB's people 12–18, Orlov 10 (the course, years ago), his contact 15, SOLOVEY 2. A handler's jab no longer drops an FSB officer cold.
- **The screens, second pass** (from the UI review):
  - The keys at the bottom right follow what you're doing: on the street they now show T (instinct) and H (first aid) and that E tapped glances; in a fight, only the fight's keys (K L M, Shift for an edge, G, F for your read); in a conversation, 1–4 and Esc. Their labels are lighter, easier on light pavement.
  - What T would do is a chip of its own after the instinct's line, not run on into its sentence. Busy, the free walk says what you're busy with ("Picking it up", "Binding it") rather than "At it."
  - A roll at the top left is in brief ("Pathfinding 23 against Deception 19 · ours"); the whole sum, every modifier, is in the log (J), and under the pointer.
  - In a fight, your state reads YOU · DAZED, and the labels over the two of you sit apart; when they're stunned the badge over them says OPEN, not "?".
  - When someone stands at arm's length, a small brass mark over your head says which one is you.
  - Your read of someone lists what you've read first; what never shows at a glance is one line, not eight rows of "?".
  - The character sheet says what its levels and dots mean; the bout's header reads "You vs the man in the red beanie"; asked the time, people tell it as the watch has it ("Twenty to"); debug mode's clock keys are named as your keyboard has them ($ and ^ on AZERTY).

## v0.1.0-rc6 (2026-10-27)

- **Three more cities beside Moscow:** London, Beirut and Cairo (your ask: cities to post in), a free walk in each from the title (one entry now, a button per city). Each has its own names, buildings, shops and signs, street furniture, trees and people, and the sun where it stands over it. The mechanic tests run there too (`?play=tail&city=cairo`, or `sdr`, `hunted`), their words in the city's own (its name, its service, its prison) until the scenes are written for each.
  - London: brick and stucco terraces behind their areas and black railings, sash windows, pubs and their signs, parades under their fascias. Pillar boxes, red telephone boxes, black cabs, Belisha zebras with LOOK RIGHT, plane trees, rain-dark York stone. Cars drive on the left.
  - Beirut: Ottoman houses with triple arched windows and red tile roofs, mandate balconies, post-war concrete with awnings and plants, the war still in the walls. Cables everywhere, generators, scooters, escaliers up the hill.
  - Cairo: khedival blocks the colour of the dust, mashrabiyas, unfinished brick and concrete, a mosque and its minaret, carts, stalls and souk passages.
  - Signs in Arabic, in a pixel script of its own (joined, right to left), with French or English beside them. People dress as their city does: headscarves, galabeyas, the names of its families.
  - The streets aren't a grid: lanes that dogleg behind the houses, dead-end courts, squares and midans set back from the street, London crescents, mews, stairs and souks. Anyone can still be followed through all of it (24 chases of 24 in the new cities' test; at night, 25 m back, a Beirut chase is now and then lost at its very start).
  - Moscow is as it was (its streets byte for byte the same), but its parked cars now face the way the traffic runs.

## v0.1.0-rc5 (2026-10-27)

- **Speech balloons** (your ask). What's said aloud shows in a balloon over whoever said it (Hale on the mat, the hunter who takes your arm, you on SOLOVEY's bench), for as long as a line at the top left lingers (16 s, waiting while a brief, a sheet or the pause is up). Several lines from one person stack in the one balloon; the rest of the line (the score, "a hand on your arm") stays top left. Someone off the picture still speaks top left; the log (J) keeps it all.
- **Being tailed:** going up a lane and straight back no longer made the team vanish (the reviewer's bot met its source clean 23 times in 24 that way). The watchers coming up after you meet you in the lane, turn, and come back with you; and they've seen you double back.
- **Tailing:** his double-back gives you a moment (2.5 s) before he looks, so a second sighting can't land in the same breath as the first (it did in nearly half of the evenings); and standing still in the evening's first seconds no longer counts as stopping when he did.
- **The Farm:** a riposte counts as a cover in Hale's first drill (it didn't, and knocked him cold by his bout); Hale is fresh at each step; the riposte is taught in the edge drill. Hurt but on your feet, you spar on (out cold or broken, you're done for the day): benched before Hale 5 times in 60 for a beginner, from half. A bout stops only for a wound taken in it, and in the memory "shake it off" leaves you a third hurt, not two thirds: Hale's bout runs a median 3 exchanges, half to points.

## v0.1.0-rc4 (2026-10-27)

The first polish pass, from three outside reviews of rc1 (gameplay, screens, performance):

- **A crash fixed:** a fight ender that went wrong and broke a bone froze the game (no words for a fracture). Now it has them; and any error in the game costs one tick and says so (Esc → Save to a file, to send it), rather than freezing.
- **Blood comes back.** It was rounded away a second at a time, so a collapse was for good. Now it returns 2% an hour once nothing bleeds; collapsed with nothing bleeding any more, you come round after 90 s, in shock; in the free walk, H offers a rest (up to 8 hours somewhere warm, the clock skipped).
- **First aid:** pressing on someone else's wound now works (it didn't); a missed dressing changes nothing (it used to slow it anyway, so retrying always won), and each try after is −2 harder. Press says to hold still a minute.
- **AZERTY:** the number keys in F's menu and a conversation didn't work without Shift (the top row types & é " '). Keys are read by their place now, and the first-aid, carry and taxi cards take 1–9 too.
- **Fights:** on the street they no longer talk about the mat and the hall; an FSB man is "the man in the red beanie", not "beanie)"; the instinct writes keys with their words ("a K hit can't be blocked").
- **Talk:** one reply in four read "undefined"; fixed.
- **Screens:** the title fits at 1280×720 (two columns on wide screens; it scrolls on small ones); the log's lines stop short of the fight's score; they wait while a sheet, a brief or the pause is up, and keep out from under them; PAUSED says Space; Esc out of J or C keeps a pause; the "seen before" slips fit their words; G on a bottle says you put it down (it won't go in a pocket); the result papers say "another lesson" or "another walk" where that's what it is, and ask for a score only in the mechanic tests.
- F does nothing in a conversation (it opened a hidden menu that took the number keys).

## v0.1.0-rc3 (2026-10-27)

- **Taxis** (your ask: transport for fast travel; and the design's taxi that shakes a tail). At the kerb, T hails one; say where: two or four streets north or south, or in the campaign your flat, the embassy, a safe house, and in Blown somewhere near the car. The ride takes its minutes, and you're out at the kerb there. On foot, nobody can follow you: being tailed's team loses you, but if one of them saw you jump in, it's written down, and they know what that means. In Blown, some drivers have heard the radio.

- **Blown** (the hunted state you asked for, as a mission: the title's test 4). Your network's rolled up and they have your face; a car waits across the city for 80 minutes. Men in plain clothes with your description search the streets round where you were last seen, and talk to each other: one who knows you follows you right up and takes hold, and it's a fight. Two safe houses on the way: in and out, a different coat (the description stops fitting), a minute out of sight. Keep to people and the dark; don't run where they can see you. Their looks at you show in the log only at the end.

## v0.1.0-rc2 (2026-10-27)

- **The posting has an arc.** It's done when the station has what it wanted (ten pieces of intelligence: six or seven good operations, two or three weeks done well), and you get the posting's paper. A tail that sees the meeting gives you a lead: the station names the man he met, and he's yours to tail next. An asset who trusts you enough (4) brings twice as much.
- **Heat costs now.** Meet an asset with a tail on you and in the days after they may be arrested: it's on the evening news, they're gone from your network, and the heat jumps. Let the heat reach the top and you're declared persona non grata: 48 hours to leave, the posting over. Lying low cools it, faster at a safe house (travel there first).
- **Fatigue.** Sixteen hours awake and every skill is down 1; twenty, down 3, until you sleep. The instinct tells you, and the sheet.

- **The campaign begins** (your ask: character life, posting, assignments). On the title: Campaign.
  - Pick one of three officers (each a Handler with a background: Army intelligence, Treasury, State, a detective, a Navy corpsman, a correspondent; skills to match), then read the posting: Station Moscow, the subject the station wants, your network (codenamed assets, their roles and motives), the man you're to watch.
  - You start outside your flat. Tab is the desk: the date, heat, cover standing, intelligence, money; what's ahead (asset meetings and tails, a week planned at a time); the places (the flat, the embassy, two safe houses: go there by metro or taxi, the minutes it takes); and the day's choices: the embassy till six, sleep till seven, lie low for a day.
  - Assignments are the missions you've tested, now with your officer, your city, your asset's codename and your target's name: an asset meeting is a detection run to his bench (the heat decides who's on you), a tail follows your target to his contact. Their outcomes count: intelligence, heat, an asset's trust, a target turned wary. Miss one and it costs.
  - The days count: a working day missed shows, pay comes on the 1st, and every Sunday night the week's review.
  - Your wounds, your blood and what you carry go with you from one scene to the next.

## v0.1.0-rc1 (2026-10-27)

- **Bleeding out** (your ask: a blood-pressure health stat). You have a blood level (100%), and every wound that bleeds has a rate: a split lip a trickle, a shallow cut through your guard under 1% a minute, a knife that lands clean several, a cut artery 10–15% a minute. Shallow cuts stop on their own; deep ones and arteries don't. Lose blood and it costs: pale under 85% (−1 to everything), in shock under 70% (−3, no running), collapsed under 55%, dead under 45%. Untended, a clean knife wound kills in about ten minutes, an artery in four or five. It comes back slowly once nothing bleeds. The edges of the screen darken as you lose it, the sheet shows it, and the instinct tells you to tend it.
- **First aid** (your ask, Medicine driving it): H tends your own wounds; F → First aid tends someone else's. Press on it (it bleeds a third as fast while you hold still), dress it with a strip of your shirt, a tourniquet from your belt on an arm or a leg (it stops an artery, but the limb's useless till a hospital), a splint from a stick, a pipe or an umbrella for a broken limb (half the penalty). Each a Medicine check (harder for worse wounds, on yourself, one-handed) and the time it takes. Real bandages and kits come with money and the pharmacies.
- Fixed: the short stoop when you pick something up was a twentieth of what it should be.

## v0.0.46 (2026-10-27)

- **The instinct, overhauled** (your report: mostly useless, advice that doesn't apply).
  - Every line is now a rule checked every tick against where you actually are: the line shown stays only while it still applies, and goes the moment it doesn't (it used to hang on for up to 7 seconds).
  - No more crossing offered from up a lane (the zebra was found by looking along the street only); T no longer offers one there either. In a lane with him, it says what matters in a lane: "In a lane there's nowhere to be but behind him, 21 m. Hang back till he's out the far end."
  - The filler is gone: instead of "Good. Keep it.", how things stand: "19 m behind him, the gap steady. 3 people between you." Distances in the warnings ("Too close: 7 m").
  - Lost him, or out of sight: no talk of a gap it can't know. Following the wrong grey coat: it's as sure as you are, as before.
  - The free walk's instinct names the place and the way, or says nothing; the rotating lessons are gone (there and in being tailed).
- **No more copy-paste streets** (your ask; the round's numbers: 640 street sections checked identical in everything the game reads, only the look differs).
  - Every stretch of Moscow is laid and furnished its own way: five pavements, four kerbs, five zebras (Moscow's white-and-yellow, raised, faded, fresh), six lamp posts, five railings, benches and bins, seven cars (a yellow taxi now and then), lanes and alleys in setts, slabs, patched tarmac or dirt. Surfaces change only at a zebra or a stretch's end, never mid-pavement.
  - Every building wears a dress: pediments, rustication, Art Nouveau, constructivist ribbon windows, dressed or yellow or painted brick, ornate or tiled Stalinist blocks, panel blocks, 1970s white brick; gates and carriage doors in the arches, awnings, hanging signs, letters on the wall, posters, drainpipes, air conditioners, satellite dishes, scaffolding, varied roofs.
  - It's November: limes, maples, poplars and birches are bare, oaks hang on to their brown leaves, spruces stay green, leaves lie in the gutters, hedges have turned. Parks get new ponds, fountains boxed up for the winter, busts and seated bronzes, newsstands, cabbage beds.
  - Faster, too: a quarter fewer draw calls (a prop's plain parts are one mesh now).

## v0.0.45 (2026-10-26)

- **Knives and what's to hand** (your round). Nineteen weapons: six knives (penknife, box cutter, switchblade, kitchen knife, finka, combat knife) and what lies about (a screwdriver, a bottle, half a brick, a hammer, a spanner, a length of pipe, a crowbar, a stick, an umbrella, a snow shovel, a bike lock, a chain).
  - **In a fight it's still CQC.** Armed, you mostly hit with the weapon (the trained three times in four; they still kick and knee, never punch with the knife hand), and cover with it if it's any good for that. Knives are balanced, no drawback, and a direct hit is heavy (2.2 to 2.9 times a fist) and cuts. Everything else costs: a full hand fumbles grabs (a pipe one in five; a shovel can't grab at all), awkward things cost every roll and come slower.
  - **Blocking a blade bare-handed** is a CQC roll for a clean block; lose it and it comes through your guard, mostly into the forearms, never past a wound. A pipe or a crowbar across it stops it whole.
  - **Disarmed:** a grab can knock a weapon out of a hand (an arm lock half the time), and it lies where it fell. A bottle can break into a broken one.
  - **A kill:** with a weapon in hand, Shift with a hit on someone stunned is an attempt to kill (your rule).
  - **The street** has things lying about, about two every 45 m: bottles by the bins, pipes and bricks down the alleys, a snow shovel by a courtyard's arch, a stick under a tree. T picks one up. G takes out a weapon you carry or puts it away (in a fight, that exchange you only cover). I shows what you carry. Pockets by your clothes (two in the trousers, two more in a coat), two weapons in the beltline, no bags yet: a pipe is held or put down. What's in your hand shows under the watch, and on you.
  - **Others:** a few passers-by carry a blade; whoever does draws it when it turns bad ("Steel"), a criminal at once.
  - Numbers: CQC 10 with a penknife against 10 bare-handed wins half the time (35% without); 20 bare-handed against 10 with a kitchen knife, four times in five. The sprite cell is 4 px wider, for what's held.

## v0.0.44 (2026-10-26)

- **Women and men no longer share a haircut** (your report: him against her looked like him against him): women's hair is long or up in a bun, men's short (or gone); a woman's short cut was a man's. More cuts each side come next.
- **F reads "Interact"** in the keys bar (your ask).
- **Edges are zero-sum** (your ask): a block takes one of their edges away first, if they hold any; only then does it earn you one. The line says so ("That takes Price's edge away").
- **The log's lines at the top left linger twice as long** (your ask): 16 s, then they fade.
- **A fight reads them for you** (your ask): an Analysis check as you square up, and another every four exchanges, each narrowing what you know of them (it's in the log, with the roll). F in a fight opens your read of them, their sheet as you guess it; F again closes it. Drills read nobody.

- **Fixed: who landed what** (your report). When they won an exchange, the line read "Price fires a cross; you throw a straight right, and it lands", as if yours had. Now the winner's move comes last ("You throw a straight right; Price fires a cross, and it lands"), and two hits say whose landed first. A cover no longer says forearms twice ("gets the forearms up, and takes it on the forearms").
- **The illegal speaks Russian like a native** (your note): in Moscow, years on, your Russian is native, no accent, nothing. DESIGN.md has it as a rule for illegals.

## v0.0.43 (2026-10-26)

- **Fight enders** (your design). When they're stunned and you hold an edge, Shift with a move tries to end it: a CQC check against their CQC and Fitness (about 3 in 4 between equals). A hit knocks them out. A grab breaks an arm or a leg if you're good enough (CQC 21), or else it's a wild charge that slams them into the floor. Failed, it still hits twice as hard and nearly always breaks something: a crack, or a new, worse injury, a fracture (a broken jaw, an eye socket, ribs, a forearm, a shin: six weeks). A knockout or a slam can kill: rarely someone fresh (2%), far more often someone already beaten up (about 1 in 7 at 60%). The move panel shows it in red when it's there to take. They'll do it to you, too, in a real fight.
- **Death.** Someone killed lies where they fell, for good. A killing in the street that's seen is four times the heat of a fight. You killed: the game says so, on its own paper.
- **A foul at the Farm.** Finishing a sparring partner in a bout is a foul: Hale stops it, the bout is lost, and it goes on your file. Kill a classmate and you're out of the course. Your sparring partners never do it to you.
- **The instinct says how things stand** (your ask): you or they stunned, dazed or off balance, and what it means (no cover, no grab, whatever comes lands; them stunned, the keys to finish it, or a warning that it's a foul), in every fight. The move panel now sits above the instinct however long it runs.
- Fixes: a knocked-out opponent now lies on the ground after the fight (they stood idle); a sentence starting with a name like "the FSB man" gets its capital.
- **Fixed: Hale's score read backwards when you lost** (your report). "Novak 2–3 you" was Novak winning 3–2, written with your score first. Now it says "Novak takes it, 3–2" or "You win it, 3–1", and the result paper puts the winner's score first ("lost 3–2").

## v0.0.42 (2026-10-26)

- **Fixed: people swapping looks at the Farm** (your report, a priority). Since v0.0.41 the Farm is in 2007, before the game's calendar starts, and a person's standing frame was picked from the clock: before 2026 it came out as a frame that doesn't exist, and the picture took the cell next to it, someone else's, every other half-second. Both chapters, everyone in the hall. The frame is now picked the right way round whatever the date, and a frame the picture doesn't know stands still instead of borrowing a neighbour's.
- **The F tag over whoever's within reach** (your report: clunky on the mat): a paper keycap outlined in ink, with a hard shadow under it and a point down to them, at full strength, just above the head (it floated higher). It reads on the mat, the pavement and a dark doorway alike.

## v0.0.41 (2026-10-26)

- **The Farm, remembered** (your idea). Once you've had the lesson, the title offers the Farm as a memory: no drills, straight to the bouts, now four: the weaker classmate, the even one, a better one (new, in the lesson too), and Hale. When Hale's bout ends you hit the floor, and it isn't the mat: a white flash, and it's Moscow, three in the morning, nineteen years on. You're on your back on the cobbles; somebody hit you hard enough to send you back to the Farm. Same character, an illegal now, as good in a fight as Hale was then (CQC 30), against an FSB officer (CQC 24): strong, but you're better. You get up, and it's not a bout: it ends with one of you down. The whole lesson is still on the title.
- The Farm is 2007 now: the past.
- In a memory, nobody's sent to the bench: hurt badly, Hale has you shake it off and go again, so all four bouts happen.
- Fixes: a fight that isn't a drill (a street brawl, Moscow) no longer says "drill" at the top, and names them properly ("vs The FSB man", not "man"); nothing at hand is offered (T: the shop window) in the middle of a fight; the edge's line in the move panel fits on one line again (the whole of it on hover).

## v0.0.40 (2026-10-26)

- **F: what to do with someone** (your ask). Close to anyone (a key shows over them), F opens a menu, numbers or a click:
  - **Talk:** time stands still while you talk; ask the time, the way, some small talk; what they say depends on how they feel about you, and someone you've hit is afraid of you. (A KLM-style minigame for some conversations comes later.)
  - **Violence:** a hit, a sucker punch (if they don't see it coming: it lands with all your weight), a push, a grab (CQC 9 and over), a stab (greyed: no blades yet). It's a fight on the spot, the same engine as the dojo's; caught unawares, they're open. A civilian who's had enough runs; one out cold lies there a minute. Whoever saw it remembers your face: heat.
  - **Read:** their sheet as you guess it. Your Analysis decides how close: each skill that shows at a glance (Fitness, CQC, Awareness, Weapon handling) as a range that holds the truth, narrower the better the read and with every read after; a good read says what they are, a very good one how trained. A fight shows bounds. What you've learned is kept.
- **The fight, deeper** (your asks):
  - **The riposte:** cover with Shift held, an edge in hand, and when the hit comes you hit back, half as hard again, mostly to the head, and they're dazed; you keep the edge. A plain cover still earns one. Hitting every time into a much better fighter no longer stalls: they read it, cover, and riposte, and a bout is over in four exchanges.
  - **Handicaps:** staggered, no grab (no footing) and −3; dazed, no cover (hands too slow) and −4; stunned, nothing at all. The move panel greys out what you can't do.
  - **Their edges:** when they can't read you, they spend them; when they can, they keep them to riposte.
  - An expert's variety, checked: at CQC 30 a hit is a kick a third of the time, a punch about half, an elbow or a knee the rest.
- **Night is dark** (your report): in the dark the eye reaches 15 m (was 22), into a lamp's light 30 m (was 34), by day 52 m. On screen, what you can't see goes near black at night, so the edge of your sight is a shadow. It cuts both ways: watchers lose you more easily, and tailing at night means staying close: the game's follower held 309 night chases in 320 (most losses on the first street, starting further back than it could see), and over mixed evenings a follower of 15 against Orlov's 10 sees the meeting 54% of the time (79% before).
- **Your keys:** labels read AZERTY whatever the browser says or hasn't said yet: the cover is M, not ";".

## v0.0.39 (2026-10-26)

- **The camera looks where you look** (your report: people up or down a lane were off the picture while you could still see them). It leans the way your eyes go, more north–south where the picture is shorter: a little as you walk, up to 8 m when you hold E and look; and tailing, toward him while he's in sight, so a man going up a lane stays in the picture while you're still on the street. The fog still shows only what your character sees; the picture just keeps up with the eyes. (The crowd's never-on-screen rule widens to match: nobody appears or vanishes within 24 m east–west, 22 m north–south.)

## v0.0.38 (2026-10-26)

- **Injuries and blood** (your ask).
  - A blow that takes half of what a part can take may crack it: a cracked rib, forearm, shin or cheekbone, −2 to what it does until it knits (three weeks). A hard blow to the face can split a brow or a lip, or bloody your nose; they bleed a while and mend in days. (Blades will cut, when there are blades.) The sheet lists them under each part.
  - **Blood on the floor, pixel by pixel:** a blow that draws blood flings a spatter the way it went, a few big drops near and fine ones far; whoever's bleeding drips where they stand. It stays where it fell and darkens as it dries.
  - **Blood on people:** a bloodied face shows it (a trickle from the nose or lip, down the chin) until it's washed off a day later.
  - The words say it: "Your skin splits: a split brow. Blood runs warm." "Something in Morgan gives with a crack: a cracked rib, by the sound of it."
  - In sparring the blows are pulled, so it's rare; in a real fight, a professional against a civilian cracks something in most fights and bloodies a face in about two in five.

## v0.0.37 (2026-10-26)

- **The fight, faster and harder** (your asks). An exchange is quick now and lands:
  - a wind-up, the strike with a step in, the moment of impact held a beat (0.15 s) while the picture jolts a pixel or three, the one struck knocked back by how hard it was, then reeling, staggering, or standing dazed;
  - a throw puts you down beside your mark and you get up through a kneel (it used to drop you two metres off and pop you back);
  - 0.45 s for an expert's blocked kick, nearly a second for a beginner thrown. No sparks.
- **Techniques by level** (your ask): you still choose hit, grab or cover; how it comes out is your CQC.
  - A beginner swings, slow and wide; then jabs, crosses, hooks and front kicks; experts elbows, knees, low kicks, a palm to the jaw, a kick to the head.
  - A grab goes from a shove to a hip throw, a sweep, an arm lock, a choke; a cover from a block to a parry or a slip.
  - Each with its own frame of animation (there are 18 fight frames now), its target and its weight.
- **Staggered and dazed:** a heavy blow, a low kick, a shove, a parry or a slip leaves someone off balance (−3 next exchange, no reading anyone); a hard blow to the head, a palm, a head kick or a choke can daze them, and the next exchange they can't do anything. Hale will do it to you.
- **The words:** every exchange told from many lines, by technique, outcome, the part hit and how hard; what you do to them as it looks, what they do to you as it feels ("Your ribs light up", "Lights go off behind your eyes").
- **The indications:** over your opponent, what you read as a pixel icon and a word (a fist, an open hand, a cover), or a ?; STAGGERED and DAZED over whoever is; the header with both names, the score and each one's edges as brass diamonds; the three moves and their keys at the foot of the picture while you choose.

## v0.0.36 (2026-10-26)

- **What's at hand is the game's, not the scene's** (your ask): in the free walk, tailing and being tailed alike, the instinct's line ends with what you can do where you stand (look in the shop window, sit on a free seat, cross at the zebra) and T does it. A scene still offers its own moves first (sit down with SOLOVEY, call it off, a shoelace as he looks back). Being tailed now offers benches, which it never did; sitting is a quiet way to check your back.
- **One to a seat** (your report): people sat on top of each other, and T could sit you on someone (on SOLOVEY, in your shot). Now a passer-by who finds their seat taken walks on, T picks a free seat (and offers none when there isn't one), and the bench a scene's meeting needs (Orlov's, SOLOVEY's) is kept free of passers-by. Six minutes of a busy day on the boulevard: 32 people sat down, never two to a seat, none on his bench.

## v0.0.35 (2026-10-26)

- **Close combat, and the Farm** (your ask). A new start on the title, *The Farm: hand to hand*: the agency's training hall at Camp Peary, week six of the course, an instructor (Hale), a class, a mat. It's the tutorial for fighting.
  - **A fight** is a second at a time, and the world stops while you choose: K hit, L grab, M cover (on QWERTY, ;). Cover beats a hit, a hit beats a grab, a grab beats cover; the same move both ways is a roll of CQC against CQC. Blows land on a body part and show on your sheet; what's hurt costs your CQC from then on.
  - **Edges:** every punch you cover earns one (one per 10 CQC held at most); hold Shift with a move to spend it: a hit that lands does double, a grab shrugs off the punch it walks into, a cover stops a throw.
  - **Reading:** the better fighter sees what's coming. Over the other one's head: HIT, GRAB or COVER when you read it, a ? when you can't. Hale reads you nearly always, and answers.
  - **The lesson:** Hale calls the moves while you learn them (cover, grab, hit, the three mixed, an edge spent), then you spar to three points: a weaker classmate, an even one, then Hale. In the tests' bouts, six points of CQC over your partner wins 83% of them, even is a coin toss, and nobody beats Hale (1 in 100). Too hurt, and you're sent to the bench.
  - People now have fight poses: a guard (fists up before the face), a punch, a grab, a stagger, and lying on the mat.
- **Fixed:** a walk the game makes for you (to a shop's glass, a bench, the mat) gave up after a second however far it had to go; it now goes all the way, and gives up only when a second's walking brings it no closer.

## v0.0.34 (2026-10-26)

- **The character sheet, on C** (your ask): your name and cover, Tradecraft (the over-skill) as a bar, every skill with its training (course, advanced, expert, master, and practice as dots), what Tradecraft multiplies it by, and its value; your languages; and your **health part by part**: head, torso, each arm, each leg, on a figure and in words. The game pauses while it's open; C or Esc closes it. The camera, when there is one, moves to P.
- **Health, part by part:** each part takes damage against what it can take (head 6, torso 12, an arm 8, a leg 9, more with Fitness: Fitness 8 takes 40% more), and reads unhurt, bruised, hurt, wounded or out (broken, down, out cold). Hurts cost checks (a hurt arm −1 to fighting and shooting, a broken one no grappling and −6 with a gun; a hurt head −1 to everything), wounded legs slow the walk, and bruises mend in days while wounds wait for care. Nothing hurts you yet: the fight is next.

## v0.0.33 (2026-10-26)

- **The game fills the window** (your ask). It was drawn at 640 × 360 and scaled up by a whole number only, so a window between two sizes left a wide border. Now it scales by any amount, sharp-bilinear: every pixel the same size, the seam between two blended over a single screen pixel, so nothing crawls as the street goes by. A window of another shape shows a little more street on its longer side (up to 736 × 430, as far as the street is kept alive off screen), and a border only past that: a window like yours in the screenshot keeps a thin band top and bottom; 1920 × 960 and 1280 × 720 fill it all.
- **`./play.sh` makes the play copy the first time** (from the latest release), as `play.cmd` does on Windows. It used to stop and tell you to promote first.
- **The keep-awake leaves the screen lit** (your ask). It used to turn the backlight off after 20 minutes with nobody at the keyboard, and once, finding the screen already dark when it did, "restored" it to dark when you came back. Turning it off is now opt-in (`AWAKE_DIM=1`), and it never turns off a screen that's already dark.

## v0.0.32 (2026-10-26)

- **Shop windows are mirrors** (your ask). Stand at a shop's glass facing it and you're looking in the window, however you got there (T, or walking up to it): its reflection shows the street behind you, lit on the screen like anything else you see.
  - **Less than turning round:** only what the pane reflects (stand at one end and the glass runs the other way), three quarters as far (39 m by day against 52), and not straight behind you, 24° wide, where the reflection is your own back: a dark wedge on the screen.
  - **Slant it:** straight in, the glass shows the road behind you; hold E and turn your eyes along it (up-left, up-right) and it shows the pavement you walked, on the side the glass runs.
  - **Always on offer:** the instinct offers the window at every shopfront now, whatever else it's saying, in all three scenes (being tailed, it came and went, and other lines hid it). T walks you to the end of the pane where the glass runs back the way you came (tailing: toward him), and you stay at it until you move.
- **Being tailed:** a window is a check of your back as you come to it and every 6 s you stay, so the look after 5 s shows who stopped when you stopped. With a watcher's eyes on you it's still a roll, at better odds than a glance back: the same Deception against their Awareness, +5 on your side (people do look in windows), +1 at another within a minute. Caught, they write it down. Covert watchers stopped at a window watch you in its glass.
  - The test's checker, who looks in windows (its eyes slanted back along the glass) and glances back now and then, now calls a covert team off rightly 5 times in 12 (2 before) and burns him 4 times (5); with an overt pair, 5 called off rightly in 9 (6). It's written down a little more often, 1.3 times a walk against 0.8: windows are a check too. The pro, overt: 8 in 9 called off rightly (7); covert: 7 clean and 2 called off rightly in 12 (6 and 4). Nobody behind: still 8 clean in 9.
- **Tailing:** Orlov's windows are real glass now, at the end of the pane ahead of him with his look slanted back along it the way he came; before, half of them were beside the door where there's no glass. The game's follower at a window keeps him in the glass, slanted his way, instead of looking straight at him. Unchanged in the measure: it held a careful man in 959 chases out of 960 (the same one lost, at night), and skill against skill moved no further than chance (our base 5 / 10 / 15 / 20 against his 10: seen 0%, 25%, 79%, 100%; ours 15 against his 5 / 10 / 15 / 20: 100%, 79%, 21%, 4%).

## v0.0.31 (2026-10-26)

- **The city lives round you** (your ask): passers-by are going somewhere real now, a shop, a block of flats, a courtyard's arch, 2–5 streets from where they appear and 120–600 m along, by a way of their own, stopping at a shop window, a bench on the boulevard, a phone call on the way. Follow anyone and the tail ends at their door: six civilians followed by the game's follower all went in at theirs, 2 to 4 streets on.
  - **The bubble:** people live on your street and the streets either side. Cross to the next street and the one behind keeps its people (all 32 of them, crossing in the test), the one you arrive on was already full (all 29 were there before you), and anyone who comes through the lane after you arrives. Cross again and the street two back is let go.
  - Saves keep each passer-by's plan (a few numbers), not their route (2 KB), which is planned again on load, the same. A tick costs 105 µs for some 90 people over three streets (27 µs before, for 30).
- **Tailing: no arrow over him** (your ask). The marker shows him for his first 30 s out of the door; then it's your eyes and the instinct. **A close look:** hold E on a grey coat for 2 s (within 24 m) and Awareness tells: "That's him: the fedora, the briefcase", "Not him: a cap, not a fedora", or "From here, it could be anyone's". Found again in a crowd, the instinct says where ("by the shops, a way off, to your left"). The look-alikes are passers-by now, going past him on his pavement.
- **Being tailed, with a living crowd:** people going your way, by the same lanes, would look like a tail; so now only following counts. A face counts again when it's copied a move of yours it had no reason to copy (stood behind you when you stood, crossed after you, turned when you turned back), or (for "seen before" only) stayed with you 90 s and 100 m. Three times is a tail; twice on two streets no longer is. With nobody behind them, the test's three players now meet clean 8 times in 9 (the ninth missed him). A covert team shows itself only to moves that test it: a player who just glances back catches 2 in 12, a pro that stops and takes lanes catches 4 and shakes 6 more. The lane's-mouth advice is less sure of itself, now that people come through lanes all day.
- **Benches** (your ask): two seats 1.65 m apart (2.65 m long, so nobody's elbow to elbow), and a third of the time three (4.3 m). People sit on the seats now: a step off the path was walked a metre wide, so sitters (and shoppers at doors) ended up beside their spot.
- The game's follower squeezes past people in a lane when it's hurrying, as anyone would; it was stuck behind strollers in alleys, now they're busy. Through the living crowd it held a careful man across ten streets and more in 959 chases out of 960 (day, dusk and night, 10 to 30 m back); the one it lost stepped into a short lane at night just out of its sight.
- Toasts and the log show your keys where a line names one.

## v0.0.30 (2026-10-26)

- **Passers-by no longer vanish in the middle of the street** (your report from Windows). Someone heading off the end of the street had their end point set when it was off screen; walk the same way and it came on screen, and they vanished there. Someone who gave up a stuck step could vanish the same way. Now they only leave through a door, off the map up a lane, or off the screen. Six minutes walking the street both ways: v0.0.29 lost 12 in the open on screen, this one none (a test now checks it).
- **Tailing, across the city:** Orlov's bench is ten to twelve streets away (1.1–1.4 km, some 20 minutes), on a way he plans across the city, a little roundabout, much more so on a wary evening. You start on his pavement behind his first way. Through the lanes he takes, the instinct names the lane ("He's gone up an alley off Maroseyka: 9 m to the far end").
  - **His habits** on the way: a look back every 55–100 m (35–65 m wary); along a row of shops a window's glass (3 in 10 a stretch; 4 in 10 wary) or a shop (1 in 8, once a walk); a glance at a zebra (35%; 60% wary) and at a lane's mouth (45%; 75% wary). Some 14 checks a calm walk, 23 a wary one (at every corner it would be one every half-minute). Seen once, he dry-cleans: back on himself, then a longer way round. Made, he turns for home. The meeting unseen when he gets up is missed.
- **The game's own follower** (the FSB's watchers next, and the player in autoplay: `?play=tail&autoplay`). In his footsteps, never further back than 60% of what the eye reaches in the open air (31 m by day, 11 m at night); it looks away when he stops to check, walks on ahead when he comes its way, cuts across where his trail loops back. Out of sight it hurries to where it last saw him and guesses: up the lane he was in or walking straight at, the door he went in by, or (not on the street after a look both ways) the shops nearby, watched from the pavement.
  - **Reliable:** after a careful man across ten streets and more, 960 chases out of 960 by day, dusk and night, 10 to 30 m back (half of them on seeds it was never tuned on): never blocked, never lost, never more than 49 m behind.
  - **Skill against skill** (your ask), the game's follower 20 m back, 30 evenings a cell, the meeting seen: our trained base 5 against his 5 / 10 / 15 / 20: 23%, 7%, 3%, 0%; ours 10: 63%, 23%, 13%, 3%; ours 15: 97%, 83%, 23%, 3%; ours 20: 100%, 100%, 73%, 17%. Nearly all the rest are made (it lost him outright 2 evenings in 480). A better follower sees more and a better watcher makes more, everywhere. At equal bases he wins three evenings in four though our tradecraft gives us a few points more: two sightings end it over a long walk, and d20 against d20 is a wide spread. Tell me if equal skill should be closer to even.

## v0.0.29 (2026-10-26)

- **Windows:** `play.cmd` serves and opens the game like `play.sh`: the play copy (made from the latest release the first time) on :8100, `--dev` for the working tree on :8101, `--promote [vX.Y.Z]`, `--status`. It needs Git and Python 3. The server now sets file types itself (Windows can serve `.js` as text, which stops the game loading).
- **The background game, started** (your ask: where NPCs go, pathfinding that never fails):
  - **The city as a graph** (`sim/city.js`): every street's walking lines, joined by the zebras, the railings' gaps, park paths and the lanes between streets. Routes are planned on it across the city, randomised per walker; a careful walker goes the long way round. Ten streets apart is ten map changes at least.
  - **Proved walkable:** 915,000 points on the ways of 3 × 13 × 13 street sections are clear at their full width. 60 routes of 10–13 streets, walked at every offset, are never blocked. 4,000 random spots anywhere walkable all find their way onto a line and on.
  - **Agents** (`sim/agents.js`) walk routes by the clock on any street, loaded or not. Followers walk in their target's footsteps as far as they've seen them, and through the lanes they saw them take. The loaded street follows whoever the camera follows. (The two tests move onto them next.)
- **The street:** every other section now has at least an alley north, so a way north is never more than two sections off; a lamp or two moved out of the crossings' way. Saves from before load onto a slightly different street.

## v0.0.28 (2026-10-26)

- **Being tailed:** the result paper no longer says "0 rolls" when the only rolls were your unseen checks.

## v0.0.27 (2026-10-26)

- **No clue to what your character doesn't know** (your note): an unread sign reads exactly as no sign, "November passes quietly." with no hedge. The papers count only the rolls you saw and the mix-ups you found out about, and the tail's "(maybe more)" is gone.

## v0.0.26 (2026-10-26)

- **You only know what your character knows** (your note):
  - **Being tailed:** what the FSB writes down stays hidden, unless you catch a watcher at it ("She may have seen you check. Maybe it's nothing."). The result paper says only what you know: whether you met him, the faces you marked, what you think they caught you at. The truth comes later, as the world tells it: SOLOVEY's next signal, or an arrest in the papers.
  - **The signs** of what they made of you (a car outside your building, a face twice on the way to work) need a Pathfinding roll to notice. Fail it, and November passes quietly, as far as you can tell.
  - **Tailing:** if he makes you while you're not looking, you don't know why the evening ended: he's "spooked". "What you didn't see" and the log's unseen entries show only in debug mode.

## v0.0.25 (2026-10-26)

- **Being tailed:** a check that catches a face behind you going your way says so ("You'll know that face again"), passers-by included, so a covert team leaves something to go on. SOLOVEY walks up to his bench if you're already watching it, rather than appearing on it.

## v0.0.24 (2026-10-26)

- **Mechanic test 2: being tailed** (title, Mechanic tests). A surveillance detection run: SOLOVEY, a source in the Ministry of Defence, will be on a bench in a park a street or two away for eight minutes. Walk there, and find out first whether the FSB is behind you.
  - **Some evenings nobody is.** Some, an overt pair, close and not caring if you see. Some, a covert team of three, well back, taking turns.
  - **Check your back the way people do:** a shop window's glass, a crossing, standing a while, or a glance over your shoulder (E tapped). A face seen again somewhere else is marked "seen before"; three times, or on two streets, "tail".
  - **They write down** what a professional does: running, glancing back where they can see, crossing away from the zebra, doubling back. It costs heat, and two together tell them what you are.
  - **Losing them:** take a lane none of them saw you take, and they never know where you went. Watch the lane's mouth from the other end: whoever comes out after you came for you.
  - **Then sit down with him (T), or call it off (T)** when the instinct says you're followed. A watcher's eyes on that bench and he's burned.
  - **The result paper** tells you who was really there, what they wrote down, and the faces you'd marked.
  - **Balance**, 60 evenings of scripted players: walking straight there burns him nearly every time a team is on you; checking your back calls it off rightly, though a covert team gets past a quarter of the time; shaking them up a lane works against a covert team about four times in ten.
- **An arrow at the picture's edge** shows the way to where you're going, with the streets and metres.
- **Getting about:** a helper (`sim/nav.js`) takes the watchers, and the scripted players, round railings and hedges and through the crossings and lanes. People in a hurry go round slow walkers.

## v0.0.23 (2026-10-26)

- **What characters are aware of, shown:** a ? over him when he half-notices something, a ! when he's seen you, if you're watching him. Passers-by turn their heads to look at someone running past, or at you if you stare at them close up (E held, 1.5 s).
- **Tailing:**
  - If you don't see him turn up a lane, the instinct doesn't know which one either (it no longer says he's in a shop).
  - Taking a different lane, or leaving the street without him, now says so: you went the wrong way.
  - A save and a load across a change of street play on the same (tested).
- **The scripted followers** (`tests/bots.mjs`) go round railings, lamp posts and parked cars, so their numbers measure the game. Over 100 evenings: naive made 79; careful sees the meeting 47, trained 61.
- **Playtests** are logged in `docs/PLAYTESTS.md`: what was played, what turned up, what was fixed, what's still rough.

## v0.0.22 (2026-10-26)

- **Every side of the map leads somewhere** (you asked for it). The city is rows of streets, each its own map:
  - **North:** side streets and narrow, dark alleys run through the terrace to the next street.
  - **South:** past the boulevard there's now its far road (with a zebra) and far pavement, or, a stretch at a time, a park with a pond, a fountain, a monument, a kiosk or flower beds; then a hedge with lanes leading on south.
  - **East and west:** the street goes on (the free walk is endless now too).
  - Walk off through a lane and you come out at its other end on the next street, with an autosave. Streets, boulevards, parks and lanes have Moscow names, shown under the watch.
  - Passers-by use all of it, and never pop into view.
- **The free walk's instinct:** it names the lanes and where they lead, offers to cross at the zebras (T), to sit on a bench, to look in a window, and between those, a lesson or two.
- **Tailing:** once an evening he may turn up a side street or an alley to the next street. Give him the corner, then follow him through, or lose him. The instinct's lines hold longer when calm (no more flicking between two).
- **Balance** (40 evenings): naive made 34; careful sees the meeting 22, trained 24 to 28.
- Saves from before this load onto a regenerated street.

## v0.0.21 (2026-10-26)

- **Perception** (you asked for it: where we look, what characters are aware of). Everyone faces a way and sees a cone ahead, as far as the light allows, plus a small radius of awareness all round; walls block the view. Awareness widens both.
  - **The screen shows what your character is aware of.** The rest is dimmed and frozen as it was last seen: people out of sight stand where you saw them, mid-step, until you look that way again. At night, lamplit pools stay visible far off and the dark between them doesn't.
  - **New keys:** Alt (Option on a Mac) held strolls (0.95 m/s, to keep a pace); E held stops and looks, the move keys turning your eyes; E tapped glances back over your shoulder for a second, walking on.
  - In numbers: a cone of 100° plus 2° a point of Awareness (a Handler's ≈ 132°); reach 18 m + 34 m × the light (50 m by day, 34 m into a lamp's pool at night, 22 m into the dark); awareness 2.5 m + 0.2 m a point (≈ 5.7 m).
- **Tailing, rebuilt on perception and made to play** (mechanic test 1):
  - **Each run is an evening:** dusk, night, the lunchtime crowd, or a wary evening (he checks more, warns less).
  - **His checks come with tells** (he slows, drifts to a window, glances at the kerb). If you're watching him, Awareness reads them, and the instinct warns you in time to act. The check itself needs you in his sight, so being out of his line of sight, or in the dark between lamps, is safe.
  - **Cover on T:** the instinct offers what fits where you stand: look in a shop window (its glass shows the street behind you), sit on a bench, tie a shoelace, cross at the zebra. Starting it as he looks is worse than nothing.
  - **More of your choices count:** standing about, staring at him, your back to him, lamplight at night, jaywalking, glancing back.
  - **His alertness** rises with near things and brings his checks closer.
  - **Lookalikes:** men in grey coats and hats walk the street, and you can end up following the wrong one until you're close enough to see it.
  - **The marker** is over whom you take for him, hollow where you last saw him when he's out of sight.
  - **The instinct always speaks**, the voice of training, with dry humour now and then ("You have no idea where he went…"). Its border shows how pressing it is.
  - **You only learn what you see:** a check of his you didn't see isn't narrated. The result paper lists them after ("what you didn't see"), and you may notice the change in him later.
  - **Balance** over 100 evenings: a naive tail is made 91 times; a careful one sees the meeting 60 times, a trained one 67. Lunch is the hardest evening, night the easiest.
- **The brief** lists the keys the test needs. **The result** adds how many of his checks you read in time and how often you followed the wrong man.

## v0.0.20 (2026-10-26)

- **Mechanic test 1: tailing a target** (title, Mechanic tests). Gennady Orlov, a former GRU officer, leaves his office on a Tuesday at 16:45 and walks east through the dusk to a meeting. Follow him, don't be seen twice, and see whom he meets.
  - **A brief** before it starts. **A brass marker** over him while you have him; it goes when you lose him.
  - **His habits:** looking back, studying a shop window's reflection, going into a shop and coming out looking, crossing the road, a pause on his phone. After a first sighting he dry-cleans: a little later he doubles back.
  - **The dice:** his Pathfinding against your Deception at each of those moments. The modifiers are your choices: distance, the other pavement, people about you, the dark, not running, not stopping when he stops. Your Tracking keeps him at a distance, your Awareness finds him again. Every roll is in the log with a line of flavour.
  - **The instinct** (a line at the foot of the picture) warns that you're too close, he's stopped, he's pulling away, he's in a shop. T does what it says when there's something to do: look in a shop window.
  - **The meeting:** a man in a blue beanie joins him on a boulevard bench. Watch from close enough, not too close: the other man has eyes too.
  - **A result paper:** seen, made, lost, missed or blown, with the numbers. Play the same evening again, or another.
  - **Balance**, by scripted followers over 30 evenings: tailing 10 m behind is made 9 times in 10; the other pavement, 20 m back, sees the meeting 6 times in 10.
- **Opposed rolls:** the totals decide, naturals included (they had given every contest a one-in-ten floor of failure); ties still go to us.
- **The street:** lamps keep clear of the crossings. Passers-by keep to their lanes and step round what blocks them; nobody gets stuck now.
- **A new section of street** is built over a few frames (it had cost a 76 ms stall); the endless street holds 60 frames a second.
- **The log's lines** now come in at the top left, three at most. **The November sunset** is cooler.

## v0.0.19 (2026-10-26)

- **The look is picked** (the user, 2026-10-26): chibi people in the fine town. Sample 007 shows it with `?people=chibi`, and the gallery has it by day and by night.
- **The game's skeleton, played as the free walk** (the title's first choice): a Handler from the US embassy on a Moscow boulevard, Monday 2 November 2026, 15:40.
  - **The street** is generated in 45 m sections, the same every time for a seed:
    - a terrace in Moscow ochres, pinks and greens, red brick or Stalinist stone, with shops signed in Cyrillic (АПТЕКА, ПРОДУКТЫ, ОДЕЖДА…), entrances, arches to the courtyards and side streets;
    - a wide pavement with lamps, the road with parked cars and a zebra;
    - a boulevard with railings, lawns, trees, a gravel path and benches.
  - **Passers-by:** about 30 on the map in the afternoon, up to 40 per 100 m at the busiest hours, a handful at night. They walk the lanes, look in shop windows, cross at the zebra, sit on benches, and go into shops, arches and side streets.
  - **Light from the clock:** the real sun over Moscow sets at 16:50 that day. The light warms, then goes blue; windows light up house by house; the lamps come on, with their pools of light. People and trees take the light where they stand, the same light the dice will read.
  - **Moving:** walk at 1.45 m/s, run at 3.6. The camera follows, snapped to the pixel grid. A tree in front of you is seen through.
  - **Screens:** the watch, the log's lines as they come, the keys labelled as your keyboard prints them; J opens the log, Space pauses, Esc opens the menu.
  - **Saves:** an autosave every 30 game minutes, on leaving the page and on quitting. The menu saves to a file and loads one. Debug mode (menu) adds a manual save, and ] / [ move the clock on.
- **Under it** (`src/sim`, pure):
  - the tick: 20 a second, in a fixed order, the same game twice from a seed and across a save and a load (tested);
  - the calendar;
  - the sun;
  - skills, as (base + practice) × (1 + weight × Tradecraft / 100);
  - checks and opposed rolls, with natural 1s and 20s, hooks, and ties to us, each written in the log;
  - the three gauges, drifting back a step a week;
  - heat per legend per country, starting at 20 under official cover;
  - generated passers-by with Russian names.

  In the browser: one draw for the whole crowd; 60 frames a second.
- Art moved to `src/art/`, shared by the game and the samples (samples 006 and 007 render pixel for pixel as before).

## v0.0.18 (2026-10-26)

- Sample 007, fine town: sample 006's street in a finer finish, after Stoneshard (Q155).
  - **People** (`samples/lib/finepeople.js`): a 24 × 40 cell, faces with glinting eyes, brows, cheeks and a mouth, legs and boots that show, six hue-shifted tones a colour, the outline softened on the lit side.
  - **Motion:** limbs drawn between joints give an 8-frame walk, a 6-frame run, and an idle that breathes and blinks.
  - **Surfaces:** bevelled bricks and slabs, weathered plaster showing brick, ivy, puddles, weeds, litter.
  - **Colour:** a 116-colour palette and a warm grade.
  - **View:** 640 × 360; `?res=480` shows sample 006's frame.
- Stoneshard measured: its people are 2.4 heads tall, close to our chibi, not the tall, small-headed figures I first described. The difference is the finish. DESIGN.md and PIPELINE.md corrected.
- `samples/lib/mainstreet.js`: the street of samples 006 and 007, built once; sample 006 renders pixel for pixel as before.
- `pixelart.js`: OKLCH colour, `tone()`, `noise()`, `nearest()`, the fine palette, a warm grade, any resolution, palettes up to 128 colours.

## v0.0.17 (2026-10-26)

- The design is settled: DESIGN.md now holds the user's answers to round 2 of the debrief as decisions:
  - postings played in chapters (key days in full, the rest summarised); an active day of 20–40 minutes;
  - leads beside intelligence; intelligence changes the world, seen in the news and briefings;
  - the ladder Recruit, Officer, Handler, Undercover, Illegal; the classes and over-skills: Tradecraft, Warfighting, Intuition (cops, up to special agent), Streetwise;
  - checks: a trained base 0–20, practice 0–3, over-skill 0–100 with a weight per skill, opposed rolls with environmental modifiers; Awareness, Tech and Medicine added; a hook halves the difficulty;
  - one heat number, read only through the instinct's signs;
  - a lost character is lost (a new one among generated candidates; debug mode allows reloading);
  - agency services on replenishing credits; two purses; a cover standing gauge;
  - observation on E, the camera on C, shooting paused like CQC, knockouts that can kill, no driving, transit playable when it matters;
  - maps larger than a screen with a following camera.

  0.1.0 is a few weeks as a Handler in Moscow, 5–10 hours, with all nine kinds of assignment.
- My calls to close the last holes, marked as such: what makes a day key, the summary between chapters, heat thresholds, Tradecraft's weights per skill, who rolls against whom.
- Road to 0.1.0: the look, a skeleton, eight mechanic tests the user scores, then joining them.

## v0.0.16 (2026-10-26)

- DESIGN.md rewritten from the user's 101 answers to the design debrief (round 1), as decisions:
  - pillars, and the loop at every scale from seconds to a career;
  - world and setting, ranks and classes, postings and the day, time, intelligence;
  - skills and d20 checks, the fear/trust/affinity gauges and hooks;
  - cover, exposure and the hunted state; networks; the agency and special forces;
  - moment-to-moment play (CQC as rock, paper, scissors on K/L/M; the T instinct), presentation, saves;
  - the first playable: a CIA officer at the US embassy in Moscow.

  My proposals are marked as such, each tied to a round-2 question.
- Scale settled: compact maps, about 50 people on screen at the busiest, no city simulation (geopolitics and persistent characters only). The technical base waits for the design, as the user asked (Q101).
- Design debrief round 2 (Q102–Q162, same page): the holes and tensions in round 1, each section opening with a read-back to correct, most questions leading with my proposal.

## v0.0.15 (2026-10-25)

- People run properly side-on: the back leg bends and kicks up behind, and the arms are bent, where they swung out straight like sticks. The in-between frames are airborne, one knee up, instead of standing still.
- `?view=sheet&cols=right:run0,…` on sample 006 picks the frames to lay out.
- Release numbering: `tools/release.sh rc`. 0.1.0-rc1 when the user declares a candidate (`--user-declared`), rc2, rc3… for fixes to it, and 0.1.0 when they validate it. `promote.sh` sorts a release after its candidates.
- DESIGN.md: the user's pitch (ranks, intelligence, character sheets for everyone, a real-time clock, crowds, varying light), and controls (ZQSD read by physical key, F, I).

## v0.0.14 (2026-10-25)

- Chibi town, second pass, after the user's scores (camera 95, night 90, environment 80, characters 35: "front view is too boxy"):
  - People are pixel sprites now (`samples/lib/sprites.js`). Each part is a template in three views, recoloured per person from palette ramps, shaded as a pixel artist would: upper-left light, shadow under hair and chin, inner lines between parts, an ink outline. Frames: idle 2, walk 4, run 4, sit.
  - In the street, people are upright cards one texel to a pixel, snapped to the pixel grid, and lit at night by the pools they stand in. `?people=boxes` brings back the box people for comparison.
  - Trees are drawn sprites (leaf clumps lit from the upper left, bark), casting their silhouette's shadow. New props: potted shrubs, a post box, a café chalkboard, bistro tables and chairs, a bicycle, pecking pigeons, flower boxes under windows, posters in the alley.
  - `?view=sheet` lays the cast's sprites out flat.

## v0.0.13 (2026-10-25)

- Chibi town (sample 006), after the user asked for simple pixel art, handheld-RPG style. `samples/lib/pixelart.js` renders 480 × 270 through a 45° orthographic camera at 16 px a metre, with inked outlines and one 50-colour palette. `samples/lib/chibi.js` makes people 29 px tall from a few boxes: 15 × 13 heads with painted faces and profiles, hats, beards, glasses, coats and dresses, things carried. They're posed in code at 8 fps: idle, walk, run, sit, crouch. `samples/lib/pixeltown.js` paints the street: facades, signs in a 3 × 5 pixel font, kerbs, a zebra crossing, trees, lamps, benches, café tables, cars and a taxi. Night lights windows, signs and lamps.
- Gallery: pixel-art samples get crisp PNG shots at twice their native size (no smoothing, no JPEG).

## v0.0.12 (2026-10-25)

- Animation libraries: `tools/blender/animlib.py` fits a whole folder of clips once to MPFB's mixamo skeleton, checking each against its recording. `samples/lib/anim.js` re-bases them onto any person on that rig. The first Mixamo clip (a walk) passes every check: limbs 0°, shrug 2°, wrists as recorded, real finger curl, head tilt 0.7°. `retarget.py` now has a profile per library (CMU, Mixamo). The rest of the Mixamo clips wait on Chrome's permission for multiple downloads. `samples/004-mixamo/` shows the library.
- Looks (`samples/lib/looks.js`, sample 005): the same street rendered as realistic, 3D pixel art (pixel, pixel-chunky), toon, and a low-poly toy (flat), with a chibi option. `samples/lib/street.js` is the shared street (trees and a lamp post added). `samples/lib/motion-view.js` is the shared motion review.

## v0.0.11 (2026-10-25)

- Two more pose checks, for what the user caught at "60/100": head tilt (beyond the recording's) and hand clearance (fingertip to thigh surface, negative = inside the leg). The CMU walk fails the second, at -0.02 m.

## v0.0.10 (2026-10-25)

- `tools/gallery.mjs` removes the pictures of views that no longer exist.

## v0.0.9 (2026-10-25)

- Motion fixed: shoulders no longer shrug and hands no longer bend into flippers (the user caught it). The retarget now aligns only the clip's pose differences, never its skeleton's construction: against the recording, the shrug went from about 29° to 0.3° and the wrist bend from 90° to 12°. Fingers really curl toward the palm now (they splayed sideways before), along an axis derived from the hand rather than tuned by eye.
- Every bake prints a pose check against the recording (limbs, shrug, wrist, curl, lean), with limits that print WARN, kept in `.credits.json`. The recording's own skeleton is written to `<out>.motion.json`. `samples/001-motion/` draws it in orange over or beside the person (`?ghost=over|beside`), and takes `?orbit=front|side|back`, read from the motion.
- docs/PIPELINE.md: "How to judge motion", a checklist written after this miss.

## v0.0.8 (2026-10-25)

- The samples gallery: `samples/index.html` (open with `./play.sh --dev`, then `/samples/`) shows every sample and view as a picture that opens it live. ★ marks a pick, and "Copy my picks" gives a list to paste back. `tools/gallery.mjs` shoots the views on the GPU, failing on page errors, and writes `samples/index.json` and a contact sheet.

## v0.0.7 (2026-10-25)

- The building kit (`tools/blender/kit.py` → `assets/kit/kit.glb`): a casement window, a French window, a shopfront, a door, a double entrance, a flight of stairs, and a balcony. Each is bevelled, carries real dimensions, and states the opening it fills.
- Buildings at runtime (`samples/lib/building.js`): outer walls with openings, interior walls with doors, floors with stairwells, and a roof. Textures tile in true metres, with a dark section colour on cut faces. There are three cutaway modes (walls up, cut, down), plus hiding the storeys above the one viewed. `samples/lib/materials.js` makes materials from the fetched texture sets.
- `samples/003-building/`: a three-storey corner block with a shop, flats, balconies and stairs, on a cobbled pavement. One person walks outside, another talks upstairs.

## v0.0.6 (2026-10-25)

- `tools/fetch-asset.mjs`: search and fetch CC0 textures, models and skies from Poly Haven and ambientCG, game-sized, each with its `.source.json`. `samples/002-library/` puts them in the renderer: an asphalt street, a brick wall at true scale, a scanned armchair, a night-street sky as the light, and the walking man.
- People's clothes no longer shine like vinyl: no clear coat on cloth, hair or brows, and cloth matte, shoes with a little sheen.

## v0.0.5 (2026-10-25)

- `tools/gen.sh`: image generation through a saved 8-bit copy of each model (Z-Image-Turbo: 7.5 GB and 32 s an image, down from a 25 GB peak that swapped), writing each image's provenance (`.gen.json`) as it goes.

- People move. CMU motion capture (`tools/fetch-cmu.sh`) is baked onto MPFB people by `person.py --motions` through a new retargeting (`tools/blender/retarget.py`): a walk at 1.55 m/s with a planted foot sliding 0.12 m/s, a stealthy walk, and a two-person conversation. The hands follow the forearms with a relaxed curl, since the recordings carry no hand data.
- `samples/001-motion/`: the clips played under the iso camera, with `?check` (speed, facing, foot slide), `?strip` filmstrips and `?orbit&focus` close-ups. `samples/lib/stage.js` is the stage every sample now shares. `tools/shot.mjs` prints a page's `window.__report`.

## v0.0.4 (2026-10-25)

- docs/PIPELINE.md: how content is made. It covers the rules for picking a tool (real before generated, scripts, the least restrictive licence, local before hosted, provenance), which tool for which job, the licence table, recipes, what's still needed, and a log of lessons. CLAUDE.md keeps the rules that never bend and points to it.

- Image models: with the user's Hugging Face token, FLUX.2 klein 9B, Krea 2 Turbo and Ideogram 4 (readable text in images) are cleared for the game's art. Their licences are read and summarised in CLAUDE.md.

## v0.0.3 (2026-10-25)

- People no longer see-through: MPFB marked every material as blended, so the inside of the mouth and the backs of the eyes showed through the face. `person.py` now exports skin and eyes opaque, and hair, brows, lashes and clothes as cut-outs (soft-edged with MSAA in the sample). The red tie was there all along.
- `samples/000-toolchain/?cam=px,py,pz,tx,ty,tz` aims the camera anywhere, for close looks at faces and hands.
- `*.private` files are never committed (credentials).

## v0.0.2 (2026-10-25)

- Design: a contemporary spy game, single player, 3D from an isometric-style camera; the look is to be found through samples (docs/DESIGN.md).
- Toolchain (`tools/setup.sh`): Blender driven by scripts, MPFB (MakeHuman) with 34 asset packs for people, ffmpeg, and pinned npm dev tools (three.js, playwright-core, gltf-transform).
- three.js 0.186.1 vendored in `vendor/three/` (`tools/vendor-three.mjs`), loaded through an import map: still no build step and no network to play.
- Local image generation with mflux: no API key, nothing leaves the machine. Which models may ship images in this free game, and which are for samples only, is set out in CLAUDE.md.
- `tools/blender/person.py`: a person from a short spec (build, skin, hair, clothes, skeleton), exported as a game-ready glTF.
- `tools/shot.mjs`: screenshots in headless Chrome on the GPU, failing on page errors and missing files.
- `samples/000-toolchain/`: the toolchain check (a generated person under the iso camera).
- CREDITS.md: third-party code and assets, CC-BY credited.

## v0.0.1 (2026-10-25)

- Project boilerplate: the method carried over from longhaul (CLAUDE.md), the pinned play copy (`play.sh`, `tools/promote.sh`), releases (`tools/release.sh`), the keep-awake lease (`tools/awake.sh` and its hooks), the test runner.

