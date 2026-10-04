/**
 * AgriGuard Phonetics & Agricultural Domain Pronunciation Dictionary
 * Provides accurate phonetic expansion for agricultural terms, pathogen Latin names,
 * scientific abbreviations, units, and fluent stat card sentence generation across all supported languages.
 */

import { LanguageCode } from '../types/i18n';

// ── Common Agricultural & Technical Acronyms ───────────────────────────────
const ACRONYM_EXPANSIONS: Record<string, string> = {
  NDVI: 'N-D-V-I Normalized Difference Vegetation Index',
  CLAHE: 'C-L-A-H-E contrast enhanced imaging',
  PWA: 'Progressive Web App',
  APK: 'Android application package',
  AI: 'A-I Artificial Intelligence',
  CV: 'Computer Vision',
  NPK: 'Nitrogen, Phosphorus, and Potassium',
  PH: 'P-H level',
  GPS: 'G-P-S location coordinates',
  SMS: 'text message',
  QR: 'Q-R code',
};

// ── Pathogen Latin Names to Natural Phonetic Pronunciations ─────────────────
const PATHOGEN_PHONETICS: Record<string, string> = {
  'Xanthomonas oryzae': 'Zanthomonas orizee, bacterial leaf blight pathogen',
  'Magnaporthe oryzae': 'Magnaporthe orizee, rice blast fungus',
  'Bipolaris oryzae': 'Bipolaris orizee, brown spot fungal pathogen',
  'Sarocladium oryzae': 'Sarocladium orizee, sheath rot pathogen',
  'Rhizoctonia solani': 'Rhizoctonia solani, sheath blight pathogen',
  'Puccinia polysora': 'Puccinia pollysora, southern corn rust pathogen',
  'Helminthosporium maydis': 'Helminthosporium maydis, maydis leaf blight',
  'Exserohilum turcicum': 'Exserohilum turcicum, northern corn leaf blight',
  'Ustilaginoidea virens': 'Ustilaginoidea virens, false smut pathogen',
  'Cercospora': 'Sir-cospora leaf spot',
};

// ── Unit Expansions ────────────────────────────────────────────────────────
interface UnitExpansion {
  pattern: RegExp;
  replacements: Record<string, string>;
}

const UNIT_EXPANSIONS: UnitExpansion[] = [
  {
    pattern: /(\d+(?:\.\d+)?)\s*(?:ha|ha\.)\b/gi,
    replacements: {
      en: '$1 hectares',
      te: '$1 హెక్టార్లు',
      ta: '$1 ஹெக்டேர்',
      hi: '$1 हेक्टेयर',
      kn: '$1 ಹೆಕ್ಟೇರ್',
      ml: '$1 ഹെക്ടർ',
      mr: '$1 हेक्टर',
    },
  },
  {
    pattern: /(\d+(?:\.\d+)?)\s*°C\b/gi,
    replacements: {
      en: '$1 degrees Celsius',
      te: '$1 డిగ్రీల సెల్సియస్',
      ta: '$1 டிகிரி செல்சியஸ்',
      hi: '$1 डिग्री सेल्सियस',
      kn: '$1 ಡಿಗ್ರಿ ಸೆಲ್ಸಿಯಸ್',
      ml: '$1 ഡിഗ്രി സെൽഷ്യസ്',
      mr: '$1 अंश सेल्सिअस',
    },
  },
  {
    pattern: /(\d+(?:\.\d+)?)\s*%\b/gi,
    replacements: {
      en: '$1 percent',
      te: '$1 శాతం',
      ta: '$1 சதவீதம்',
      hi: '$1 प्रतिशत',
      kn: '$1 ಶೇಕಡಾ',
      ml: '$1 ശതമാനം',
      mr: '$1 टक्के',
    },
  },
  {
    pattern: /(\d+(?:\.\d+)?)\s*kg\/ha\b/gi,
    replacements: {
      en: '$1 kilograms per hectare',
      te: '$1 కిలోగ్రాములు హెక్టారుకు',
      ta: '$1 ஹெக்டேருக்கு கிலோகிராம்',
      hi: '$1 किलोग्राम प्रति हेक्टेयर',
      kn: '$1 ಕಿಲೋಗ್ರಾಂ ಪ್ರತಿ ಹೆಕ್ಟೇರ್',
      ml: '$1 കിലോഗ്രാം പ്രതി ഹെക്ടർ',
      mr: '$1 किलो प्रति हेक्टर',
    },
  },
];

// ── Natural Stat Card Sentence Formatters ──────────────────────────────────
// Ensures stat numbers are spoken naturally as full communicative sentences
interface StatDescriptor {
  en: (val: string | number) => string;
  te: (val: string | number) => string;
  ta: (val: string | number) => string;
  kn: (val: string | number) => string;
  ml: (val: string | number) => string;
  mr: (val: string | number) => string;
  hi: (val: string | number) => string;
}

const STAT_SENTENCE_TEMPLATES: Record<string, StatDescriptor> = {
  totalFarms: {
    en: (val) => `Total Farms: You have ${val} registered agricultural fields.`,
    te: (val) => `మొత్తం పొలాలు: మీ ఖాతాలో ${val} నమోదైన పొలాలు ఉన్నాయి.`,
    ta: (val) => `மொத்த பண்ணைகள்: உங்களிடம் ${val} பதிவுசெய்யப்பட்ட வயல்கள் உள்ளன.`,
    kn: (val) => `ಒಟ್ಟು ಜಮೀನುಗಳು: ನಿಮ್ಮಲ್ಲಿ ${val} ನೋಂದಾಯಿತ ಕೃಷಿ ಹೊಲಗಳಿವೆ.`,
    ml: (val) => `ആകെ ഫാമുകൾ: നിങ്ങൾക്ക് ${val} രജിസ്റ്റർ ചെയ്ത കൃഷിയിടങ്ങളുണ്ട്.`,
    mr: (val) => `एकूण शेती: तुमच्याकडे ${val} नोंदणीकृत शेतजमीन आहेत.`,
    hi: (val) => `कुल खेत: आपके पास ${val} पंजीकृत कृषि क्षेत्र हैं.`,
  },
  healthyCrops: {
    en: (val) => `Healthy Crops: Crop vitality is at ${val} percent healthy.`,
    te: (val) => `పంట ఆరోగ్యం: పంట ఆరోగ్యం ${val} శాతం ఆరోగ్యకరంగా ఉంది.`,
    ta: (val) => `பயிர் நலம்: பயிர் ஆரோக்கியம் ${val} சதவீதம் நலமாக உள்ளது.`,
    kn: (val) => `ಬೆಳೆ ಆರೋಗ್ಯ: ಬೆಳೆ ಕ್ಷೇಮ ${val} ಶೇಕಡಾ ಆರೋಗ್ಯಕರವಾಗಿದೆ.`,
    ml: (val) => `വിള ആരോഗ്യം: വിള ആരോഗ്യം ${val} ശതമാനം മികച്ചതാണ്.`,
    mr: (val) => `पिकांचे आरोग्य: पिकांचे आरोग्य ${val} टक्के निरोगी आहे.`,
    hi: (val) => `फसल स्वास्थ्य: फसल का स्वास्थ्य ${val} प्रतिशत अच्छा है.`,
  },
  activeOfficers: {
    en: (val) => `Active Officers: There are ${val} agricultural field officers active in your region.`,
    te: (val) => `క్రియాశీల అధికారులు: మీ ప్రాంతంలో ${val} మంది వ్యవసాయ అధికారులు అందుబాటులో ఉన్నారు.`,
    ta: (val) => `செயலில் உள்ள அலுவலர்கள்: உங்கள் பகுதியில் ${val} வேளாண்மை அலுவலர்கள் பணியில் உள்ளனர்.`,
    kn: (val) => `ಸಕ್ರಿಯ ಅಧಿಕಾರಿಗಳು: ನಿಮ್ಮ ವಲಯದಲ್ಲಿ ${val} ಕೃಷಿ ಅಧಿಕಾರಿಗಳು ಕರ್ತವ್ಯದಲ್ಲಿದ್ದಾರೆ.`,
    ml: (val) => `സജീവ ഓഫീസർമാർ: നിങ്ങളുടെ മേഖലയിൽ ${val} കൃഷി ഓഫീസർമാർ ലഭ്യമാണ്.`,
    mr: (val) => `सक्रिय अधिकारी: तुमच्या भागात ${val} कृषी अधिकारी उपलब्ध आहेत.`,
    hi: (val) => `सक्रिय अधिकारी: आपके क्षेत्र में ${val} कृषि अधिकारी सक्रिय हैं.`,
  },
  farmersMonitored: {
    en: (val) => `Farmers Monitored: You are currently monitoring ${val} registered farmers.`,
    te: (val) => `పర్యవేక్షిస్తున్న రైతులు: మీరు ప్రస్తుతం ${val} మంది రైతులను పర్యవేక్షిస్తున్నారు.`,
    ta: (val) => `கண்காணிக்கப்படும் விவசாயிகள்: நீங்கள் தற்போது ${val} விவசாயிகளைக் கண்காணிக்கிறீர்கள்.`,
    kn: (val) => `ಮೇಲ್ವಿಚಾರಣೆ ನಡೆಸುತ್ತಿರುವ ರೈತರು: ನೀವು ಪ್ರಸ್ತುತ ${val} ರೈತರನ್ನು ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡುತ್ತಿದ್ದೀರಿ.`,
    ml: (val) => `നിരീക്ഷിക്കുന്ന കർഷകർ: നിങ്ങൾ ഇപ്പോൾ ${val} കർഷകരെ നിരീക്ഷിക്കുന്നു.`,
    mr: (val) => `निरीक्षण केलेले शेतकरी: तुम्ही सध्या ${val} शेतकऱ्यांचे निरीक्षण करत आहात.`,
    hi: (val) => `निगरानी में किसान: आप वर्तमान में ${val} किसानों की निगरानी कर रहे हैं.`,
  },
  activeCases: {
    en: (val) => `Active Cases: There are ${val} crop pathology cases requiring attention.`,
    te: (val) => `క్రియాశీల కేసులు: పరిష్కారం కోసం ${val} పంట వ్యాధి కేసులు ఉన్నాయి.`,
    ta: (val) => `செயலில் உள்ள வழக்குகள்: கவனிக்கப்பட வேண்டிய ${val} பயிர் நோய் வழக்குகள் உள்ளன.`,
    kn: (val) => `ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು: ಗಮನಹರಿಸಬೇಕಾದ ${val} ಬೆಳೆ ರೋಗ ಪ್ರಕರಣಗಳಿವೆ.`,
    ml: (val) => `സജീവ കേസുകൾ: ശ്രദ്ധ ആവശ്യമുള്ള ${val} വിള രോഗ കേസുകളുണ്ട്.`,
    mr: (val) => `सक्रिय प्रकरणे: लक्ष देण्याची गरज असलेली ${val} पीक रोग प्रकरणे आहेत.`,
    hi: (val) => `सक्रिय मामले: ध्यान देने योग्य ${val} फसल रोग के मामले हैं.`,
  },
  resolvedCases: {
    en: (val) => `Resolved Cases: ${val} cases have been successfully resolved.`,
    te: (val) => `పరిష్కరించబడిన కేసులు: ${val} పంట కేసులు విజయవంతంగా పరిష్కరించబడ్డాయి.`,
    ta: (val) => `தீர்க்கப்பட்ட வழக்குகள்: ${val} வழக்குகள் வெற்றிகரமாகத் தீர்க்கப்பட்டுள்ளன.`,
    kn: (val) => `ಪರಿಹರಿಸಲಾದ ಪ್ರಕರಣಗಳು: ${val} ಪ್ರಕರಣಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಪರಿಹರಿಸಲಾಗಿದೆ.`,
    ml: (val) => `പരിഹരിച്ച കേസുകൾ: ${val} കേസുകൾ വിജയകരമായി പരിഹരിച്ചു.`,
    mr: (val) => `निकाली काढलेली प्रकरणे: ${val} प्रकरणे यशस्वीरीत्या सोडवली गेली आहेत.`,
    hi: (val) => `हल किए गए मामले: ${val} मामले सफलतापूर्वक हल किए गए हैं.`,
  },
  activeConversations: {
    en: (val) => `Active Conversations: You have ${val} live farmer consultations open.`,
    te: (val) => `క్రియాశీల సంభాషణలు: మీ వద్ద ${val} క్రియాశీల రైతు సంప్రదింపులు ఉన్నాయి.`,
    ta: (val) => `செயலில் உள்ள உரையாடல்கள்: உங்களிடம் ${val} விவசாய ஆலோசனைகள் உள்ளன.`,
    kn: (val) => `ಸಕ್ರಿಯ ಸಂಭಾಷಣೆಗಳು: ನಿಮ್ಮಲ್ಲಿ ${val} ರೈತರ ಸಮಾಲೋಚನೆಗಳು ಪ್ರಗತಿಯಲ್ಲಿವೆ.`,
    ml: (val) => `സജീവ സംഭാഷണങ്ങൾ: നിങ്ങൾക്ക് ${val} കർഷക കൂടിയാലോചനകൾ ഉണ്ട്.`,
    mr: (val) => `सक्रिय संभाषणे: तुमच्याकडे ${val} शेतकरी सल्लामसलत सुरू आहेत.`,
    hi: (val) => `सक्रिय बातचीत: आपके पास ${val} सक्रिय किसान परामर्श चल रहे हैं.`,
  },
  pendingQuestions: {
    en: (val) => `Pending Questions: ${val} farmer questions are awaiting your expert answer.`,
    te: (val) => `పెండింగ్ ప్రశ్నలు: ${val} రైతు ప్రశ్నలు మీ సమాధానం కోసం ఎదురుచూస్తున్నాయి.`,
    ta: (val) => `நிலுவையில் உள்ள கேள்விகள்: உங்கள் பதிலுக்காக ${val} விவசாயிகளின் கேள்விகள் காத்திருக்கின்றன.`,
    kn: (val) => `ಬಾಕಿ ಇರುವ ಪ್ರಶ್ನೆಗಳು: ${val} ರೈತರ ಪ್ರಶ್ನೆಗಳು ನಿಮ್ಮ ಉತ್ತರಕ್ಕಾಗಿ ಕಾಯುತ್ತಿವೆ.`,
    ml: (val) => `തീർപ്പുകൽപ്പിക്കാത്ത ചോദ്യങ്ങൾ: നിങ്ങളുടെ മറുപടിക്കായി ${val} കർഷക ചോദ്യങ്ങൾ കാത്തിരിക്കുന്നു.`,
    mr: (val) => `प्रलंबित प्रश्न: ${val} शेतकऱ्यांचे प्रश्न तुमच्या उत्तराची वाट पाहत आहेत.`,
    hi: (val) => `लंबित प्रश्न: ${val} किसान प्रश्न आपके विशेषज्ञ उत्तर की प्रतीक्षा कर रहे हैं.`,
  },
  farmersHelped: {
    en: (val) => `Farmers Helped: You have supported ${val} farmers so far.`,
    te: (val) => `సహాయం పొందిన రైతులు: మీరు ఇప్పటివరకు ${val} మంది రైతులకు సహాయం అందించారు.`,
    ta: (val) => `உதவி பெற்ற விவசாயிகள்: நீங்கள் இதுவரை ${val} விவசாயிகளுக்கு உதவியுள்ளீர்கள்.`,
    kn: (val) => `ಸಹಾಯ ಪಡೆದ ರೈತರು: ನೀವು ಇಲ್ಲಿಯವರೆಗೆ ${val} ರೈತರಿಗೆ ನೆರವಾಗಿದ್ದೀರಿ.`,
    ml: (val) => `സഹായം ലഭിച്ച കർഷകർ: നിങ്ങൾ ഇതുവരെ ${val} കർഷകരെ സഹായിച്ചു.`,
    mr: (val) => `मदत मिळालेले शेतकरी: तुम्ही आतापर्यंत ${val} शेतकऱ्यांना मदत केली आहे.`,
    hi: (val) => `सहायता प्राप्त किसान: आपने अब तक ${val} किसानों की सहायता की है.`,
  },
  avgRating: {
    en: (val) => `Average Rating: Your agronomist satisfaction rating is ${val} out of 5 stars.`,
    te: (val) => `సగటు రేటింగ్: మీ వ్యవసాయ సలహాదారు రేటింగ్ 5 నక్షత్రాలకు ${val} గా ఉంది.`,
    ta: (val) => `சராசரி மதிப்பீடு: உங்கள் வேளாண்மை வல்லுநர் மதிப்பீடு 5க்கு ${val} ஆகும்.`,
    kn: (val) => `ಸರಾಸರಿ ರೇಟಿಂಗ್: ನಿಮ್ಮ ಕೃಷಿ ತಜ್ಞರ ರೇಟಿಂಗ್ 5 ಕ್ಕೆ ${val} ಆಗಿದೆ.`,
    ml: (val) => `ശരാശരി റേറ്റിംഗ്: നിങ്ങളുടെ വിദഗ്ദ്ധ റേറ്റിംഗ് 5-ൽ ${val} ആണ്.`,
    mr: (val) => `सरासरी रेटिंग: तुमचे कृषी तज्ज्ञ रेटिंग 5 पैकी ${val} आहे.`,
    hi: (val) => `औसत रेटिंग: आपकी कृषि विशेषज्ञ रेटिंग 5 में से ${val} स्टार है.`,
  },
};

/**
 * Format a stat card's label and value into a natural communicative sentence
 */
export function formatStatSentence(
  statKey: string,
  rawLabel: string,
  value: string | number,
  lang: LanguageCode
): string {
  // Normalize key lookup
  const cleanKey = statKey.replace(/^dashboard\.|^farmer\.|^officer\.|^expert\./, '');
  const template = STAT_SENTENCE_TEMPLATES[cleanKey];

  const primaryLang = (['te', 'ta', 'kn', 'ml', 'mr', 'hi'].includes(lang) ? lang : 'en') as keyof StatDescriptor;

  if (template && template[primaryLang]) {
    return template[primaryLang](value);
  }

  // Fallback natural sentence
  if (lang === 'te') return `${rawLabel}: ${value}.`;
  if (lang === 'ta') return `${rawLabel}: ${value}.`;
  if (lang === 'hi') return `${rawLabel}: ${value}.`;
  if (lang === 'kn') return `${rawLabel}: ${value}.`;
  return `${rawLabel}: ${value}.`;
}

/**
 * Phonetically enhance and clean text for natural speech synthesis
 */
export function enhancePronunciation(text: string, lang: LanguageCode = 'en'): string {
  if (!text) return '';

  let enhanced = text;

  // 1. Clean markdown tokens, excessive symbols, asterisks, brackets
  enhanced = enhanced
    .replace(/[*_#`~>]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link text](url) -> link text
    .replace(/https?:\/\/\S+/gi, '') // Remove URLs
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 2. Expand common agricultural acronyms
  for (const [acronym, expansion] of Object.entries(ACRONYM_EXPANSIONS)) {
    const regex = new RegExp(`\\b${acronym}\\b`, 'g');
    enhanced = enhanced.replace(regex, expansion);
  }

  // 3. Expand Latin pathogen scientific binomials
  for (const [latinName, phonetic] of Object.entries(PATHOGEN_PHONETICS)) {
    const regex = new RegExp(latinName, 'gi');
    enhanced = enhanced.replace(regex, phonetic);
  }

  // 4. Expand unit abbreviations based on selected language
  for (const unit of UNIT_EXPANSIONS) {
    const repl = unit.replacements[lang] || unit.replacements['en'];
    if (repl) {
      enhanced = enhanced.replace(unit.pattern, repl);
    }
  }

  return enhanced;
}

/**
 * Break long text paragraphs into natural sentence chunks
 * Prevents browser speech synthesis from cutting out on long advisory sections
 */
export function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  // Match sentence terminators (., !, ?, ।, etc.)
  const rawSentences = text.split(/(?<=[.!?।\n])\s+/);
  return rawSentences
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
