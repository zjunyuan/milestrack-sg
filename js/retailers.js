// Curated Singapore retailer -> MCC lookup.
//
// Every `mcc` here must be a known code (MCC_DATABASE in js/config.js or MCC_NAMES in js/mcc-names.js).
// Curated MCC_DATABASE categories carry hand-written card rules; the rest fall back to base-rate cards (js/mcc.js).
// conf:  "high"   = reliably coded this way
//        "medium" = usually this way, can vary by outlet / app / acquirer
//        "low"    = unsure, the true MCC varies a lot, so the user is warned.
// alt:   other MCC codes worth offering as one-tap alternatives.
// promo: shown as a tag in suggestions; the actual promo logic lives in recommender.js.
//
// Household corrections (Firestore `milestrack_merchants`) override or extend this list at runtime.

const r = (name, mcc, conf = "high", aliases = [], extra = {}) => ({ name, mcc, conf, aliases, ...extra });

export const RETAILERS = [
  // ---- Supermarkets & grocery (5411) ----
  r("NTUC FairPrice", "5411", "high", ["fairprice", "ntuc", "fp", "fairprice finest", "fairprice xtra"]),
  r("Sheng Siong", "5411", "high", ["ss"]),
  r("Cold Storage", "5411", "high", ["cs", "cs fresh"]),
  r("Giant", "5411", "medium", ["giant hypermarket", "giant supermarket"]),
  r("Jasons Market Place", "5411", "medium", ["jasons", "marketplace"]),
  r("Prime Supermarket", "5411", "high", ["prime"]),
  r("Don Don Donki", "5411", "medium", ["donki", "don quijote"], { alt: ["5999"] }),
  r("Meidi-Ya", "5411", "medium", ["meidiya"]),
  r("Little Farms", "5411", "medium"),
  r("RedMart", "5411", "medium", ["red mart"], { note: "RedMart is excluded from the OCBC Lazada promo (it codes as 5411)." }),
  r("Phoon Huat", "5499", "medium", ["phoon huat baking"]),
  r("7-Eleven", "5499", "medium", ["7 eleven", "7-11", "7eleven", "seven eleven"], { alt: ["5411"], note: "Convenience stores usually code as 5499, sometimes 5411." }),
  r("Cheers", "5499", "medium", ["cheers convenience"], { alt: ["5411"] }),
  r("Bee Cheng Hiang", "5499", "medium", ["bcm", "bak kwa"]),
  r("Lim Chee Guan", "5499", "medium", ["bak kwa"]),

  // ---- Petrol (5541) ----
  r("Shell", "5541", "high", ["shell petrol", "shell station", "shell go+"]),
  r("SPC", "5541", "high", ["spc petrol"]),
  r("Esso", "5541", "high"),
  r("Caltex", "5541", "high"),
  r("Sinopec", "5541", "high"),

  // ---- Pharmacies & personal care (5912) ----
  r("Guardian", "5912", "high", [], { note: "In-app checkout can code as 5499, not 5912." }),
  r("Watsons", "5912", "high", ["watson"], { promo: "OCBC 6 mpd promo" }),
  r("Unity", "5912", "high", ["unity pharmacy"]),
  r("Sephora", "5977", "medium", [], { alt: ["5999", "5912"] }),

  // ---- Fast food, cafes, bubble tea, delivery (5814) ----
  r("McDonald's", "5814", "high", ["mcd", "mcdonalds", "macs", "mcdonald"]),
  r("KFC", "5814", "high", ["kentucky", "kentucky fried chicken"]),
  r("Burger King", "5814", "high", ["bk"]),
  r("Subway", "5814", "high"),
  r("Jollibee", "5814", "high"),
  r("Popeyes", "5814", "high", ["popeye"]),
  r("Texas Chicken", "5814", "high"),
  r("Wendy's", "5814", "high", ["wendys"]),
  r("Carl's Jr", "5814", "high", ["carls jr", "carl's junior"]),
  r("Shake Shack", "5814", "medium", [], { alt: ["5812"] }),
  r("Mos Burger", "5814", "high", ["mos"]),
  r("Four Fingers", "5814", "high"),
  r("Pizza Hut", "5814", "medium", [], { alt: ["5812"] }),
  r("Domino's", "5814", "medium", ["dominos"]),
  r("Yoshinoya", "5814", "medium"),
  r("Pastamania", "5814", "medium"),
  r("Starbucks", "5814", "high", ["sbux", "starbuck"]),
  r("Coffee Bean & Tea Leaf", "5814", "high", ["coffee bean", "cbtl"]),
  r("Luckin Coffee", "5814", "high", ["luckin"]),
  r("% Arabica", "5814", "medium", ["arabica"]),
  r("Common Man Coffee Roasters", "5814", "medium", ["common man", "cmcr"], { alt: ["5812"] }),
  r("Toast Box", "5814", "high", ["toastbox"]),
  r("Ya Kun Kaya Toast", "5814", "high", ["ya kun", "yakun"]),
  r("Killiney Kopitiam", "5814", "medium", ["killiney"]),
  r("Old Chang Kee", "5814", "high", ["occ"]),
  r("Kopitiam", "5814", "high", ["kopitiam food court"]),
  r("Koufu", "5814", "medium", ["koufu food court"]),
  r("Food Republic", "5814", "medium"),
  r("KOI Thé", "5814", "high", ["koi", "koi the", "koi tea"]),
  r("LiHO", "5814", "high", ["li ho"]),
  r("Gong Cha", "5814", "high", ["gongcha"]),
  r("Each A Cup", "5814", "high", ["eac"]),
  r("Playmade", "5814", "high"),
  r("Chicha San Chen", "5814", "high", ["chicha"]),
  r("The Alley", "5814", "high", ["alley"]),
  r("Tiger Sugar", "5814", "high"),
  r("HEYTEA", "5814", "medium", ["hey tea"]),
  r("CHAGEE", "5814", "high", [], { note: "CHAGEE counts as a DBS yuu partner merchant only when you pay in its app." }),
  r("foodpanda", "5814", "high", ["food panda", "panda"]),
  r("Deliveroo", "5814", "high"),
  r("GrabFood", "5814", "high", ["grab food"]),

  // ---- Sit-down restaurants (5812) ----
  r("Din Tai Fung", "5812", "high", ["dtf"]),
  r("Paradise Group", "5812", "high", ["paradise dynasty", "paradise classic", "paradise"]),
  r("Crystal Jade", "5812", "high"),
  r("Imperial Treasure", "5812", "high"),
  r("Haidilao", "5812", "high", ["hai di lao", "hdl"]),
  r("Jumbo Seafood", "5812", "high", ["jumbo"]),
  r("Song Fa Bak Kut Teh", "5812", "high", ["song fa"]),
  r("Tim Ho Wan", "5812", "high"),
  r("Putien", "5812", "high"),
  r("TungLok", "5812", "high", ["tung lok"]),
  r("Ichiban Boshi", "5812", "high"),
  r("Genki Sushi", "5812", "high", ["genki"]),
  r("Sushiro", "5812", "high"),
  r("Sakae Sushi", "5812", "high", ["sakae"]),
  r("Sushi Express", "5812", "high"),
  r("Saizeriya", "5812", "high"),
  r("Pepper Lunch", "5812", "medium", [], { alt: ["5814"] }),
  r("Ajisen Ramen", "5812", "high", ["ajisen"]),
  r("Ippudo", "5812", "high"),
  r("Marugame Udon", "5812", "high", ["marugame"]),
  r("Swensen's", "5812", "high", ["swensens"]),
  r("Fish & Co", "5812", "high", ["fish and co"]),
  r("PS.Cafe", "5812", "high", ["ps cafe", "pscafe"]),
  r("Soup Restaurant", "5812", "high"),

  // ---- Bars (5813) & catering (5811) ----
  r("1-Altitude", "5813", "high", ["1 altitude", "one altitude"]),
  r("LeVeL33", "5813", "high", ["level 33"]),
  r("Brewerkz", "5813", "high"),
  r("Harry's", "5813", "high", ["harrys"]),
  r("Muddy Murphy's", "5813", "high", ["muddy murphys"]),
  r("Zouk", "5813", "medium", [], { note: "Club entry and drinks can code differently." }),
  r("Neo Garden Catering", "5811", "high", ["neo garden"]),
  r("Stamford Catering", "5811", "high", ["stamford"]),

  // ---- Bakeries (5462) ----
  r("BreadTalk", "5462", "high", ["bread talk"]),
  r("Bengawan Solo", "5462", "high"),
  r("Cedele", "5462", "high"),
  r("Chateraise", "5462", "high"),
  r("Paris Baguette", "5462", "high"),
  r("Four Leaves", "5462", "high"),
  r("Delifrance", "5462", "medium", [], { alt: ["5814"] }),
  r("Tiong Bahru Bakery", "5462", "medium", ["tbb"], { alt: ["5814"] }),
  r("Awfully Chocolate", "5462", "medium", ["awfully choc"], { alt: ["5441"] }),

  // ---- Department stores (5311) ----
  r("Takashimaya", "5311", "high", ["taka"]),
  r("Tangs", "5311", "high"),
  r("Isetan", "5311", "high"),
  r("OG", "5311", "high", ["orchard grand"]),
  r("Metro", "5311", "high"),
  r("BHG", "5311", "high", ["beauty hall"]),
  r("Marks & Spencer", "5311", "medium", ["m&s", "marks and spencer", "mns"], { alt: ["5651"] }),
  r("Mustafa Centre", "5311", "medium", ["mustafa"], { alt: ["5999"] }),

  // ---- Fashion (5651 / 5621) ----
  r("Uniqlo", "5651", "high"),
  r("Zara", "5651", "high"),
  r("H&M", "5651", "high", ["hm", "h and m"]),
  r("Cotton On", "5651", "high", ["cotton"]),
  r("Charles & Keith", "5661", "medium", ["charles and keith", "c&k"], { alt: ["5651"] }),
  r("Pedro", "5661", "medium", [], { alt: ["5651"] }),
  // ---- Shoes & sports footwear (household-set MCCs, not bank-confirmed) ----
  r("Puma", "5655", "medium", [], { alt: ["5661", "5941"] }),
  r("New Balance", "5655", "medium", ["nb"], { alt: ["5661", "5941"] }),
  r("Asics", "5655", "medium", [], { alt: ["5661", "5941"] }),
  r("Under Armour", "5655", "medium", ["ua"], { alt: ["5661", "5941"] }),
  r("Reebok", "5655", "medium", [], { alt: ["5661", "5941"] }),
  r("Fila", "5655", "medium", [], { alt: ["5661", "5941"] }),
  r("Saucony", "5655", "medium", [], { alt: ["5661", "5941"] }),
  r("Hoka", "5655", "medium", ["hoka one one"], { alt: ["5661", "5941"] }),
  r("On Running", "5655", "medium", ["on cloud"], { alt: ["5661", "5941"] }),
  r("Mizuno", "5655", "medium", [], { alt: ["5661", "5941"] }),
  r("Onitsuka Tiger", "5655", "medium", ["onitsuka"], { alt: ["5661", "5941"] }),
  r("Salomon", "5655", "medium", [], { alt: ["5661", "5941"] }),
  r("Vincci", "5661", "medium", [], { alt: ["5655"] }),
  r("Bata", "5661", "medium", [], { alt: ["5655"] }),
  r("Hush Puppies", "5661", "medium", [], { alt: ["5655"] }),
  r("Skechers", "5661", "medium", [], { alt: ["5655"] }),
  r("Clarks", "5661", "medium", [], { alt: ["5655"] }),
  r("Crocs", "5661", "medium", [], { alt: ["5655"] }),
  r("Birkenstock", "5661", "medium", [], { alt: ["5655"] }),
  r("Dr. Martens", "5661", "medium", ["dr martens", "doc martens"], { alt: ["5655"] }),
  r("Havaianas", "5661", "medium", [], { alt: ["5655"] }),
  r("Ecco", "5661", "medium", [], { alt: ["5655"] }),
  r("Geox", "5661", "medium", [], { alt: ["5655"] }),
  r("Rockport", "5661", "medium", [], { alt: ["5655"] }),
  r("Camper", "5661", "medium", [], { alt: ["5655"] }),
  r("Aldo", "5661", "medium", [], { alt: ["5655"] }),
  r("Steve Madden", "5661", "medium", [], { alt: ["5655"] }),
  r("Call It Spring", "5661", "medium", [], { alt: ["5655"] }),
  r("Ugg", "5661", "medium", ["uggs"], { alt: ["5655"] }),
  r("Timberland", "5661", "medium", [], { alt: ["5655"] }),
  r("Converse", "5661", "medium", [], { alt: ["5655"] }),
  r("Vans", "5661", "medium", [], { alt: ["5655"] }),
  r("Foot Locker", "5661", "medium", ["footlocker"], { alt: ["5655"] }),
  r("Sneakers Mania", "5661", "medium", [], { alt: ["5655"] }),
  r("Limited Edt", "5661", "medium", ["limited edition"], { alt: ["5655"] }),
  r("Allbirds", "5661", "medium", [], { alt: ["5655"] }),
  r("Bata Kids", "5661", "medium", [], { alt: ["5655"] }),
  r("Clarks Kids", "5661", "medium", [], { alt: ["5655"] }),
  r("Pazzion", "5661", "medium", [], { alt: ["5655"] }),
  r("Bossini", "5651", "high"),
  r("G2000", "5651", "medium"),
  r("Padini", "5651", "high"),
  r("Nike", "5655", "medium", [], { alt: ["5661", "5941"] }),
  r("Adidas", "5655", "medium", [], { alt: ["5661", "5941"] }),
  r("Lululemon", "5651", "medium"),
  r("Mango", "5621", "medium", [], { alt: ["5651"] }),
  r("Love Bonito", "5621", "medium", ["lovebonito"], { alt: ["5651"] }),
  r("MUJI", "5651", "low", ["muji"], { alt: ["5999"], note: "MUJI sells apparel and household goods; coding varies." }),
  r("Zalora", "5651", "low", [], { alt: ["5999"], note: "Online fashion marketplaces vary by seller." }),
  r("SHEIN", "5651", "low", ["shein"], { alt: ["5999"], note: "Online; usually coded as an online/general merchant." }),

  // ---- General retail & marketplaces (5999) ----
  r("Popular Bookstore", "5942", "medium", ["popular"], { alt: ["5999"] }),
  r("Kinokuniya", "5942", "medium", ["kino"], { alt: ["5999"] }),
  r("Daiso", "5331", "medium", [], { alt: ["5999"] }),
  r("Miniso", "5999", "medium"),
  r("Typo", "5999", "medium"),
  r("Art Friend", "5999", "medium"),
  r("IKEA", "5712", "medium", [], { alt: ["5999"] }),
  r("Courts", "5712", "medium", [], { alt: ["5732"] }),
  r("Harvey Norman", "5712", "medium", [], { alt: ["5732"] }),
  r("Challenger", "5732", "medium", [], { alt: ["5999"] }),
  r("Apple Store", "5732", "medium", ["apple"], { alt: ["5999"] }),
  r("Decathlon", "5941", "medium", [], { alt: ["5999"] }),
  r("Pandora", "5944", "medium", [], { alt: ["5999"] }),
  r("Lovisa", "5944", "medium", [], { alt: ["5999"] }),
  r("Amazon", "5999", "low", [], { note: "Varies by what you buy; treated as general retail." }),
  r("Qoo10", "5999", "low"),
  r("Carousell", "5999", "low"),
  r("Temu", "5999", "low"),
  r("Shopee", "5999", "low", ["shopee sg"], { promo: "OCBC 6 mpd promo" }),
  r("Lazada", "5999", "low", [], { promo: "OCBC 6 mpd promo" }),
  r("Taobao", "5999", "low", [], { promo: "OCBC 6 mpd promo" }),
  r("TikTok Shop", "5999", "low", ["tiktok"], { promo: "OCBC 6 mpd promo" }),

  // ---- Ride-hailing / taxis (4121) ----
  r("Grab", "4121", "medium", ["grab ride", "grabcar", "grab car", "grabtaxi"], { alt: ["5814"], note: "GrabFood orders are usually 5814; wallet top-ups may not earn bonus miles." }),
  r("Gojek", "4121", "high", ["go-jek"]),
  r("SimplyGo", "4111", "high", ["bus/mrt", "bus mrt", "simply go"], { note: "Bank statements print bus and MRT taps as BUS/MRT." }),
  r("ComfortDelGro", "4121", "high", ["cdg", "comfort", "comfort taxi", "cab", "taxi"]),
  r("CityCab", "4121", "high", ["city cab"]),
  r("TADA", "4121", "medium"),
  r("Ryde", "4121", "medium"),
  r("Zig", "4121", "medium"),
  r("Uber", "4121", "high"),

  // ---- Public transport (4111) ----
  r("SimplyGo", "4111", "high", ["simply go"]),
  r("SMRT", "4111", "high"),
  r("SBS Transit", "4111", "high", ["sbs"]),
  r("MRT / Bus", "4111", "high", ["mrt", "bus", "lrt", "train", "public transport"]),

  // ---- Airlines (4511) ----
  r("Singapore Airlines", "4511", "high", ["sia", "krisflyer", "singapore air"]),
  r("Scoot", "4511", "high"),
  r("Jetstar", "4511", "high"),
  r("AirAsia", "4511", "high", ["air asia"]),
  r("Cathay Pacific", "4511", "high", ["cathay"]),
  r("Emirates", "4511", "high"),
  r("Qantas", "4511", "high"),
  r("ANA", "4511", "high", ["all nippon airways"]),
  r("Japan Airlines", "4511", "high", ["jal"]),
  r("Qatar Airways", "4511", "high", ["qatar"]),

  // ---- Travel agencies / OTAs (4722) ----
  r("Agoda", "4722", "high"),
  r("Klook", "4722", "high"),
  r("Trip.com", "4722", "high", ["trip", "ctrip"]),
  r("Expedia", "4722", "high"),
  r("Booking.com", "4722", "high", ["booking"]),
  r("Traveloka", "4722", "high"),
  r("Skyscanner", "4722", "medium"),
  r("Airbnb", "4722", "low", [], { alt: ["7011"], note: "Airbnb's MCC varies by listing and payment path." }),

  // ---- Hotels (7011) ----
  r("Marina Bay Sands", "7011", "medium", ["mbs"], { note: "Casino and gaming charges code separately and are not eligible." }),
  r("Resorts World Sentosa", "7011", "medium", ["rws"], { note: "Casino and attractions code separately from the hotels." }),
  r("Hilton", "7011", "high"),
  r("Marriott", "7011", "high"),
  r("Hyatt", "7011", "high"),
  r("Shangri-La", "7011", "high", ["shangri la"]),
  r("Raffles Hotel", "7011", "high", ["raffles"]),
  r("Fullerton Hotel", "7011", "high", ["fullerton"]),
  r("Capella", "7011", "high"),
  r("Pan Pacific", "7011", "high"),
  r("Mandarin Oriental", "7011", "high"),
  r("Ritz-Carlton", "7011", "high", ["ritz carlton", "ritz"]),
  r("Four Seasons", "7011", "high"),

  // ---- Car rental (7512) ----
  r("Hertz", "7512", "high"),
  r("Avis", "7512", "high"),
  r("Sixt", "7512", "high"),
  r("Budget Rent a Car", "7512", "high", ["budget"]),
  r("GetGo", "7512", "medium", ["get go"]),
  r("BlueSG", "7512", "low", ["blue sg"]),

  // ---- Healthcare (8011 / 8021 / 8062) ----
  r("Raffles Medical", "8011", "high", ["rmg"]),
  r("Healthway Medical", "8011", "high", ["healthway"]),
  r("Fullerton Health", "8011", "high"),
  r("Q&M Dental", "8021", "high", ["qnm", "q and m"]),
  r("Pearlie White", "8021", "high"),
  r("Singapore General Hospital", "8062", "high", ["sgh"]),
  r("National University Hospital", "8062", "high", ["nuh"]),
  r("Tan Tock Seng Hospital", "8062", "high", ["ttsh"]),
  r("Changi General Hospital", "8062", "high", ["cgh"]),
  r("Khoo Teck Puat Hospital", "8062", "high", ["ktph"]),
  r("KK Women's and Children's Hospital", "8062", "high", ["kkh", "kk hospital"]),
  r("Mount Elizabeth", "8062", "high", ["mount e"]),
  r("Gleneagles", "8062", "high"),
  r("Mount Alvernia", "8062", "high"),
  r("Thomson Medical", "8062", "high"),

  // ---- Education & childcare (8211 / 8220 / 8351) ----
  r("NUS", "8220", "high", ["national university of singapore"]),
  r("NTU", "8220", "high", ["nanyang technological university"]),
  r("SMU", "8220", "high", ["singapore management university"]),
  r("SUTD", "8220", "high"),
  r("SIT", "8220", "high", ["singapore institute of technology"]),
  r("SUSS", "8220", "high"),
  r("MOE / School Fees", "8211", "high", ["moe", "school fees", "school"]),
  r("PCF Sparkletots", "8351", "high", ["pcf", "sparkletots"]),
  r("My First Skool", "8351", "high", ["mfs"]),
  r("Little Skool-House", "8351", "high", ["little skoolhouse"]),
  r("Kinderland", "8351", "high"),

  // ---- Charities (8398) ----
  r("Community Chest", "8398", "high", ["comchest"]),
  r("Singapore Red Cross", "8398", "high", ["red cross"]),
  r("SPCA", "8398", "high"),
  r("Singapore Cancer Society", "8398", "high", ["cancer society"]),
  r("Giving.sg", "8398", "medium", ["giving sg", "givingsg"]),

  // ---- v1.10.0: more categories (most fall back to base-rate cards; see js/mcc.js) ----
  // Electronics, home, hobby
  r("Best Denki", "5732", "high", ["bestdenki"]),
  r("Gain City", "5732", "high", ["gaincity"]),
  r("Samsung", "5732", "medium", ["samsung store"], { alt: ["5999"] }),
  r("Castlery", "5712", "medium"),
  r("Home-Fix", "5200", "high", ["homefix", "home fix"]),
  r("Mr DIY", "5200", "medium", ["mrdiy", "mr diy"], { alt: ["5999"] }),
  r("Costco", "5300", "high", ["costco wholesale"], { note: "Warehouse clubs (5300) may be treated differently from supermarkets by your cards." }),
  r("Toys\"R\"Us", "5945", "high", ["toys r us", "toysrus"]),
  r("Hamleys", "5945", "high"),
  r("LEGO Store", "5945", "high", ["lego"]),
  r("Pet Lovers Centre", "5995", "high", ["pet lovers", "plc"]),
  r("Far East Flora", "5992", "high", ["flora", "florist"]),
  r("Samsonite", "5948", "high"),
  r("Poh Heng", "5944", "high", ["poh heng jewellery"]),
  r("Lee Hwa", "5944", "high", ["lee hwa jewellery"]),
  r("Tiffany & Co", "5944", "high", ["tiffany"]),
  r("Cartier", "5944", "high"),
  r("Van Cleef & Arpels", "5944", "high", ["van cleef", "vca", "van cleef and arpels"]),
  r("Bvlgari", "5944", "high", ["bulgari"]),
  r("Chaumet", "5944", "high"),
  r("Chopard", "5944", "high"),
  // Luxury (MCCs from CheckMCC community listings and household judgement; not bank-confirmed, so "medium")
  r("Celine", "5631", "medium", ["celine boutique"], { alt: ["5691"], note: "Luxury boutique; coded 5631 per CheckMCC (in-store). Can vary by outlet or channel." }),
  r("Louis Vuitton", "5631", "medium", ["lv", "louis vuitton boutique"], { alt: ["5691"], note: "Luxury boutique; coded 5631 per CheckMCC (in-store). Can vary by outlet or channel." }),
  r("Chanel (fashion & bags)", "5691", "medium", ["chanel", "chanel boutique", "chanel fashion", "chanel bags"], { alt: ["5631"], note: "Fashion and bags boutique. For makeup and fragrance counters use Chanel Beauty." }),
  r("Chanel Beauty", "5944", "medium", ["chanel beaute", "chanel makeup", "chanel cosmetics", "chanel perfume", "chanel fragrance"], { alt: ["5977"], note: "Beauty counter. 5944 is community-reported (CheckMCC), unusual for cosmetics, so confirm on your statement." }),
  r("Dior (fashion & bags)", "5691", "medium", ["dior", "dior boutique", "dior fashion", "dior bags"], { alt: ["5631"], note: "Fashion and bags boutique. For makeup and fragrance counters use Dior Beauty." }),
  r("Dior Beauty", "5977", "medium", ["dior beaute", "dior makeup", "dior cosmetics", "dior perfume", "dior fragrance"], { alt: ["5944"], note: "Beauty counter, coded 5977 (cosmetic stores) per CheckMCC." }),
  r("Hermès", "5691", "medium", ["hermes", "hermes boutique"], { alt: ["5631", "5948"], note: "Luxury boutique; coding can vary (leather goods, accessories)." }),
  r("Gucci", "5691", "medium", [], { alt: ["5631", "5948"], note: "Luxury boutique; coding can vary (clothing, bags, accessories)." }),
  r("Prada", "5691", "medium", [], { alt: ["5631", "5948"], note: "Luxury boutique; coding can vary (clothing, bags, accessories)." }),
  r("Rolex", "5944", "medium", ["rolex boutique"], { alt: ["5094"], note: "Watches are coded 5944 (jewellery and watch stores); authorised dealers can differ." }),
  r("Saint Laurent", "5699", "medium", ["ysl", "yves saint laurent"], { alt: ["5691", "5631"], note: "Luxury boutique; MCC set by the household, not bank-confirmed. Coding can vary by outlet." }),
  r("Balenciaga", "5691", "medium", [], { alt: ["5631"], note: "Luxury boutique; MCC set by the household, not bank-confirmed. Coding can vary by outlet." }),
  r("Bottega Veneta", "5699", "medium", ["bottega"], { alt: ["5631", "5948"], note: "Luxury boutique; MCC set by the household, not bank-confirmed. Coding can vary by outlet." }),
  r("Givenchy", "5631", "medium", [], { alt: ["5691"], note: "Luxury boutique; MCC set by the household, not bank-confirmed. Coding can vary by outlet." }),
  r("Burberry", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Fendi", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Loewe", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Valentino", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Versace", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Dolce & Gabbana", "5691", "low", ["dolce and gabbana", "d&g"], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Miu Miu", "5691", "low", ["miumiu"], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Balmain", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Moncler", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Max Mara", "5691", "low", ["maxmara"], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Armani", "5691", "low", ["giorgio armani", "emporio armani"], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Lanvin", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Alexander McQueen", "5691", "low", ["mcqueen"], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Stella McCartney", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Off-White", "5691", "low", ["off white"], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Golden Goose", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Brunello Cucinelli", "5691", "low", ["cucinelli"], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Berluti", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Tom Ford", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Ralph Lauren", "5691", "low", ["polo ralph lauren"], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Hugo Boss", "5691", "low", ["boss"], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Dunhill", "5691", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Coach", "5631", "low", [], { alt: ["5948", "5691"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Michael Kors", "5631", "low", ["mk"], { alt: ["5948", "5691"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Kate Spade", "5631", "low", [], { alt: ["5948", "5691"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Tory Burch", "5631", "low", [], { alt: ["5948", "5691"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Longchamp", "5631", "low", [], { alt: ["5948", "5691"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Furla", "5631", "low", [], { alt: ["5948", "5691"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Mulberry", "5631", "low", [], { alt: ["5948", "5691"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Delvaux", "5631", "low", [], { alt: ["5948", "5691"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Ferragamo", "5661", "low", ["salvatore ferragamo"], { alt: ["5948"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Jimmy Choo", "5661", "low", [], { alt: ["5948"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Christian Louboutin", "5661", "low", ["louboutin"], { alt: ["5948"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Goyard", "5948", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Rimowa", "5948", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Tumi", "5948", "low", [], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Montblanc", "5948", "low", ["mont blanc"], { alt: ["5631"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Omega", "5944", "low", ["omega watches"], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Patek Philippe", "5944", "low", ["patek"], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Audemars Piguet", "5944", "low", ["audemars"], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Richard Mille", "5944", "low", [], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("TAG Heuer", "5944", "low", ["tag heuer", "tagheuer"], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Tudor", "5944", "low", [], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("IWC", "5944", "low", ["iwc schaffhausen"], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Breitling", "5944", "low", [], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Jaeger-LeCoultre", "5944", "low", ["jlc", "jaeger lecoultre"], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Vacheron Constantin", "5944", "low", ["vacheron"], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Longines", "5944", "low", [], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Seiko", "5944", "low", [], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Mikimoto", "5944", "low", [], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Boucheron", "5944", "low", [], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Graff", "5944", "low", [], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Harry Winston", "5944", "low", [], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Piaget", "5944", "low", [], { note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("La Mer", "5977", "low", ["creme de la mer"], { alt: ["5999"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Aesop", "5977", "low", [], { alt: ["5999"], note: "Luxury brand; MCC is an educated guess (no source found), so check your statement." }),
  r("Swarovski", "5944", "high"),
  r("OWNDAYS", "8043", "high", ["owndays", "own days"]),
  r("Spectacle Hut", "8043", "high"),
  r("Kumon", "8299", "high"),

  // Telecoms, utilities, insurance, government, stored value
  r("Singtel", "4814", "high", ["singtel bill"], { note: "Singtel is a DBS yuu partner merchant." }),
  r("StarHub", "4814", "high", ["star hub"]),
  r("M1", "4814", "high"),
  r("Simba", "4814", "high", ["simba telecom"]),
  r("Circles.Life", "4814", "high", ["circles life", "circles"]),
  r("SP Services", "4900", "high", ["sp group", "sp utilities", "electricity", "water bill"]),
  r("Prudential", "6300", "high", ["pru"]),
  r("AIA", "6300", "high"),
  r("Great Eastern", "6300", "high", ["ge", "great eastern life"]),
  r("NTUC Income", "6300", "high", ["income", "income insurance"]),
  r("Manulife", "6300", "high"),
  r("FWD", "6300", "high", ["fwd insurance"]),
  r("AXA", "6300", "high"),
  r("IRAS", "9311", "high", ["income tax", "property tax", "tax"]),
  r("HDB", "9399", "high", ["hdb payment"]),
  r("CPF", "9399", "high", ["cpf board"]),
  r("ICA", "9399", "high", ["passport", "immigration"]),
  r("LTA", "9399", "medium", ["land transport authority"]),
  r("SingPost", "9402", "medium", ["singapore post", "post office"], { alt: ["4215"] }),
  r("EZ-Link", "6540", "high", ["ezlink", "ez link", "ez-link topup"]),
  r("GrabPay Top-up", "6540", "medium", ["grabpay", "grab wallet"]),

  // Entertainment, attractions, fitness
  r("Golden Village", "7832", "high", ["gv", "gv cinemas"]),
  r("Shaw Theatres", "7832", "high", ["shaw"]),
  r("Cathay Cineplexes", "7832", "high", ["cathay cinemas"]),
  r("WE Cinemas", "7832", "high"),
  r("Universal Studios Singapore", "7996", "medium", ["uss", "universal studios"]),
  r("Mandai Wildlife Reserve", "7998", "medium", ["singapore zoo", "night safari", "river wonders", "bird paradise", "mandai"]),
  r("S.E.A. Aquarium", "7998", "medium", ["sea aquarium"]),
  r("Gardens by the Bay", "7991", "medium", ["gbtb", "gardens by the bay"]),
  r("Sentosa", "7991", "medium", ["sentosa development", "sentosa express"]),
  r("Madame Tussauds", "7991", "medium"),
  r("Anytime Fitness", "7997", "high"),
  r("Fitness First", "7997", "high"),
  r("Virgin Active", "7997", "high"),
  r("ActiveSG", "7997", "medium", ["active sg"], { alt: ["7941"] }),
  r("Parking.sg", "7523", "medium", ["parking", "parking sg"]),
  r("Wilson Parking", "7523", "high"),
  r("Ninja Van", "4215", "medium"),
  r("Royal Caribbean", "4411", "high"),
  r("Resorts World Cruises", "4411", "high", ["genting dream", "dream cruises"]),
  r("Star Cruises", "4411", "high"),

  // Subscriptions & digital
  r("Netflix", "4899", "medium", [], { alt: ["5968"] }),
  r("Disney+", "4899", "medium", ["disney plus", "disney"], { alt: ["5968"] }),
  r("Spotify", "5815", "medium", [], { alt: ["5968"] }),
  r("Steam", "5816", "high", ["steam games", "valve"]),
  r("Google Play", "5816", "medium", ["google play store"], { alt: ["5818"] })
];

/* ==========================================================================
   Matching helpers (pure: no DOM, no Firebase)
   ========================================================================== */

export function normalizeText(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // strip accents (Thé -> the)
    .replace(/&/g, " and ")
    .replace(/['’`.]/g, "")                            // mcdonald's -> mcdonalds, trip.com -> tripcom
    .replace(/[^a-z0-9%+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(s = "") {
  return normalizeText(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Built-in list merged with household overrides ({ [slug]: { name, mcc, aliases? } }).
// Override-only brands are appended; overridden built-ins keep their aliases.
export function buildRetailerList(overrides = {}) {
  const seen = new Set();
  const list = RETAILERS.map(base => {
    const slug = slugify(base.name);
    seen.add(slug);
    const o = overrides[slug];
    if (!o) return { ...base, slug, builtin: true, source: "builtin" };
    return {
      ...base, slug, builtin: true,
      name: o.name || base.name,
      mcc: o.mcc || base.mcc,
      conf: "high",                       // someone in the household confirmed it
      alt: [],
      note: undefined,
      aliases: [...new Set([...(base.aliases || []), ...(o.aliases || [])])],
      source: "household"
    };
  });
  for (const [slug, o] of Object.entries(overrides)) {
    if (seen.has(slug) || !o?.name || !o?.mcc) continue;
    list.push({ name: o.name, mcc: o.mcc, conf: "high", aliases: o.aliases || [], slug, source: "household" });
  }
  return list;
}

// Score one query against one retailer (0 = no match).
function scoreRetailer(q, retailer) {
  const names = [retailer.name, ...(retailer.aliases || [])].map(normalizeText);
  let best = 0;
  for (const n of names) {
    if (!n) continue;
    let s = 0;
    if (n === q) s = 100;
    else if (n.startsWith(q)) s = 80;
    else if (n.split(" ").some(w => w.startsWith(q))) s = 70;
    else if (q.length >= 3 && n.includes(q)) s = 55;
    else if (q.length >= 4) {
      // Typo tolerance: compare against the whole name and each word.
      const limit = q.length >= 7 ? 2 : 1;
      const cands = [n, ...n.split(" ").filter(w => w.length >= 4)];
      for (const c of cands) {
        const d = editDistance(q, c.slice(0, q.length + 1), limit);
        if (d <= limit) { s = Math.max(s, 48 - d * 3); }
      }
    }
    if (s > best) best = s;
  }
  return best;
}

// Ranked matches for a query. Returns [{ retailer, score }].
export function searchRetailers(query, overrides = {}, limit = 6) {
  const q = normalizeText(query);
  if (!q) return [];
  const confRank = { high: 2, medium: 1, low: 0 };
  return buildRetailerList(overrides)
    .map(retailer => ({ retailer, score: scoreRetailer(q, retailer) }))
    .filter(x => x.score >= 40)
    .sort((a, b) =>
      b.score - a.score ||
      (b.retailer.source === "household") - (a.retailer.source === "household") ||
      confRank[b.retailer.conf] - confRank[a.retailer.conf] ||
      a.retailer.name.length - b.retailer.name.length)
    .slice(0, limit);
}

// The single retailer we are confident enough to auto-resolve for typed text, or null.
// Exact/alias hits resolve at any length; prefix/word-prefix hits need 3+ characters.
export function findRetailerForInput(query, overrides = {}) {
  const q = normalizeText(query);
  if (!q) return null;
  const [top, second] = searchRetailers(q, overrides, 2);
  if (!top) return null;
  // Never guess between two different brands that match equally well
  // ("ko" -> Koufu / KOI, "cinema" -> Golden Village / Shaw / WE Cinemas).
  if (second && second.score === top.score && second.retailer.slug !== top.retailer.slug) return null;
  if (top.score >= 100) return top.retailer;
  if (q.length >= 3 && top.score >= 70) return top.retailer;
  return null;
}
