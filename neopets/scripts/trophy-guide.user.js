// ==UserScript==
// @name         Neopets 獎盃攻略（Trophy Guide）
// @namespace    neopets-trophy-guide
// @version      1.2
// @description  在獎盃櫃（Trophy Cabinet）直接列出每個獎盃：拿到沒、拿到哪一級、怎麼拿（中文條件），附「去玩／高分榜／攻略」連結
// @match        *://*.neopets.com/prizes.phtml*
// @match        *://neopets.com/prizes.phtml*
// @match        *://*.neopets.com/userlookup.phtml*
// @match        *://neopets.com/userlookup.phtml*
// @grant        none
// @license      GPL-3.0
// @downloadURL  https://daqingjuan.github.io/neopets/scripts/trophy-guide.user.js
// @updateURL    https://daqingjuan.github.io/neopets/scripts/trophy-guide.user.js
// ==/UserScript==
//
// 獎盃清單資料來自 Karla's Trophy Tracker（GPL-3.0），本腳本另外加上中文條件與連結。
// 只讀取你自己的獎盃頁，不會自動玩、不會送出任何東西。

(() => {
  "use strict";
  if (window.__trophyGuide) return;
  window.__trophyGuide = true;

  // ---------- 自己的個人資料頁：加一顆「獎盃攻略」按鈕，點了到獎盃櫃 ----------
  if (/userlookup\.phtml/.test(location.pathname)) {
    const who = (new URLSearchParams(location.search).get("user") || "").toLowerCase();
    const me = ((document.body.textContent || "").match(/Welcome,\s*([\w]+)/i) || [])[1] || "";
    if (!who || who !== me.toLowerCase()) return; // 只在自己的頁面出現
    const head = [...document.querySelectorAll(".contentModuleHeaderAlt, .contentModuleHeader")].find((e) => /Trophies/i.test(e.textContent));
    const a = document.createElement("a");
    a.href = "https://www.neopets.com/prizes.phtml";
    a.textContent = "🏆 獎盃攻略";
    a.style.cssText = "display:inline-block;margin-left:10px;padding:2px 10px;border-radius:999px;background:#f28500;color:#fff;font:bold 12px/1.6 'Trebuchet MS',Arial,sans-serif;text-decoration:none;vertical-align:middle";
    if (head) head.appendChild(a);
    else {
      a.style.cssText += ";position:fixed;right:16px;bottom:16px;z-index:99999;font-size:14px;padding:6px 14px";
      document.body.appendChild(a);
    }
    return;
  }

  // [分類代號, 分類名稱, [[獎盃名, 獎盃編號, [等級...]], ...]]　等級：1=金 2=銀 3=銅
  const DATA = [["easy","非競爭獎盃（自己努力就拿得到）",[["Beating Punchbag Bob",115,[1]],["Cellblock",216,[1,2,3]],["Cheat!",109,[1,2,3]],["Cosy Campfire Collection",1409,[1,2,3]],["Go! Go! Go!",108,[1,2,3]],["The Neopian Lottery",58,[1,2,3]],["NeoQuest",91,[1,2,3]],["NeoQuest II",372,[1,2,3]],["Plushie Tycoon",170,[1,2,3]],["Pyramid Bonus",68,[1,2,3]],["Sakhmet Solitaire Bonus",77,[1,2,3]],["Snow Wars",55,[1,2,3]]]],["flash","遊戲高分獎盃",[["200m Peanut Dash",987,[1,2,3]],["AAA's Revenge",1375,[1,2,3]],["Advert Attack",204,[1,2,3]],["Assignment 53",1347,[1,2,3]],["Attack of the Gummy Dice",685,[1,2,3]],["Attack of the Marblemen",201,[1,2,3]],["Attack of the Revenge",527,[1,2,3]],["Attack of the Slorgs",386,[1,2,3]],["Barf Boat",1026,[1,2,3]],["Berry Bash",968,[1,2,3]],["Biscuit Brigade: Hagan's Last Stand",941,[1,2,3]],["Black Pawkeet Slots",1099,[1,2,3]],["Bouncy Supreme",532,[1,2,3]],["Brucey B Slots",1121,[1,2,3]],["Bruno's Backwoods Breakaway",734,[1,2,3]],["Bumble Beams",799,[1,2,3]],["Carnival of Terror",902,[1,2,3]],["Castle Battles",430,[1,2,3]],["Cave Glider",1156,[1,2,3]],["Caves and Corridors: Mystery Island",627,[1,2,3]],["Chariot Chase",1148,[1,2,3]],["Cheeseroller",155,[1,2,3]],["Chemistry for Beginners",239,[1,2,3]],["Chia Bomber 2",539,[1,2,3]],["Clockwork Codebreaker",1173,[1,2,3]],["Cloud Raiders",1149,[1,2,3]],["Coal War Tactics",1370,[1,2,3]],["Cooty Wars",796,[1,2,3]],["Crisis Courier",773,[1,2,3]],["Dar-BLAT!!!",895,[1,2,3]],["Darigan Dodgeball",1139,[1,2,3]],["Deckball",82,[1,2,3]],["Defender Trainer",258,[1,2,3]],["Destruct-O-Match III",999,[1,2,3]],["Dice Escape",356,[1,2,3]],["Dice of Destiny",1126,[1,2,3]],["Dice-A-Roo",10,[1,2,3]],["Double or Nothing",178,[1,2,3]],["Dubloon Disaster",772,[1,2,3]],["Dueling Decks",1182,[1,2,3]],["Dungeon Dash",962,[1,2,3]],["Edna's Shadow",821,[1,2,3]],["Escape from Meridell Castle",197,[1,2,3]],["Escape to Kreludor",400,[1,2,3]],["Evil Fuzzles from Beyond the Stars",585,[1,2,3]],["Extreme Faerie Cloud Racers",1155,[1,2,3]],["Extreme Herder",149,[1,2,3]],["Extreme Herder 2",1117,[1,2,3]],["Extreme Potato Counter",226,[1,2,3]],["Eye of the Storm",720,[1,2,3]],["Faerie Bubbles",358,[1,2,3]],["Faerie Caves II - Fyora's Quest",489,[1,2,3]],["Faerie Cloud Racers",586,[1,2,3]],["Feed Florg",645,[1,2,3]],["Fetch!",97,[1,2,3]],["Flycatcher",570,[1,2,3]],["Freaky Factory",390,[1,2,3]],["Frumball",313,[1,2,3]],["Gadgadsgame",159,[1,2,3]],["Ghost Bopper",614,[1,2,3]],["Goparokko",887,[1,2,3]],["Gormball",6,[1,2,3]],["Gourmet Club Bowls",330,[1,2,3]],["Grand Theft Ummagine",212,[1,2,3]],["Grarrl Keno",48,[1,2,3]],["Gwyl's Great Escape",668,[1,2,3]],["Hannah and the Ice Caves",473,[1,2,3]],["Hannah and the Kreludor Caves",1252,[1,2,3]],["Hannah and the Pirate Caves",349,[1,2,3]],["Hannah and the Wardrobe of Adventure",1229,[1,2,3]],["Hasee Bounce",368,[1,2,3]],["Hot Dog Hero",965,[1,2,3]],["Hubrid's Hero Heist",314,[1,2,3]],["Hungry Skeith",538,[1,2,3]],["Ice Cream Machine",507,[1,2,3]],["Igloo Garage Sale - The Game",676,[1,2,3]],["Illusens Glade",160,[1,2,3]],["Imperial Exam",656,[1,2,3]],["Invasion: Blastoids",1330,[1,2,3]],["Island Chef Academy",1205,[1,2,3]],["Itchy Invasion",713,[1,2,3]],["Jelly Blobs of Doom",359,[1,2,3]],["Jhudoras Bluff",126,[1,2,3]],["Jolly Jugglers",615,[1,2,3]],["Jubble Bubble",619,[1,2,3]],["Jumpin' Gem Heist",1191,[1,2,3]],["Jungle Raiders",1064,[1,2,3]],["Kass Basher",381,[1,2,3]],["Kiko Match II",519,[1,2,3]],["Kiss the Mortog",154,[1,2,3]],["Kookia",1189,[1,2,3]],["Korbats Lab",801,[1,2,3]],["Kou-Jong",707,[1,2,3]],["Kreludan Mining Corp.",404,[1,2,3]],["Legends of Pinball",1118,[1,2,3]],["Let It Slide",970,[1,2,3]],["Lost City Lanes",1108,[1,2,3]],["Lost in Space Fungus",774,[1,2,3]],["MAGAX: Destroyer II",763,[1,2,3]],["Magma Blaster",571,[1,2,3]],["Maths Nightmare",885,[1,2,3]],["Meepit Juice Break",379,[1,2,3]],["Meepit vs. Feepit",540,[1,2,3]],["Meerca Chase II",500,[1,2,3]],["Moon Rock Rampage",444,[1,2,3]],["Mootix Drop",396,[1,2,3]],["Mop 'n' Bop",904,[1,2,3]],["Mutant Graveyard of Doom II",1042,[1,2,3]],["Mynci Beach Volleyball",315,[1,2,3]],["NeggSweeper",54,[1,2,3]],["NeoQuest II Race",373,[1,2,3]],["Neopian Battlefield Legends",1221,[1,2,3]],["Neverending Boss Battle",552,[1,2,3]],["Nimmos Pond",1048,[1,2,3]],["Nova Defender",1223,[1,2,3]],["Pakiko",1369,[1,2,3]],["Petpet Battles",231,[1,2,3]],["Petpet Cannonball",553,[1,2,3]],["Petpet Plunge",1078,[1,2,3]],["Petpet Rescue",228,[1,2,3]],["Petpetsitter",428,[1,2,3]],["Piper Panic",973,[1,2,3]],["Pterattack",587,[1,2,3]],["Raiders of Maraqua",248,[1,2,3]],["Ready to Roll",934,[1,2,3]],["Revel Roundup",794,[1,2,3]],["Rink Runner",220,[1,2,3]],["Roodoku",820,[1,2,3]],["Round Table Poker",177,[1,2,3]],["Ruins Rampage",600,[1,2,3]],["S.M.E.L.T.",1292,[1,2,3]],["Scarab 21",70,[1,2,3]],["Scorchy Slots",8,[1,2,3]],["Scourge of the Lab Jellies",760,[1,2,3]],["Sewage Surfer",157,[1,2,3]],["Shapeshifter",151,[1,2,3]],["Shenkuu River Rush",877,[1,2,3]],["Shenkuu Tangram",1075,[1,2,3]],["Shenkuu Warrior",786,[1,2,3]],["Shenkuu Warrior II",1266,[1,2,3]],["Skies Over Meridell",340,[1,2,3]],["Slorgs in Space",1146,[1,2,3]],["Smug Bug Smite",933,[1,2,3]],["Snot Splatter",1100,[1,2,3]],["Snow Roller",1076,[1,2,3]],["Snow Wars II",544,[1,2,3]],["Snowball Fight",633,[1,2,3]],["Snowbeast Snackrifice",818,[1,2,3]],["Snowmuncher",412,[1,2,3]],["Sophie's Stew",659,[1,2,3]],["Sorcerers' Skirmish",1202,[1,2,3]],["Spacerocked!",964,[1,2,3]],["Spell-Or-Starve",202,[1,2,3]],["Spellseeker",1157,[1,2,3]],["Spinacles",1134,[1,2,3]],["Splat-A-Sloth",81,[1,2,3]],["Stowaway Sting",852,[1,2,3]],["Super Hasee Bounce",1061,[1,2,3]],["Sutek's Tomb",306,[1,2,3]],["Swarm - The Bugs Strike Back",562,[1,2,3]],["Techo Says",1000,[1,2,3]],["Terror Mountain Tilt",925,[1,2,3]],["The Buzzer Game",307,[1,2,3]],["The Castle of Eliv Thade",230,[1,2,3]],["The Great Desert Race",830,[1,2,3]],["The Great Qasalan Caper",660,[1,2,3]],["The Last Blast",926,[1,2,3]],["The Return of the Return of Dr. Sloth",480,[1,2,3]],["The Search for Princess Lunara",874,[1,2,3]],["The Usul Suspects",789,[1,2,3]],["Time Tunnel",536,[1,2,3]],["TNT Staff Smasher",198,[1,2,3]],["Top Chop",1095,[1,2,3]],["Toy Box Escape",367,[1,2,3]],["Trouble at the National Neopian",371,[1,2,3]],["Tubular Kiko Racing",606,[1,2,3]],["Tug 'O' War",909,[1,2,3]],["Tunnel Tumble",1175,[1,2,3]],["Turmac Roll",366,[1,2,3]],["Typing Terror",574,[1,2,3]],["Tyrannian Mini Golf",648,[1,2,3]],["Tyranu Evavu",47,[1,2,3]],["Ugga Drop",1204,[1,2,3]],["Ugga Smash",726,[1,2,3]],["Ultimate Bullseye II",903,[1,2,3]],["Usuki Frenzy",884,[1,2,3]],["Volcano Run II",761,[1,2,3]],["Warf Rescue Team",305,[1,2,3]],["Web of Vernax",353,[1,2,3]],["Wheeler's Wild Ride",1080,[1,2,3]],["Whirlpool",927,[1,2,3]],["Wicked Wocky Wobble",881,[1,2,3]],["Wingoball",771,[1,2,3]],["Word Poker",229,[1,2,3]],["Word Pyramid",575,[1,2,3]],["Wrath of the Snowager",1269,[1,2,3]],["Zurroball",207,[1,2,3]]]],["cumu","累計排行獎盃",[["NeggSweeper Cumulative",84,[1,2,3]],["Pyramids",67,[1,2,3]],["Sakhmet Solitaire",76,[1,2,3]],["Scarab 21 Cumulative",69,[1,2,3]],["Slots Big Losers",448,[1,2,3]]]],["other","其他排行獎盃",[["Angry Tax Beast",487,[1,2,3]],["Brain Tree Quest",75,[1,2,3]],["Card Collector",1329,[1,2,3]],["Food Club",88,[1,2,3]],["Grumpy Old King",218,[1,2,3]],["NeoBoard Avatar Collector",342,[1,2,3]],["Sloth's Invasion Tax",341,[1,2,3]],["Stamp Collector",346,[1,2,3]],["Tax Beast",196,[1,2,3]],["Test Your Strength",331,[1,2,3]],["Vending Machine",36,[1,2,3]],["Wise Old King",493,[1,2,3]]]],["spot","投稿／比賽獎盃",[["Caption Competition",100,[1,2,3]],["Gallery Spotlight",222,[1]],["Lookup of the Week",467,[1]],["Mystery Pic",105,[1,2,3]],["Neopian Times",107,[1]],["Picture Competition",102,[1,2,3]],["Poetry Competition",103,[1,2,3]],["Storytelling",104,[1,2,3]]]],["pvp","對戰獎盃（目前拿不到）",[["Armada",18,[1,2,3]],["Geos",113,[1,2,3]],["Kacheekers",111,[1,2,3]]]],["retired","已停辦遊戲獎盃（拿不到）",[["200m Peanut Dash",189,[1,2,3]],["Aisha Puzzle",21,[1,2,3]],["Alien Invasion",4,[1,2,3]],["Alpine Challenge",35,[1,2,3]],["Balthazar Basher",482,[1,2,3]],["Beast Smack",33,[1,2,3]],["Bilge Dice",351,[1,2,3]],["Bilge Dice Streak",352,[1,2,3]],["Black Pawkeet Slots",309,[1,2,3]],["Brucey B Slots",300,[1,2,3]],["BUBBLE YUM",171,[1,2,3]],["Bullseye",39,[1,2,3]],["Bumper Cars",61,[1,2,3]],["Carnival of Terror",131,[1,2,3]],["Chia Bingo",9,[1,2,3]],["Chia Bomber",62,[1,2,3]],["Chiazilla Puzzle",23,[1,2,3]],["Chomby and the Fungus Balls",49,[1,2,3]],["Chute",60,[1,2,3]],["CodeBreakers",2,[1,2,3]],["Dark Faerie Puzzle",24,[1,2,3]],["Deckball Timed",83,[1,2,3]],["Deckswabber",19,[1,2,3]],["Destruct-O-Match",53,[1,2,3]],["Destruct-O-Match II",453,[1,2,3]],["Destruct-O-Match II",759,[1,2,3]],["Dubloon Disaster",143,[1,2,3]],["Earth Faerie Aces",40,[1,2,3]],["Earth Faerie Aces - Expert",41,[1,2,3]],["Evil Fuzzles from Beyond the Stars",128,[1,2,3]],["Faerie Caves",43,[1,2,3]],["Faerie Cloud Racers",137,[1,2,3]],["Faerie Quest",37,[1,2,3]],["Feed Florg",156,[1,2,3]],["Fruit Machine",20,[1,2,3]],["Grundo Snowthrow",31,[1,2,3]],["Ice Caves Puzzle",32,[1,2,3]],["Ice Cream Factory",57,[1,2,3]],["Igloo Garage Sale - The Game",169,[1,2,3]],["Invasion of Meridell",182,[1,2,3]],["Jelly Processing Plant",95,[1,2,3]],["JubJub Scramble",56,[1,2,3]],["Kau Korrall",15,[1,2,3]],["Kauvaras Potion Cumulative",99,[1,2,3]],["Kauvaras Potion Game",98,[1,2,3]],["Kiko Match",3,[1,2,3]],["Kiko Match II",93,[1,2,3]],["Korbats Lab",85,[1,2,3]],["MAGAX: Destroyer",162,[1,2,3]],["Maraqua Puzzle",22,[1,2,3]],["Maths Nightmare",150,[1,2,3]],["Meerca Chase",46,[1,2,3]],["Meriball",173,[1,2,3]],["Meristones",180,[1,2,3]],["Meristones Cumulative",181,[1,2,3]],["Moon Puzzle",25,[1,2,3]],["Mummy Maze",71,[1,2,3]],["Mutant Graveyard of DOOM",65,[1,2,3]],["Neo DJ",30,[1,2,3]],["Neoknights",34,[1,2,3]],["NeoQuest II Artists",374,[1,2]],["NeoQuest Race",90,[1,2,3]],["Nimmos Pond",74,[1,2,3]],["Nova Battle",1188,[1,2,3]],["Omelette Defender",127,[1,2,3]],["Pterattack",63,[1,2,3]],["Pumpkin Patch",64,[1,2,3]],["Skarl's Scramble",243,[1,2,3]],["Snow Dogs",96,[1,2,3]],["Solo Says",11,[1,2,3]],["Super Bullseye",42,[1,2,3]],["Swarm",66,[1,2,3]],["Techo Says",1,[1,2,3]],["The Haunted Shootery",1114,[1,2,3]],["The Last Smiley",576,[1,2,3]],["The Warehouse Of Lost Plushies",322,[1,2,3]],["Theme Parks",116,[1,2,3]],["Thinkway Toybox Escape",236,[1,2,3]],["Tower of Turnips",172,[1,2,3]],["Tug-O-War",52,[1,2,3]],["Turmac Roll",323,[1,2,3]],["Tyrannian Mini Golf",395,[1,2,3]],["Uber Faerie Caves",44,[1,2,3]],["Ultimate Bullseye",152,[1,2,3]],["Usuki Frenzy",129,[1,2,3]],["Volcano Run",140,[1,2,3]]]]];

  const BASE = "https://www.neopets.com";
  const LV = { 1: "金", 2: "銀", 3: "銅", 4: "亞軍" };
  const game = (id) => `${BASE}/games/game.phtml?game_id=${id}`;
  const scores = (id) => `${BASE}/gamescores.phtml?game_id=${id}`;

  // 各分類的通用條件
  const RULE = {
    easy: "",
    flash: "高分榜名次獎盃：每天結算，第 1 名金、第 2 名銀、第 3 名銅。按「高分榜」看今天前幾名要幾分。",
    cumu: "看累計排行（累積贏的 NP 或勝場）名次：第 1 名金、第 2 名銀、第 3 名銅。",
    other: "看這個活動的排行榜名次：第 1 名金、第 2 名銀、第 3 名銅。",
    spot: "投稿或參加比賽，被選上／得獎才有。",
    pvp: "要跟真人對戰，目前官方沒開放，拿不到。",
    retired: "這個遊戲已經停辦，拿不到了。",
  };

  // 個別獎盃：中文條件、要不要標「好拿」、專屬連結
  const INFO = {
    115: { easy: 1, cond: "在 Battledome 打贏 Punchbag Bob（打贏一次就給）。", play: `${BASE}/dome/` },
    216: { easy: 1, cond: "跟電腦玩 Cellblock 打贏：亞軍 T1 第 4 關、銅 T1 第 8 關、銀 T11 第 4 關、金 T11 第 8 關（T=難度）。", play: `${BASE}/games/cellblock/cellblock_main.phtml` },
    109: { easy: 1, cond: "跟電腦玩 Cheat! 打贏，關卡越高獎盃越好（銅→銀→金）。", play: `${BASE}/games/cheat/index.phtml` },
    108: { easy: 1, cond: "跟電腦玩 Go! Go! Go! 打贏，關卡越高獎盃越好（銅→銀→金）。" },
    68: { easy: 1, cond: "Pyramids 清空整座金字塔：累計 2 次銅、5 次銀、連續 2 局都清空金。每局 50 NP，可用「金字塔自動玩」腳本。", play: `${BASE}/games/pyramids/index.phtml` },
    77: { easy: 1, cond: "Sakhmet Solitaire 贏牌：累計 2 次銅、5 次銀、連續 2 局都贏金。每局 50 NP。", play: `${BASE}/games/sakhmet_solitaire/index.phtml` },
    55: { easy: 1, cond: "跟電腦玩 Snow Wars 打贏：第 5 關銅、第 7 關銀、第 10 關金。每局 100 NP。", play: `${BASE}/games/snowwars.phtml` },
    91: { cond: "NeoQuest 破關：普通難度銅、Evil 銀、Insane 金。很花時間。", play: `${BASE}/games/neoquest/neoquest.phtml` },
    372: { cond: "NeoQuest II 破關：普通難度銅、Evil 銀、Insane 金。很花時間。", play: `${BASE}/games/nq2/index.phtml` },
    58: { cond: "中 Neopian Lottery 頭獎才有（靠運氣）。", play: `${BASE}/games/lottery.phtml` },
    1409: { cond: "Cosy Campfire Collection 收集／分數達標（條件看攻略）。" },
    170: { cond: "Plushie Tycoon 經營賺到目標（遊戲常壞，條件看攻略）。" },
    75: { cond: "完成 Brain Tree 任務的次數排行。", play: `${BASE}/halloween/braintree.phtml` },
    88: { cond: "Food Club 贏錢排行。", play: `${BASE}/pirates/foodclub.phtml` },
    331: { cond: "Test Your Strength 敲出的力氣排行。", play: `${BASE}/halloween/strtest/index.phtml` },
    218: { cond: "Grumpy Old King 排行。", play: `${BASE}/medieval/grumpyking.phtml` },
    493: { cond: "Wise Old King 排行。", play: `${BASE}/medieval/wiseking.phtml` },
    346: { cond: "郵票收藏數量排行。", play: `${BASE}/stamps.phtml` },
    342: { cond: "NeoBoard 頭像收集數量排行。" },
    1329: { cond: "卡片收藏數量排行。" },
    100: { cond: "Caption Competition 投稿被選為前三名。", noplay: 1 },
    105: { easy: 1, cond: "猜 Mystery Pic，猜對的人裡面會選出得獎者（免費、每週一題）。", play: `${BASE}/games/mysterypic.phtml` },
    107: { cond: "投稿 Neopian Times 被刊登。", play: `${BASE}/ntimes/index.phtml` },
    102: { cond: "Art Gallery 投稿得獎。", noplay: 1 },
    103: { cond: "Poetry 投稿得獎。", noplay: 1 },
    104: { cond: "Storytelling 投稿得獎。", noplay: 1 },
    222: { cond: "自己的 Gallery 被選為 Spotlight。", play: `${BASE}/gallery/index.phtml` },
    467: { cond: "自己的 Lookup 被選為 Lookup of the Week。", noplay: 1 },
  };

  // ---------- 讀我已經有的獎盃 ----------
  const owned = {}; // 編號 → 拿到的最好等級（數字越小越好）
  for (const img of document.querySelectorAll("img")) {
    const m = (img.getAttribute("src") || "").match(/trophies\/(\d+)_(\d+)\.gif/);
    if (!m) continue;
    const id = +m[1], lv = +m[2];
    if (!owned[id] || lv < owned[id]) owned[id] = lv;
  }

  const items = [];
  for (const [cat, title, list] of DATA) {
    for (const [name, id, lvs] of list) {
      const info = INFO[id] || {};
      const best = owned[id] || 0;
      const top = Math.min(...lvs);
      const status = !best ? "missing" : best > top ? "upgrade" : "done";
      items.push({ cat, title, name, id, lvs, info, best, status, easy: !!info.easy });
    }
  }

  // ---------- 樣式 ----------
  const css = document.createElement("style");
  css.textContent = `
  #tg{--tg-bg:#fffaf0;--tg-card:#fff;--tg-line:#ead9b8;--tg-ink:#2b2216;--tg-mute:#7a6a52;--tg-acc:#c9790f;--tg-gold:#d4a017;--tg-silver:#8f9aa3;--tg-bronze:#b06a2c;--tg-miss:#c94a3a;--tg-ok:#3f8a46;
    text-align:left;margin:14px auto;max-width:760px;background:var(--tg-bg);border:2px solid var(--tg-line);border-radius:12px;padding:12px 14px;font:13px/1.5 "Trebuchet MS",Arial,sans-serif;color:var(--tg-ink)}
  #tg h3{margin:0 0 6px;font-size:17px;color:var(--tg-acc)}
  #tg .tg-sum{display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:8px;color:var(--tg-mute)}
  #tg .tg-sum b{color:var(--tg-ink)}
  #tg .tg-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}
  #tg .tg-bar button{font:inherit;padding:3px 10px;border-radius:999px;border:1px solid var(--tg-line);background:var(--tg-card);color:var(--tg-ink);cursor:pointer}
  #tg .tg-bar button.on{background:var(--tg-acc);border-color:var(--tg-acc);color:#fff}
  #tg .tg-bar input[type=search]{font:inherit;padding:3px 8px;border:1px solid var(--tg-line);border-radius:8px;min-width:0;flex:1 1 140px}
  #tg .tg-bar label{display:flex;gap:4px;align-items:center;color:var(--tg-mute)}
  #tg details{margin:8px 0;border-top:1px dashed var(--tg-line);padding-top:6px}
  #tg summary{cursor:pointer;font-weight:bold;font-size:14px}
  #tg summary small{font-weight:normal;color:var(--tg-mute)}
  #tg .tg-rule{color:var(--tg-mute);margin:4px 0 8px}
  #tg .tg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
  #tg .tg-c{background:var(--tg-card);border:1px solid var(--tg-line);border-left:4px solid var(--tg-miss);border-radius:8px;padding:6px 8px;display:flex;flex-direction:column;gap:3px}
  #tg .tg-c.upgrade{border-left-color:var(--tg-gold)}
  #tg .tg-c.done{border-left-color:var(--tg-ok)}
  #tg .tg-top{display:flex;gap:8px;align-items:center}
  #tg .tg-top img{width:48px;height:48px;object-fit:contain;flex:none}
  #tg .tg-top img.dim{filter:grayscale(1);opacity:.35}
  #tg .tg-name{font-weight:bold;line-height:1.25}
  #tg .tg-st{font-size:12px}
  #tg .tg-st .miss{color:var(--tg-miss)} #tg .tg-st .up{color:var(--tg-bronze)} #tg .tg-st .ok{color:var(--tg-ok)}
  #tg .tg-easy{display:inline-block;font-size:11px;background:#e6f4e2;color:var(--tg-ok);border-radius:6px;padding:0 5px;margin-left:4px}
  #tg .tg-cond{font-size:12px;color:var(--tg-ink)}
  #tg .tg-links{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px}
  #tg .tg-links a{color:var(--tg-acc);font-weight:bold;text-decoration:none}
  #tg .tg-links a:hover{text-decoration:underline}
  #tg .tg-empty{color:var(--tg-mute);padding:6px 0}
  `;
  document.head.appendChild(css);

  // ---------- 面板 ----------
  const box = document.createElement("div");
  box.id = "tg";
  const cnt = (f) => items.filter(f).length;
  const live = items.filter((i) => i.cat !== "retired" && i.cat !== "pvp");
  box.innerHTML = `
    <h3>🏆 獎盃攻略</h3>
    <div class="tg-sum">
      <span>已拿 <b>${cnt((i) => i.best)}</b> 個</span>
      <span>還拿得到但沒拿 <b>${cnt((i) => !i.best && i.cat !== "retired" && i.cat !== "pvp")}</b> 個</span>
      <span>可以升級 <b>${cnt((i) => i.status === "upgrade")}</b> 個</span>
      <span>好拿又還沒拿 <b>${cnt((i) => i.easy && i.status !== "done")}</b> 個</span>
    </div>
    <div class="tg-bar">
      <button data-f="todo" class="on">還沒拿＋可升級</button>
      <button data-f="easy">⭐ 好拿的</button>
      <button data-f="missing">還沒拿</button>
      <button data-f="upgrade">可升級</button>
      <button data-f="have">已拿到</button>
      <button data-f="all">全部</button>
      <input type="search" placeholder="搜尋獎盃名稱…">
      <label><input type="checkbox" class="tg-dead"> 顯示拿不到的</label>
    </div>
    <div class="tg-list"></div>`;

  const anchor = document.querySelector(".content center") || document.querySelector("[width='600']");
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
  else document.body.appendChild(box);

  let filter = "todo";
  const $ = (s) => box.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const img = (id, lv) => `https://images.neopets.com/trophies/${id}_${lv}.gif`;

  const pass = (i) => {
    const showDead = $(".tg-dead").checked;
    if (!showDead && (i.cat === "retired" || i.cat === "pvp") && !i.best) return false;
    const q = $("input[type=search]").value.trim().toLowerCase();
    if (q && !i.name.toLowerCase().includes(q)) return false;
    switch (filter) {
      case "todo": return i.status !== "done";
      case "easy": return i.easy && i.status !== "done";
      case "missing": return i.status === "missing";
      case "upgrade": return i.status === "upgrade";
      case "have": return !!i.best;
      default: return true;
    }
  };

  function card(i) {
    const top = Math.min(...i.lvs);
    const showLv = i.best || Math.max(...i.lvs);
    let st;
    if (i.status === "missing") st = `<span class="miss">還沒拿</span>`;
    else if (i.status === "upgrade") st = `<span class="up">已拿 ${LV[i.best] || i.best}，還能升到 ${LV[top]}</span>`;
    else st = `<span class="ok">已拿 ${i.lvs.length > 1 ? LV[i.best] : ""}✓</span>`;
    const lvTxt = i.lvs.length > 1 ? `（有 ${i.lvs.slice().sort((a, b) => b - a).map((l) => LV[l] || l).join("、")}）` : "";
    const cond = i.info.cond || RULE[i.cat] || "";
    const links = [];
    const dead = i.cat === "retired" || i.cat === "pvp";
    if (!dead && !i.info.noplay) links.push(`<a href="${i.info.play || game(i.id)}" target="_blank" rel="noopener">去玩</a>`);
    if (i.cat !== "spot" && i.cat !== "pvp") links.push(`<a href="${scores(i.id)}" target="_blank" rel="noopener">高分榜</a>`);
    links.push(`<a href="https://www.google.com/search?q=${encodeURIComponent('neopets "' + i.name + '" trophy')}" target="_blank" rel="noopener">攻略</a>`);
    return `<div class="tg-c ${i.status}">
      <div class="tg-top"><img src="${img(i.id, showLv)}" class="${i.best ? "" : "dim"}" alt="" loading="lazy">
        <div><div class="tg-name">${esc(i.name)}${i.easy ? '<span class="tg-easy">好拿</span>' : ""}</div>
        <div class="tg-st">${st} <span style="color:var(--tg-mute)">${lvTxt}</span></div></div></div>
      <div class="tg-cond">${esc(cond)}</div>
      <div class="tg-links">${links.join("")}</div></div>`;
  }

  function render() {
    const out = [];
    for (const [cat, title] of DATA) {
      const list = items.filter((i) => i.cat === cat && pass(i));
      if (!list.length) continue;
      list.sort((a, b) => (b.easy - a.easy) || a.name.localeCompare(b.name));
      const have = items.filter((i) => i.cat === cat && i.best).length;
      const total = items.filter((i) => i.cat === cat).length;
      const open = cat !== "retired" && cat !== "pvp" && (cat !== "flash" || filter !== "todo" || $("input[type=search]").value);
      out.push(`<details ${open ? "open" : ""}><summary>${esc(title)} <small>（顯示 ${list.length} 個｜這類已拿 ${have}/${total}）</small></summary>
        ${RULE[cat] && cat !== "easy" ? `<div class="tg-rule">${esc(RULE[cat])}</div>` : ""}
        <div class="tg-grid">${list.map(card).join("")}</div></details>`);
    }
    $(".tg-list").innerHTML = out.join("") || `<div class="tg-empty">沒有符合的獎盃。</div>`;
  }

  box.querySelectorAll(".tg-bar button").forEach((b) => (b.onclick = () => {
    filter = b.dataset.f;
    box.querySelectorAll(".tg-bar button").forEach((x) => x.classList.toggle("on", x === b));
    render();
  }));
  $("input[type=search]").addEventListener("input", render);
  $(".tg-dead").addEventListener("change", render);
  render();
})();
