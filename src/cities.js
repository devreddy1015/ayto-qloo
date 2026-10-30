// Candidate cities per market, and how to match them to Qloo's localities.
//
// Qloo's heatmap comes back as geohash cells with no names, and its locality
// listing can't be filtered by area. So each market has a candidate list of
// city names here; every one is looked up with a Qloo locality search, and
// only the ones Qloo returns, with Qloo's own id, spelling and coordinates,
// go on to the heatmap. A name on this list never reaches the kit by itself.
export const CANDIDATE_CITIES = {
  India: ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal", "Patna", "Vadodara", "Ludhiana", "Agra", "Nashik", "Visakhapatnam", "Vijayawada", "Kochi", "Coimbatore", "Tiruppur", "Chandigarh", "Guwahati", "Bhubaneswar", "Mysuru", "Madurai", "Amritsar", "Dehradun", "Thiruvananthapuram", "Kozhikode", "Mangaluru", "Raipur", "Ranchi", "Jodhpur", "Warangal", "Guntur", "Tirupati", "Nellore"],
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "Austin", "San Jose", "Jacksonville", "Columbus", "Charlotte", "Indianapolis", "San Francisco", "Seattle", "Denver", "Nashville", "Oklahoma City", "El Paso", "Las Vegas", "Boston", "Portland", "Detroit", "Memphis", "Louisville", "Baltimore", "Milwaukee", "Albuquerque", "Tucson", "Fresno", "Sacramento", "Atlanta", "Miami", "Minneapolis", "New Orleans", "Orlando", "Tampa", "Salt Lake City", "Raleigh", "Pittsburgh", "Cincinnati", "Kansas City", "St. Louis", "Cleveland", "Honolulu", "Newark"],
  "United Kingdom": ["London", "Birmingham", "Manchester", "Glasgow", "Liverpool", "Leeds", "Sheffield", "Edinburgh", "Bristol", "Leicester", "Nottingham", "Newcastle upon Tyne", "Cardiff", "Belfast", "Coventry", "Bradford", "Southampton", "Brighton", "Reading", "Oxford", "Cambridge", "Luton", "Wolverhampton", "Derby", "Stoke-on-Trent", "Plymouth", "Aberdeen", "Portsmouth"],
  Canada: ["Toronto", "Montréal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Québec", "Hamilton", "Kitchener", "Halifax", "Victoria", "Saskatoon", "Regina", "Mississauga", "Brampton", "Surrey", "Laval", "Windsor", "Oshawa"],
  Brazil: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Belo Horizonte", "Manaus", "Curitiba", "Recife", "Goiânia", "Belém", "Porto Alegre", "Guarulhos", "Campinas", "São Luís", "Maceió", "Natal", "Campo Grande", "Florianópolis", "João Pessoa", "Santos", "Niterói", "Vitória", "Cuiabá"],
  Mexico: ["Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Ciudad Juárez", "Querétaro", "Mérida", "Cancún", "Chihuahua", "San Luis Potosí", "Aguascalientes", "Hermosillo", "Morelia", "Toluca", "Oaxaca", "Veracruz", "Culiacán", "Mexicali", "Saltillo", "Acapulco", "Tuxtla Gutiérrez", "Villahermosa"],
  Spain: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Murcia", "Palma", "Las Palmas de Gran Canaria", "Bilbao", "Alicante", "Córdoba", "Valladolid", "Vigo", "Gijón", "Granada", "A Coruña", "Vitoria-Gasteiz", "Elche", "Santa Cruz de Tenerife", "Pamplona", "San Sebastián", "Salamanca", "Cádiz"],
  France: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes", "Reims", "Toulon", "Grenoble", "Dijon", "Angers", "Nîmes", "Clermont-Ferrand", "Le Havre", "Saint-Étienne", "Tours", "Limoges", "Brest", "Aix-en-Provence"],
  Germany: ["Berlin", "Hamburg", "München", "Köln", "Frankfurt am Main", "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Essen", "Bremen", "Dresden", "Hannover", "Nürnberg", "Duisburg", "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster", "Karlsruhe", "Mannheim", "Augsburg", "Wiesbaden", "Freiburg im Breisgau", "Mainz", "Kiel"],
  Japan: ["Tokyo", "Osaka", "Nagoya", "Yokohama", "Sapporo", "Fukuoka", "Kobe", "Kyoto", "Kawasaki", "Saitama", "Hiroshima", "Sendai", "Chiba", "Kitakyushu", "Sakai", "Niigata", "Hamamatsu", "Kumamoto", "Okayama", "Shizuoka", "Naha", "Kanazawa"],
  "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju", "Suwon", "Ulsan", "Changwon", "Goyang", "Yongin", "Seongnam", "Cheongju", "Bucheon", "Jeonju", "Cheonan", "Jeju", "Pohang", "Gimhae", "Ansan"],
  Indonesia: ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar", "Palembang", "Tangerang", "Depok", "Bekasi", "Yogyakarta", "Malang", "Denpasar", "Bogor", "Batam", "Pekanbaru", "Padang", "Balikpapan", "Samarinda", "Manado", "Banjarmasin", "Pontianak"],
  Philippines: ["Manila", "Quezon City", "Davao City", "Cebu City", "Zamboanga City", "Taguig", "Pasig", "Cagayan de Oro", "Makati", "Bacolod", "Iloilo City", "Baguio", "General Santos", "Antipolo", "Caloocan", "Parañaque", "Dumaguete", "Angeles City", "Tacloban", "Naga"],
  Nigeria: ["Lagos", "Abuja", "Kano", "Ibadan", "Port Harcourt", "Benin City", "Kaduna", "Enugu", "Jos", "Ilorin", "Abeokuta", "Onitsha", "Warri", "Calabar", "Uyo", "Owerri", "Akure", "Maiduguri", "Zaria", "Aba", "Osogbo"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Al Ain", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain", "Khor Fakkan", "Dibba Al-Fujairah"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra", "Newcastle", "Wollongong", "Hobart", "Geelong", "Townsville", "Cairns", "Darwin", "Toowoomba", "Ballarat", "Bendigo", "Launceston", "Sunshine Coast", "Mackay"],
};

// How Qloo spells each market's country in a locality's parent chain.
export const COUNTRY_ALIASES = {
  India: ["india"],
  "United States": ["united states of america", "united states"],
  "United Kingdom": ["united kingdom"],
  Canada: ["canada"],
  Brazil: ["brasil", "brazil"],
  Mexico: ["méxico", "mexico"],
  Spain: ["españa", "spain"],
  France: ["france"],
  Germany: ["deutschland", "germany"],
  Japan: ["日本", "japan"],
  "South Korea": ["대한민국", "south korea", "korea"],
  Indonesia: ["indonesia"],
  Philippines: ["philippines", "pilipinas"],
  Nigeria: ["nigeria"],
  "United Arab Emirates": ["الإمارات العربية المتحدة", "united arab emirates"],
  Australia: ["australia"],
};

const lower = (s) => String(s ?? "").toLowerCase();
const head = (s) => lower(s).split(",")[0].trim();
// Accents and case folded away, so "Montreal" finds "Montréal".
const fold = (s) => head(s).normalize("NFKD").replace(/\p{M}/gu, "");
const KNOWN = new Set(Object.values(CANDIDATE_CITIES).flat().map(fold));
// Qloo often keeps a city as "Pune City", "Jaipur Municipal Corporation" or "City of Edinburgh" next to "Pune
// District" and a village of the same name; these forms are the city itself.
const CITY_FORMS = [/^(?:city of|county borough of|municipality of|municipio de|município de)\s+(.+)$/, /^(.+?)\s*(?:city|\(urban\)|urban|\(m\.?\s?corp\.?\)|(?:urban\s+)?municipal corporation|nagar nigam|metropolitan city)$/];
const METRO_FORMS = [/^(.+?)\s*(?:metropolitan region|metropolitan area|metro)$/];
const formOf = (n, forms) => forms.map((re) => n.match(re)?.[1]?.trim()).find(Boolean);

/** How well one name carries the query: 4 the name, 3 the city's own form, 2 its metro, 1 "<name> District" and kin. */
function fitOf(n, needle) {
  if (n === needle) return 4;
  if (formOf(n, CITY_FORMS) === needle) return 3;
  if (formOf(n, METRO_FORMS) === needle) return 2;
  // "Patna District", "Jaipur(Rural) District", "Jodhpur Tehsil": the name plus admin words only, so neither "Perth
  // and Kinross" (or its "Perth ja Kinross" alias) nor "Perth Amboy" counts as Perth.
  const rest = n.startsWith(needle) ? n.slice(needle.length).trim() : "";
  return rest && ADMIN_REST.test(rest) ? 1 : 0;
}
const ADMIN_REST = /^(?:\(?(?:rural|urban)\)?\s*)?(?:district|distict|tehsil|tahsil|taluka?|mandal|rural|urban|division|subdivision|region|county|municipality|borough|zone|cantonment|central)?$/;
const POPULAR_WITHIN = 0.003;

/**
 * The locality a city name means, from Qloo's search hits. Qloo lists a famous city next to villages that share its
 * name ("Jaipur" in Jharkhand at popularity 0.50; "Glasgow" in Kentucky), and often lists the city itself only in an
 * admin form ("Jaipur Municipal Corporation"). So: hits that carry the name, then only those near the most popular
 * of them, then the best form (the name, the city's own form, its metro, its district), city-sized, popular.
 * With a market, only hits inside that country (or, where Qloo gives no parent chain, a famous exact one).
 */
export function rankLocalities(results = [], query, { market, within, wantedId, levels = [4, 8] } = {}) {
  const needle = fold(query);
  const hits = results.filter((r) => r?.entity_id && r?.location?.lat !== undefined && r?.location?.lon !== undefined);
  const wanted = wantedId && hits.find((r) => r.entity_id === wantedId);
  if (wanted) return wanted;
  if (!needle) return undefined;
  const typed = head(query);
  const scored = hits.map((r) => {
    const own = fold(r.name);
    const raw = [r.name, ...(r.properties?.akas ?? []).map((a) => a?.value)].map(head);
    const names = [own, ...(r.properties?.akas ?? []).map((a) => fold(a?.value))].filter(Boolean);
    const fit = Math.max(...names.map((n) => fitOf(n, needle)));
    const level = r.properties?.admin_level;
    return {
      r,
      fit,
      // Spelt as typed, accents and all: "Münster" is the German city, not Ireland's Munster.
      asTyped: raw.includes(typed) ? 1 : 0,
      ownName: fitOf(own, needle) === fit ? 1 : 0,
      // Weaker readings, used only when nothing carries the name properly: "New Delhi" for Delhi, "Leicestershire" for Leicester.
      word: names.some((n) => new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(n)) ? 1 : 0,
      part: needle.length >= 5 && names.some((n) => n.includes(needle)) ? 1 : 0,
      country: market ? (inCountry(r, market) ? 1 : 0) : within ? (isWithin(r, within) ? 1 : 0) : 1,
      orphan: !(r.properties?.ancestors ?? []).length,
      cityLevel: level === undefined || (level >= levels[0] && level <= levels[1]) ? 1 : 0,
      popularity: r.popularity ?? 0,
    };
  });
  const local = scored.filter((s) => s.country);
  const pool = [local.filter((s) => s.fit > 0), local.filter((s) => s.word), local.filter((s) => s.part)].find((p) => p.length);
  if (!pool) {
    // Some countries' localities carry no parent chain at all (Japan). Only then, trust an exact, well-known, city-sized hit.
    if (!market) return undefined;
    return scored.filter((s) => s.orphan && s.fit >= 3 && s.cityLevel && s.popularity >= 0.98).sort((a, b) => b.popularity - a.popularity)[0]?.r;
  }
  const top = Math.max(...pool.map((s) => s.popularity));
  return pool
    .filter((s) => s.popularity >= top - POPULAR_WITHIN)
    .sort((a, b) => b.fit - a.fit || b.asTyped - a.asTyped || b.ownName - a.ownName || b.cityLevel - a.cityLevel || b.popularity - a.popularity)[0]?.r;
}

/** Does this Qloo locality sit inside the market's country, going by its parent chain? */
export function inCountry(entity, market) {
  const aliases = COUNTRY_ALIASES[market] ?? [lower(market)];
  const chain = [...(entity?.properties?.ancestors ?? []).map((a) => a?.name), entity?.disambiguation].map(lower);
  return chain.some((n) => n && aliases.some((a) => n === a || n.includes(a)));
}

/** Is this place inside the one named ("Maine", "Chennai")? A whole name in its parent chain, never part of one. */
export function isWithin(entity, place) {
  const want = fold(place);
  const chain = [...(entity?.properties?.ancestors ?? []).map((a) => a?.name), ...String(entity?.disambiguation ?? "").split(",").slice(1)];
  // The place as Qloo lists it may carry an admin word: "Chennai District" is Chennai, "Patna Rural" is Patna.
  return Boolean(want) && chain.some((n) => fold(n) === want || fold(displayName(n)) === want || fitOf(fold(n), want) > 0);
}

/** The English name when Qloo lists one, else Qloo's own name. */
export function localityName(entity) {
  const en = (entity?.properties?.akas ?? []).find((a) => a?.language === "en" && a.value && !a.value.includes(","));
  return en?.value ?? entity?.name;
}

/**
 * The name a person would say: "Mysuru" for "Mysuru District", "Tijuana" for
 * "Municipio de Tijuana". Qloo's own name stays on `qlooName` for the receipts.
 */
export function displayName(name) {
  let s = String(name ?? "").trim();
  s = s.replace(/^(municipio de|município de|autonomous community of the region of|autonomous community of|región de|region of|comunidad de|province of|county borough of|county of|city of|municipality of)\s+/i, "");
  // Admin words, twice over ("Patna Urban Municipal Corporation" → "Patna", "Jaipur(Rural) District" → "Jaipur").
  for (let i = 0; i < 2; i += 1) {
    s = s.replace(/\s*\((urban|rural|city|town|m\.?\s?corp\.?)\)\s*$/i, "");
    s = s.replace(/\s+(district|taluk|taluka|tehsil|mandal|municipal corporation|nagar nigam|municipality|metropolitan region|metropolitan area|metro|county|urban agglomeration|urban|rural)$/i, "");
  }
  // "City" only where the name without it is a city AYTO knows: "Pune City" is Pune, "Kansas City" stays.
  const bare = s.replace(/\s+city$/i, "");
  if (bare !== s && KNOWN.has(fold(bare)) && !KNOWN.has(fold(s))) s = bare;
  return s || String(name ?? "");
}

/** Shape a Qloo locality for the heatmap: id, name, coordinates, market. */
export const toPlace = (r, market) => ({
  id: r.entity_id,
  name: displayName(localityName(r)),
  qlooName: localityName(r),
  lat: r.location.lat,
  lon: r.location.lon,
  popularity: r.popularity,
  level: r.properties?.admin_level,
  market,
});

/** The Qloo locality for one candidate city inside a market (see rankLocalities). Undefined when nothing fits. */
export function pickLocality(results = [], { query, market, levels = [4, 8] } = {}) {
  return rankLocalities(results, query, { market, levels });
}

/** Localities Qloo lists inside a city: search hits whose parent chain names the city. */
export function subLocalities(results = [], { city, market }) {
  const needle = head(city);
  const seen = new Set();
  return results
    .filter((r) => r?.entity_id && r?.location?.lat !== undefined && inCountry(r, market))
    .filter((r) => head(r.name) !== needle)
    .filter((r) => (r.properties?.ancestors ?? []).some((a) => head(a?.name) === needle) || lower(r.disambiguation).includes(`, ${needle},`))
    .filter((r) => !seen.has(head(r.name)) && seen.add(head(r.name)))
    .map((r) => toPlace(r, market));
}

// Common spellings a maker might type that differ from the list above by more than a typo.
const SPELLINGS = { bangalore: "Bengaluru", bombay: "Mumbai", madras: "Chennai", calcutta: "Kolkata", mysore: "Mysuru", mangalore: "Mangaluru", trivandrum: "Thiruvananthapuram", calicut: "Kozhikode", cochin: "Kochi", vizag: "Visakhapatnam", gurgaon: "Gurugram", nyc: "New York", la: "Los Angeles", vegas: "Las Vegas", sf: "San Francisco" };

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}

/**
 * The known city a mistyped name most likely means ("Hydrabad" → Hyderabad, "Bangalore" → Bengaluru),
 * from the candidate lists: an old name, or within two edits (one for short names). Undefined when
 * nothing is that close, so a real but unlisted town is never silently swapped for a big city.
 */
export function closestKnownCity(query, { market } = {}) {
  const q = String(query ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "").trim();
  if (!q) return undefined;
  if (SPELLINGS[q]) return { name: SPELLINGS[q], market: Object.entries(CANDIDATE_CITIES).find(([, l]) => l.includes(SPELLINGS[q]))?.[0] };
  const limit = q.length <= 5 ? 1 : 2;
  let best;
  for (const [m, list] of Object.entries(CANDIDATE_CITIES)) {
    if (market && m !== market) continue;
    for (const name of list) {
      const n = name.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "");
      if (n === q) return undefined; // spelt right; Qloo just didn't find it
      const d = editDistance(q, n);
      if (d <= limit && (!best || d < best.d)) best = { name, market: m, d };
    }
  }
  return best ? { name: best.name, market: best.market } : undefined;
}
