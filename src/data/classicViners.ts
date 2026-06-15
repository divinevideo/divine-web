// ABOUTME: Static data for Classic Viners to avoid slow API calls
// ABOUTME: This data is precomputed and bundled with the app for instant loading

export interface StaticViner {
  pubkey: string;
  name: string;
  picture: string;
  totalLoops: number;
  videoCount: number;
}

/**
 * Top Classic Viners by total loop count
 *
 * This static data eliminates the need for:
 * 1. Calling the /api/viners endpoint (which returns 404)
 * 2. Falling back to fetching 100 videos and computing viners
 *
 * Data last updated: 2026-01-29
 * Source: Computed from relay.divine.video/api/videos?classic=true (3100 videos, 56 unique viners)
 */
export const CLASSIC_VINERS: StaticViner[] = [
  {
    pubkey: "81acbb70475b8b715c38d072ce93769ca275783d187990117ec0c01ea849bf95",
    name: "KingBach",
    picture: "https://storage.googleapis.com/divine-vine-archive/avatars/93/49/934940633704046592.jpg",
    totalLoops: 19037036884,
    videoCount: 372
  },
  {
    pubkey: "2338dd3cf958723782f85c22fddd863ef3ae49ea5277c076450281f5e66f4b4e",
    name: "EhBee.TV",
    picture: "https://media.divine.video/2521611542ef5b08aaeba5d0142d8c6e4299d49321e095685022cfca6dd7ba27",
    totalLoops: 9185994958,
    videoCount: 124
  },
  {
    pubkey: "6612831d4adb8ffc44331c1eb4e056bac9a94ee39cd9b6189249652dd21173fd",
    name: "instagram @katieryan430",
    picture: "https://media.divine.video/d5347fc668f2ebb89824e3cd4444c15fd85cd8e08029799e126bf87344991ab9",
    totalLoops: 7594003350,
    videoCount: 93
  },
  {
    pubkey: "85ae6817b2e860c678fcd7692cb1142bfb0f3b11ea21ba5b85a93cafb2e49332",
    name: "Twitter: @AFVOfficial",
    picture: "https://media.divine.video/0cd5f5fc417879dc563637c433e9d9a4867f5f94982430352a36a1964e3522e4",
    totalLoops: 6076649760,
    videoCount: 93
  },
  {
    pubkey: "bace60e0467300d2e1edf1e81d963c11d2a1d6d7bd4daf70ba1e5d5c8b0546ef",
    name: "Anwar Jibawi",
    picture: "https://media.divine.video/5f1ac1c8fc5dfd131122c80b0c78f63c27140d77a53ee9e71dcda033e33fb387",
    totalLoops: 6028764680,
    videoCount: 124
  },
  {
    pubkey: "60068fbead97d5fe3d5c98b1df4021b30ab0ee6aad5539ebec0f0e152a80259d",
    name: "Trench (IG @AcousticTrench)",
    picture: "https://media.divine.video/20ceff935e1edd7a5298f387652f7e49bd124e9958352019920542f432996331",
    totalLoops: 5470439180,
    videoCount: 93
  },
  {
    pubkey: "701c877d97718839121058dcb8ec563325a2d64e6d2b5b40a01a197513522bcb",
    name: "Logan Paul",
    picture: "https://media.divine.video/129b88be1fcc82a5448b590fd6785eeef6e73aeecd5a5b99f829ca14734ad587",
    totalLoops: 4961140149,
    videoCount: 93
  },
  {
    pubkey: "0339968951cc0ca3e98957af88322ac7c9a2972b961203a8df74ba7b9c372c12",
    name: "Rudy Mancuso",
    picture: "https://media.divine.video/fab015a2145aed738e5d23b1b71f162aa8dbd8bd98bf95ed63b1b92130cdf2b2",
    totalLoops: 4944361585,
    videoCount: 93
  },
  {
    pubkey: "5d334682a26ff56ae99186d29d3f4650b304f3a49ea5f00129ae2cf5a82cefec",
    name: "lmao jack (ig: @jack.wmv)",
    picture: "https://media.divine.video/6492fc13a9ac981bfbed789fc280f3c4e6133f60f28e284761f19bbc2811eda0",
    totalLoops: 4841792381,
    videoCount: 93
  },
  {
    pubkey: "8b33c201fc25926cb0f50d8fc8ae590ee628b49ecea2776c353949d1ea920946",
    name: "Insta: @RyanPernofski",
    picture: "https://media.divine.video/382356854086eab1faf23e8c9602dcad50bce5c99a731208964db5eb8e9dbd6e",
    totalLoops: 4740361032,
    videoCount: 93
  },
  {
    pubkey: "7c8e036b6797d8268427c046f03151e3794c23d5d203007ff870f810388d327d",
    name: "WEIRD Vidz",
    picture: "https://media.divine.video/80bcf0919ed5bb345b0885db3f00271c70deeebf94c24d5b5287e93d6a904945",
    totalLoops: 4423671046,
    videoCount: 62
  },
  {
    pubkey: "f9a79374fcf899b66fdd1e8f66c1990d592851d607fd141be3922c8ba4dd44d9",
    name: "Instagram: @Purpdrank",
    picture: "https://media.divine.video/7d49e97d39d23a7c4ef2c100c422b929d21fa0eee60dd7b345926316c38e7022",
    totalLoops: 4134181173,
    videoCount: 93
  },
  {
    pubkey: "8094b09fd8612645ba730b250c81e7a84faded244e7549f91784d22d4015f13f",
    name: "IG: @SamuelGrubbs",
    picture: "https://media.divine.video/0f9bf83f31fc12dacdcae71d467595cf723f16ed1e4a76ca4b9ee4a18b46f40f",
    totalLoops: 4059857123,
    videoCount: 62
  },
  {
    pubkey: "78709b22f8c6652a06b771154efa7a0d7d2ce2eab1b692b2dbf247a06d4331f3",
    name: "4everkelz",
    picture: "https://media.divine.video/5e5db4895951bc599698168cffae61ed1baa5673626259e1c1d2b8bab032885f",
    totalLoops: 4056915967,
    videoCount: 62
  },
  {
    pubkey: "93f8e0a6cb4220a19112c20fb5b0ab29f4d7d2efeeaa538c15bef71c0f9452f1",
    name: "its just luke",
    picture: "/user-avatar.png",
    totalLoops: 3725077242,
    videoCount: 62
  },
  {
    pubkey: "6e0f5188eac64e8e00166c1b285bfc27af8ddd873c540942d656405c46dd5ed8",
    name: "Lele Pons",
    picture: "https://storage.googleapis.com/divine-vine-archive/avatars/93/14/931427884873170944.jpg",
    totalLoops: 3507611963,
    videoCount: 93
  },
  {
    pubkey: "c821ebd9bfbc6bba292589b7fa3fdc89168fae3a45bc4ea46040b68594927166",
    name: "nick mastodon",
    picture: "https://media.divine.video/57bda34668d9331874979204a52feda3822fe28680afb544cf234461f9aa0df6",
    totalLoops: 3478047635,
    videoCount: 62
  },
  {
    pubkey: "49b779887fa2b2a3c1c82f9e07e279d58a61d946d10e4c1560bccbee6bb04d44",
    name: "Brittany Furlan",
    picture: "https://media.divine.video/950b59e937d922cdb2ae9fd1220fae32c5fb160148af06e90ca124e0f31e5c7d",
    totalLoops: 3191502545,
    videoCount: 31
  },
  {
    pubkey: "edb803082fc43fb2bbc4a36f62a85debf5d88231880a1594f80d2e5cf951ac65",
    name: "Christine Sydelko",
    picture: "https://storage.googleapis.com/divine-vine-archive/avatars/91/00/910070265105485824.jpg",
    totalLoops: 3143035781,
    videoCount: 31
  },
  {
    pubkey: "c1cdd30cbba527363198a507ebef8d44b4ad1178be4a9c534005b35715e8857a",
    name: "Nick Colletti",
    picture: "https://media.divine.video/1c840057f2de449adbc0501cf957274d06908b2439e19862a6b42863792f3826",
    totalLoops: 2791864526,
    videoCount: 62
  },
  {
    pubkey: "285d761cfbb3d8ae2fb1328d2ed3f62e6a28ab229801523f2b34366742f8386b",
    name: "IG: @CurtisLepore",
    picture: "https://media.divine.video/8daec1c4c9822e8909a3eade0c4a5e7b0dadebb20340a906bd97f293869f8a8d",
    totalLoops: 2679635660,
    videoCount: 62
  },
  {
    pubkey: "1680baa3d62bfb4c1f47627049f24dd15598a8abf5c39a558eb992b48cc7fc40",
    name: "@hemtube 's cat",
    picture: "https://media.divine.video/dc84998d4230c6a28c16b57d63b7e93d364fbdd550e1947693c5304a076f6a66",
    totalLoops: 2664183741,
    videoCount: 31
  },
  {
    pubkey: "27ba170a2b6217c37ba9dbcb639976c6229abeefd1bfb8ec826c944f51072cde",
    name: "RiFF RAFF ",
    picture: "https://media.divine.video/88452fbe3e33ce4c31a2b39bca1f3fe1a61c60e12ab22781349d7e7046f4a823",
    totalLoops: 2622097273,
    videoCount: 62
  },
  {
    pubkey: "9dc2e8ccc45e9a72524d59cf8131b79b7e18d5f9e9bf9681460a48ab60c7dfda",
    name: "Mightyduck",
    picture: "https://media.divine.video/83fd1643e8467a842064de472c66c04b1fe72fc53996cc2a217a69c6f6e8214e",
    totalLoops: 2567864602,
    videoCount: 31
  },
  {
    pubkey: "5b691899acad0ad586ef543e687523fe159038bca823f109b3362c7cb3c735da",
    name: "Instagram: Victorpopejr",
    picture: "https://media.divine.video/9350d0ac7088416fc46b27d91258e4bcdd8cba7bee90d2f41b185136c3df6a33",
    totalLoops: 2444479549,
    videoCount: 62
  },
  {
    pubkey: "17c9d8a2b4044c743da753e6a62d9d1229e0616394506dbad9ac7cbc6ec75d55",
    name: "MTV",
    picture: "https://media.divine.video/9eaee309f4a13ad30ef4d65e3513d0f219d5e0c7b53718776f55a8990ec62da5",
    totalLoops: 2393588399,
    videoCount: 31
  },
  {
    pubkey: "0e13b9fa7a5fd25aa0ae7c0c41e967fa5db1c9886b5c9090d00564ca690712fb",
    name: "Parker Kit Hill",
    picture: "https://storage.googleapis.com/divine-vine-archive/avatars/91/38/913899469181956096.jpg",
    totalLoops: 2263051243,
    videoCount: 31
  },
  {
    pubkey: "a39f3df916f089a82758a6cccadfd83096031a94fe535ebf296ac8b5fbac4d88",
    name: "aswad",
    picture: "https://media.divine.video/3a0fe97d7860548def762098c327d424ff9722a26e154282cfc1851830537d54",
    totalLoops: 2243484477,
    videoCount: 31
  },
  {
    pubkey: "e5248c78e0a5091dab82e13cf3ec152eaae365b473947ad85b2df5259a92deb5",
    name: "IG: @austingeter",
    picture: "https://media.divine.video/79076716172ed49a9f5ceda911ae19672791504856de34ed8e307cbbd0aad00a",
    totalLoops: 2174477795,
    videoCount: 31
  },
  {
    pubkey: "c037488dbedf20505b24f211c9fcff9852f24b314f36ac30e744c6a4f6924780",
    name: "JÉRÔME JARRE",
    picture: "https://media.divine.video/f97f2a3071dfd221a8bf35d7cf2a20245e085000dcb5069ba34ecf989b2da6b7",
    totalLoops: 1943009072,
    videoCount: 31
  },
  {
    pubkey: "6c7c48d7f7ea4250bd5225f55df25121032c473757b689f96e5794d53158d213",
    name: "GOLF",
    picture: "https://media.divine.video/577e6e5214ec5d42c6c812a8d06998b05a947d23057630a3764b8b648fdcf8ff",
    totalLoops: 1942354693,
    videoCount: 31
  },
  {
    pubkey: "4e84031c30128510ee4b5cc9d57448e9d1290df731dd82a5edca1523bad3e64f",
    name: "Watch This: GasStation Vines",
    picture: "https://vines.s3.amazonaws.com/r/avatars/3E3263BDBB1258974782951972864_3c24907b6ab.4.6.jpg?versionId=xfi295DrXOZ52Z_J3eneHitp_dLKvvU7",
    totalLoops: 1923215882,
    videoCount: 31
  },
  {
    pubkey: "d1b836db8956815b887bd031f046e6734b633b07a966d128d7b1132c4aa350a9",
    name: "IG: DannyGonzalez",
    picture: "https://media.divine.video/680c6d732156f557b7e54bf52136ce265de6905c06fccb2b386fcd256e4a6a32",
    totalLoops: 1827683058,
    videoCount: 31
  },
  {
    pubkey: "45d2c9756443fb2100d4fd0b3a4705e4fd10f92860ac237564815821a73af5c4",
    name: "Dank Memes",
    picture: "https://media.divine.video/9a11bdbf94a23b1818a9d342abc9dcfc461979cb53693df9a41b1e41200bc7e9",
    totalLoops: 1816026531,
    videoCount: 31
  },
  {
    pubkey: "1482f9cbf1f2918c961329ea4f6ef1aac7151b0c758f0555b3255d30d62d4e9d",
    name: "liza koshy",
    picture: "https://media.divine.video/2d273eb064bd21e502a6eab45290cd4f28c363c240b0a126b90f2a1053c5d949",
    totalLoops: 1642772894,
    videoCount: 31
  },
  {
    pubkey: "8a1d2cc1ea4c19fea6b884899fe931882541c0c5b49a1c31e2c9d304ad327b92",
    name: "IG: @Christian",
    picture: "https://media.divine.video/c0a4171486d5d22a6d95a6a00d2c0dbd3b49a9914a0e0ae1049e73e6dfbd25ad",
    totalLoops: 1539258624,
    videoCount: 31
  },
  {
    pubkey: "21bfa49a1f012e9c865afb035a0c514cf39b3b378160300bbb1d938d5d1c883f",
    name: "INSTAGRAM: MattCutshall",
    picture: "https://media.divine.video/754e4c5605a6017036de868e5fa77a5f65adc9f2802351d54f88f9cd5015e2fd",
    totalLoops: 1467384380,
    videoCount: 31
  },
  {
    pubkey: "9201d0627dc393d676ae65c29d557753e9f77a05fc44bb996145c40090743d6b",
    name: "goofys",
    picture: "https://v.cdn.vine.co/r/avatars/1A4817461D1204547371103830016_3076616c726.3.0.jpg?versionId=fUWOOK214rP2sGsulds4uoveChC7TtZI",
    totalLoops: 1439732256,
    videoCount: 31
  },
  {
    pubkey: "66fdff9699d5bf6448a7c42dd8ece4292364d8d3871dba6b11c0cfab9c221bff",
    name: "nut",
    picture: "https://storage.googleapis.com/divine-vine-archive/avatars/92/33/923341446508056576.jpg",
    totalLoops: 1402776009,
    videoCount: 31
  },
  {
    pubkey: "01c0adb6db2f0a5f6c03d8bd0473cc15c1cc8f71e9eae257af1598bd45ef48b6",
    name: "IG @mikaelallong",
    picture: "https://media.divine.video/ce41bb02294355b93aaa288ab76bea64564be1b124682a5bb5964eeb45602cf5",
    totalLoops: 1402483493,
    videoCount: 31
  },
  {
    pubkey: "d4434e0c63358d02167333c00fc9593e11e81f982b82d542a8db026ec4b11288",
    name: "Brisk God (IG: the.brisk.god)",
    picture: "https://storage.googleapis.com/divine-vine-archive/avatars/10/20/1020980325196918784.jpg",
    totalLoops: 1395415462,
    videoCount: 31
  },
  {
    pubkey: "34ff4707a624baff6b6e944991470aa1bb2f5ab85c1395e382120e568576aa89",
    name: "Zach King",
    picture: "https://media.divine.video/174eaade6a2e5dd411aa6e97cf0ae9c2816929e78d43224b79c911d94af59e23",
    totalLoops: 1375511230,
    videoCount: 31
  },
  {
    pubkey: "58be33389c08d4f407238357489e3f06ef5a3a12f5c6ae815292c766c2cdc87f",
    name: "Zachary Piona",
    picture: "https://media.divine.video/9e2cb318cb44ff81aa8a10109177519dd1924dcbf51449199682575c02428039",
    totalLoops: 1318490109,
    videoCount: 31
  },
  {
    pubkey: "9e00b0acaee85a26b5581153b38a0fd92cbd5c1bbd1c6300c34e4686735e34ac",
    name: "JAY VERSACE",
    picture: "https://media.divine.video/b7d81d3ee9a7858f5a0e8a9768544bac627faaa3008128703f7873c3d6cf3239",
    totalLoops: 1290255712,
    videoCount: 31
  },
  {
    pubkey: "288e38ab1e81f1de3af39626b5dae3b460de42d9eceb86d8bd4590ff1a4326af",
    name: "Gustavo Vega",
    picture: "/user-avatar.png",
    totalLoops: 1275183574,
    videoCount: 31
  },
  {
    pubkey: "c0dbc39c98d4d6d83a5f452c6b70d28901e0616776a1d7c76dfd7635ecb7671b",
    name: "Nash Grier",
    picture: "https://media.divine.video/eb2cb6f441b6acb05f789a30505613f7417e3773c33ffb124241e4efd20cba47",
    totalLoops: 1260234196,
    videoCount: 31
  },
  {
    pubkey: "f6c078bcec65120eecee3c0bc2abd67bc1597c0393d5c28f24d8105ed1b8bb46",
    name: "michael k (ig: michaelkedits)",
    picture: "https://media.divine.video/1a2f64b625b1366c18b2c1926fa93512ef8795494eed5096391d7e9577a46a84",
    totalLoops: 1257549906,
    videoCount: 31
  },
  {
    pubkey: "8a203b83eda37db6e41adb48a51bdd2c74764fa08edee58e4fd2d05152a0b550",
    name: "The Funny Vine",
    picture: "https://media.divine.video/f13b100d28a2482c700abb60621ffaa279c4df8986c0294d0ae0807032fdd112",
    totalLoops: 1255721495,
    videoCount: 31
  },
  {
    pubkey: "190e9d42fabc5092448fde66f8b2150f8696d0ae4291c25eff4c36b78cc45abd",
    name: "The LAD Bible",
    picture: "https://media.divine.video/9eaee309f4a13ad30ef4d65e3513d0f219d5e0c7b53718776f55a8990ec62da5",
    totalLoops: 1255580011,
    videoCount: 31
  },
  {
    pubkey: "a06dd849d3174e23ab3a436ba12e37c5fe1e81e4a548b7febff6e5913db9fcd4",
    name: "IG: @drewochsner",
    picture: "/user-avatar.png",
    totalLoops: 1235745653,
    videoCount: 31
  },
  {
    pubkey: "4c5141daaefc4e79f9c03c85c1ff02cb47f273adf36e729d8c6bc4580dec1608",
    name: "House of Highlights (Official)",
    picture: "https://media.divine.video/a678769aa4ade6f276a7ad5ad4b4a8da8aae80426dabe5220b7ec2951e1019a7",
    totalLoops: 1193942866,
    videoCount: 31
  },
  {
    pubkey: "53c149bd858c7574ebf269c8173899698fe787c247a1ce54f7193943ce7d786f",
    name: "FailArmy",
    picture: "https://media.divine.video/59ba7bbd9925b6968758ffbbe4e337a9aad436dbfaeb49dd15631d21ce6ffac2",
    totalLoops: 1183995865,
    videoCount: 31
  },
  {
    pubkey: "82f725a4feb69dcec855d6e5e7bd5a72b10d1a8788594014e2fab5254d2fb78f",
    name: "youtube: LAturtle",
    picture: "https://media.divine.video/8d2c4ded2d3a489b8e501409839f33bf0e089f1fdd954737af3a9b860c509c0a",
    totalLoops: 1171525619,
    videoCount: 31
  },
  {
    pubkey: "dfbf31d0d4daa700b114664f2d3940e2207fc5fde22363dc303d433f34c89666",
    name: "World Star Funny",
    picture: "https://media.divine.video/5a73c0d03f5363ea61aff929aac601e8a8a69439f096caa1f060833b1f2b94f0",
    totalLoops: 1167511894,
    videoCount: 31
  },
  {
    pubkey: "422571214be487a7f9b6c28b4c4f6de1ec5ce2e96f3aab9caf98e9c70a587f88",
    name: "Chest-Bump",
    picture: "/user-avatar.png",
    totalLoops: 1147853585,
    videoCount: 31
  },
  {
    pubkey: "cad3dd46958b1463e64e46644d7480977afe3f2ba88ac184be8cec5c779f10b3",
    name: "Senan Byrne",
    picture: "https://media.divine.video/7983f6a38b98b95ced77ed4a54d5239048ae95a999ea649ed03e3f2ef2859649",
    totalLoops: 1139976082,
    videoCount: 31
  }
];

/**
 * Get avatar URLs for preloading
 */
export const CLASSIC_VINER_AVATARS = CLASSIC_VINERS.map(v => v.picture).filter(p => p && !p.endsWith('.png'));
