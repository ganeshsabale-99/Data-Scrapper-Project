/**
 * City normalization utility.
 *
 * Two types of mappings:
 *  1. SUBURB_TO_CITY  – suburb / area / alias → canonical parent city
 *  2. CANONICAL_CASING – any recognised city name → correct display casing
 *
 * Keys are always lowercase.
 */

// ─── Suburb / alias → canonical city ──────────────────────────────────────────
const SUBURB_TO_CITY: Record<string, string> = {

  // ── Pune metro ─────────────────────────────────────────────────────────────
  "पुणे":                     "Pune",   // Marathi
  "pune division":            "Pune",
  "pimpri-chinchwad":         "Pune",
  "pimpri chinchwad":         "Pune",
  "pcmc":                     "Pune",
  "pirangut":                 "Pune",
  "kharadipune":              "Pune",
  "kharadi pune":             "Pune",
  "kharadi":                  "Pune",
  "gorhe khurd":              "Pune",
  "hadapsar":                 "Pune",
  "wakad":                    "Pune",
  "hinjewadi":                "Pune",
  "baner":                    "Pune",
  "balewadi":                 "Pune",
  "aundh":                    "Pune",
  "viman nagar":              "Pune",
  "magarpatta":               "Pune",
  "kondhwa":                  "Pune",
  "katraj":                   "Pune",
  "bavdhan":                  "Pune",
  "ambegaon":                 "Pune",
  "talegaon":                 "Pune",
  "chakan":                   "Pune",
  "wagholi":                  "Pune",
  "nibm":                     "Pune",
  "sus":                      "Pune",
  "mahalunge":                "Pune",
  "mamurdi":                  "Pune",
  "punawale":                 "Pune",
  "moshi":                    "Pune",
  "dighi":                    "Pune",
  "pimpri":                   "Pune",
  "chinchwad":                "Pune",
  "bhosari":                  "Pune",
  "vishrantwadi":             "Pune",
  "kothrud":                  "Pune",
  "shivajinagar":             "Pune",
  "deccan":                   "Pune",
  "swargate":                 "Pune",
  "wanowrie":                 "Pune",
  "bibwewadi":                "Pune",
  "yerawada":                 "Pune",
  "kalyani nagar":            "Pune",
  "koregaon park":            "Pune",
  "camp pune":                "Pune",
  "sadashiv peth":            "Pune",
  "lohegaon":                 "Pune",
  "alandi":                   "Pune",
  "dehu road":                "Pune",

  // ── Thane ──────────────────────────────────────────────────────────────────
  "ठाणे":                     "Thane",  // Marathi

  // ── Mumbai metro (Navi Mumbai & Thane remain separate) ─────────────────────
  "मुंबई":                    "Mumbai", // Hindi/Marathi
  "mumbai suburban":          "Mumbai",
  "south mumbai":             "Mumbai",
  "central mumbai":           "Mumbai",
  "western mumbai":           "Mumbai",
  "bandra":                   "Mumbai",
  "kurla":                    "Mumbai",
  "andheri":                  "Mumbai",
  "powai":                    "Mumbai",
  "goregaon":                 "Mumbai",
  "malad":                    "Mumbai",
  "kandivali":                "Mumbai",
  "borivali":                 "Mumbai",
  "dadar":                    "Mumbai",
  "worli":                    "Mumbai",
  "lower parel":              "Mumbai",
  "parel":                    "Mumbai",
  "bkc":                      "Mumbai",
  "bandra kurla complex":     "Mumbai",
  "marol":                    "Mumbai",
  "vikhroli":                 "Mumbai",
  "ghatkopar":                "Mumbai",
  "chembur":                  "Mumbai",
  "mulund":                   "Mumbai",
  "bhandup":                  "Mumbai",
  "kanjurmarg":               "Mumbai",
  "sakinaka":                 "Mumbai",
  "jogeshwari":               "Mumbai",
  "santacruz":                "Mumbai",
  "vile parle":               "Mumbai",
  "churchgate":               "Mumbai",
  "colaba":                   "Mumbai",
  "nariman point":            "Mumbai",
  "dharavi":                  "Mumbai",
  "belapur":                  "Navi Mumbai",
  "airoli":                   "Navi Mumbai",
  "vashi":                    "Navi Mumbai",
  "kharghar":                 "Navi Mumbai",
  "panvel":                   "Navi Mumbai",
  "nerul":                    "Navi Mumbai",
  "sanpada":                  "Navi Mumbai",
  "turbhe":                   "Navi Mumbai",
  "kalamboli":                "Navi Mumbai",
  "ghansoli":                 "Navi Mumbai",
  "kopar khairane":           "Navi Mumbai",
  "cbd belapur":              "Navi Mumbai",

  // ── Bengaluru / Bangalore ───────────────────────────────────────────────────
  // "Bengaluru" is the canonical form in this dataset (171 records).
  // "Bangalore" is treated as an alias.
  "bangalore":                "Bengaluru",
  "bangalore division":       "Bengaluru",
  "bengaluru urban":          "Bengaluru",
  "bengaluru rural":          "Bengaluru",
  "bommasandra":              "Bengaluru",
  "jigani":                   "Bengaluru",
  "varthur":                  "Bengaluru",
  "anagahalli":               "Bengaluru",
  "kondenahalli":             "Bengaluru",
  "mesthri palya":            "Bengaluru",
  "janthagalli":              "Bengaluru",
  "karle":                    "Bengaluru",
  "shyadanahally":            "Bengaluru",
  "whitefield":               "Bengaluru",
  "electronic city":          "Bengaluru",
  "marathahalli":             "Bengaluru",
  "koramangala":              "Bengaluru",
  "indiranagar":              "Bengaluru",
  "jayanagar":                "Bengaluru",
  "jp nagar":                 "Bengaluru",
  "btm layout":               "Bengaluru",
  "hsr layout":               "Bengaluru",
  "yelahanka":                "Bengaluru",
  "hebbal":                   "Bengaluru",
  "sarjapur":                 "Bengaluru",
  "sarjapur road":            "Bengaluru",
  "bellandur":                "Bengaluru",
  "outer ring road":          "Bengaluru",
  "cv raman nagar":           "Bengaluru",
  "domlur":                   "Bengaluru",
  "ulsoor":                   "Bengaluru",
  "mahadevapura":             "Bengaluru",
  "bannerghatta":             "Bengaluru",
  "bannerghatta road":        "Bengaluru",
  "kanakapura road":          "Bengaluru",
  "tumkur road":              "Bengaluru",
  "mysore road":              "Bengaluru",
  "rajajinagar":              "Bengaluru",
  "vijayanagar":              "Bengaluru",
  "malleshwaram":             "Bengaluru",
  "jalahalli":                "Bengaluru",

  // ── Gurugram / Gurgaon ─────────────────────────────────────────────────────
  "gurgaon":                  "Gurugram",
  "5gurugram":                "Gurugram",  // data-entry typo
  "gurgaon division":         "Gurugram",
  "gurugram division":        "Gurugram",

  // ── Delhi ──────────────────────────────────────────────────────────────────
  "new delhi":                "Delhi",
  "south delhi":              "Delhi",
  "north delhi":              "Delhi",
  "east delhi":               "Delhi",
  "west delhi":               "Delhi",
  "central delhi":            "Delhi",
  "dwarka":                   "Delhi",
  "rohini":                   "Delhi",
  "janakpuri":                "Delhi",
  "saket":                    "Delhi",
  "lajpat nagar":             "Delhi",
  "connaught place":          "Delhi",
  "nehru place":              "Delhi",
  "okhla":                    "Delhi",
  "jasola":                   "Delhi",
  "pitampura":                "Delhi",
  "delhi ncr":                "Delhi",

  // ── Hyderabad ──────────────────────────────────────────────────────────────
  "cyberabad":                "Hyderabad",
  "hitech city":              "Hyderabad",
  "hitec city":               "Hyderabad",
  "secunderabad":             "Hyderabad",
  "gachibowli":               "Hyderabad",
  "kondapur":                 "Hyderabad",
  "madhapur":                 "Hyderabad",
  "banjara hills":            "Hyderabad",
  "jubilee hills":            "Hyderabad",
  "kukatpally":               "Hyderabad",
  "miyapur":                  "Hyderabad",
  "uppal":                    "Hyderabad",
  "lb nagar":                 "Hyderabad",
  "dilsukhnagar":             "Hyderabad",
  "ameerpet":                 "Hyderabad",
  "begumpet":                 "Hyderabad",
  "somajiguda":               "Hyderabad",
  "manikonda":                "Hyderabad",
  "nanakramguda":             "Hyderabad",
  "financial district":       "Hyderabad",
  "khajaguda":                "Hyderabad",
  "kurmalguda":               "Hyderabad",
  "kharmanghat":              "Hyderabad",
  "serilingampalle (m)":      "Hyderabad",
  "serilingampally":          "Hyderabad",

  // ── Chennai ────────────────────────────────────────────────────────────────
  "adyar":                    "Chennai",
  "anna nagar":               "Chennai",
  "t nagar":                  "Chennai",
  "velachery":                "Chennai",
  "perungudi":                "Chennai",
  "sholinganallur":           "Chennai",
  "ambattur":                 "Chennai",
  "thoraipakkam":             "Chennai",
  "siruseri":                 "Chennai",
  "porur":                    "Chennai",
  "chromepet":                "Chennai",
  "tambaram":                 "Chennai",
  "pallavaram":               "Chennai",
  "guindy":                   "Chennai",
  "nungambakkam":             "Chennai",
  "mylapore":                 "Chennai",
  "triplicane":               "Chennai",
  "egmore":                   "Chennai",
  "perambur":                 "Chennai",
  "kolathur":                 "Chennai",
  "madipakkam":               "Chennai",
  "omr":                      "Chennai",
  "old mahabalipuram road":   "Chennai",

  // ── Coimbatore ─────────────────────────────────────────────────────────────
  "gandhipuram":              "Coimbatore",
  "saibaba colony, coimbatore": "Coimbatore",
  "eachanari":                "Coimbatore",
  "kalapatti":                "Coimbatore",
  "kurumbapalayam sskulam":   "Coimbatore",
  "neelambur":                "Coimbatore",
  "ottakkalmandapam":         "Coimbatore",
  "p n pudur":                "Coimbatore",
  "k.pudur":                  "Coimbatore",
  "kaniyur":                  "Coimbatore",
  "keeranatham":              "Coimbatore",

  // ── Kochi ──────────────────────────────────────────────────────────────────
  "kakkanad":                 "Kochi",
  "ernakulam":                "Kochi",
  "kolenchery":               "Kochi",
  "pallippuram":              "Kochi",
  "pallipuram":               "Kochi",
  "kazhakkoottam":            "Thiruvananthapuram",

  // ── Kolkata ────────────────────────────────────────────────────────────────
  "howrah":                   "Kolkata",
  "salt lake":                "Kolkata",
  "new town":                 "Kolkata",
  "rajarhat":                 "Kolkata",
  "sector v":                 "Kolkata",
  "park street":              "Kolkata",
  "barrackpore":              "Kolkata",

  // ── Ahmedabad ──────────────────────────────────────────────────────────────
  "prahlad nagar":            "Ahmedabad",
  "sg highway":               "Ahmedabad",
  "sarkhej":                  "Ahmedabad",
  "bodakdev":                 "Ahmedabad",
  "satellite":                "Ahmedabad",
  "thaltej":                  "Ahmedabad",
  "navrangpura":              "Ahmedabad",
  "cg road":                  "Ahmedabad",
  "bavla":                    "Ahmedabad",

  // ── Thane ──────────────────────────────────────────────────────────────────
  "anjur r.f.":               "Thane",

  // ── Visakhapatnam ──────────────────────────────────────────────────────────
  "atchutapuram":             "Visakhapatnam",

  // ── Mysuru ─────────────────────────────────────────────────────────────────
  "ilavala hobli":            "Mysuru",

  // ── Bhubaneswar ────────────────────────────────────────────────────────────
  "khordha":                  "Bhubaneswar",

  // ── Thrissur ───────────────────────────────────────────────────────────────
  "koratty":                  "Thrissur",

  // ── Kottayam ───────────────────────────────────────────────────────────────
  "pampady":                  "Kottayam",

  // ── Mohali ─────────────────────────────────────────────────────────────────
  "sahibzada ajit singh nagar": "Mohali",

  // ── Mangaluru ──────────────────────────────────────────────────────────────
  "thokottu":                 "Mangaluru",

  // ── Indore ─────────────────────────────────────────────────────────────────
  "indore division":          "Indore",

  // ── Surat ──────────────────────────────────────────────────────────────────
  "vesu":                     "Surat",
  "katargam":                 "Surat",
  "adajan":                   "Surat",
  "udhna":                    "Surat",
  "varachha":                 "Surat",
  "sachin ina":               "Surat",
};

// ─── Canonical casing for cities that may be entered in wrong case ─────────────
// Key: lowercase, Value: correctly-cased display name
const CANONICAL_CASING: Record<string, string> = {
  "ahmedabad":          "Ahmedabad",
  "bengaluru":          "Bengaluru",
  "bhopal":             "Bhopal",
  "bhubaneswar":        "Bhubaneswar",
  "chandigarh":         "Chandigarh",
  "chennai":            "Chennai",
  "coimbatore":         "Coimbatore",
  "delhi":              "Delhi",
  "gandhinagar":        "Gandhinagar",
  "greater noida":      "Greater Noida",
  "gurugram":           "Gurugram",
  "guwahati":           "Guwahati",
  "ghaziabad":          "Ghaziabad",
  "hyderabad":          "Hyderabad",
  "indore":             "Indore",
  "jaipur":             "Jaipur",
  "kochi":              "Kochi",
  "kolkata":            "Kolkata",
  "kozhikode":          "Kozhikode",
  "kottayam":           "Kottayam",
  "mohali":             "Mohali",
  "thrissur":           "Thrissur",
  "lucknow":            "Lucknow",
  "mangaluru":          "Mangaluru",
  "mira bhayandar":     "Mira Bhayandar",
  "mumbai":             "Mumbai",
  "mysuru":             "Mysuru",
  "nagpur":             "Nagpur",
  "navi mumbai":        "Navi Mumbai",
  "noida":              "Noida",
  "patna":              "Patna",
  "pune":               "Pune",
  "shillong":           "Shillong",
  "surat":              "Surat",
  "thane":              "Thane",
  "thiruvananthapuram": "Thiruvananthapuram",
  "tiruppur":           "Tiruppur",
  "vadodara":           "Vadodara",
  "visakhapatnam":      "Visakhapatnam",
};

// Build a set of lowercase canonical city names from both maps
const CANONICAL_SET = new Set([
  ...Object.keys(CANONICAL_CASING),
  ...Object.values(SUBURB_TO_CITY).map((c) => c.toLowerCase()),
]);

// Build display lookup: lowercase → display name (covers both maps)
const DISPLAY_MAP: Record<string, string> = { ...CANONICAL_CASING };
for (const v of Object.values(SUBURB_TO_CITY)) {
  if (!DISPLAY_MAP[v.toLowerCase()]) {
    DISPLAY_MAP[v.toLowerCase()] = v;
  }
}

/**
 * Returns the canonical, correctly-cased city name for any raw city string.
 *
 * Resolution order:
 *  1. Explicit SUBURB_TO_CITY map (case-insensitive).
 *  2. CANONICAL_CASING — known city entered in wrong case (e.g. "ahmedabad" → "Ahmedabad").
 *  3. Substring match — raw name contains a canonical city name but is not itself
 *     canonical (handles "KharadiPune" → "Pune", "Bangalore Division" → "Bengaluru").
 *  4. Fallback: return trimmed original unchanged.
 */
export function normalizeCity(cityRaw: string): string {
  const trimmed = cityRaw.trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();

  // 1. Explicit suburb / alias map
  const mapped = SUBURB_TO_CITY[lower];
  if (mapped) return mapped;

  // 2. Known canonical city — fix casing
  const cased = CANONICAL_CASING[lower];
  if (cased) return cased;

  // 3. Substring match against canonical cities
  //    Sort longest-first so "Navi Mumbai" is tested before "Mumbai"
  const canonicals = [...CANONICAL_SET].sort((a, b) => b.length - a.length);
  for (const canon of canonicals) {
    if (lower.includes(canon)) {
      return DISPLAY_MAP[canon] ?? trimmed;
    }
  }

  return trimmed;
}
