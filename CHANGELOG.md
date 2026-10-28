# Changelog

One entry per release, newest first: what changed for the player, and the numbers that moved. Write it under Unreleased as the work happens; `tools/release.sh` stamps it with the version and the date.

## Unreleased

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

