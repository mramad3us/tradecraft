// TRADECRAFT sim: the people of the cities other than Moscow (Moscow's are sim/people.js): their
// names, and how they dress on the street (sprite specs, src/art/sprites.js).
//
// A passer-by's name comes from a background drawn first (in London: English, Irish, South Asian,
// West African or Caribbean, Polish, Arab…; in Beirut: Christian, Muslim, Armenian; in Cairo: Muslim or
// Coptic), and their skin follows it loosely. Their dress is the city's in its month: London's
// coats and raincoats; Beirut's and Cairo's lighter November, jackets and shirts. Headscarves: some
// women in London and Beirut, most in Cairo; in Cairo some older men in a galabeya and a skullcap.
import { int, pick, chance, weighted } from '../rng.js';

const HAIR = [0x14151c, 0x2a1c18, 0x47302a, 0x6b4636, 0x8f6345, 0xb9862e];
const GREY = [0x8f96a6, 0xdfe2e8, 0xb8bdc8];
const COATS = [0x353947, 0x4c5262, 0x23252f, 0x47302a, 0x6b4636, 0x8f6345, 0xd6ad7a, 0x24503a, 0x283f6b, 0x6e2a2e, 0x6a7182, 0x2f6b62, 0x4a2a52];
const BRIGHT = [0x9e3c36, 0xc95c45, 0xe7b84a, 0x3b6296, 0x5d8fc2, 0x7a4a86, 0x356f42, 0xf6f4ee];
const LIGHT = [0xf6f4ee, 0xdfe2e8, 0xe2dac6, 0xd6ad7a, 0x95c1e3, 0xb8bdc8, 0xc4bba9];   // shirts, a warm November
const LEGS = [0x23252f, 0x353947, 0x283f6b, 0x1b2541, 0x47302a, 0x4c5262, 0x2a1c18];
const SHOES = [0x14151c, 0x2a1c18, 0x47302a, 0x23252f];
const SCARVES = [0x23252f, 0x353947, 0x4a2a52, 0x6e2a2e, 0x283f6b, 0x24503a, 0xd6ad7a, 0xe2dac6, 0x8f96a6, 0x9e3c36, 0x2f6b62, 0x7a4a86, 0xc4bba9];

// ---------- names ----------

const pickBy = (r, table) => weighted(r, table);
const LONDON = {
  english: { w: 5, skin: [['light', 9], ['tan', 1]], m: ['Oliver', 'George', 'Harry', 'James', 'Jack', 'Thomas', 'William', 'Daniel', 'Matthew', 'Samuel', 'Joseph', 'Edward', 'Charlie', 'Alfie', 'Tom', 'Rob', 'Nick', 'Simon', 'Graham', 'Nigel'],
    f: ['Olivia', 'Amelia', 'Emily', 'Sophie', 'Charlotte', 'Grace', 'Lucy', 'Hannah', 'Jessica', 'Rebecca', 'Victoria', 'Alice', 'Harriet', 'Kate', 'Helen', 'Sarah', 'Claire', 'Jane', 'Ruth', 'Pippa'],
    s: ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Robinson', 'Wright', 'Thompson', 'Evans', 'Walker', 'White', 'Roberts', 'Green', 'Hall', 'Wood', 'Jackson', 'Clarke', 'Hughes', 'Edwards', 'Turner', 'Hill', 'Cooper', 'Ward', 'Fletcher', 'Pike'] },
  irish: { w: 0.8, skin: [['light', 1]], m: ['Ciaran', 'Sean', 'Declan', 'Padraig', 'Liam', 'Eoin'], f: ['Siobhan', 'Niamh', 'Aoife', 'Roisin', 'Orla', 'Mairead'], s: ['Murphy', 'O\'Brien', 'Kelly', 'Walsh', 'Byrne', 'Ryan', 'Doyle', 'Gallagher'] },
  southasian: { w: 1.5, skin: [['tan', 3], ['brown', 4]], m: ['Mohammed', 'Arjun', 'Imran', 'Sanjay', 'Rahul', 'Amir', 'Ravi', 'Hamza', 'Vikram', 'Faisal'], f: ['Priya', 'Aisha', 'Fatima', 'Anjali', 'Sana', 'Nadia', 'Meera', 'Zara', 'Shabnam', 'Kavita'],
    s: ['Patel', 'Khan', 'Ahmed', 'Singh', 'Shah', 'Begum', 'Hussain', 'Ali', 'Sharma', 'Kaur', 'Chaudhry', 'Mistry', 'Iqbal', 'Rahman'] },
  african: { w: 1.1, skin: [['dark', 4], ['brown', 2]], m: ['Kwame', 'Tunde', 'Femi', 'Chidi', 'Kofi', 'Emeka', 'Daniel', 'Samuel', 'Marcus', 'Andre'], f: ['Chiamaka', 'Adaeze', 'Abena', 'Ngozi', 'Folake', 'Grace', 'Blessing', 'Shanice', 'Tanisha', 'Esther'],
    s: ['Okafor', 'Adeyemi', 'Mensah', 'Boateng', 'Okonkwo', 'Campbell', 'Francis', 'Grant', 'Thomas', 'Asante', 'Oyelaran', 'Clarke'] },
  european: { w: 0.9, skin: [['light', 1]], m: ['Piotr', 'Tomasz', 'Luca', 'Marco', 'Pierre', 'Andrei', 'Jakub', 'Pablo'], f: ['Agnieszka', 'Kasia', 'Giulia', 'Chiara', 'Camille', 'Elena', 'Lucia', 'Ana'],
    s: ['Kowalski', 'Nowak', 'Wisniewski', 'Rossi', 'Bianchi', 'Dubois', 'Garcia', 'Popescu', 'Silva', 'Novak'] },
  arab: { w: 0.7, skin: [['tan', 3], ['light', 1], ['brown', 1]], m: ['Omar', 'Youssef', 'Karim', 'Tariq', 'Sami'], f: ['Layla', 'Yasmin', 'Rania', 'Noor', 'Dina'], s: ['Haddad', 'Mansour', 'Saleh', 'Nasser', 'Khalil', 'Aziz'] },
  chinese: { w: 0.5, skin: [['light', 1]], m: ['Wei', 'Jun', 'Kevin', 'Hao'], f: ['Mei', 'Lin', 'Jenny', 'Xin'], s: ['Chen', 'Wong', 'Li', 'Zhang', 'Lau', 'Ng'] },
};
const BEIRUT = {
  christian: { w: 4, skin: [['light', 4], ['tan', 5]], m: ['Georges', 'Elie', 'Joseph', 'Antoine', 'Pierre', 'Charbel', 'Fadi', 'Ziad', 'Marc', 'Rabih', 'Tony', 'Nabil', 'Michel', 'Karim', 'Walid'],
    f: ['Rita', 'Nadine', 'Maya', 'Carla', 'Joelle', 'Myriam', 'Christelle', 'Nathalie', 'Rima', 'Lara', 'Tatiana', 'Mireille', 'Josiane', 'Nour'],
    s: ['Khoury', 'Haddad', 'Nassar', 'Hayek', 'Tannous', 'Abboud', 'Karam', 'Matar', 'Sfeir', 'Bitar', 'Daher', 'Najjar', 'Rizk', 'Azar', 'Gemayel', 'Frangieh', 'Mansour', 'Chidiac', 'Feghali', 'Saliba'] },
  muslim: { w: 4, skin: [['tan', 5], ['light', 3], ['brown', 1]], m: ['Mohammad', 'Ali', 'Hassan', 'Ahmad', 'Omar', 'Rami', 'Hussein', 'Khaled', 'Bilal', 'Samir', 'Mahmoud', 'Wassim', 'Jad', 'Hadi'],
    f: ['Fatima', 'Zeinab', 'Rana', 'Hiba', 'Rasha', 'Lina', 'Mariam', 'Nada', 'Samar', 'Dalia', 'Hala', 'Yasmine', 'Ghada', 'Aya'],
    s: ['Saad', 'Khalil', 'Salameh', 'Hamdan', 'Hamadeh', 'Moussa', 'Haidar', 'Itani', 'Beydoun', 'Daouk', 'Sinno', 'Fakhoury', 'Shehab', 'Jaber', 'Hijazi', 'Ghandour', 'Kabbani', 'Yassine'] },
  armenian: { w: 1, skin: [['light', 3], ['tan', 2]], m: ['Hagop', 'Vartan', 'Sarkis', 'Garo', 'Raffi', 'Krikor'], f: ['Ani', 'Talar', 'Nayiri', 'Lena', 'Sevan', 'Maral'], s: ['Kevorkian', 'Boyadjian', 'Hagopian', 'Kassardjian', 'Der Sarkissian', 'Manoukian', 'Tashjian'] },
};
const CAIRO = {
  muslim: { w: 9, skin: [['tan', 5], ['brown', 4], ['light', 1], ['dark', 0.6]], m: ['Mohamed', 'Ahmed', 'Mahmoud', 'Mostafa', 'Hassan', 'Ali', 'Omar', 'Youssef', 'Karim', 'Amr', 'Tarek', 'Hany', 'Sherif', 'Ibrahim', 'Khaled', 'Waleed', 'Hossam', 'Islam', 'Ayman', 'Sayed'],
    f: ['Fatma', 'Mariam', 'Nour', 'Aya', 'Salma', 'Heba', 'Dina', 'Yasmin', 'Rania', 'Mona', 'Shaimaa', 'Doaa', 'Esraa', 'Hend', 'Amira', 'Nadia', 'Samah', 'Asmaa'],
    s: ['Abdel Rahman', 'El-Sayed', 'Hassan', 'Mahmoud', 'Ibrahim', 'Mostafa', 'Fathy', 'Saleh', 'Gaber', 'Soliman', 'Farouk', 'Mansour', 'Shawky', 'Ezzat', 'Fawzy', 'Ramadan', 'Tawfik', 'Abdel Aziz', 'El-Masry', 'Zaki', 'Hamdy', 'Abdallah'] },
  coptic: { w: 1.2, skin: [['tan', 5], ['light', 2], ['brown', 2]], m: ['Mina', 'Girgis', 'Bishoy', 'Michael', 'Peter', 'Fady', 'Ramy', 'Youssef', 'Sameh'], f: ['Marina', 'Mariam', 'Christine', 'Irene', 'Demiana', 'Sally', 'Nancy', 'Mary'],
    s: ['Hanna', 'Girgis', 'Boutros', 'Naguib', 'Ghali', 'Wassef', 'Habib', 'Shenouda', 'Tadros', 'Ayoub'] },
};

function named(r, sex, table) {
  const bg = pickBy(r, Object.entries(table).map(([k, v]) => [k, v.w])), T = table[bg];
  return { bg, T, given: pick(r, sex === 'f' ? T.f : T.m), family: pick(r, T.s) };
}
// (the background is drawn again from the look's stream, the same draws: the name and the skin agree)
const backgrounds = new WeakMap();
const nameOf = (table) => (r, sex) => { const n = named(r, sex, table); backgrounds.set(r, n); return [n.given, n.family]; };
export const londonName = nameOf(LONDON);
export const beirutName = nameOf(BEIRUT);
export const cairoName = nameOf(CAIRO);

// ---------- looks ----------

/**
 * A look for someone on a city's street (a sprite spec), as sim/people.js streetLook() is Moscow's:
 * `climate` 'cold' (coats, a few hats: London), 'mild' (jackets and shirts: Beirut, Cairo);
 * `scarf` the share of women in a headscarf; `robe` the share of older men in a galabeya.
 */
function cityLook(r, sex, age, { climate = 'cold', scarf = 0, robe = 0, shades = 0.4, hats = 1 }) {
  const bgd = backgrounds.get(r), grey = age > 55 && chance(r, 0.7);
  const skin = bgd ? weighted(r, bgd.T.skin) : weighted(r, [['light', 6], ['tan', 2], ['brown', 1]]);
  const dark = skin === 'brown' || skin === 'dark' || bgd?.bg === 'muslim' || bgd?.bg === 'arab' || bgd?.bg === 'southasian' || bgd?.bg === 'coptic';
  const hairColor = grey ? pick(r, GREY) : dark ? pick(r, HAIR.slice(0, 3)) : pick(r, HAIR);
  const style = sex === 'f' ? weighted(r, [['long', 4], ['bun', 3]]) : weighted(r, [['short', 8], ['bald', age > 45 ? 2 : 0.3]]);
  const look = { skin, hair: { style, color: hairColor } };
  const cold = climate === 'cold';
  if (sex === 'm' && age > 45 && chance(r, robe)) {                // a galabeya, and often a skullcap
    look.top = { kind: 'robe', color: pick(r, [0xe2dac6, 0xc4bba9, 0x8f96a6, 0x6a7182, 0x47302a, 0x283f6b, 0xf6f4ee]), trim: 0x23252f };
    look.legs = look.top.color; look.shoes = pick(r, SHOES);
    if (chance(r, 0.6)) { look.hat = { kind: 'skullcap', color: chance(r, 0.7) ? 0xf6f4ee : 0xb8bdc8 }; look.hair.style = 'short'; }
    if (chance(r, 0.4)) look.beard = hairColor; else if (chance(r, 0.4)) look.moustache = true;
    return look;
  }
  const top = sex === 'f'
    ? weighted(r, cold ? [['coat', 6], ['sweater', 2], ['dress', 1.2], ['suit', 0.6]] : [['coat', 2], ['sweater', 3], ['dress', 2], ['suit', 1], ['tee', 1]])
    : weighted(r, cold ? [['coat', 6], ['sweater', 2], ['suit', 1.5], ['tee', 0.3]] : [['coat', 1.5], ['sweater', 2.5], ['suit', 2], ['tee', 2.5]]);
  const color = top === 'coat' || top === 'suit' ? pick(r, COATS) : top === 'tee' && !cold ? pick(r, LIGHT) : chance(r, 0.5) ? pick(r, BRIGHT) : pick(r, COATS);
  look.top = { kind: top, color };
  if (top === 'coat') { look.top.trim = pick(r, [0x23252f, 0x353947, 0x47302a]); if (chance(r, 0.5)) look.top.belt = look.top.trim; if (cold && chance(r, 0.18)) { look.top.color = 0xd6ad7a; look.top.belt = 0xb48459; } }   // (a trench)
  if (top === 'suit') look.top.tie = pick(r, BRIGHT.slice(0, 7));
  if (top === 'sweater') look.top.trim = pick(r, [0xf6f4ee, 0xdfe2e8, ...BRIGHT]);
  if (top === 'dress') look.top.trim = pick(r, [0x23252f, 0x3f1a22, 0x1b2541]);
  look.legs = top === 'dress' ? pick(r, [0x23252f, 0x353947, 0xedc39c]) : pick(r, LEGS);
  look.shoes = pick(r, SHOES);
  if (sex === 'f' && chance(r, scarf)) {                           // a headscarf, its colour the outfit's or one of its own (the hair under it)
    look.hat = { kind: 'hijab', color: chance(r, 0.4) ? look.top.color : pick(r, SCARVES) };
    look.hair.style = 'short';
    if (top === 'dress' || chance(r, 0.6)) look.legs = top === 'dress' ? look.top.color : look.legs;
  } else {
    const hat = weighted(r, [[null, 6], ['beanie', cold ? 2 * hats : 0.2], ['cap', 0.8 * hats], ['fedora', sex === 'm' && age > 40 ? 0.5 * hats : 0.05]]);
    if (hat) look.hat = { kind: hat, color: hat === 'beanie' ? pick(r, [...BRIGHT, ...COATS.slice(0, 6)]) : pick(r, COATS.slice(0, 8)) };
    if (hat === 'beanie') look.hat.band = pick(r, [0x173327, 0x23252f, 0x3f1a22, 0x1b2541]);
  }
  if (sex === 'm' && chance(r, dark ? 0.3 : 0.16)) look.beard = hairColor; else if (sex === 'm' && chance(r, dark ? 0.25 : 0.08)) look.moustache = true;
  const glasses = weighted(r, [[null, 8], ['specs', age > 45 ? 3 : 1], ['shades', shades]]);
  if (glasses) look.glasses = glasses;
  const carry = weighted(r, [[null, 6], ['briefcase', top === 'suit' ? 4 : 0.7], ['paper', 0.6]]);
  if (carry) look.carry = carry;
  return look;
}

export const londonLook = (r, sex, age) => cityLook(r, sex, age, { climate: 'cold', scarf: 0.07, shades: 0.2, hats: 0.8 });
export const beirutLook = (r, sex, age) => cityLook(r, sex, age, { climate: 'mild', scarf: backgrounds.get(r)?.bg === 'muslim' ? 0.45 : 0, shades: 2, hats: 0.5 });
export const cairoLook = (r, sex, age) => cityLook(r, sex, age, { climate: 'mild', scarf: backgrounds.get(r)?.bg === 'muslim' ? 0.8 : 0.05, robe: 0.35, shades: 1, hats: 0.4 });
