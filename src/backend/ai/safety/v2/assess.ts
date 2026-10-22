/**
 * Beddy 2.0 — rule layer of the child-safety signal detector.
 *
 * Pure and deterministic (no I/O): runs on every chat message in a few
 * microseconds, before the LLM reply starts streaming. An optional LLM review
 * (llm-review.ts) may raise — never lower — the level for ambiguous messages.
 *
 * Design notes
 * - Hospital context first: "주사 맞았어" is not violence, "죽 먹기 싫어" is food,
 *   "치료 끝내고 싶어" is wanting to go home.
 * - Benign readings are explicit suppressors (hyperbole, game/media, education,
 *   negation, someone else's words) so false alarms to guardians stay rare.
 * - Laughter (ㅋㅋ) never cancels a direct wish to die on its own; children use it
 *   to soften real distress. Only a clear hyperbole construction does.
 * - Earlier messages in the conversation can raise an ambiguous message
 *   ("그냥 다 그만하고 싶어" after "어차피 안 나을 거야").
 */
import { normalizeMessage, type NormalizedText } from "./normalize";
import {
  LEVEL_RANK,
  type SafetyAssessment,
  type SafetyInput,
  type SafetyLevel,
  type SignalCategory,
  type Suppressor,
} from "./types";

type CrisisLevel = Exclude<SafetyLevel, "protect">;

interface Hit {
  rule: string;
  category: SignalCategory;
  level: CrisisLevel;
}

// ── Lexicon ─────────────────────────────────────────────────────────────────

/** Death-wish core on the compact view: 죽고싶 / 쥭고십 / 주꼬싶 / 죽구시퍼 … */
const DIE_WISH =
  /(죽|쥭)(고|구|꼬)(싶|십|시퍼|시프|쉽|싶)|주꼬(싶|십|시퍼)|(뒤지|디지|뒈지)(고)?(싶|십|시퍼)|죽어?버(리고싶|리고십|리고시퍼|릴래|릴까|리려고|릴거|릴꺼|리면좋겠)|죽는게(나아|나을|낫|편해|편할|좋을)|죽는편이|죽어야(돼|겠|할까)|(내가|나는|난|나)죽었으면좋겠|죽(으면|는다면)(편할|편하|좋겠|끝나|안아프)|죽어도(상관없|괜찮아|돼|아무렇지)|죽게(내버려|놔둬|둬|해줘)|unalive/;

/** "죽을래" as a statement (not the playground threat "죽을래?"). */
const DIE_STATEMENT =
  /(나|난|그냥|진짜|확)\s?죽을래(?!\s*\?)|(나|난|그냥|진짜|오늘|이제|확|내일|곧)[가-힣\s]{0,6}죽을\s?(거야|거임|꺼야|게|거다|거예요)/;

const SUICIDE_WORD =
  /자살(?!\s?(골|률|예방|방지|이라는|이란|이 뭐|의 뜻|뜻|사건|기사|뉴스))|ㅈㅅ\s?(하고\s?싶|할래|할까|할\s?거|각|생각|충동|마렵|ㄱㄱ)|ㅈㄱㅅ[ㄷㅇㅍ]|자\s살(?=\s?(하고|할래|할까|생각|충동|각|시도))/;

const SUICIDE_PHRASE =
  /극단적(인)?선택|목숨(을)?끊|생(을)?마감|스스로목숨|세상(을)?떠나고싶|kill ?myself|\bkms\b|want(ed)? to die|wanna die|suicid|end my life/;

const SELF_HARM =
  /자해(?!\s?(예방|방지|교육|라는|란|뜻|에 대해|하지 말라))|손목(을)?(긋|그어|그을|그었|긋고)|(팔|다리|허벅지)(을|를)?(긋|그어|그을|그었)|상처(를)?(내|낼)(고싶|고십|래|까|버리|고)|(손목|팔|다리|허벅지|몸)에상처(를)?(냈|내고|내)|일부러(나를|날|내몸|몸)?(을|를|에)?(다치|해치)|(나를|날|내몸을|스스로를?)(다치게하|해치)|머리(를)?(박|찧)(고싶|고십|을래|고)|self ?-?harm|cut myself/;

/** Indirect / euphemistic wishes to stop existing. */
const INDIRECT =
  /(사라지|없어지|없어져버리)(고싶|고십|고시퍼|고파|고만싶|면좋겠)|(사라|없어)졌으면좋겠|안깨(어나|어났|났|었)?(으면|면)좋겠|안깼으면|깨어나지(않|말)(았으면|기를|았음|았으)|영원히(잠들|자고싶|눈감|쉬고싶|편해지)|편해지고싶[가-힣]{0,3}영원히|(다|모든걸|모든것|인생|삶|내삶)끝내(버리|고싶|고십|버릴|고파|자)|끝내버리(고싶|고십|ㄹ래|릴래)|그만살(고싶|래|까)|살기(가)?싫|살고싶지(가)?않|더(는|이상)?살고싶지|살(아서|아)?뭐해|살이유(가)?없|살가치(가)?없|왜살아야|사는게무슨의미|(사는게|살아서|삶이|삶은|인생이|사는것)[가-힣]{0,3}(의미|소용)(가|이)?없|(태어나지|태어나지를)(말았|않았|말걸|말았어야)|안태어났으면|차라리태어나|(하늘나라|천국)[가-힣]{0,12}(가고싶|가고십|갈래|가고파|가고시퍼|가면좋겠|빨리가)|별이되고싶|놓아버리(고싶|고십|고파)|다놓고싶|없어져도(돼|된다|괜찮|상관없)|내가죽으면[가-힣]{0,10}(덜|편|좋|행복|나아)/;

/** Self as the subject of "없는 게 낫다 / 없어지면 편하다 / 없어도 모른다". */
const SELF_ABSENCE =
  /나만없으면|차라리없는게(나아|나을|낫|좋)|(내가|나는|난|나)[가-힣]{0,10}(없는게|없으면|없어지면|사라지면)[가-힣]{0,10}(나아|나을|낫|좋|편하|편할|행복)|(나|내가|난)[가-힣]{0,3}없어도[가-힣]{0,6}(모를|모르|상관없|티안|아무렇지)|아무도[가-힣]{0,4}(나|내가)?없어도(모를|모르)/;

const FUTURE_INTENT =
  /(자살|자해)(할거|할꺼|할게|하러|해버릴거)|죽(을거야|을거임|을꺼야|을거다|어버릴거|어버릴꺼)|뛰어내릴(거|꺼|게)|끝낼(거야|꺼야|거임)/;

const INTENT_MARKERS =
  /(오늘|지금|이따|오늘밤|밤에|내일|곧|이번엔|진짜로|결심)[가-힣]{0,8}(죽을|죽어버릴|자살할|자해할|끝낼|뛰어내릴|목숨)|(유서|마지막인사|마지막편지|다들안녕|모두안녕|이제안녕|작별인사)|(죽는|자살|자해|죽을수있는|자살하는|안아프게죽는)(방법|법)|방법[가-힣]{0,4}(죽|자살|자해)|어떻게(하면)?(죽|자살)|(다|모두|이미)준비(했|해놨|해뒀|됐)|끝낼거야|끝낼래/;

const ACT_NOW =
  /(지금|방금|아까|조금전|막)[가-힣]{0,8}(그었|긋고있|긋는중|자해했|자해하는|자해중|피나|상처냈|뛰어내리려)|자해(하는)?중이|그었어|자해했어|(손목|팔|다리|허벅지)에상처(를)?냈/;

const PAST_MARKERS =
  /(예전|옛날|작년|재작년|한때|어릴때|초등학생때|그때는|한참전|전에는|전엔|예전엔|저번에|몇달전|몇년전)/;
const STILL_MARKERS = /(지금도|요즘도|아직도|여전히|요새도|또그래|다시그래)/;
const RECOVERED_MARKERS =
  /(지금은|요즘은|이제는|이젠|요샌|요새는)[가-힣]{0,6}(괜찮|안해|안그래|나아|아니|안들|좋아)/;

/** Means / places (S5). Strong ones are urgent on their own. */
const MEANS_STRONG =
  /뛰어내리(면|고싶|고십|ㄹ까|릴까|려고|려면|면어떻게|면죽)|(높은데|높은곳|건물|다리|옥상|창문)(에서)?(떨어지면|뛰어내|떨어져볼)|옥상(문|에문)?[가-힣]{0,6}(열려|열어|열리|잠겨|가는법|어떻게가|몇시까지)|약[가-힣]{0,4}(한꺼번에|많이|다|잔뜩|몽땅|한번에|왕창)[가-힣]{0,6}(먹으면|먹을|먹어버|삼키|먹어도죽)|약(을)?(모아(둔|뒀|놨|놓|두고|두는)|숨겨(둔|뒀|놨)|안먹고모아)|(끈|줄)[가-힣]{0,6}(목에|목을)|목(을)?매|(호흡기|산소줄|산소|링거|수액|주사줄|콧줄|관)[가-힣]{0,4}(떼면|빼면|뽑으면|끊으면|뽑아버리면)[가-힣]{0,6}(죽|어떻게돼|끝)/;
const MEANS_WEAK =
  /옥상[가-힣]{0,8}(올라가|가볼|갈수있|가고싶)|(칼|커터칼|면도칼|가위|끈|줄넘기줄)[가-힣]{0,6}(어디|있어|구할|찾|가져|숨겨)|창문[가-힣]{0,6}(열려|열수|안열려|열고)/;
const BENIGN_PLACE_PURPOSE =
  /(정원|바람|경치|구경|사진|산책|하늘보|노을|별보|햇빛|공기|꽃|놀이)/;

/** Hopelessness / perceived burden (S3). */
const HOPELESS =
  /어차피[가-힣]{0,8}(안나|못나|안낫|못낫|소용|죽|안될|안돼|끝|의미|그대로)|(나을|나아질|좋아질|낫을|나을것)(리가|리|수가|거라는|일이)?없|나아질기미|희망(이)?(없|안보|안생|따위)|(다|그냥|모든게|살아도|치료도|노력해도|아무리해도)(의미|소용)(가|이)?없|(평생|영영|계속|맨날)[가-힣]{0,6}(아플|아프기만|병원에(만)?있|못나가|못가|이럴|이대로|누워)|내가죽으면[가-힣]{0,8}(슬퍼|울|어떡|어떨|기억)|나때문에[가-힣]{0,10}(울|힘들|고생|아프|싸우|싸워|돈|일두|못자|지쳐|슬퍼|걱정)|(짐|짐덩어리|민폐|골칫거리|방해꾼)(만|이|가)?(되|돼|이야|이잖|인것|인거|같아|덩어리)|(다|전부|모두)내(탓|잘못)|(나같은|나같은건|난)[가-힣]{0,3}(쓸모없|필요없|있으나마나)|아무도나(를)?필요(로)?(없|안해)|(힘들|지쳐|괴로|우울|슬퍼|외로)[가-힣]{0,4}(죽을것같|죽을거같|죽겠|미치겠|죽을듯)/;

/** Treatment refusal (S4) — counts only with distress or resignation. */
const TREATMENT_REFUSAL =
  /(치료|항암|약|주사|수술|검사|재활|투석|수혈|입원|방사선)[가-힣]{0,5}(그만할|그만하|포기|안받|안할|안먹|안맞|받기싫|하기싫|먹기싫|맞기싫|거부|끊을|때려치|안하고싶|안받고싶)/;
const TREATMENT_MAJOR = /(치료|항암|수술|재활|투석|방사선|입원)/;
const RESIGNATION =
  /(어차피|소용|포기|지쳤|지쳐|더는|더이상|못하겠|못견디|못버티|그냥다|의미없|싫어죽|힘들어서|그만두고싶)/;

/** Loneliness (S8). */
const LONELY =
  /아무도[가-힣]{0,6}(안와|안찾|날안|나를안|나안|관심없|신경안|연락안|몰라|모르|이해못|안놀|안봐)|(다들|친구들|애들|반친구들|친구들도)[가-힣]{0,6}(나|날|나를)?[가-힣]{0,4}(잊|잊었|잊은|모른척|버렸|안놀아|따돌)|(혼자|외톨이|버려진)[가-힣]{0,3}(인것같|인거같|같아|느낌|기분|남겨진|남은것같)|외로(워|운|움|웠|와)|아무랑도(말|얘기)(안|못)/;

/** Abuse / violence disclosure (S6). */
const ABUSE_AGENT =
  "(아빠|엄마|새아빠|새엄마|계부|계모|삼촌|이모|고모|외삼촌|할아버지|할머니|형|오빠|누나|언니|선생님|쌤|어른|아저씨|아줌마|그사람|누가|걔네|걔|애들|친구들|선배|남친|코치|목사님|사람들)";
const ABUSE_VIOLENCE = new RegExp(
  `${ABUSE_AGENT}[가-힣]{0,10}(때리|때려|때렸|때림|팼|패고|패서|발로차|발로찼|밀쳤|밀어서|던졌|목(을)?졸|목조르|꼬집|머리채|가뒀|가둬|굶겼|굶겨|협박|죽여버린|죽인다|담뱃불|멍들게|침뱉|돈뺏|돈을뺏)`
);
const ABUSE_BULLY = new RegExp(
  `${ABUSE_AGENT}[가-힣]{0,8}(괴롭혀|괴롭히|괴롭혔|왕따시|따돌|협박해|겁줘|위협)`
);
const ABUSE_HIT_BY =
  /(한테|에게|이랑있으면)[가-힣]{0,4}(맞았|맞아|맞을|맞는|맞고|두들겨|혼나면서맞)/;
const ABUSE_HOME =
  /(집에서|맨날|매일|자꾸|또)[가-힣]{0,4}(맞아|맞았|맞는다|맞고|두들겨맞|매맞)|매(를)?맞/;
const ABUSE_SEXUAL =
  /(이상한|은밀한|중요한|싫은)(데|곳|부분|데를|곳을)[가-힣]{0,4}(만지|만졌|만져|보여|찍)|몸(을)?(만지|만졌|만져)[가-힣]{0,6}(싫|이상|비밀|자꾸|계속)|(자꾸|계속)[가-힣]{0,4}몸(을)?(만지|만져|만졌)|옷(을)?벗(기|으라|으래|겨)|(아무한테도|아무에게도|누구한테도|엄마한테)[가-힣]{0,3}(말하지마|말하지말|말하면안|비밀로)|(말하면|이르면|일러바치면)[가-힣]{0,6}(혼난|혼내|죽여|때린|가만안|큰일)|비밀로하(래|라고|자고|라)/;
const MEDICAL_HIT_OBJECTS =
  /(주사|링거|수액|백신|접종|항암|진통제|영양제|해열제|항생제|약|비|눈|바람|햇빛|답|정답|문제|퀴즈|점수|공에|공)/;

// ── Suppressors ─────────────────────────────────────────────────────────────

const HYPERBOLE_DEATH =
  /(배고프|배고파|졸려|졸리|심심|지루|웃겨|웃기|더워|덥|추워|춥|아파|아프|짜증|귀찮|피곤|부러워|설레|궁금|맛있|좋아|귀여|행복|미치|답답|간지러|무서워|배불러|배아파|목말라|떨려|긴장|힘들어|힘든)(서|어서|아서|해서|워서|여서)?(죽겠|죽을것같|죽을거같|죽는줄|죽을뻔|죽네|죽음|죽을듯|죽을지경|죽는다)|(죽는줄알|죽을뻔)|죽고싶(을|은|던)?(만큼|정도로|정도|듯이)[가-힣]{0,6}(웃|재밌|좋|부끄|창피|쪽팔|민망|맛있|행복|설레|귀여|기뻐)|(웃|재밌|좋|부끄|창피|쪽팔|민망|맛있|행복|설레|귀여|기뻐)[가-힣]{0,6}죽고싶(을|은|던)?(만큼|정도)|(부끄|창피|쪽팔|민망)[가-힣]{0,6}(죽고싶|죽겠|죽을)/;
/** Emotional exhaustion said as hyperbole — not "none", it is a watch signal. */
const DISTRESS_HYPERBOLE =
  /(힘들|지쳐|괴로|외로|우울|슬퍼)[가-힣]{0,4}(죽을것같|죽을거같|죽겠|죽을듯|미치겠)/;

const MEDIA =
  /(게임|캐릭터|보스|몬스터|좀비|롤에서|롤|배그|마크|마인크래프트|포켓몬|브롤|피파|오버워치|웹툰|드라마|영화|애니|만화|소설|주인공|등장인물|악당|유튜브|영상에서|챔피언|스킨|레벨|라운드|npc|체력|목숨이|목숨하나|부활|리스폰|좀비한테|공략|퀘스트|던전|판에서)/;
const EDUCATION =
  /(예방|교육|수업|뉴스|기사|캠페인|포스터|발표|숙제|생명존중|통계|자살률|뜻이|뜻은|이라는단어|단어뜻|강의|책에서|배웠|선생님이알려|상담선생님이말)/;
const THIRD_PARTY_SUBJECT =
  /(친구|걔|그애|반애|옆침대|옆자리|병실친구|언니|오빠|누나|형|동생|사촌|주인공|연예인|가수|배우|사람|아이돌|그사람|누가)/;
const REPORTED_SPEECH =
  /(죽고싶|자살|자해|사라지고싶|죽을|죽고)[가-힣]{0,6}(대|댔|다고|더라|래서|래|랬|한대|했대|하더라|했다던데|했다고|한다고|한다던데)(?![가-힣]{0,2}(싶|요))/;
const NEGATION =
  /(죽고싶|자살|자해|죽을|사라지고싶)[가-힣]{0,5}(은|는|진|지|건|거는|게)?(아니|않|없어|없는|안해|안한|안할|안했|안하고|안들어|안함)/;
const NEG_EXCEPTIONS = /(장난(이|은)?아니|농담(이|은)?아니|거짓말(이|은)?아니|아닌척|없지않|않을수없)/;
const ABSTINENCE = /(안한지|안한게|참은지|참고있|끊은지|안하고있|안하려고)[가-힣]{0,6}(일|주|달|개월|년|됐|되었|노력|버티)?/;
const NEG_TWIST = /(인데|지만|는데|데도)[가-힣]{0,4}(사실|그래도|자꾸|가끔|또)/;
const APOLOGY_CHOSUNG = /ㅈㅅ(?!\s?(하고\s?싶|할래|할까|할\s?거|각|생각|충동|마렵|ㄱㄱ))/;
const TASK_CONTEXT =
  /(숙제|공부|문제집|게임|시험|과제|퀘스트|미션|일기|그림|영상|책|청소|정리|수학|영어|학원)/;
const GRIEF = /(하늘나라|천국)[가-힣]{0,4}(가신|간|갔|가셨|계신|있는)/;

/** Short replies that only carry risk if the conversation was already risky. */
const AMBIGUOUS_CONTINUATION =
  /(그만하고싶|다그만|그만할래|그만할게|이제그만|포기할래|다포기|이제됐어|다필요없|지쳤어|더는못|못버티|못견디|끝내고싶|끝내버리고싶|그만두고싶|이제끝|다싫어)/;
const FAREWELL =
  /(미안해|고마웠어|고마웠|사랑해|잘있어|잘지내)[가-힣]{0,12}(그만할게|안녕|갈게|떠날게|끝낼게|먼저갈게)|(엄마|아빠|다들|모두)[가-힣]{0,4}안녕/;

/** Soft words that justify an LLM second look when rules decide "none". */
const SOFT_RISK =
  /(죽|사라|끝내|그만|없어지|살기|살고|자해|자살|힘들|지쳐|포기|희망|짐|아프|외로|무서|싫어|울고|울었|눈물)/;

// ── Helpers ─────────────────────────────────────────────────────────────────

function maxLevel(a: CrisisLevel, b: CrisisLevel): CrisisLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

function test(re: RegExp, value: string): boolean {
  re.lastIndex = 0;
  return re.test(value);
}

/** Remove benign compounds before risk matching, remembering why. */
function stripBenign(n: NormalizedText, suppressors: Set<Suppressor>): NormalizedText {
  let text = n.text;
  let compact = n.compact;
  const benignTokens: Array<[RegExp, Suppressor]> = [
    [/자살\s?골/g, "media"],
    [/(자살|자해)\s?(예방|방지)/g, "education"],
    [/자살\s?률/g, "education"],
    [/생명\s?존중/g, "education"],
  ];
  for (const [re, why] of benignTokens) {
    if (re.test(text) || re.test(compact)) {
      suppressors.add(why);
      text = text.replace(re, " ");
      compact = compact.replace(re, "");
    }
  }
  return { raw: n.raw, text, compact };
}

interface Scan {
  hits: Hit[];
  suppressors: Set<Suppressor>;
  thirdParty: boolean;
  abuse: boolean;
  intent: boolean;
  actNow: boolean;
  hyperbole: boolean;
}

function scanMessage(message: string): Scan {
  const suppressors = new Set<Suppressor>();
  const n = stripBenign(normalizeMessage(message), suppressors);
  const { text, compact } = n;
  const hits: Hit[] = [];
  const add = (rule: string, category: SignalCategory, level: CrisisLevel) =>
    hits.push({ rule, category, level });

  // Abuse first — routing differs (no automatic guardian alert).
  let abuse = false;
  if (test(ABUSE_VIOLENCE, compact)) abuse = true;
  if (test(ABUSE_SEXUAL, compact)) abuse = true;
  if (test(ABUSE_BULLY, compact)) abuse = true;
  if (test(ABUSE_HIT_BY, compact) && !test(/(주사|링거|수액|백신|접종)/, compact)) {
    abuse = true;
  }
  if (test(ABUSE_HOME, compact)) {
    if (test(MEDICAL_HIT_OBJECTS, compact) && !test(/매(를)?맞/, compact)) {
      suppressors.add("medical_object");
    } else {
      abuse = true;
    }
  }

  // Death / self-harm wording
  const dieWish = test(DIE_WISH, compact) || test(DIE_STATEMENT, text);
  const suicideWord = test(SUICIDE_WORD, text) || test(SUICIDE_PHRASE, compact) || test(SUICIDE_PHRASE, text);
  const selfHarm = test(SELF_HARM, compact) || test(SELF_HARM, text);
  const indirect = test(INDIRECT, compact) || test(SELF_ABSENCE, compact);

  // Benign readings of death words
  const hyperbole = test(HYPERBOLE_DEATH, compact);
  const distressHyperbole = test(DISTRESS_HYPERBOLE, compact);
  const media = test(MEDIA, compact);
  const education = test(EDUCATION, compact);
  const reported = test(REPORTED_SPEECH, compact) && test(THIRD_PARTY_SUBJECT, compact);
  const firstPersonWish =
    /(나|내가|난|나도|저|제가)[가-힣]{0,6}(죽고싶|자살하고싶|자해하고싶|사라지고싶)/.test(compact) ||
    (!test(THIRD_PARTY_SUBJECT, compact) && (dieWish || selfHarm));
  const negated = test(NEGATION, compact) && !test(NEG_EXCEPTIONS, compact) && !test(NEG_TWIST, compact);
  const apology = test(APOLOGY_CHOSUNG, text) && !suicideWord;
  if (apology) suppressors.add("apology");

  const intent = test(INTENT_MARKERS, compact) || test(FUTURE_INTENT, compact);
  const actNow = test(ACT_NOW, compact);
  const past = test(PAST_MARKERS, compact) && !test(STILL_MARKERS, compact);

  let thirdParty = false;
  let deathTalk = dieWish || suicideWord || selfHarm || indirect;

  if (deathTalk && hyperbole && !indirect) {
    suppressors.add("hyperbole");
    deathTalk = false;
  }
  if (deathTalk && reported) {
    suppressors.add("third_party");
    thirdParty = true;
    deathTalk = false;
  }
  if (deathTalk && media && !(firstPersonWish && !reported && !/(캐릭터|주인공|보스|좀비|챔피언|등장인물|악당|npc)/.test(compact))) {
    suppressors.add("media");
    deathTalk = false;
  }
  if (deathTalk && education && !firstPersonWish) {
    suppressors.add("education");
    deathTalk = false;
  }
  if (deathTalk && negated && !indirect) {
    if (test(ABSTINENCE, compact) && (selfHarm || suicideWord)) {
      // "자해 안 한 지 한 달 됐어" — recovering, still worth a gentle check
      deathTalk = false;
      hits.push({ rule: "abstinence", category: "S7_past", level: "watch" });
    } else {
      suppressors.add("negation");
      deathTalk = false;
    }
  }

  if (deathTalk) {
    if (past && test(RECOVERED_MARKERS, compact) && !intent && !actNow) {
      add("past_recovered", "S7_past", "watch");
    } else if (past && !intent && !actNow && !/(싶어|싶다|싶음|싶네|할래|할까)$/.test(compact)) {
      add("past_episode", "S7_past", "watch");
    } else {
      if (dieWish) add("die_wish", "S1_direct", "elevated");
      if (suicideWord) add("suicide_word", "S1_direct", "elevated");
      if (selfHarm) add("self_harm", "S1_direct", "elevated");
      if (indirect) add("indirect_wish", "S2_indirect", "elevated");
      if (intent) add("intent_or_plan", "S1_direct", "urgent");
      if (actNow) add("act_now", "S1_direct", "urgent");
    }
  } else if (actNow && /(그었|자해|상처)/.test(compact)) {
    add("act_now", "S1_direct", "urgent");
  } else if (intent && /(유서|방법|죽는법|자살하는법|끝낼|작별|다들안녕|모두안녕)/.test(compact) && !test(TASK_CONTEXT, compact) && !media) {
    add("intent_or_plan", "S1_direct", "urgent");
  }

  // Means / places
  if (test(MEANS_STRONG, compact)) {
    if (test(BENIGN_PLACE_PURPOSE, compact) && !deathTalk && !/뛰어내|약/.test(compact)) {
      suppressors.add("benign_place");
    } else {
      add("means_strong", "S5_means", "urgent");
    }
  } else if (test(MEANS_WEAK, compact)) {
    if (test(BENIGN_PLACE_PURPOSE, compact)) suppressors.add("benign_place");
    else add("means_weak", "S5_means", "watch");
  }

  // Hopelessness / burden, distressed treatment refusal, loneliness
  if (test(HOPELESS, compact) || distressHyperbole) {
    add(distressHyperbole ? "distress_hyperbole" : "hopeless_burden", "S3_hopeless_burden", "watch");
  }
  if (test(TREATMENT_REFUSAL, compact)) {
    const resigned =
      test(RESIGNATION, compact) ||
      (test(TREATMENT_MAJOR, compact) && /그냥/.test(compact));
    if (resigned) add("treatment_refusal_distress", "S4_treatment_refusal", "watch");
  }
  if (test(LONELY, compact)) add("loneliness", "S8_loneliness", "watch");

  if (test(GRIEF, compact) && !indirect) suppressors.add("grief");

  return {
    hits,
    suppressors,
    thirdParty,
    abuse,
    intent,
    actNow,
    hyperbole,
  };
}

function levelOf(hits: Hit[]): CrisisLevel {
  return hits.reduce<CrisisLevel>((acc, h) => maxLevel(acc, h.level), "none");
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Assess one child message (optionally with up to 3 earlier child messages).
 * Pure: same input → same output. No message text is returned.
 */
export function assessChildMessage(input: SafetyInput): SafetyAssessment {
  const current = scanMessage(input.text);
  let level = levelOf(current.hits);
  let contextRaised = false;
  const rules = current.hits.map((h) => h.rule);
  const categories = new Set<SignalCategory>(current.hits.map((h) => h.category));

  const context = (input.context ?? []).slice(-3).filter((c) => c && c.trim());
  if (context.length) {
    const ctxScans = context.map((c) => scanMessage(c));
    const ctxLevels = ctxScans.map((s) => levelOf(s.hits));
    const ctxMax = ctxLevels.reduce<CrisisLevel>((a, b) => maxLevel(a, b), "none");
    const ctxRiskCount = ctxLevels.filter((l) => LEVEL_RANK[l] >= LEVEL_RANK.watch).length;
    const compact = normalizeMessage(input.text).compact;
    const ctxTask = context.some((c) => test(TASK_CONTEXT, normalizeMessage(c).compact));
    const ctxMedia = context.some((c) => test(MEDIA, normalizeMessage(c).compact));

    // A means question or a goodbye right after risk talk is urgent.
    if (
      LEVEL_RANK[ctxMax] >= LEVEL_RANK.watch &&
      (current.hits.some((h) => h.category === "S5_means") || test(FAREWELL, compact))
    ) {
      if (LEVEL_RANK[ctxMax] >= LEVEL_RANK.elevated || current.hits.some((h) => h.category === "S5_means")) {
        if (level !== "urgent") {
          level = "urgent";
          contextRaised = true;
          rules.push(test(FAREWELL, compact) ? "context_farewell" : "context_means");
          categories.add(test(FAREWELL, compact) ? "S1_direct" : "S5_means");
        }
      }
    }

    // "그냥 다 그만하고 싶어" — meaning comes from what was said before.
    if (LEVEL_RANK[level] < LEVEL_RANK.elevated && test(AMBIGUOUS_CONTINUATION, compact)) {
      if (ctxTask && LEVEL_RANK[ctxMax] < LEVEL_RANK.watch) {
        current.suppressors.add("task_context");
      } else if (LEVEL_RANK[ctxMax] >= LEVEL_RANK.elevated || ctxRiskCount >= 2) {
        level = "elevated";
        contextRaised = true;
        rules.push("context_continuation");
        categories.add("S2_indirect");
      } else if (ctxRiskCount === 1 && LEVEL_RANK[level] < LEVEL_RANK.watch) {
        level = "watch";
        contextRaised = true;
        rules.push("context_continuation_watch");
        categories.add("S3_hopeless_burden");
      }
    }

    // A game conversation keeps "또 죽었어" harmless.
    if (ctxMedia && level !== "none" && current.hits.every((h) => h.rule === "die_wish") && /죽었|죽어서|죽음/.test(compact) && !/싶/.test(compact)) {
      level = "none";
      current.suppressors.add("media");
    }
  } else {
    // No context: a bare continuation reads as fatigue worth a gentle check.
    const compact = normalizeMessage(input.text).compact;
    if (level === "none" && test(AMBIGUOUS_CONTINUATION, compact) && !test(TASK_CONTEXT, compact)) {
      level = "watch";
      rules.push("bare_continuation");
      categories.add("S3_hopeless_burden");
    }
  }

  let finalLevel: SafetyLevel = level;
  if (current.abuse) {
    categories.add("S6_abuse");
    rules.push("abuse_disclosure");
    if (LEVEL_RANK[level] < LEVEL_RANK.elevated) finalLevel = "protect";
  }

  const compactAll = normalizeMessage(input.text).compact;
  const ambiguous =
    finalLevel === "none" &&
    (current.suppressors.size > 0 || test(SOFT_RISK, compactAll)) &&
    !current.suppressors.has("apology");

  return {
    level: finalLevel,
    categories: Array.from(categories),
    rules: Array.from(new Set(rules)),
    suppressors: Array.from(current.suppressors),
    thirdParty: current.thirdParty,
    contextRaised,
    abuse: current.abuse,
    ambiguous,
  };
}
