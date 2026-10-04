import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Send, ShieldCheck, User, BookOpen,
  AlertTriangle, MessageSquare, RefreshCw, ChevronDown, ChevronUp, History, Trash2,
  Plus, X, AlertCircle, Clock, Copy, Check
} from 'lucide-react';
import { aiApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface Citation {
  document_id: string;
  title: string;
  source: string;
  crop?: string;
  disease?: string;
  category?: string;
  relevance_score: number;
  snippet: string;
  last_verified?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Citation[];
  suggested_questions?: string[];
  farm_context?: any;
  confidence?: number;
  escalation_recommended?: boolean;
  created_at: string;
  isStreaming?: boolean;
  isError?: boolean;
  failedQuery?: string;
}

interface ConversationItem {
  id: string;
  title: string;
  context_summary?: string;
  message_count: number;
  updated_at?: string;
  created_at?: string;
}

interface AIAssistantViewProps {
  onBack: () => void;
  onNavigateExpert?: () => void;
  onNavigateScan?: () => void;
  initialQuery?: string;
}

// ── Distinct AI Avatar ────────────────────────────────────────────────
// A dedicated circuit/AI motif SVG — clearly not the AgriGuard brand leaf
// and clearly not a human Expert profile photo.
const AIAvatar: React.FC<{ size?: number; primaryColor?: string; glowColor?: string }> = ({
  size = 20,
  primaryColor = '#34d399',
  glowColor = 'rgba(52,211,153,0.35)',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="AI Assistant"
    style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
  >
    {/* CPU/circuit chip body */}
    <rect x="7" y="7" width="10" height="10" rx="2" stroke={primaryColor} strokeWidth="1.5" />
    {/* Center dot */}
    <circle cx="12" cy="12" r="1.5" fill={primaryColor} />
    {/* Circuit pins - top */}
    <line x1="9" y1="7" x2="9" y2="4" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="7" x2="12" y2="4" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="15" y1="7" x2="15" y2="4" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" />
    {/* Circuit pins - bottom */}
    <line x1="9" y1="17" x2="9" y2="20" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="12" y1="17" x2="12" y2="20" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="15" y1="17" x2="15" y2="20" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" />
    {/* Circuit pins - left */}
    <line x1="7" y1="10" x2="4" y2="10" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="14" x2="4" y2="14" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" />
    {/* Circuit pins - right */}
    <line x1="17" y1="10" x2="20" y2="10" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="17" y1="14" x2="20" y2="14" stroke={primaryColor} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ── Role-Aware Default Suggestions ───────────────────────────────────
// ── Multilingual Role-Aware Default Suggestions ──────────────────────────────
const LOCALIZED_ROLE_SUGGESTIONS: Record<string, Record<string, string[]>> = {
  te: {
    FARMER: [
      "నా వరి ఆకులపై మచ్చలు ఉన్నాయి. ఏమి పిచికారీ చేయాలి?",
      "మొక్కజొన్నలో కత్తెర పురుగును సేంద్రీయంగా ఎలా నివారించాలి?",
      "యూరియా మరియు పొటాష్ వేయడానికి సిఫార్సు చేయబడిన సమయం ఏది?",
      "టమాట ఆకులపై రింగుల మచ్చలకు కారణం ఏమిటి?",
      "వరి పొలంలో నీటి నిర్వహణ ఎలా చేయాలి?",
    ],
    OFFICER: [
      "నాకు కేటాయించిన కేసుల సారాంశం చూపించు.",
      "క్షేత్ర పరిశీలనకు ముందు ఏ చర్యలు తీసుకోవాలి?",
      "తీవ్రమైన పంట వ్యాధిని నిపుణుడికి ఎలా బదిలీ చేయాలి?",
      "కేసు పరిష్కార నివేదికలో ఏ వివరాలు ఉండాలి?",
    ],
    EXPERT: [
      "రైతు సంప్రదింపుల జాబితాను సమీక్షించు.",
      "వరి తెగులు నివారణకు ICAR మార్గదర్శకాలు ఏమిటి?",
      "టమాట ఆకుముడత వైరస్ నిర్వహణ సలహా తయారు చేయండి.",
    ],
    ADMIN: [
      "ప్లాట్‌ఫామ్ ఆరోగ్య సారాంశం ఏమిటి?",
      "ఈ నెలలో ఎన్ని వ్యాధులు గుర్తించబడ్డాయి?",
    ],
  },
  ta: {
    FARMER: [
      "என் நெல் இலைகளில் புள்ளிகள் உள்ளன. என்ன தெளிக்க வேண்டும்?",
      "மக்காச்சோளத்தில் படைப்புழுவை இயற்கையாக கட்டுப்படுத்துவது எப்படி?",
      "யூரியா மற்றும் பொட்டாஷ் உரம் இடுவதற்கான சரியான நேரம் எது?",
      "தக்காளி இலைகளில் கருகல் நோய்க்கான காரணம் என்ன?",
      "நெற்பயிரில் நீர் மேலாண்மை முறைகள் யாவை?",
    ],
    OFFICER: [
      "எனக்கு ஒதுக்கப்பட்ட வழக்குகளின் நிலையை காட்டு.",
      "கள ஆய்வுக்கு முன் கவனிக்க வேண்டிய வழிமுறைகள் யாவை?",
      "தீவிர நோய் பாதிப்பை நிபுணரிடம் எவ்வாறு பரிந்துரைப்பது?",
    ],
    EXPERT: [
      "நிலுவையில் உள்ள விவசாயி ஆலோசனைகளை சுருக்கமாக காட்டு.",
      "நெல் குலை நோய்க்கான புதிய ICAR பரிந்துரைகள் யாவை?",
    ],
    ADMIN: [
      "தளத்தின் ஒட்டுமொத்த செயல்பாட்டு நிலை என்ன?",
      "இந்த மாதம் எத்தனை நோய் பதிவுகள் செய்யப்பட்டுள்ளன?",
    ],
  },
  kn: {
    FARMER: [
      "ನನ್ನ ಭತ್ತದ ಎಲೆಗಳ ಮೇಲೆ ಚುಕ್ಕೆಗಳಿವೆ. ಏನನ್ನು ಸಿಂಪಡಿಸಬೇಕು?",
      "ಮೆಕ್ಕೆಜೋಳದಲ್ಲಿ ಲದ್ದಿ ಹುಳು ನಿವಾರಣೆಗೆ ಸಾವಯವ ವಿಧಾನ ಯಾವುದು?",
      "ಯೂರಿಯಾ ಮತ್ತು ಪೊಟ್ಯಾಶ್ ಗೊಬ್ಬರ ಹಾಕಲು ಸೂಕ್ತ ಸಮಯ ಯಾವುದು?",
      "ಟೊಮ್ಯಾಟೊ ಎಲೆ ಮುದುರುವ ರೋಗಕ್ಕೆ ಕಾರಣವೇನು?",
    ],
    OFFICER: [
      "ನನಗೆ ನಿಯೋಜಿಸಲಾದ ಪ್ರಕರಣಗಳ ಸ್ಥಿತಿಯನ್ನು ತೋರಿಸಿ.",
      "ಕ್ಷೇತ್ರ ಭೇಟಿಗೆ ಮುನ್ನ ತೆಗೆದುಕೊಳ್ಳಬೇಕಾದ ಕ್ರಮಗಳೇನು?",
      "ತೀವ್ರ ರೋಗದ ಪ್ರಕರಣವನ್ನು ತಜ್ಞರಿಗೆ ಹೇಗೆ ವರ್ಗಾಯಿಸುವುದು?",
    ],
    EXPERT: [
      "ರೈತರ ಬಾಕಿ ಇರುವ ಸಮಾಲೋಚನೆಗಳ ಸಾರಾಂಶ ತೋರಿಸಿ.",
      "ಭತ್ತದ ಬೆಂಕಿ ರೋಗ ನಿಯಂತ್ರಣಕ್ಕೆ ICAR ಮಾರ್ಗಸೂಚಿಗಳೇನು?",
    ],
    ADMIN: [
      "ವೇದಿಕೆಯ ಒಟ್ಟಾರೆ ಸ್ಥಿತಿ ಸಾರಾಂಶವೇನು?",
    ],
  },
  ml: {
    FARMER: [
      "എന്റെ നെല്ലിന്റെ ഇലകളിൽ പുള്ളികളുണ്ട്. എന്താണ് തളിക്കേണ്ടത്?",
      "മക്കച്ചോളത്തിലെ പുഴുക്കളെ ജൈവരീതിയിൽ എങ്ങനെ നിയന്ത്രിക്കാം?",
      "യൂറിയയും പൊട്ടാഷും പ്രയോഗിക്കേണ്ട ശരിയായ സമയം ഏതാണ്?",
      "തക്കാളിയിലെ ഇലപ്പുള്ളി രോഗത്തിന് കാരണം എന്താണ്?",
    ],
    OFFICER: [
      "എനിക്ക് ചുമതലപ്പെടുത്തിയ കേസുകളുടെ വിവരങ്ങൾ കാണിക്കുക.",
      "ഫീൽഡ് സന്ദർശനത്തിന് മുൻപ് ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ എന്തൊക്കെ?",
    ],
    EXPERT: [
      "കർഷകരുടെ കൺസൾട്ടേഷനുകളുടെ സംഗ്രഹം കാണിക്കുക.",
      "നെല്ലിലെ രോഗങ്ങൾക്കുള്ള പുതിയ ICAR മാർഗ്ഗനിർദ്ദേശങ്ങൾ എന്തൊക്കെ?",
    ],
    ADMIN: [
      "പ്ലാറ്റ്‌ഫോമിന്റെ പ്രവർത്തന സംഗ്രഹം എന്താണ്?",
    ],
  },
  mr: {
    FARMER: [
      "माझ्या भाताच्या पानांवर ठिपके आले आहेत. काय फवारणी करावी?",
      "मक्यावरील लष्करी अळीचे सेंद्रिय नियंत्रण कसे करावे?",
      "युरिया आणि पोटॅश खत देण्याची योग्य वेळ कोणती?",
      "टोमॅटोवरील करपा रोगाची कारणे कोणती?",
    ],
    OFFICER: [
      "माझ्याकडे सोपवलेल्या प्रकरणांचा तपशील दाखवा.",
      "शेत पाहणीपूर्वी कोणत्या खबरदाऱ्या घ्याव्यात?",
      "गंभीर रोगाची तक्रार तज्ज्ञांकडे कशी वर्ग करावी?",
    ],
    EXPERT: [
      "शेतकऱ्यांच्या प्रलंबित सल्लामसलतींचा सारांश दाखवा.",
      "भात पिकावरील करपा नियंत्रणासाठी ICAR च्या मार्गदर्शक सूचना काय आहेत?",
    ],
    ADMIN: [
      "प्लॅटफॉर्मच्या कार्यक्षमतेचा सारांश काय आहे?",
    ],
  },
  tcy: {
    FARMER: [
      "ಎನ್ನ ಬಾರ್‌ದ ಇರೆಟ್ ಕಲೆ ತೋಜುಂಡು. ದಾದ ಮರ್ದ್ ತಳಿಪೊಡು?",
      "ಜೋಳದ ಪುರಿ ನಿವಾರಣೆಗ್ ಸಾವಯವ ಉಪಾಯ ದಾದ?",
      "ಗೊಬ್ಬರ ಪಾಡ್ಯರೆ ಸರಿಯಾಯಿನ ಪೊರ್ತು ವಾವು?",
    ],
    OFFICER: ["ಕೆಲಸದ ಪ್ರಕರಣಲೆನ ವಿವರ ತೋಜಾಲೆ."],
    EXPERT: ["ರೈತೆರೆನ ಸಲಹೆಲೆನ್ ಪರಿಶೀಲನೆ ಮಲ್ಪುಲೆ."],
    ADMIN: ["ವೇದಿಕೆದ ಸಾರಾಂಶ ತೋಜಾಲೆ."],
  },
  kok: {
    FARMER: [
      "म्हज्या भाताच्या पानांचेर दाग पडल्यात. कितें फवारचें?",
      "मक्याच्या किड्यांचेर सेंद्रिय नियंत्रण कशें करचें?",
      "सारें घालपाक योग्य वेळ खंयची?",
    ],
    OFFICER: ["माझ्यो केसी दाखवा."],
    EXPERT: ["शेतकारांच्यो शंका तपासा."],
    ADMIN: ["सिस्टम स्थिती तपासा."],
  },
  kfa: {
    FARMER: [
      "ಎನ್ನ ಬೆಳೆತ ಎಲೆಲ್ ಚುಕ್ಕೆ ತೋಜುವ. ದಾದ ಸಿಂಪಡನೆ ಮಾಡೋಕು?",
      "ಕಾಪಿ ತೋಟಲ್ ರೋಗ ನಿವಾರಣೆ ಎಂಗೆ?",
    ],
    OFFICER: ["ಕೇಸ್‌ಗಳ ವಿವರ ತೋರ್ಸಿ."],
    EXPERT: ["ರೈತರ ಸಲಹೆ ವಿವರ ನೋಡಿ."],
    ADMIN: ["ವೇದಿಕೆ ವಿವರ ನೋಡಿ."],
  },
  bgy: {
    FARMER: [
      "ಎನ್ನ ಬೆಳೆಲ್ ಕಲೆ ಉಂಡು. ದಾದ ಮರ್ದ್ ಪಾಡೊಡು?",
      "ಜೋಳದ ಪುರಿಕ್ ದಾದ ಮಲ್ತೊಡು?",
    ],
    OFFICER: ["ಕೇಸ್ ವಿವರ ತೋರ್ಸಿ."],
    EXPERT: ["ಸಲಹೆ ಪರಿಶೀಲನೆ ಮಲ್ಪುಲೆ."],
    ADMIN: ["ಸಿಸ್ಟಮ್ ವಿವರ."],
  },
  bfq: {
    FARMER: [
      "ಎನ್ನ ತೋಟದ ಎಲೆಲಿ ಚುಕ್ಕೆ ಅದ. ಎನ್ನ ಮದ್ದು ಹಾಕೋಕು?",
      "ಟೀ ತೋಟದ ರೋಗ ತಡೆಗೋ ಎನ್ನ ಮಾಡೋಕು?",
    ],
    OFFICER: ["ಕೇಸ್ ವಿವರ ನೋಡಿ."],
    EXPERT: ["ರೈತರ ಸಲಹೆ ನೋಡಿ."],
    ADMIN: ["ಸಿಸ್ಟಮ್ ನೋಡಿ."],
  },
  en: {
    FARMER: [
      "My paddy leaves have diamond spindle-shaped brown spots. What should I spray?",
      "How do I control Fall Armyworm in my maize crop organically?",
      "What is the recommended split application timing for Urea and Potash?",
      "What causes concentric dark rings on tomato leaves?",
      "How does Alternate Wetting and Drying (AWD) save irrigation water?",
    ],
    OFFICER: [
      "Summarise my open cases and their priority levels.",
      "What steps should I take before a field visit on a blight case?",
      "How do I escalate a critical disease case to an expert?",
      "What documentation is needed to mark a case as resolved?",
    ],
    EXPERT: [
      "Summarise my pending farmer consultations.",
      "What are the latest ICAR guidelines for managing rice blast?",
      "How should I explain early blight progression to a farmer simply?",
    ],
    ADMIN: [
      "What is the overall platform health summary?",
      "How many disease detections were recorded this month?",
    ],
  },
};

const getSuggestions = (role?: string, lang: string = 'en'): string[] => {
  const langDict = LOCALIZED_ROLE_SUGGESTIONS[lang] || LOCALIZED_ROLE_SUGGESTIONS.en;
  const roleKey = role?.toUpperCase() ?? 'FARMER';
  return langDict[roleKey] || langDict.FARMER || LOCALIZED_ROLE_SUGGESTIONS.en.FARMER;
};

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  onBack,
  onNavigateExpert,
  onNavigateScan,
  initialQuery,
}) => {
  const { tokens } = useTheme();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const userRole = user?.role ?? 'FARMER';
  const defaultSuggestions = getSuggestions(userRole, language);

  type ChatState = 'NOT_LOADED' | 'LOADING' | 'LOADED_EMPTY' | 'LOADED_WITH_MESSAGES' | 'ERROR';
  const [chatState, setChatState] = useState<ChatState>('NOT_LOADED');

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [farmContext, setFarmContext] = useState<any>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  // History Drawer & Clear Modal states
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [clearingConversation, setClearingConversation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createWelcomeMessage = (): Message => {
    const welcomeByLang: Record<string, string> = {
      te: `### అగ్రిగార్డ్ AI సహాయకుడికి స్వాగతం 🌱\n\nనేను మీ AI వ్యవసాయ సలహాదారుడిని — ICAR, TNAU, IARI మరియు FAO పరిశోధనల ఆధారంగా ప్రామాణిక సమాచారం అందిస్తాను.\n\nపంట వ్యాధులు, ఎరువుల నిర్వహణ, పురుగుల నివారణ మరియు సాగు సలహాల కోసం నన్ను అడగండి.`,
      ta: `### அக்ரிகார்ட் AI உதவியாளருக்கு வரவேற்கிறோம் 🌱\n\nநான் உங்கள் AI விவசாய ஆலோசகர் — ICAR, TNAU மற்றும் FAO வேளாண் ஆராய்ச்சி அடிப்படையில் செயல்படுகிறேன்.\n\nபயிர் நோய்கள், உர நிர்வாகம், பூச்சி கட்டுப்பாடு மற்றும் நீர்ப்பாசன ஆலோசனைகளுக்கு என்னை கேட்கலாம்.`,
      kn: `### ಅಗ್ರಿ ಗಾರ್ಡ್ AI ಸಹಾಯಕರಿಗೆ ಸುಸ್ವಾಗತ 🌱\n\nನಾನು ನಿಮ್ಮ AI ಕೃಷಿ ಸಲಹೆಗಾರ — ICAR ಮತ್ತು ಕೃಷಿ ವಿಜ್ಞಾನ ಕೇಂದ್ರಗಳ ಮಾರ್ಗಸೂಚಿಗಳ ಆಧಾರದ ಮೇಲೆ ಸಲಹೆ ನೀಡುತ್ತೇನೆ.\n\nಬೆಳೆ ರೋಗಗಳು, ಗೊಬ್ಬರ ನಿರ್ವಹಣೆ, ಕೀಟ ನಿಯಂತ್ರಣ ಮತ್ತು ನೀರಾವರಿ ಬಗ್ಗೆ ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ.`,
      ml: `### അഗ്രിഗാർഡ് AI അസിസ്റ്റന്റിലേക്ക് സ്വാഗതം 🌱\n\nഞാൻ നിങ്ങളുടെ കാർഷിക AI ഉപദേശകനാണ് — ICAR, FAO എന്നിവയിൽ നിന്നുള്ള വിവരങ്ങൾ നൽകുന്നു.\n\nവിള രോഗങ്ങൾ, വളപ്രയോഗം, കീടനിയന്ത്രണം എന്നിവയെക്കുറിച്ച് എന്നോട് ചോദിക്കാം.`,
      mr: `### अॅग्रीगार्ड AI सहाय्यकामध्ये आपले स्वागत आहे 🌱\n\nमी तुमचा कृषी AI सल्लागार आहे — ICAR आणि कृषी विद्यापीठांच्या संशोधनावर आधारित सल्ला देतो.\n\nपिकांचे रोग, खतांचे व्यवस्थापन, कीड नियंत्रण आणि सिंचनाविषयी मला विचारा.`,
      tcy: `### ಅಗ್ರಿ ಗಾರ್ಡ್ AI ಸಹಾಯಕರೆಗ್ ಸ್ವಾಗತ 🌱\n\nಯಾನ್ ಈರೆನ AI ಬೆಳೆ ಸಲಹೆಗಾರೆ — ICAR ಸಂಶೋಧನೆದ ಆಧಾರೊಡು ಮಾಹಿತಿ ಕೊರ್ಪೆ. ಬೆಳೆತ ರೋಗ, ಮರ್ದ್ ಪಾಡುನೆದ ಬಗ್ಗೆ ಕೇನ್ಲೆ.`,
      kok: `### अग्रीगार्ड AI सहाय्यकांत येवकार 🌱\n\nहांव तुमचो शेतकामती AI सल्लागार — ICAR आनी संशोधनाचेर आदारित सल्ला दितां. पिकांचे रोग आनी सार्याविशीं विचारात.`,
      kfa: `### ಅಗ್ರಿ ಗಾರ್ಡ್ AI ಸಹಾಯಕಂಗೆ ಸ್ವಾಗತ 🌱\n\nನಾನ್ ನಿಮ್ಮ ಬೆಳೆ AI ಸಲಹೆಗಾರ — ICAR ಸಂಶೋಧನೆದ ಆಧಾರೊಲ್ ಸಲಹೆ ಕೊಡ್ತಿನಿ. ಬೆಳೆ ರೋಗ, ಗೊಬ್ಬರ ಬಗ್ಗೆ ಕೇಳ್‌ರಿ.`,
      bgy: `### ಅಗ್ರಿ ಗಾರ್ಡ್ AI ಸಹಾಯಕರೆಗ್ ಸ್ವಾಗತ 🌱\n\nನಾನ್ ಈರೆನ ಬೆಳೆ AI ಸಲಹೆಗಾರ — ಕೃಷಿ ಮಾಹಿತಿ ಕೊರ್ಪೆ. ಬೆಳೆ ರೋಗ, ಗೊಬ್ಬರದ ಬಗ್ಗೆ ಕೇನ್ಲೆ.`,
      bfq: `### ಅಗ್ರಿ ಗಾರ್ಡ್ AI ಸಹಾಯಕರೆಗೆ ಸ್ವಾಗತ 🌱\n\nನಾ ನಿಮ್ಮ ತೋಟದ AI ಸಲಹೆಗಾರ — ಕೃಷಿ ಮಾಹಿತಿ ಕೊಡ್ತಿನಿ. ಬೆಳೆ ರೋಗ, ಮದ್ದು ಬಗ್ಗೆ ಕೇಳಿ.`,
      en: `### Welcome to AgriGuard AI Assistant 🌱\n\nI'm your **AI agricultural advisor** — grounded in verified agronomic knowledge (ICAR, TNAU, IARI, FAO).\n\nAsk about crop disease diagnosis, fertilizer schedules, pest control, or irrigation advice.`,
    };

    return {
      id: 'welcome-1',
      role: 'assistant',
      content: welcomeByLang[language] || welcomeByLang.en,
      suggested_questions: defaultSuggestions.slice(0, 3),
      created_at: new Date().toISOString(),
    };
  };

  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const copyMessage = (msgId: string, text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    }
  };

  // Permanently restore conversation history from server on mount/refresh/role switch
  useEffect(() => {
    initChatHistory();
  }, [initialQuery, user?.id, userRole]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, chatState]);

  const initChatHistory = async () => {
    setChatState('LOADING');
    try {
      // 1. Fetch conversations list
      const convListRes = await aiApi.getConversations();
      const convList = Array.isArray(convListRes) ? convListRes : [];
      setConversations(convList);

      // 2. Fetch the active/latest conversation and its messages
      const activeRes = await aiApi.getActiveConversation();
      if (activeRes?.conversation && activeRes.conversation.messages?.length > 0) {
        const c = activeRes.conversation;
        const formatted: Message[] = c.messages.map((m: any) => ({
          id: m.id || `msg-${Math.random()}`,
          role: m.role,
          content: m.content,
          sources: m.citations || [],
          farm_context: m.farm_context,
          confidence: m.confidence ?? m.metadata?.confidence,
          created_at: m.created_at || new Date().toISOString(),
        }));
        setMessages(formatted);
        setConversationId(c.id);
        if (c.messages[c.messages.length - 1]?.farm_context) {
          setFarmContext(c.messages[c.messages.length - 1].farm_context);
        }
        setChatState('LOADED_WITH_MESSAGES');
      } else if (convList.length > 0) {
        // Fallback: load first available conversation
        const firstId = convList[0].id;
        const historyRes = await aiApi.getMessages(firstId);
        const history = Array.isArray(historyRes) ? historyRes : (historyRes?.messages || []);
        if (Array.isArray(history) && history.length > 0) {
          const formatted: Message[] = history.map((m: any) => ({
            id: m.id || `msg-${Math.random()}`,
            role: m.role,
            content: m.content,
            sources: m.citations || [],
            farm_context: m.farm_context,
            confidence: m.confidence ?? m.metadata?.confidence,
            created_at: m.created_at || new Date().toISOString(),
          }));
          setMessages(formatted);
          setConversationId(firstId);
          setChatState('LOADED_WITH_MESSAGES');
        } else {
          setConversationId(firstId);
          setMessages([createWelcomeMessage()]);
          setChatState('LOADED_EMPTY');
        }
      } else {
        // Genuine empty state: no prior conversations
        setConversationId(undefined);
        setMessages([createWelcomeMessage()]);
        setChatState('LOADED_EMPTY');
      }

      if (initialQuery) {
        handleSendMessage(initialQuery);
      }
    } catch (err) {
      console.error('Failed to restore AI conversation history:', err);
      setChatState('ERROR');
    }
  };

  const loadConversations = async () => {
    try {
      setLoadingHistory(true);
      const data = await aiApi.getConversations();
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not load AI conversation history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSelectConversation = async (id: string) => {
    try {
      setChatState('LOADING');
      setIsHistoryOpen(false);
      const historyRes = await aiApi.getMessages(id);
      const history = Array.isArray(historyRes) ? historyRes : (historyRes?.messages || []);

      if (Array.isArray(history) && history.length > 0) {
        const formatted: Message[] = history.map((m: any) => ({
          id: m.id || `msg-${Math.random()}`,
          role: m.role,
          content: m.content,
          sources: m.citations || [],
          farm_context: m.farm_context,
          confidence: m.confidence ?? m.metadata?.confidence,
          created_at: m.created_at || new Date().toISOString(),
        }));
        setMessages(formatted);
        setConversationId(id);
        setChatState('LOADED_WITH_MESSAGES');
      } else {
        setConversationId(id);
        setMessages([createWelcomeMessage()]);
        setChatState('LOADED_EMPTY');
      }
    } catch (err) {
      console.error('Failed to load selected conversation:', err);
      setChatState('ERROR');
    }
  };

  const handleNewChat = () => {
    setConversationId(undefined);
    setMessages([createWelcomeMessage()]);
    setInputQuery('');
    setChatState('LOADED_EMPTY');
    setIsHistoryOpen(false);
  };

  const handleClearConversation = async () => {
    if (!conversationId) {
      handleNewChat();
      setShowClearConfirmModal(false);
      return;
    }

    try {
      setClearingConversation(true);
      await aiApi.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      handleNewChat();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setClearingConversation(false);
      setShowClearConfirmModal(false);
    }
  };

  const handleRetry = (failedMsgId: string, failedQuery: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== failedMsgId));
    executeSendMessage(failedQuery, true);
  };

  const handleSendMessage = (queryText?: string) => {
    executeSendMessage(queryText, false);
  };

  const executeSendMessage = async (queryText?: string, isRetry: boolean = false) => {
    const query = (queryText || inputQuery).trim();
    if (!query || isLoading) return;

    if (!isRetry) {
      setInputQuery('');
      const userMsgId = `user-${Date.now()}`;
      const newMsg: Message = {
        id: userMsgId,
        role: 'user',
        content: query,
        created_at: new Date().toISOString(),
      };

      setChatState('LOADED_WITH_MESSAGES');
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== 'welcome-1');
        return [...filtered, newMsg];
      });
    }

    setIsLoading(true);

    const aiMsgId = `ai-${Date.now()}`;
    const initialAiMsg: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, initialAiMsg]);

    let accumulatedContent = '';

    try {
      await aiApi.streamChat(
        query,
        conversationId,
        farmContext?.farm_id,
        // onToken
        (token: string) => {
          accumulatedContent += token;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: accumulatedContent } : m
            )
          );
        },
        // onStart
        (data: { conversation_id: string }) => {
          if (data.conversation_id) {
            setConversationId(data.conversation_id);
          }
        },
        // onDone
        (data: any) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                  ...m,
                  isStreaming: false,
                  sources: data.sources || [],
                  suggested_questions: data.suggested_questions || [],
                  farm_context: data.farm_context,
                  escalation_recommended: data.escalation_recommended,
                }
                : m
            )
          );
          if (data.conversation_id) setConversationId(data.conversation_id);
          if (data.farm_context) setFarmContext(data.farm_context);
          loadConversations();
        },
        undefined, // signal
        language // target language
      );
    } catch (streamErr) {
      console.warn('SSE stream failed, attempting standard REST fallback:', streamErr);
      if (!accumulatedContent) {
        try {
          const data = await aiApi.chat(query, conversationId, farmContext?.farm_id, language);
          if (data.conversation_id) {
            setConversationId(data.conversation_id);
          }
          if (data.farm_context) {
            setFarmContext(data.farm_context);
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                  ...m,
                  content: data.response,
                  isStreaming: false,
                  sources: data.sources || [],
                  suggested_questions: data.suggested_questions || [],
                  farm_context: data.farm_context,
                  escalation_recommended: data.escalation_recommended,
                }
                : m
            )
          );
          loadConversations();
          return;
        } catch (postErr) {
          console.error('REST fallback failed:', postErr);
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
              ...m,
              isStreaming: false,
              isError: true,
              failedQuery: query,
              content:
                accumulatedContent ||
                `⚠️ The AI Assistant is temporarily unavailable. Please check your connection and try again. If the issue persists, use **Expert Chat** to reach a human agricultural expert.`,
              suggested_questions: defaultSuggestions.slice(0, 2),
            }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  return (
    <div className="screen-fill-height bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/85 border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10 cursor-pointer"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            {/* Distinct AI Avatar — circuit chip motif, not the AgriGuard leaf, not a human */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0"
              style={{
                backgroundColor: tokens.soft,
                borderColor: tokens.border,
                borderWidth: '1px',
                borderStyle: 'solid',
                boxShadow: `0 0 15px ${tokens.glow}`,
              }}
              aria-label="AI Assistant"
            >
              <AIAvatar size={20} primaryColor={tokens.primary} glowColor={tokens.glow} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-white tracking-wide">{t('ai.title', undefined, 'AI Assistant')}</h1>
                <span
                  className="px-2 py-0.5 text-[10px] font-semibold rounded-full flex items-center gap-1"
                  style={{
                    backgroundColor: tokens.badgeBg,
                    color: tokens.badgeText,
                    borderColor: tokens.badgeBorder,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                >
                  <ShieldCheck className="w-3 h-3" /> {t('ai.groundedRag', undefined, 'Grounded RAG')}
                </span>
              </div>
              <p className="text-xs text-slate-400">{t('ai.aiDisclaimerBadge', undefined, 'AI Assistant — not a human expert')}</p>
            </div>
          </div>
        </div>

        {/* Action buttons in header */}
        <div className="flex items-center gap-2">
          {/* History Drawer Toggle */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer"
            title={t('ai.history', undefined, 'History')}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('ai.history', undefined, 'History')}</span>
            {conversations.length > 0 && (
              <span
                className="px-1.5 py-0.2 rounded-full text-[10px] font-bold"
                style={{ backgroundColor: tokens.badgeBg, color: tokens.badgeText }}
              >
                {conversations.length}
              </span>
            )}
          </button>

          {/* New Consultation */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer"
            title={t('ai.newChat', undefined, 'New')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('ai.newChat', undefined, 'New')}</span>
          </button>

          {/* Clear Current Conversation */}
          {messages.length > 1 && (
            <button
              onClick={() => setShowClearConfirmModal(true)}
              className="p-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-200 border border-red-500/30 transition-all cursor-pointer"
              title={t('ai.clearChat', undefined, 'Clear conversation')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Real Expert Chat Hand-Off */}
          {onNavigateExpert && (
            <button
              onClick={onNavigateExpert}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold border border-amber-500/30 transition-all cursor-pointer shadow-sm"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t('ai.talkToExpert', undefined, 'Talk to an Expert')}</span>
            </button>
          )}
        </div>
      </header>

      {/* Farm Context Bar */}
      {farmContext && farmContext.farm_name && (
        <div
          className="border-b px-4 py-2 flex items-center justify-between text-xs"
          style={{
            backgroundColor: tokens.soft,
            borderColor: tokens.border,
            color: tokens.text,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: tokens.primary }}
            />
            <span>
              {t('ai.activePlot', undefined, 'Active Plot')}: <strong>{farmContext.farm_name}</strong>
              {farmContext.crop && ` • ${t('ai.cropLabel', undefined, 'Crop')}: ${farmContext.crop}`}
              {farmContext.location && ` • ${farmContext.location}`}
            </span>
          </div>
          <span className="text-[11px] opacity-75">{t('ai.disclaimer', undefined, 'Verified agronomic context')}</span>
        </div>
      )}

      {/* Chat Messages Container */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto space-y-6">
        {chatState === 'LOADING' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 select-none">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-bold text-emerald-200">{t('common.loading', undefined, 'Loading conversation...')}</p>
          </div>
        )}

        {chatState === 'ERROR' && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center select-none">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">{t('common.error', undefined, 'Unable to load previous messages')}</h3>
            </div>
            <button
              onClick={() => initChatHistory()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer mx-auto shadow-lg shadow-emerald-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('common.retry', undefined, 'Retry')}</span>
            </button>
          </div>
        )}

        {chatState !== 'LOADING' && chatState !== 'ERROR' && messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSourcesOpen = expandedSources[msg.id];

          return (
            <div
              key={msg.id}
              className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Distinct AI avatar on messages — same circuit chip motif as header */}
              {!isUser && (
                <div
                  className="w-9 h-9 rounded-xl shrink-0 shadow-md flex items-center justify-center"
                  style={{
                    backgroundColor: tokens.soft,
                    borderColor: tokens.border,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                  aria-label={t('ai.title', undefined, 'AI Assistant')}
                >
                  <AIAvatar size={16} primaryColor={tokens.primary} glowColor={tokens.glow} />
                </div>
              )}

              <div
                role="article"
                tabIndex={0}
                aria-label={`${isUser ? 'You asked' : 'AI Assistant advised'}: ${msg.content}`}
                data-read-aloud-text={`${isUser ? 'You asked' : 'AI Assistant advised'}: ${msg.content}`}
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 sm:p-5 shadow-lg cursor-pointer ${isUser
                    ? 'rounded-br-none text-white'
                    : 'bg-slate-900/80 backdrop-blur-md border border-white/10 text-slate-200 rounded-bl-none'
                  }`}
                style={
                  isUser
                    ? {
                      background: tokens.gradient,
                      boxShadow: `0 4px 16px ${tokens.glow}`,
                      borderColor: tokens.border,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                    }
                    : undefined
                }
              >
                {/* Message header for AI — label is 'AI Assistant', not a person name */}
                {!isUser && (
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 text-[11px] text-slate-400">
                    <span className="font-semibold flex items-center gap-1.5" style={{ color: tokens.primary }}>
                      <AIAvatar size={11} primaryColor={tokens.primary} />
                      {t('ai.title', undefined, 'AI Assistant')}
                    </span>
                    <div className="flex items-center gap-2">
                      {msg.sources && msg.sources.length > 0 && (
                        <span className="text-slate-500 text-[10px]">
                          {msg.sources.length} {t('ai.sourceReferences', undefined, 'Sources')}
                        </span>
                      )}
                      {!msg.isStreaming && !msg.isError && msg.content && (
                        <button
                          onClick={() => copyMessage(msg.id, msg.content)}
                          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/5 transition cursor-pointer"
                          title={t('common.copy', undefined, 'Copy')}
                        >
                          {copiedMsgId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">{t('common.copied', undefined, 'Copied')}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>{t('common.copy', undefined, 'Copy')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Markdown text formatted paragraphs */}
                <div className="text-sm leading-relaxed space-y-3 select-text">
                  {msg.content.split('\n\n').map((paragraph, pIdx) => {
                    if (paragraph.startsWith('### ')) {
                      return (
                        <h3 key={pIdx} className="text-base font-bold mt-1 mb-1" style={{ color: tokens.text }}>
                          {paragraph.replace('### ', '')}
                        </h3>
                      );
                    }
                    if (paragraph.startsWith('#### ')) {
                      return (
                        <h4 key={pIdx} className="text-sm font-bold text-teal-300 mt-2">
                          {paragraph.replace('#### ', '')}
                        </h4>
                      );
                    }
                    if (paragraph.startsWith('> ')) {
                      return (
                        <blockquote key={pIdx} className="border-l-2 border-amber-400 pl-3 italic text-amber-200/90 text-xs my-2">
                          {paragraph.replace('> ', '')}
                        </blockquote>
                      );
                    }
                    if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                      const items = paragraph.split('\n');
                      return (
                        <ul key={pIdx} className="list-disc list-inside space-y-1 my-1 pl-1 text-slate-200">
                          {items.map((it, itIdx) => (
                            <li key={itIdx}>{it.replace(/^[-*]\s+/, '')}</li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={pIdx}>{paragraph}</p>;
                  })}
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-4 ml-1 bg-emerald-400 animate-pulse align-middle rounded-sm" />
                  )}
                </div>

                {/* Retry button for failed messages */}
                {msg.isError && msg.failedQuery && (
                  <div className="mt-3 pt-2 border-t border-red-500/20 flex items-center justify-between">
                    <span className="text-xs text-red-300">{t('common.error', undefined, 'Request could not be completed')}</span>
                    <button
                      onClick={() => handleRetry(msg.id, msg.failedQuery!)}
                      disabled={isLoading}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{t('common.retry', undefined, 'Retry')}</span>
                    </button>
                  </div>
                )}

                {/* Grounded Institutional Citations Box */}
                {!isUser && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <button
                      onClick={() => toggleSources(msg.id)}
                      className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium border border-white/5 transition-all cursor-pointer"
                      style={{ color: tokens.text }}
                    >
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        {msg.sources.length} {t('ai.sourceReferences', undefined, 'Verified Extension Sources')}
                      </span>
                      {isSourcesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {isSourcesOpen && (
                      <div className="mt-2 space-y-2">
                        {msg.sources.map((s, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-3 rounded-xl bg-slate-950/70 border border-white/10 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">{s.title}</span>
                              <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                                {(s.relevance_score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2">
                              <span><em>{s.source}</em></span>
                              {s.last_verified && <span>• {s.last_verified}</span>}
                            </div>
                            <p className="text-slate-300 text-[11px] line-clamp-2 pt-0.5 italic">
                              "{s.snippet}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Human Escalation Alert if recommended */}
                {!isUser && msg.escalation_recommended && onNavigateExpert && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs text-amber-200">
                        {t('ai.confidenceNotice', undefined, 'High-risk condition detected.')}
                      </span>
                    </div>
                    <button
                      onClick={onNavigateExpert}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-all shrink-0 shadow-md cursor-pointer"
                    >
                      {t('ai.talkToExpert', undefined, 'Talk to an Expert')}
                    </button>
                  </div>
                )}

                {/* Suggested follow-up questions */}
                {!isUser && msg.suggested_questions && msg.suggested_questions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      {t('ai.suggestedQuestions', undefined, 'Related Follow-ups')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggested_questions.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          onClick={() => handleSendMessage(q)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs border border-white/10 transition-all text-left cursor-pointer"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div
                  className="w-9 h-9 rounded-xl p-0.5 shrink-0 flex items-center justify-center"
                  style={{
                    backgroundColor: tokens.soft,
                    borderColor: tokens.border,
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                >
                  <User className="w-4 h-4" style={{ color: tokens.text }} />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3.5 justify-start">
            <div
              className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
              style={{
                backgroundColor: tokens.soft,
                borderColor: tokens.border,
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
              aria-label={t('ai.title', undefined, 'AI Assistant')}
            >
              <AIAvatar size={16} primaryColor={tokens.primary} glowColor={tokens.glow} />
            </div>
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl rounded-bl-none p-4 text-slate-300 text-sm flex items-center gap-3">
              <RefreshCw className="w-4 h-4 animate-spin" style={{ color: tokens.primary }} />
              <span>{t('ai.thinking', undefined, 'Analyzing agronomy data & verified institutional sources...')}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Suggested chips above input */}
      <div className="px-4 py-2 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
            <AIAvatar size={11} primaryColor={tokens.primary} /> {t('ai.suggestedQuestions', undefined, 'Quick Topics')}:
          </span>
          {defaultSuggestions.map((topic, tIdx) => (
            <button
              key={tIdx}
              onClick={() => handleSendMessage(topic)}
              className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs border border-white/10 transition-all shrink-0 whitespace-nowrap cursor-pointer"
            >
              {topic.length > 36 ? topic.substring(0, 36) + '...' : topic}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <footer className="sticky bottom-0 z-20 backdrop-blur-xl bg-slate-950/90 border-t border-white/10 p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <input
            type="text"
            id="ai-assistant-question-input"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={t('ai.askQuestion', undefined, 'Ask about crop symptoms, fertilizer dosage, pests, weather precautions...')}
            aria-label={t('ai.askQuestion', undefined, 'Ask about crop symptoms, fertilizer dosage, pests, weather precautions')}
            className="flex-1 bg-slate-900/90 border border-white/10 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
            disabled={isLoading}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputQuery.trim() || isLoading}
            aria-label={t('ai.send', undefined, 'Ask AI')}
            style={{
              background: tokens.gradient,
              color: tokens.contrast,
              boxShadow: `0 4px 16px ${tokens.glow}`,
            }}
            className="px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{t('ai.send', undefined, 'Ask')}</span>
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-600 mt-2 flex items-center justify-center gap-1.5">
          <AIAvatar size={10} primaryColor="#4b5563" />
          <span>{t('ai.disclaimer', undefined, 'AI Assistant — not a human expert · Powered by Claude (Anthropic) · Ground truth: ICAR & FAO research')}</span>
        </p>
      </footer>

      {/* ── Conversation History Slide-Over Drawer ── */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-slate-950/95 border-l border-white/10 h-full flex flex-col p-5 shadow-2xl animate-slide-left">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5" style={{ color: tokens.primary }} />
                <h2 className="text-base font-bold text-white">{t('ai.history', undefined, 'Consultation History')}</h2>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* New consultation action inside drawer */}
            <div className="pt-4 pb-3">
              <button
                onClick={handleNewChat}
                style={{
                  background: tokens.gradient,
                  color: tokens.contrast,
                  boxShadow: `0 0 16px ${tokens.glow}`,
                }}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('ai.newChat', undefined, 'Start New Consultation')}</span>
              </button>
            </div>

            {/* List of past conversations */}
            <div className="flex-1 overflow-y-auto space-y-2 pt-2 pr-1">
              {loadingHistory ? (
                <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t('common.loading', undefined, 'Loading past conversations...')}</span>
                </div>
              ) : conversations.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p>{t('chat.noMessagesYet', undefined, 'No previous conversations found.')}</p>
                </div>
              ) : (
                conversations.map((c) => {
                  const isSelected = conversationId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectConversation(c.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${isSelected
                          ? 'bg-white/10 border-white/30 text-white'
                          : 'bg-white/5 hover:bg-white/8 border-white/5 text-slate-300'
                        }`}
                      style={isSelected ? { borderColor: tokens.border } : undefined}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold line-clamp-1 flex-1 text-white">{c.title}</h4>
                        <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                          {c.message_count}
                        </span>
                      </div>
                      {c.context_summary && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-1 italic">
                          {c.context_summary}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1.5">
                        <Clock className="w-3 h-3" />
                        <span>
                          {c.updated_at
                            ? new Date(c.updated_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                            : 'Recent'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Conversation Confirmation Modal ── */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-red-500/30 text-left space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t('ai.clearChat', undefined, 'Clear Conversation?')}</h3>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                disabled={clearingConversation}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-300 transition cursor-pointer"
              >
                {t('common.cancel', undefined, 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleClearConversation}
                disabled={clearingConversation}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition cursor-pointer shadow-lg shadow-red-600/30 flex items-center gap-1.5"
              >
                {clearingConversation ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{t('common.delete', undefined, 'Clear')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
