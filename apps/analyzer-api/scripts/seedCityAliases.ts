import { prismaInstance } from "@repo/db";

const ALIASES: { alias: string; canonicalCity: string }[] = [
  // Pune metro
  { alias: "पुणे", canonicalCity: "Pune" },
  { alias: "pune division", canonicalCity: "Pune" },
  { alias: "pimpri-chinchwad", canonicalCity: "Pune" },
  { alias: "pimpri chinchwad", canonicalCity: "Pune" },
  { alias: "pcmc", canonicalCity: "Pune" },
  { alias: "pirangut", canonicalCity: "Pune" },
  { alias: "kharadipune", canonicalCity: "Pune" },
  { alias: "kharadi pune", canonicalCity: "Pune" },
  { alias: "kharadi", canonicalCity: "Pune" },
  { alias: "gorhe khurd", canonicalCity: "Pune" },
  { alias: "hadapsar", canonicalCity: "Pune" },
  { alias: "wakad", canonicalCity: "Pune" },
  { alias: "hinjewadi", canonicalCity: "Pune" },
  { alias: "baner", canonicalCity: "Pune" },
  { alias: "balewadi", canonicalCity: "Pune" },
  { alias: "aundh", canonicalCity: "Pune" },
  { alias: "viman nagar", canonicalCity: "Pune" },
  { alias: "magarpatta", canonicalCity: "Pune" },
  { alias: "kondhwa", canonicalCity: "Pune" },
  { alias: "katraj", canonicalCity: "Pune" },
  { alias: "bavdhan", canonicalCity: "Pune" },
  { alias: "ambegaon", canonicalCity: "Pune" },
  { alias: "talegaon", canonicalCity: "Pune" },
  { alias: "chakan", canonicalCity: "Pune" },
  { alias: "wagholi", canonicalCity: "Pune" },
  { alias: "nibm", canonicalCity: "Pune" },
  { alias: "sus", canonicalCity: "Pune" },
  { alias: "mahalunge", canonicalCity: "Pune" },
  { alias: "mamurdi", canonicalCity: "Pune" },
  { alias: "punawale", canonicalCity: "Pune" },
  { alias: "moshi", canonicalCity: "Pune" },
  { alias: "dighi", canonicalCity: "Pune" },
  { alias: "pimpri", canonicalCity: "Pune" },
  { alias: "chinchwad", canonicalCity: "Pune" },
  { alias: "bhosari", canonicalCity: "Pune" },
  { alias: "vishrantwadi", canonicalCity: "Pune" },
  { alias: "kothrud", canonicalCity: "Pune" },
  { alias: "shivajinagar", canonicalCity: "Pune" },
  { alias: "deccan", canonicalCity: "Pune" },
  { alias: "swargate", canonicalCity: "Pune" },
  { alias: "wanowrie", canonicalCity: "Pune" },
  { alias: "bibwewadi", canonicalCity: "Pune" },
  { alias: "yerawada", canonicalCity: "Pune" },
  { alias: "kalyani nagar", canonicalCity: "Pune" },
  { alias: "koregaon park", canonicalCity: "Pune" },
  { alias: "camp pune", canonicalCity: "Pune" },
  { alias: "sadashiv peth", canonicalCity: "Pune" },
  { alias: "lohegaon", canonicalCity: "Pune" },
  { alias: "alandi", canonicalCity: "Pune" },
  { alias: "dehu road", canonicalCity: "Pune" },
  // Canonical casing for Pune
  { alias: "pune", canonicalCity: "Pune" },

  // Thane
  { alias: "ठाणे", canonicalCity: "Thane" },
  { alias: "anjur r.f.", canonicalCity: "Thane" },
  { alias: "thane", canonicalCity: "Thane" },

  // Mumbai metro
  { alias: "मुंबई", canonicalCity: "Mumbai" },
  { alias: "mumbai suburban", canonicalCity: "Mumbai" },
  { alias: "south mumbai", canonicalCity: "Mumbai" },
  { alias: "central mumbai", canonicalCity: "Mumbai" },
  { alias: "western mumbai", canonicalCity: "Mumbai" },
  { alias: "bandra", canonicalCity: "Mumbai" },
  { alias: "kurla", canonicalCity: "Mumbai" },
  { alias: "andheri", canonicalCity: "Mumbai" },
  { alias: "powai", canonicalCity: "Mumbai" },
  { alias: "goregaon", canonicalCity: "Mumbai" },
  { alias: "malad", canonicalCity: "Mumbai" },
  { alias: "kandivali", canonicalCity: "Mumbai" },
  { alias: "borivali", canonicalCity: "Mumbai" },
  { alias: "dadar", canonicalCity: "Mumbai" },
  { alias: "worli", canonicalCity: "Mumbai" },
  { alias: "lower parel", canonicalCity: "Mumbai" },
  { alias: "parel", canonicalCity: "Mumbai" },
  { alias: "bkc", canonicalCity: "Mumbai" },
  { alias: "bandra kurla complex", canonicalCity: "Mumbai" },
  { alias: "marol", canonicalCity: "Mumbai" },
  { alias: "vikhroli", canonicalCity: "Mumbai" },
  { alias: "ghatkopar", canonicalCity: "Mumbai" },
  { alias: "chembur", canonicalCity: "Mumbai" },
  { alias: "mulund", canonicalCity: "Mumbai" },
  { alias: "bhandup", canonicalCity: "Mumbai" },
  { alias: "kanjurmarg", canonicalCity: "Mumbai" },
  { alias: "sakinaka", canonicalCity: "Mumbai" },
  { alias: "jogeshwari", canonicalCity: "Mumbai" },
  { alias: "santacruz", canonicalCity: "Mumbai" },
  { alias: "vile parle", canonicalCity: "Mumbai" },
  { alias: "churchgate", canonicalCity: "Mumbai" },
  { alias: "colaba", canonicalCity: "Mumbai" },
  { alias: "nariman point", canonicalCity: "Mumbai" },
  { alias: "dharavi", canonicalCity: "Mumbai" },
  { alias: "mumbai", canonicalCity: "Mumbai" },

  // Navi Mumbai
  { alias: "belapur", canonicalCity: "Navi Mumbai" },
  { alias: "airoli", canonicalCity: "Navi Mumbai" },
  { alias: "vashi", canonicalCity: "Navi Mumbai" },
  { alias: "kharghar", canonicalCity: "Navi Mumbai" },
  { alias: "panvel", canonicalCity: "Navi Mumbai" },
  { alias: "nerul", canonicalCity: "Navi Mumbai" },
  { alias: "sanpada", canonicalCity: "Navi Mumbai" },
  { alias: "turbhe", canonicalCity: "Navi Mumbai" },
  { alias: "kalamboli", canonicalCity: "Navi Mumbai" },
  { alias: "ghansoli", canonicalCity: "Navi Mumbai" },
  { alias: "kopar khairane", canonicalCity: "Navi Mumbai" },
  { alias: "cbd belapur", canonicalCity: "Navi Mumbai" },
  { alias: "navi mumbai", canonicalCity: "Navi Mumbai" },

  // Bengaluru
  { alias: "bangalore", canonicalCity: "Bengaluru" },
  { alias: "bangalore division", canonicalCity: "Bengaluru" },
  { alias: "bengaluru urban", canonicalCity: "Bengaluru" },
  { alias: "bengaluru rural", canonicalCity: "Bengaluru" },
  { alias: "bommasandra", canonicalCity: "Bengaluru" },
  { alias: "jigani", canonicalCity: "Bengaluru" },
  { alias: "varthur", canonicalCity: "Bengaluru" },
  { alias: "anagahalli", canonicalCity: "Bengaluru" },
  { alias: "kondenahalli", canonicalCity: "Bengaluru" },
  { alias: "mesthri palya", canonicalCity: "Bengaluru" },
  { alias: "janthagalli", canonicalCity: "Bengaluru" },
  { alias: "karle", canonicalCity: "Bengaluru" },
  { alias: "shyadanahally", canonicalCity: "Bengaluru" },
  { alias: "whitefield", canonicalCity: "Bengaluru" },
  { alias: "electronic city", canonicalCity: "Bengaluru" },
  { alias: "marathahalli", canonicalCity: "Bengaluru" },
  { alias: "koramangala", canonicalCity: "Bengaluru" },
  { alias: "indiranagar", canonicalCity: "Bengaluru" },
  { alias: "jayanagar", canonicalCity: "Bengaluru" },
  { alias: "jp nagar", canonicalCity: "Bengaluru" },
  { alias: "btm layout", canonicalCity: "Bengaluru" },
  { alias: "hsr layout", canonicalCity: "Bengaluru" },
  { alias: "yelahanka", canonicalCity: "Bengaluru" },
  { alias: "hebbal", canonicalCity: "Bengaluru" },
  { alias: "sarjapur", canonicalCity: "Bengaluru" },
  { alias: "sarjapur road", canonicalCity: "Bengaluru" },
  { alias: "bellandur", canonicalCity: "Bengaluru" },
  { alias: "outer ring road", canonicalCity: "Bengaluru" },
  { alias: "cv raman nagar", canonicalCity: "Bengaluru" },
  { alias: "domlur", canonicalCity: "Bengaluru" },
  { alias: "ulsoor", canonicalCity: "Bengaluru" },
  { alias: "mahadevapura", canonicalCity: "Bengaluru" },
  { alias: "bannerghatta", canonicalCity: "Bengaluru" },
  { alias: "bannerghatta road", canonicalCity: "Bengaluru" },
  { alias: "kanakapura road", canonicalCity: "Bengaluru" },
  { alias: "tumkur road", canonicalCity: "Bengaluru" },
  { alias: "mysore road", canonicalCity: "Bengaluru" },
  { alias: "rajajinagar", canonicalCity: "Bengaluru" },
  { alias: "vijayanagar", canonicalCity: "Bengaluru" },
  { alias: "malleshwaram", canonicalCity: "Bengaluru" },
  { alias: "jalahalli", canonicalCity: "Bengaluru" },
  { alias: "bengaluru", canonicalCity: "Bengaluru" },

  // Gurugram
  { alias: "gurgaon", canonicalCity: "Gurugram" },
  { alias: "5gurugram", canonicalCity: "Gurugram" },
  { alias: "gurgaon division", canonicalCity: "Gurugram" },
  { alias: "gurugram division", canonicalCity: "Gurugram" },
  { alias: "gurugram", canonicalCity: "Gurugram" },

  // Delhi
  { alias: "new delhi", canonicalCity: "Delhi" },
  { alias: "south delhi", canonicalCity: "Delhi" },
  { alias: "north delhi", canonicalCity: "Delhi" },
  { alias: "east delhi", canonicalCity: "Delhi" },
  { alias: "west delhi", canonicalCity: "Delhi" },
  { alias: "central delhi", canonicalCity: "Delhi" },
  { alias: "dwarka", canonicalCity: "Delhi" },
  { alias: "rohini", canonicalCity: "Delhi" },
  { alias: "janakpuri", canonicalCity: "Delhi" },
  { alias: "saket", canonicalCity: "Delhi" },
  { alias: "lajpat nagar", canonicalCity: "Delhi" },
  { alias: "connaught place", canonicalCity: "Delhi" },
  { alias: "nehru place", canonicalCity: "Delhi" },
  { alias: "okhla", canonicalCity: "Delhi" },
  { alias: "jasola", canonicalCity: "Delhi" },
  { alias: "pitampura", canonicalCity: "Delhi" },
  { alias: "delhi ncr", canonicalCity: "Delhi" },
  { alias: "delhi", canonicalCity: "Delhi" },

  // Hyderabad
  { alias: "cyberabad", canonicalCity: "Hyderabad" },
  { alias: "hitech city", canonicalCity: "Hyderabad" },
  { alias: "hitec city", canonicalCity: "Hyderabad" },
  { alias: "secunderabad", canonicalCity: "Hyderabad" },
  { alias: "gachibowli", canonicalCity: "Hyderabad" },
  { alias: "kondapur", canonicalCity: "Hyderabad" },
  { alias: "madhapur", canonicalCity: "Hyderabad" },
  { alias: "banjara hills", canonicalCity: "Hyderabad" },
  { alias: "jubilee hills", canonicalCity: "Hyderabad" },
  { alias: "kukatpally", canonicalCity: "Hyderabad" },
  { alias: "miyapur", canonicalCity: "Hyderabad" },
  { alias: "uppal", canonicalCity: "Hyderabad" },
  { alias: "lb nagar", canonicalCity: "Hyderabad" },
  { alias: "dilsukhnagar", canonicalCity: "Hyderabad" },
  { alias: "ameerpet", canonicalCity: "Hyderabad" },
  { alias: "begumpet", canonicalCity: "Hyderabad" },
  { alias: "somajiguda", canonicalCity: "Hyderabad" },
  { alias: "manikonda", canonicalCity: "Hyderabad" },
  { alias: "nanakramguda", canonicalCity: "Hyderabad" },
  { alias: "financial district", canonicalCity: "Hyderabad" },
  { alias: "khajaguda", canonicalCity: "Hyderabad" },
  { alias: "kurmalguda", canonicalCity: "Hyderabad" },
  { alias: "kharmanghat", canonicalCity: "Hyderabad" },
  { alias: "serilingampalle (m)", canonicalCity: "Hyderabad" },
  { alias: "serilingampally", canonicalCity: "Hyderabad" },
  { alias: "hyderabad", canonicalCity: "Hyderabad" },

  // Chennai
  { alias: "adyar", canonicalCity: "Chennai" },
  { alias: "anna nagar", canonicalCity: "Chennai" },
  { alias: "t nagar", canonicalCity: "Chennai" },
  { alias: "velachery", canonicalCity: "Chennai" },
  { alias: "perungudi", canonicalCity: "Chennai" },
  { alias: "sholinganallur", canonicalCity: "Chennai" },
  { alias: "ambattur", canonicalCity: "Chennai" },
  { alias: "thoraipakkam", canonicalCity: "Chennai" },
  { alias: "siruseri", canonicalCity: "Chennai" },
  { alias: "porur", canonicalCity: "Chennai" },
  { alias: "chromepet", canonicalCity: "Chennai" },
  { alias: "tambaram", canonicalCity: "Chennai" },
  { alias: "pallavaram", canonicalCity: "Chennai" },
  { alias: "guindy", canonicalCity: "Chennai" },
  { alias: "nungambakkam", canonicalCity: "Chennai" },
  { alias: "mylapore", canonicalCity: "Chennai" },
  { alias: "triplicane", canonicalCity: "Chennai" },
  { alias: "egmore", canonicalCity: "Chennai" },
  { alias: "perambur", canonicalCity: "Chennai" },
  { alias: "kolathur", canonicalCity: "Chennai" },
  { alias: "madipakkam", canonicalCity: "Chennai" },
  { alias: "omr", canonicalCity: "Chennai" },
  { alias: "old mahabalipuram road", canonicalCity: "Chennai" },
  { alias: "chennai", canonicalCity: "Chennai" },

  // Coimbatore
  { alias: "gandhipuram", canonicalCity: "Coimbatore" },
  { alias: "saibaba colony, coimbatore", canonicalCity: "Coimbatore" },
  { alias: "eachanari", canonicalCity: "Coimbatore" },
  { alias: "kalapatti", canonicalCity: "Coimbatore" },
  { alias: "kurumbapalayam sskulam", canonicalCity: "Coimbatore" },
  { alias: "neelambur", canonicalCity: "Coimbatore" },
  { alias: "ottakkalmandapam", canonicalCity: "Coimbatore" },
  { alias: "p n pudur", canonicalCity: "Coimbatore" },
  { alias: "k.pudur", canonicalCity: "Coimbatore" },
  { alias: "kaniyur", canonicalCity: "Coimbatore" },
  { alias: "keeranatham", canonicalCity: "Coimbatore" },
  { alias: "coimbatore", canonicalCity: "Coimbatore" },

  // Kochi
  { alias: "kakkanad", canonicalCity: "Kochi" },
  { alias: "ernakulam", canonicalCity: "Kochi" },
  { alias: "kolenchery", canonicalCity: "Kochi" },
  { alias: "pallippuram", canonicalCity: "Kochi" },
  { alias: "pallipuram", canonicalCity: "Kochi" },
  { alias: "kochi", canonicalCity: "Kochi" },

  // Thiruvananthapuram
  { alias: "kazhakkoottam", canonicalCity: "Thiruvananthapuram" },
  { alias: "thiruvananthapuram", canonicalCity: "Thiruvananthapuram" },

  // Kolkata
  { alias: "howrah", canonicalCity: "Kolkata" },
  { alias: "salt lake", canonicalCity: "Kolkata" },
  { alias: "new town", canonicalCity: "Kolkata" },
  { alias: "rajarhat", canonicalCity: "Kolkata" },
  { alias: "sector v", canonicalCity: "Kolkata" },
  { alias: "park street", canonicalCity: "Kolkata" },
  { alias: "barrackpore", canonicalCity: "Kolkata" },
  { alias: "kolkata", canonicalCity: "Kolkata" },

  // Ahmedabad
  { alias: "prahlad nagar", canonicalCity: "Ahmedabad" },
  { alias: "sg highway", canonicalCity: "Ahmedabad" },
  { alias: "sarkhej", canonicalCity: "Ahmedabad" },
  { alias: "bodakdev", canonicalCity: "Ahmedabad" },
  { alias: "satellite", canonicalCity: "Ahmedabad" },
  { alias: "thaltej", canonicalCity: "Ahmedabad" },
  { alias: "navrangpura", canonicalCity: "Ahmedabad" },
  { alias: "cg road", canonicalCity: "Ahmedabad" },
  { alias: "bavla", canonicalCity: "Ahmedabad" },
  { alias: "ahmedabad", canonicalCity: "Ahmedabad" },

  // Other cities — canonical casing entries
  { alias: "bhopal", canonicalCity: "Bhopal" },
  { alias: "bhubaneswar", canonicalCity: "Bhubaneswar" },
  { alias: "chandigarh", canonicalCity: "Chandigarh" },
  { alias: "gandhinagar", canonicalCity: "Gandhinagar" },
  { alias: "greater noida", canonicalCity: "Greater Noida" },
  { alias: "guwahati", canonicalCity: "Guwahati" },
  { alias: "ghaziabad", canonicalCity: "Ghaziabad" },
  { alias: "indore", canonicalCity: "Indore" },
  { alias: "jaipur", canonicalCity: "Jaipur" },
  { alias: "kozhikode", canonicalCity: "Kozhikode" },
  { alias: "kottayam", canonicalCity: "Kottayam" },
  { alias: "mohali", canonicalCity: "Mohali" },
  { alias: "thrissur", canonicalCity: "Thrissur" },
  { alias: "lucknow", canonicalCity: "Lucknow" },
  { alias: "mangaluru", canonicalCity: "Mangaluru" },
  { alias: "mira bhayandar", canonicalCity: "Mira Bhayandar" },
  { alias: "mysuru", canonicalCity: "Mysuru" },
  { alias: "nagpur", canonicalCity: "Nagpur" },
  { alias: "noida", canonicalCity: "Noida" },
  { alias: "patna", canonicalCity: "Patna" },
  { alias: "shillong", canonicalCity: "Shillong" },
  { alias: "surat", canonicalCity: "Surat" },
  { alias: "tiruppur", canonicalCity: "Tiruppur" },
  { alias: "vadodara", canonicalCity: "Vadodara" },
  { alias: "visakhapatnam", canonicalCity: "Visakhapatnam" },

  // Visakhapatnam suburb
  { alias: "atchutapuram", canonicalCity: "Visakhapatnam" },

  // Mysuru suburb
  { alias: "ilavala hobli", canonicalCity: "Mysuru" },

  // Bhubaneswar suburb
  { alias: "khordha", canonicalCity: "Bhubaneswar" },

  // Thrissur suburb
  { alias: "koratty", canonicalCity: "Thrissur" },

  // Kottayam suburb
  { alias: "pampady", canonicalCity: "Kottayam" },

  // Mohali full name alias
  { alias: "sahibzada ajit singh nagar", canonicalCity: "Mohali" },

  // Mangaluru suburb
  { alias: "thokottu", canonicalCity: "Mangaluru" },

  // Indore division
  { alias: "indore division", canonicalCity: "Indore" },

  // Surat suburbs
  { alias: "vesu", canonicalCity: "Surat" },
  { alias: "katargam", canonicalCity: "Surat" },
  { alias: "adajan", canonicalCity: "Surat" },
  { alias: "udhna", canonicalCity: "Surat" },
  { alias: "varachha", canonicalCity: "Surat" },
  { alias: "sachin ina", canonicalCity: "Surat" },
];

async function seed() {
  console.log(`Seeding ${ALIASES.length} city aliases...`);
  let created = 0;
  let skipped = 0;

  for (const { alias, canonicalCity } of ALIASES) {
    try {
      await prismaInstance.cityAlias.upsert({
        where: { alias: alias.toLowerCase() },
        update: { canonicalCity, isActive: true },
        create: { alias: alias.toLowerCase(), canonicalCity },
      });
      created++;
    } catch (err) {
      console.error(`Failed to upsert "${alias}":`, err);
      skipped++;
    }
  }

  console.log(`Done. Created/updated: ${created}, failed: ${skipped}`);
  await prismaInstance.$disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
