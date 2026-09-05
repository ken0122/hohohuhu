import { characterText } from "./character-draft.js";
import { validateCharacterProfile } from "./character-profile.js";

const COMMON = {
  "zh-CN": { reactions:["摸摸头真舒服","好痒呀！","别戳肚肚啦","再抱一下","贴贴～","我在这里！","有点害羞…"], near:["你来啦","再陪我一会儿"], idle:["看看四周…","伸个懒腰","呼噜…","晃呀晃～"] },
  "zh-TW": { reactions:["摸摸頭真舒服","好癢呀！","別戳肚肚啦","再抱一下","貼貼～","我在這裡！","有點害羞…"], near:["你來啦","再陪我一會兒"], idle:["看看四周…","伸個懶腰","呼嚕…","晃呀晃～"] },
  en: { reactions:["That head pat feels nice","Hehe, that tickles!","Hey, don’t poke my belly","One more cuddle","Snuggle time","I’m right here!","A little shy…"], near:["You’re here","Stay a little longer"], idle:["Looking around…","A little stretch","Purr…","Swaying gently"] },
  ja: { reactions:["なでなで、気持ちいい","わっ、くすぐったい！","おなかをつつかないで","もう少し抱っこ","すりすり～","ここにいるよ！","ちょっと照れる…"], near:["来てくれたね","もう少し一緒にいて"], idle:["きょろきょろ…","のびをしよう","ごろごろ…","ゆらゆら～"] },
  fr: { reactions:["J’aime cette caresse","Hé, ça chatouille !","Pas le ventre !","Encore un câlin","Tout contre toi","Je suis là !","Un peu timide…"], near:["Te voilà","Reste encore un peu"], idle:["Je regarde…","Un petit étirement","Ronron…","Je me balance"] },
  de: { reactions:["Das Streicheln tut gut","He, das kitzelt!","Nicht in den Bauch stupsen","Noch eine Umarmung","Ganz nah bei dir","Ich bin hier!","Etwas schüchtern…"], near:["Du bist da","Bleib noch ein wenig"], idle:["Ich schaue mich um…","Kurz strecken","Schnurr…","Sanft hin und her"] },
  ru: { reactions:["Гладить так приятно","Ой, щекотно!","Не тыкай в животик","Ещё обнимашку","Прижмусь к тебе","Я здесь!","Немного стесняюсь…"], near:["Ты пришёл","Побудь ещё немного"], idle:["Осмотрюсь…","Немного потянусь","Мур…","Качаюсь тихонько"] },
};

const SPECIAL = {
  "blue-one-eye": {
    "zh-TW":["住在桌面上的藍色單眼小寵物","乖巧親暱，稍微害羞，偶爾撒嬌。",["乖巧","親暱","害羞"],"只給你看的眨眼","連續摸頭三次，會悄悄眨兩次眼。","這個只給你看"],
    en:["A blue one-eyed desktop pet","Sweet, affectionate and a little shy.",["sweet","affectionate","shy"],"A blink just for you","Three quick head pats reveal a secret double blink.","This one is just for you"],
    ja:["デスクトップに住む青い一つ目のペット","素直で甘えん坊、少し恥ずかしがり。",["素直","甘えん坊","照れ屋"],"あなただけのまばたき","頭を続けて3回なでると、こっそり二度まばたき。","これはあなただけに"],
    fr:["Un petit compagnon bleu à un œil","Doux, affectueux et un peu timide.",["doux","affectueux","timide"],"Clin d’œil secret","Trois caresses révèlent un double clin d’œil.","Celui-ci est rien que pour toi"],
    de:["Ein blaues einäugiges Desktop-Tier","Lieb, anhänglich und etwas schüchtern.",["lieb","anhänglich","schüchtern"],"Geheimes Blinzeln","Dreimal streicheln löst ein geheimes Doppelblinzeln aus.","Das ist nur für dich"],
    ru:["Синий одноглазый питомец","Ласковый, добрый и немного застенчивый.",["добрый","ласковый","скромный"],"Моргание для тебя","Три поглаживания открывают двойное моргание.","Это только для тебя"],
  },
  "black-cat": {
    "zh-TW":["住在桌面上的黑貓","克制、警覺，有一點傲嬌。",["克制","警覺","傲嬌"],"被發現的在意","連續貼貼三次，會突然跳起來。","……被你發現了"],
    en:["A black cat living on your desktop","Reserved, alert and quietly caring.",["reserved","alert","proud"],"Caught caring","Three quick nuzzles reveal its secret affection.","…You noticed"],
    ja:["デスクトップに住む黒猫","慎重で警戒心があり、少しツンデレ。",["慎重","警戒","ツンデレ"],"見つかった本音","すりすりを3回すると、急に跳ねる。","…気づいたの？"],
    fr:["Un chat noir sur le bureau","Réservé, vigilant et secrètement tendre.",["réservé","vigilant","fier"],"Tendresse démasquée","Trois câlins révèlent son affection secrète.","…Tu as remarqué"],
    de:["Eine schwarze Desktop-Katze","Zurückhaltend, wachsam und heimlich fürsorglich.",["still","wachsam","stolz"],"Zuneigung entdeckt","Dreimal anschmiegen zeigt die geheime Zuneigung.","…Du hast es bemerkt"],
    ru:["Чёрный кот на рабочем столе","Сдержанный, бдительный и тайно заботливый.",["тихий","бдительный","гордый"],"Забота раскрыта","Три прикосновения выдают тайную привязанность.","…Ты заметил"],
  },
  "sunny-yellow": {
    "zh-TW":["像小太陽的黃色桌面玩偶","開朗熱情，喜歡輕快慶祝。",["開朗","熱情","愛慶祝"],"三連點亮","連續戳三次，會開心地閃跳兩下。","叮叮叮，今天也亮起來！"],
    en:["A little yellow desktop sun","Bright, warm and ready to celebrate.",["cheerful","warm","festive"],"Triple sparkle","Three quick pokes trigger a joyful double hop.","Ding ding ding—shine today!"],
    ja:["小さな太陽みたいな黄色い仲間","明るく元気で、お祝いが大好き。",["明るい","元気","お祝い好き"],"三連きらり","3回つつくと、うれしく二度跳ねる。","ピカピカ、今日も輝こう！"],
    fr:["Un petit soleil jaune sur le bureau","Joyeux, chaleureux et toujours prêt à fêter.",["joyeux","chaleureux","festif"],"Triple éclat","Trois petits tapotements déclenchent deux sauts joyeux.","Ding ding ding, on rayonne !"],
    de:["Eine kleine gelbe Desktop-Sonne","Fröhlich, warm und immer feierbereit.",["fröhlich","warm","festlich"],"Dreifaches Leuchten","Dreimal anstupsen löst zwei fröhliche Sprünge aus.","Kling, kling – heute leuchten wir!"],
    ru:["Жёлтый друг, похожий на маленькое солнце","Весёлый, тёплый и любит праздновать.",["весёлый","тёплый","яркий"],"Тройная искра","Три тычка вызывают два радостных прыжка.","Динь-динь — сияем сегодня!"],
  },
};

const INTENTS = ["headpat", "tickle", "poke", "cuddle", "nuzzle", "hop", "shy"];
export function localizedBuiltinProfile(id, base, locale) {
  const common = COMMON[locale], special = SPECIAL[id]?.[locale];
  if (!common || !special) return base;
  const reactions = Object.fromEntries(INTENTS.map((intent, index) => [intent, { ...base.reactions[intent], messages: [common.reactions[index]] }]));
  return validateCharacterProfile({
    persona: { ...base.persona, identity: special[0], summary: special[1], traits: special[2] },
    reactions,
    proximity: { enter: { ...base.proximity.enter, messages: [common.near[0]] }, dwell: { ...base.proximity.dwell, messages: [common.near[1]] } },
    idle: base.idle.map((item, index) => ({ ...item, messages: [common.idle[index]] })),
    easterEgg: { ...base.easterEgg, label: special[3], description: special[4], reaction: { ...base.easterEgg.reaction, messages: [special[5]] } },
  });
}

export function localizedCustomProfile(base, locale, analysis) {
  const common = COMMON[locale];
  if (!common) return validateCharacterProfile(base);
  const text = analysis ? characterText({ analysis: { ...analysis,
    dialogue: analysis.dialogue || Object.fromEntries(INTENTS.map(intent => [intent, base.reactions[intent].messages])),
    persona: analysis.persona || base.persona,
    easterEgg: analysis.easterEgg || { label: base.easterEgg.label, description: base.easterEgg.description, triggerIntent: base.easterEgg.trigger.intent, message: base.easterEgg.reaction.messages[0] },
  } }, locale).analysis : null;
  const reactions = Object.fromEntries(INTENTS.map((intent, index) => [intent, {
    ...base.reactions[intent],
    messages: text?.dialogue[intent] || base.reactions[intent].messages,
  }]));
  return validateCharacterProfile({
    ...base,
    persona: text?.persona || base.persona,
    reactions,
    proximity: { enter: { ...base.proximity.enter, messages: [common.near[0]] }, dwell: { ...base.proximity.dwell, messages: [common.near[1]] } },
    idle: base.idle.map((item, index) => ({ ...item, messages: [common.idle[index % common.idle.length]] })),
    easterEgg: { ...base.easterEgg, ...(text ? { label: text.easterEgg.label, description: text.easterEgg.description, trigger: { ...base.easterEgg.trigger, intent: text.easterEgg.triggerIntent } } : {}), reaction: { ...base.easterEgg.reaction, messages: text ? [text.easterEgg.message] : base.easterEgg.reaction.messages } },
  });
}
