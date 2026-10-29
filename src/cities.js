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
// Qloo often keeps a city as "Pune City" or "Vijayawada (Urban)" next to "Pune District"; prefer the city-sized one,
// then the metropolitan region, then anything else that carries the name (a district or taluk), never a stranger.
const CITY_VARIANT = /\s*(city|\(urban\)|municipal corporation)$/i;
const METRO_VARIANT = /\s*(metropolitan region|metro)$/i;

/** Does this Qloo locality sit inside the market's country, going by its parent chain? */
export function inCountry(entity, market) {
  const aliases = COUNTRY_ALIASES[market] ?? [lower(market)];
  const chain = [...(entity?.properties?.ancestors ?? []).map((a) => a?.name), entity?.disambiguation].map(lower);
  return chain.some((n) => n && aliases.some((a) => n === a || n.includes(a)));
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
  s = s.replace(/^(municipio de|município de|autonomous community of the region of|autonomous community of|región de|region of|comunidad de|province of|county of|city of)\s+/i, "");
  s = s.replace(/\s*\((urban|rural|city|town|m\.?\s?corp\.?)\)\s*$/i, "");
  s = s.replace(/\s+(district|taluk|taluka|tehsil|mandal|municipal corporation|municipality|metropolitan region|metropolitan area|metro|county|city|urban agglomeration)$/i, "");
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

/**
 * Pick the Qloo locality that best matches one candidate city in a market:
 * inside the right country first, then an exact name, then a city-sized
 * admin level (4..8: city-states like Berlin are level 4, wards are 9+),
 * then popularity. Returns undefined when nothing fits.
 */
export function pickLocality(results = [], { query, market, levels = [4, 8] } = {}) {
  const needle = head(query);
  const scored = results
    .filter((r) => r?.entity_id && r?.location?.lat !== undefined && r?.location?.lon !== undefined)
    .map((r) => {
      const names = [r.name, ...(r.properties?.akas ?? []).map((a) => a?.value)].map(head);
      const level = r.properties?.admin_level;
      // 4: the name itself; 3: Qloo's city-sized variant; 2: its metropolitan region; 1: any name carrying it; 0: unrelated.
      const variant = (re) => names.some((n) => re.test(n) && n.replace(re, "").trim() === needle);
      const exact = names.includes(needle) ? 4 : variant(CITY_VARIANT) ? 3 : variant(METRO_VARIANT) ? 2 : names.some((n) => n.includes(needle)) ? 1 : 0;
      return {
        r,
        orphan: !(r.properties?.ancestors ?? []).length,
        country: inCountry(r, market) ? 1 : 0,
        exact,
        cityLevel: level === undefined || (level >= levels[0] && level <= levels[1]) ? 1 : 0,
        popularity: r.popularity ?? 0,
      };
    })
    .sort((a, b) => b.country - a.country || b.exact - a.exact || b.cityLevel - a.cityLevel || b.popularity - a.popularity);
  const best = scored[0];
  if (!best || !best.exact) return undefined;
  // Some countries' localities carry no parent chain at all (Japan). Only then, trust an exact, well-known, city-sized hit.
  if (!best.country && !(best.orphan && best.exact && best.cityLevel && best.popularity >= 0.98)) return undefined;
  return best.r;
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
