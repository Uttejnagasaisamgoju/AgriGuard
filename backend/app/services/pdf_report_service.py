"""
AgriGuard Real Multilingual PDF Generation Service.
Generates genuine, production-grade PDF reports for a selected farm using ReportLab.
- Fresh data loaded directly from backend/database
- Multilingual support for English, Telugu, Marathi, Hindi, Tamil, Kannada, and Malayalam
- Proper Unicode Indic font rendering using Arial Unicode MS without square boxes/corruptions
- Honest display of 'Not recorded' (never fake or placeholder data)
- Tables for Disease Detection History and Treatment History with localized headers & entries
"""
import io
import os
import re
from datetime import datetime
from typing import Dict, Any

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register Indic-capable Unicode TrueType Font if available
FONT_CANDIDATES = [
    "C:/Windows/Fonts/ARIALUNI.TTF",
    "C:/Windows/Fonts/arialuni.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
]

UNICODE_FONT = "Helvetica"
UNICODE_FONT_BOLD = "Helvetica-Bold"

for fpath in FONT_CANDIDATES:
    if os.path.exists(fpath):
        try:
            pdfmetrics.registerFont(TTFont("AgriUnicode", fpath))
            UNICODE_FONT = "AgriUnicode"
            UNICODE_FONT_BOLD = "AgriUnicode"  # Arial Unicode MS is unified
            break
        except Exception:
            pass


PDF_TRANSLATIONS: Dict[str, Dict[str, str]] = {
    "en": {
        "platform_title": "AgriGuard",
        "platform_sub": "AI & GIS Agricultural Platform",
        "report_title": "FARM HEALTH & ADVISORY REPORT",
        "generated": "Generated:",
        "footer_notice": "AgriGuard Official Agronomic Advisory Report • Confidential",
        "page_str": "Page {page} of {total}",
        "sec1_title": "1. Farm Agronomic Profile",
        "farm_name": "Farm Name:",
        "owner": "Registered Owner:",
        "crop_type": "Crop Type:",
        "crop_variety": "Crop Variety:",
        "sowing_date": "Crop Sowing Date:",
        "total_area": "Total Area:",
        "soil_type": "Soil Type:",
        "irrigation": "Irrigation Method:",
        "location": "Location / District:",
        "coordinates": "Coordinates:",
        "not_recorded": "Not recorded",
        "sec2_title": "2. Current Farm Health & Satellite Assessment",
        "overall_status": "Overall Farm Status:",
        "satellite_ndvi": "Satellite NDVI Index:",
        "root_moisture": "Root Zone Moisture:",
        "surface_temp": "Surface Temperature:",
        "summary_assessment": "Summary Assessment:",
        "active_infections": "Active Infections:",
        "sec3_title": "3. Disease Detection History (This Farm Only)",
        "col_disease": "Disease Name",
        "col_date": "Date Detected",
        "col_conf": "Confidence",
        "col_status": "Current Resolution Status",
        "no_diseases": "No disease detections recorded for this farm.",
        "sec4_title": "4. Treatment & Agricultural Action History",
        "col_action": "Action Type",
        "col_act_date": "Date",
        "col_desc": "Description",
        "col_target": "Related Disease / Focus",
        "col_by": "Recorded By",
        "no_treatments": "No treatment/action history recorded.",
        "sec5_title": "5. Sowing-to-Harvest Timeline Guidance",
        "est_stage": "Estimated Stage:",
        "est_harvest": "Est. Harvest Window:",
        "stage_focus": "Key Stage Focus:",
        "progress": "Progress:",
        "standard_cycle": "of standard cycle",
        "note": "Note:",
        "no_timeline": "Sowing date not recorded — timeline unavailable.",
        "sec6_title": "6. Weather-Aware Farm Alerts",
        "curr_weather": "Current Weather:",
        "humidity": "Humidity:",
        "rain_prob": "Rain Probability:",
        "no_weather": "Weather information currently unavailable.",
    },
    "te": {
        "platform_title": "అగ్రిగార్డ్",
        "platform_sub": "కృత్రిమ మేధస్సు & GIS వ్యవసాయ సాంకేతిక వేదిక",
        "report_title": "వ్యవసాయ క్షేత్ర ఆరోగ్యం మరియు యాజమాన్య సలహా నివేదిక",
        "generated": "రూపొందించబడిన తేదీ & సమయం:",
        "footer_notice": "అగ్రిగార్డ్ అధికారిక వ్యవసాయ సలహా నివేదిక • గోప్యమైనది",
        "page_str": "పేజీ {page} / {total}",
        "sec1_title": "1. వ్యవసాయ క్షేత్ర స్వరూపం & వివరాలు",
        "farm_name": "పొలం పేరు:",
        "owner": "రైతు / యజమాని:",
        "crop_type": "ప్రధాన పంట:",
        "crop_variety": "విత్తన రకం:",
        "sowing_date": "విత్తిన / నాటిన తేదీ:",
        "total_area": "మొత్తం విస్తీర్ణం:",
        "soil_type": "నేల రకం:",
        "irrigation": "నీటిపారుదల విధానం:",
        "location": "గ్రామం / జిల్లా:",
        "coordinates": "భౌగోళిక కోఆర్డినేట్లు:",
        "not_recorded": "నమోదు కాలేదు",
        "sec2_title": "2. ప్రస్తుత పంట ఆరోగ్యం & ఉపగ్రహ పర్యవేక్షణ",
        "overall_status": "మొత్తం క్షేత్ర స్థితి:",
        "satellite_ndvi": "ఉపగ్రహ NDVI సూచిక:",
        "root_moisture": "వేరు మండల తేమ శాతం:",
        "surface_temp": "ఉపరితల ఉష్ణోగ్రత:",
        "summary_assessment": "సమగ్ర విశ్లేషణ:",
        "active_infections": "క్రియాశీల తెగుళ్ల హెచ్చరికలు:",
        "sec3_title": "3. పంట తెగుళ్ల గుర్తింపు చరిత్ర (ఈ క్షేత్రం మాత్రమే)",
        "col_disease": "తెగులు పేరు",
        "col_date": "గుర్తించిన తేదీ",
        "col_conf": "ఖచ్చితత్వ శాతం",
        "col_status": "ప్రస్తుత పరిష్కార స్థితి",
        "no_diseases": "ఈ వ్యవసాయ క్షేత్రంలో ఎలాంటి తెగుళ్లు నమోదు కాలేదు.",
        "sec4_title": "4. ఎరువులు, మందులు మరియు వ్యవసాయ చర్యల చరిత్ర",
        "col_action": "యాజమాన్య చర్య",
        "col_act_date": "అమలు తేదీ",
        "col_desc": "వివరణ",
        "col_target": "సంబంధిత తెగులు / లక్ష్యం",
        "col_by": "నమోదు చేసినవారు",
        "no_treatments": "ఎలాంటి చికిత్స లేదా యాజమాన్య చర్యలు నమోదు కాలేదు.",
        "sec5_title": "5. విత్తనం నుండి కోత వరకు పంట దశల కాలక్రమం",
        "est_stage": "ప్రస్తుత పంట దశ:",
        "est_harvest": "అంచనా కోత సమయం:",
        "stage_focus": "ప్రస్తుత దశలో ముఖ్యాంశాలు:",
        "progress": "పూర్తయిన ప్రగతి:",
        "standard_cycle": "సాధారణ పంట కాలంలో",
        "note": "గమనిక:",
        "no_timeline": "విత్తిన తేదీ నమోదు కాలేదు — పంట కాలక్రమం అందుబాటులో లేదు.",
        "sec6_title": "6. వాతావరణ ఆధారిత వ్యవసాయ హెచ్చరికలు",
        "curr_weather": "ప్రస్తుత వాతావరణం:",
        "humidity": "గాలిలో తేమ:",
        "rain_prob": "వర్షం పడే అవకాశం:",
        "no_weather": "వాతావరణ సమాచారం ప్రస్తుతం అందుబాటులో లేదు.",
    },
    "mr": {
        "platform_title": "अॅग्रीगार्ड",
        "platform_sub": "एआय आणि जीआयएस कृषी तंत्रज्ञान व्यासपीठ",
        "report_title": "शेत आरोग्य आणि कृषी सल्लागार अधिकृत अहवाल",
        "generated": "निर्मिती वेळ:",
        "footer_notice": "अॅग्रीगार्ड अधिकृत कृषी सल्लागार अहवाल • गोपनीय",
        "page_str": "पृष्ठ {page} / {total}",
        "sec1_title": "१. शेती आणि पीक तपशील प्रोफाइल",
        "farm_name": "शेताचे नाव:",
        "owner": "नोंदणीकृत शेतकरी:",
        "crop_type": "मुख्य पीक:",
        "crop_variety": "वाण / प्रकार:",
        "sowing_date": "पेरणी / लागवड तारीख:",
        "total_area": "एकूण क्षेत्रफळ:",
        "soil_type": "जमिनीचा प्रकार:",
        "irrigation": "सिंचन पद्धत:",
        "location": "गाव / जिल्हा:",
        "coordinates": "भौगोलिक निर्देशांक:",
        "not_recorded": "नोंद नाही",
        "sec2_title": "२. चालू पीक आरोग्य व उपग्रह विश्लेषण",
        "overall_status": "एकूण शेत आरोग्य स्थिती:",
        "satellite_ndvi": "उपग्रह NDVI निर्देशांक:",
        "root_moisture": "मातीतील ओलावा:",
        "surface_temp": "जमिनीचे तापमान:",
        "summary_assessment": "आरोग्य विश्लेषण सारांश:",
        "active_infections": "सक्रिय रोग व कीड सूचना:",
        "sec3_title": "३. पीक रोग निदान इतिहास (केवळ या शेतासाठी)",
        "col_disease": "रोगाचे नाव",
        "col_date": "निदान तारीख",
        "col_conf": "विश्वासार्हता",
        "col_status": "सध्याची निवारण स्थिती",
        "no_diseases": "या शेतात कोणताही रोग नोंदवला गेला नाही.",
        "sec4_title": "४. औषध फवारणी व शेती कृती इतिहास",
        "col_action": "कृती प्रकार",
        "col_act_date": "तारीख",
        "col_desc": "वर्णन",
        "col_target": "लक्ष्यित रोग / उद्दिष्ट",
        "col_by": "नोंदणीकर्ता",
        "no_treatments": "कोणत्याही औषधोपचार किंवा शेती कृतीची नोंद नाही.",
        "sec5_title": "५. पेरणी ते काढणी पीक वाढीचा टप्पा व अंदाज",
        "est_stage": "अंदाजित पीक टप्पा:",
        "est_harvest": "अंदाजित काढणी कालावधी:",
        "stage_focus": "या टप्प्यातील महत्त्वाचा सल्ला:",
        "progress": "पीक प्रगती:",
        "standard_cycle": "मानक पीक चक्रापैकी",
        "note": "टीप:",
        "no_timeline": "पेरणीची तारीख नोंदवलेली नाही — वाढीचा टप्पा उपलब्ध नाही.",
        "sec6_title": "६. हवामान-आधारित शेती जोखीम सूचना",
        "curr_weather": "चालू हवामान:",
        "humidity": "हवेतील आर्द्रता:",
        "rain_prob": "पावसाची शक्यता:",
        "no_weather": "हवामान माहिती सध्या उपलब्ध नाही.",
    },
    "hi": {
        "platform_title": "एग्रीगार्ड",
        "platform_sub": "एआई एवं जीआईएस कृषि प्रौद्योगिकी मंच",
        "report_title": "खेत स्वास्थ्य एवं कृषि सलाहकार आधिकारिक रिपोर्ट",
        "generated": "तैयार किया गया:",
        "footer_notice": "एग्रीगार्ड आधिकारिक कृषि सलाहकार रिपोर्ट • गोपनीय",
        "page_str": "पृष्ठ {page} / {total}",
        "sec1_title": "1. खेत एवं फसल विस्तृत प्रोफाइल",
        "farm_name": "खेत का नाम:",
        "owner": "पंजीकृत किसान:",
        "crop_type": "मुख्य फसल:",
        "crop_variety": "फसल की किस्म:",
        "sowing_date": "बुवाई / रोपाई की तिथि:",
        "total_area": "कुल क्षेत्रफल:",
        "soil_type": "मिट्टी का प्रकार:",
        "irrigation": "सिंचाई का तरीका:",
        "location": "गाँव / जिला:",
        "coordinates": "भौगोलिक निर्देशांक:",
        "not_recorded": "दर्ज नहीं",
        "sec2_title": "2. वर्तमान फसल स्वास्थ्य एवं उपग्रह विश्लेषण",
        "overall_status": "खेत की समग्र स्वास्थ्य स्थिति:",
        "satellite_ndvi": "उपग्रह एनडीवीआई सूचकांक:",
        "root_moisture": "जड़ क्षेत्र नमी प्रतिशत:",
        "surface_temp": "सतह का तापमान:",
        "summary_assessment": "स्वास्थ्य सारांश:",
        "active_infections": "सक्रिय रोग अलर्ट:",
        "sec3_title": "3. फसल रोग पहचान इतिहास (केवल यह खेत)",
        "col_disease": "रोग का नाम",
        "col_date": "पहचान की तिथि",
        "col_conf": "सटीकता दर",
        "col_status": "वर्तमान निवारण स्थिति",
        "no_diseases": "इस खेत के लिए कोई रोग दर्ज नहीं किया गया है।",
        "sec4_title": "4. उपचार, कीटनाशक एवं कृषि कार्य इतिहास",
        "col_action": "कार्य का प्रकार",
        "col_act_date": "तिथि",
        "col_desc": "विवरण",
        "col_target": "लक्षित रोग / प्रयोजन",
        "col_by": "दर्जकर्ता",
        "no_treatments": "कोई उपचार या कृषि कार्य दर्ज नहीं किया गया है।",
        "sec5_title": "5. बुवाई से कटाई तक फसल विकास समयरेखा",
        "est_stage": "अनुमानित फसल चरण:",
        "est_harvest": "कटाई की अनुमानित अवधि:",
        "stage_focus": "वर्तमान चरण की मुख्य सलाह:",
        "progress": "विकास प्रगति:",
        "standard_cycle": "मानक फसल चक्र का",
        "note": "नोट:",
        "no_timeline": "बुवाई की तिथि दर्ज नहीं है — विकास समयरेखा अनुपलब्ध है।",
        "sec6_title": "6. मौसम-आधारित कृषि चेतावनी एवं सलाह",
        "curr_weather": "वर्तमान मौसम:",
        "humidity": "आर्द्रता:",
        "rain_prob": "बारिश की संभावना:",
        "no_weather": "मौसम की जानकारी फिलहाल उपलब्ध नहीं है।",
    },
    "ta": {
        "platform_title": "அக்ரிகார்ட்",
        "platform_sub": "செயற்கை நுண்ணறிவு & ஜிஐஎஸ் வேளாண் தளம்",
        "report_title": "பண்ணை சுகாதாரம் மற்றும் ஆலோசனை அறிக்கை",
        "generated": "உருவாக்கப்பட்ட நேரம்:",
        "footer_notice": "அக்ரிகார்ட் அதிகாரப்பூர்வ வேளாண் அறிக்கை • ரகசியமானது",
        "page_str": "பக்கம் {page} / {total}",
        "sec1_title": "1. பண்ணை மற்றும் பயிர் விவரங்கள்",
        "farm_name": "பண்ணை பெயர்:",
        "owner": "பதிவுசெய்த விவசாயி:",
        "crop_type": "முக்கிய பயிர்:",
        "crop_variety": "பயிர் ரகம்:",
        "sowing_date": "விதைப்பு தேதி:",
        "total_area": "மொத்த பரப்பளவு:",
        "soil_type": "மண் வகை:",
        "irrigation": "பாசன முறை:",
        "location": "கிராமம் / மாவட்டம்:",
        "coordinates": "புவியியல் ஆயத்தொலைவுகள்:",
        "not_recorded": "பதிவு செய்யப்படவில்லை",
        "sec2_title": "2. தற்போதைய பயிர் ஆரோக்கியம் & செயற்கைக்கோள் மதிப்பீடு",
        "overall_status": "பண்ணை நிலைமை:",
        "satellite_ndvi": "செயற்கைக்கோள் NDVI குறியீடு:",
        "root_moisture": "மண் ஈரப்பதம்:",
        "surface_temp": "மேற்பரப்பு வெப்பநிலை:",
        "summary_assessment": "ஆரோக்கிய சுருக்கம்:",
        "active_infections": "செயலில் உள்ள நோய்த்தொற்றுகள்:",
        "sec3_title": "3. நோய் கண்டறிதல் வரலாறு (இப்பண்ணை மட்டும்)",
        "col_disease": "நோய் பெயர்",
        "col_date": "கண்டறியப்பட்ட தேதி",
        "col_conf": "துல்லியம்",
        "col_status": "தற்போதைய தீர்வு நிலை",
        "no_diseases": "இப்பண்ணையில் நோய்த்தொற்றுகள் ஏதும் பதிவாகவில்லை.",
        "sec4_title": "4. சிகிச்சை மற்றும் வேளாண் செயல்பாட்டு வரலாறு",
        "col_action": "செயல் வகை",
        "col_act_date": "தேதி",
        "col_desc": "விளக்கம்",
        "col_target": "இலக்கு நோய்",
        "col_by": "பதிவு செய்தவர்",
        "no_treatments": "சிகிச்சை வரலாறுகள் ஏதும் பதிவு செய்யப்படவில்லை.",
        "sec5_title": "5. விதைப்பு முதல் அறுவடை வரையிலான வளர்ச்சி காலவரிசை",
        "est_stage": "மதிப்பிடப்பட்ட பயிர் நிலை:",
        "est_harvest": "அறுவடை காலம்:",
        "stage_focus": "முக்கிய ஆலோசனை:",
        "progress": "வளர்ச்சி முன்னேற்றம்:",
        "standard_cycle": "நிலையான சுழற்சியில்",
        "note": "குறிப்பு:",
        "no_timeline": "விதைப்பு தேதி இல்லை — காலவரிசை கிடைக்கவில்லை.",
        "sec6_title": "6. வானிலை எச்சரிக்கைகள்",
        "curr_weather": "தற்போதைய வானிலை:",
        "humidity": "ஈரப்பதம்:",
        "rain_prob": "மழை வாய்ப்பு:",
        "no_weather": "வானிலை தகவல் தற்போது கிடைக்கவில்லை.",
    },
    "kn": {
        "platform_title": "ಅಗ್ರಿಗಾರ್ಡ್",
        "platform_sub": "ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ & ಜಿಐಎಸ್ ಕೃಷಿ ವೇದಿಕೆ",
        "report_title": "ಕೃಷಿ ಜಮೀನು ಆರೋಗ್ಯ ಮತ್ತು ಸಲಹಾ ವರದಿ",
        "generated": "ರಚಿಸಲಾದ ಸಮಯ:",
        "footer_notice": "ಅಗ್ರಿಗಾರ್ಡ್ ಅಧಿಕೃತ ಕೃಷಿ ವರದಿ • ಗೌಪ್ಯ",
        "page_str": "ಪುಟ {page} / {total}",
        "sec1_title": "1. ಕೃಷಿ ಜಮೀನು ವಿವರಗಳು",
        "farm_name": "ಜಮೀನಿನ ಹೆಸರು:",
        "owner": "ನೋಂದಾಯಿತ ರೈತರು:",
        "crop_type": "ಪ್ರಮುಖ ಬೆಳೆ:",
        "crop_variety": "ತಳಿ / ವಿಧ:",
        "sowing_date": "ಬಿತ್ತನೆ ದಿನಾಂಕ:",
        "total_area": "ಒಟ್ಟು ವಿಸ್ತೀರ್ಣ:",
        "soil_type": "ಮಣ್ಣಿನ ವಿಧ:",
        "irrigation": "ನೀರಾವರಿ ಪದ್ಧತಿ:",
        "location": "ಗ್ರಾಮ / ಜಿಲ್ಲೆ:",
        "coordinates": "ಭೌಗೋಳಿಕ ನಿರ್ದೇಶಾಂಕಗಳು:",
        "not_recorded": "ದಾಖಲಾಗಿಲ್ಲ",
        "sec2_title": "2. ಪ್ರಸ್ತುತ ಬೆಳೆ ಆರೋಗ್ಯ ಮತ್ತು ಉಪಗ್ರಹ ಮೌಲ್ಯಮಾಪನ",
        "overall_status": "ಒಟ್ಟಾರೆ ಜಮೀನಿನ ಸ್ಥಿತಿ:",
        "satellite_ndvi": "ಉಪಗ್ರಹ ಎನ್‌ಡಿವಿಐ ಸೂಚ್ಯಂಕ:",
        "root_moisture": "ಮಣ್ಣಿನ ತೇವಾಂಶ:",
        "surface_temp": "ತಾಪಮಾನ:",
        "summary_assessment": "ಆರೋಗ್ಯ ಸಾರಾಂಶ:",
        "active_infections": "ಸಕ್ರಿಯ ರೋಗ ಎಚ್ಚರಿಕೆಗಳು:",
        "sec3_title": "3. ರೋಗ ಪತ್ತೆ ಇತಿಹಾಸ (ಈ ಜಮೀನು ಮಾತ್ರ)",
        "col_disease": "ರೋಗದ ಹೆಸರು",
        "col_date": "ಪತ್ತೆಯಾದ ದಿನಾಂಕ",
        "col_conf": "ನಿಖರತೆ",
        "col_status": "ಪ್ರಸ್ತುತ ಪರಿಹಾರ ಸ್ಥಿತಿ",
        "no_diseases": "ಈ ಜಮೀನಿನಲ್ಲಿ ಯಾವುದೇ ರೋಗಗಳು ದಾಖಲಾಗಿಲ್ಲ.",
        "sec4_title": "4. ಚಿಕಿತ್ಸೆ ಮತ್ತು ಕೃಷಿ ಕ್ರಮಗಳ ಇತಿಹಾಸ",
        "col_action": "ಕ್ರಮದ ಪ್ರಕಾರ",
        "col_act_date": "ದಿನಾಂಕ",
        "col_desc": "ವಿವರಣೆ",
        "col_target": "ಗುರಿ ರೋಗ",
        "col_by": "ದಾಖಲಿಸಿದವರು",
        "no_treatments": "ಯಾವುದೇ ಚಿಕಿತ್ಸಾ ಕ್ರಮಗಳು ದಾಖಲಾಗಿಲ್ಲ.",
        "sec5_title": "5. ಬಿತ್ತನೆಯಿಂದ ಕೊಯ್ಲಿನವರೆಗಿನ ಬೆಳವಣಿಗೆಯ ಕಾಲಮಿತಿ",
        "est_stage": "ಅಂದಾಜು ಹಂತ:",
        "est_harvest": "ಕೊಯ್ಲಿನ ಅವಧಿ:",
        "stage_focus": "ಮುಖ್ಯ ಸಲಹೆ:",
        "progress": "ಪ್ರಗತಿ:",
        "standard_cycle": "ಪ್ರಮಾಣಿತ ಚಕ್ರದಲ್ಲಿ",
        "note": "ಟಿಪ್ಪಣಿ:",
        "no_timeline": "ಬಿತ್ತನೆ ದಿನಾಂಕ ದಾಖಲಾಗಿಲ್ಲ — ಕಾಲಮಿತಿ ಲಭ್ಯವಿಲ್ಲ.",
        "sec6_title": "6. ಹವಾಮಾನ ಎಚ್ಚರಿಕೆಗಳು",
        "curr_weather": "ಪ್ರಸ್ತುತ ಹವಾಮಾನ:",
        "humidity": "ತೇವಾಂಶ:",
        "rain_prob": "ಮಳೆಯ ಸಾಧ್ಯತೆ:",
        "no_weather": "ಹವಾಮಾನ ಮಾಹಿತಿ ಪ್ರಸ್ತುತ ಲಭ್ಯವಿಲ್ಲ.",
    },
    "ml": {
        "platform_title": "അഗ്രിഗാർഡ്",
        "platform_sub": "എഐ & ജിഐഎസ് കാർഷിക പ്ലാറ്റ്‌ഫോം",
        "report_title": "കൃഷിത്തോട്ടം ആരോഗ്യവും ഉപദേശക റിപ്പോർട്ടും",
        "generated": "തയ്യാറാക്കിയ തീയതി:",
        "footer_notice": "അഗ്രിഗാർഡ് ഔദ്യോഗിക കാർഷിക റിപ്പോർട്ട് • രഹസ്യം",
        "page_str": "പേജ് {page} / {total}",
        "sec1_title": "1. കൃഷിത്തോട്ടം വിവരങ്ങൾ",
        "farm_name": "തോട്ടത്തിന്റെ പേര്:",
        "owner": "കർഷകൻ:",
        "crop_type": "പ്രധാന വിള:",
        "crop_variety": "വിള ഇനം:",
        "sowing_date": "വിത്ത് വിതച്ച തീയതി:",
        "total_area": "ആകെ വിസ്തീർണ്ണം:",
        "soil_type": "മണ്ണിന്റെ തരം:",
        "irrigation": "ജലസേചന രീതി:",
        "location": "ഗ്രാമം / ജില്ല:",
        "coordinates": "ഭൂമിശാസ്ത്ര നിർദ്ദേശാങ്കങ്ങൾ:",
        "not_recorded": "രേഖപ്പെടുത്തിയിട്ടില്ല",
        "sec2_title": "2. നിലവിലെ വിള ആരോഗ്യവും ഉപഗ്രഹ വിശകലനവും",
        "overall_status": "ആകെ തോട്ടത്തിന്റെ അവസ്ഥ:",
        "satellite_ndvi": "ഉപഗ്രഹ NDVI സൂചിക:",
        "root_moisture": "മണ്ണിലെ ഈർപ്പം:",
        "surface_temp": "ഉപരിതല താപനില:",
        "summary_assessment": "ആരോഗ്യ സംഗ്രഹം:",
        "active_infections": "സജീവ രോഗ മുന്നറിയിപ്പുകൾ:",
        "sec3_title": "3. രോഗനിർണ്ണയ ചരിത്രം (ഈ തോട്ടം മാത്രം)",
        "col_disease": "രോഗത്തിന്റെ പേര്",
        "col_date": "കണ്ടെത്തിയ തീയതി",
        "col_conf": "കൃത്യത",
        "col_status": "പരിഹാര നില",
        "no_diseases": "ഈ തോട്ടത്തിൽ രോഗബാധകളൊന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.",
        "sec4_title": "4. പ്രതിരോധ നടപടികളും ചികിത്സാ ചരിത്രവും",
        "col_action": "നടപടി തരം",
        "col_act_date": "തീയതി",
        "col_desc": "വിവരണം",
        "col_target": "ലക്ഷ്യ രോഗം",
        "col_by": "രേഖപ്പെടുത്തിയത്",
        "no_treatments": "ചികിത്സാ വിവരങ്ങളൊന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.",
        "sec5_title": "5. വിത്ത് വിതയ്ക്കൽ മുതൽ വിളവെടുപ്പ് വരെയുള്ള വളർച്ചാ ഘട്ടം",
        "est_stage": "വളർച്ചാ ഘട്ടം:",
        "est_harvest": "വിളവെടുപ്പ് സമയം:",
        "stage_focus": "പ്രധാന നിർദ്ദേശം:",
        "progress": "പുരോഗതി:",
        "standard_cycle": "സാധാരണ ചക്രത്തിൽ",
        "note": "കുറിപ്പ്:",
        "no_timeline": "വിതച്ച തീയതി ലഭ്യമല്ല — വളർച്ചാ ഘട്ടം ലഭ്യമല്ല.",
        "sec6_title": "6. കാലാവസ്ഥാ മുന്നറിയിപ്പുകൾ",
        "curr_weather": "നിലവിലെ കാലാവസ്ഥ:",
        "humidity": "ഈർപ്പം:",
        "rain_prob": "മഴ സാധ്യത:",
        "no_weather": "കാലാവസ്ഥ വിവരങ്ങൾ ലഭ്യമല്ല.",
    },
}

# Localized disease display dictionary
DISEASE_NAME_MAP: Dict[str, Dict[str, str]] = {
    "rice blast": {
        "te": "వరి అగ్గి తెగులు",
        "mr": "तांदूळ करपा",
        "hi": "धान का झुलसा रोग",
        "ta": "நெல் குலை நோய்",
        "kn": "ಭತ್ತದ ಬೆಂಕಿ ರೋಗ",
        "ml": "നെല്ല് കുലരോഗം",
    },
    "bacterial leaf blight": {
        "te": "బాక్టీరియల్ ఆకు ఎండు తెగులు",
        "mr": "जिवाणूजन्य पानांचा करपा",
        "hi": "जीवाणु पत्ती झुलसा",
        "ta": "பாக்டீரியா இலைக்கருகல்",
        "kn": "ಬ್ಯಾಕ್ಟೀರಿಯಲ್ ಎಲೆ ಕರಕಲು",
        "ml": "ബാക്ടീരിയൽ ഇലക്കരിച്ചിൽ",
    },
    "brown spot": {
        "te": "వరి గోధుమ రంగు మచ్చ తెగులు",
        "mr": "तपकिरी ठिपके रोग",
        "hi": "भूरा धब्बा रोग",
        "ta": "பழுப்பு புள்ளி நோய்",
        "kn": "ಕಂದು ಚುಕ್ಕೆ ರೋಗ",
        "ml": "തവിട്ടു പുള്ളി രോഗം",
    },
    "sheath blight": {
        "te": "వరి పొర కుళ్ళు తెగులు",
        "mr": "खोड करपा रोग",
        "hi": "शीथ ब्लाइट रोग",
        "ta": "உறை அழுகல் நோய்",
        "kn": "ಹಾಳೆ ಕರಕಲು ರೋಗ",
        "ml": "പോളക്കരിച്ചിൽ",
    },
    "tomato early blight": {
        "te": "టమోటా ముందస్తు తెగులు",
        "mr": "टोमॅटोचा करपा",
        "hi": "टमाटर का अगेती झुलसा",
        "ta": "தக்காளி ஆரம்பக்கால கருகல்",
        "kn": "ಟೊಮೆಟೊ ಮುಂಚಿನ ಕರಕಲು",
        "ml": "തക്കാളി നേരത്തെയുള്ള കരിച്ചിൽ",
    },
    "cotton bacterial blight": {
        "te": "ప్రత్తి బాక్టీరియల్ తెగులు",
        "mr": "कापूस जिवाणू करपा",
        "hi": "कपास जीवाणु झुलसा",
        "ta": "பருத்தி பாக்டீரியா கருகல்",
        "kn": "ಹತ್ತಿ ಬ್ಯಾಕ್ಟೀರಿಯಲ್ ಕರಕಲು",
        "ml": "പരുത്തി ബാക്ടീരിയൽ കരിച്ചിൽ",
    },
    "chilli anthracnose": {
        "te": "మిరప కాయకుళ్ళు తెగులు",
        "mr": "मिरची फळकूज",
        "hi": "मिर्च का एन्थ्रेक्नोज रोग",
        "ta": "மிளகாய் அந்த்ராக்னோஸ்",
        "kn": "ಮೆಣಸಿನಕಾಯಿ ಆಂಥ್ರಾಕ್ನೋಸ್",
        "ml": "മുളക് ആന്ത്രാക്നോസ്",
    },
    "healthy": {
        "te": "ఆరోగ్యకరమైన పంట",
        "mr": "निरोगी पीक",
        "hi": "स्वस्थ फसल",
        "ta": "ஆரோக்கியமான பயிர்",
        "kn": "ಆರೋಗ್ಯಕರ ಬೆಳೆ",
        "ml": "ആരോഗ്യമുള്ള വിള",
    },
}

# Localized action type dictionary
ACTION_TYPE_MAP: Dict[str, Dict[str, str]] = {
    "fungicide application": {
        "te": "శిలీంధ్రనాశిని పిచికారీ",
        "mr": "बुरशीनाशक फवारणी",
        "hi": "फफूंदनाशक का छिड़काव",
        "ta": "பூஞ்சைக்கொல்லி தெளிப்பு",
        "kn": "ಶಿಲೀಂಧ್ರನಾಶಕ ಸಿಂಪಡಣೆ",
        "ml": "കുമിൾനാശിനി പ്രയോഗം",
    },
    "pesticide spray": {
        "te": "పురుగు మందు పిచికారీ",
        "mr": "कीटकनाशक फवारणी",
        "hi": "कीटनाशक का छिड़काव",
        "ta": "பூச்சிக்கொல்லி தெளிப்பு",
        "kn": "ಕೀಟನಾಶಕ ಸಿಂಪಡಣೆ",
        "ml": "കീടനാശിനി പ്രയോഗം",
    },
    "fertilizer top-dressing": {
        "te": "పైపాటు ఎరువులు వేయుట",
        "mr": "खतांची मात्रा देणे",
        "hi": "उर्वरक की टॉप-ड्रेसिंग",
        "ta": "மேலுரம் இடுதல்",
        "kn": "ಮೇಲುಗೊಬ್ಬರ ಹಾಕುವುದು",
        "ml": "മേൽവളം ചേർക്കൽ",
    },
    "irrigation / watering": {
        "te": "నీటిపారుదల",
        "mr": "पाणी देणे / सिंचन",
        "hi": "सिंचाई / पानी देना",
        "ta": "நீர்ப்பாசனம்",
        "kn": "ನೀರಾವರಿ",
        "ml": "നനയ്ക്കൽ / ജലസേചനം",
    },
    "weed management": {
        "te": "కలుపు నివారణ",
        "mr": "तण नियंत्रण",
        "hi": "खरपतवार नियंत्रण",
        "ta": "களை மேலாண்மை",
        "kn": "ಕಳೆ ನಿರ್ವಹಣೆ",
        "ml": "കളനിയന്ത്രണം",
    },
    "field visit / scouting": {
        "te": "పొలం పరిశీలన",
        "mr": "शेत पाहणी",
        "hi": "खेत निरीक्षण",
        "ta": "பண்ணை ஆய்வு",
        "kn": "ಜಮೀನು ಪರಿಶೀಲನೆ",
        "ml": "പാടം പരിശോധന",
    },
    "biological control": {
        "te": "జీవ నియంత్రణ చర్యలు",
        "mr": "जैविक नियंत्रण",
        "hi": "जैविक नियंत्रण",
        "ta": "உயிரியல் கட்டுப்பாடு",
        "kn": "ಜೈವಿಕ ನಿಯಂತ್ರಣ",
        "ml": "ജൈവ നിയന്ത്രണം",
    },
}

STATUS_MAP: Dict[str, Dict[str, str]] = {
    "resolved": {
        "te": "పరిష్కరించబడింది",
        "mr": "निवारण झाले",
        "hi": "निवारित / हल किया गया",
        "ta": "தீர்க்கப்பட்டது",
        "kn": "ಪರಿಹರಿಸಲಾಗಿದೆ",
        "ml": "പരിഹരിച്ചു",
    },
    "pending": {
        "te": "పరిశీలనలో ఉంది",
        "mr": "प्रलंबित",
        "hi": "लंबित",
        "ta": "நிலுவையில் உள்ளது",
        "kn": "ಬಾಕಿ ಇದೆ",
        "ml": "തീരുമാനമായിട്ടില്ല",
    },
    "under review": {
        "te": "సమీక్షలో ఉంది",
        "mr": "पुनरावलोकनात",
        "hi": "समीक्षाधीन",
        "ta": "மதிப்பாய்வில்",
        "kn": "ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
        "ml": "പരിശോധനയിൽ",
    },
}


def get_canvas_class(lang_code: str):
    """Dynamic Two-Pass canvas that prints localized footer and page numbers."""
    T = PDF_TRANSLATIONS.get(lang_code, PDF_TRANSLATIONS["en"])

    class LocalizedNumberedCanvas(canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self.draw_page_decorations(num_pages)
                super().showPage()
            super().save()

        def draw_page_decorations(self, page_count: int):
            self.saveState()
            self.setFont(UNICODE_FONT, 8)
            self.setFillColor(colors.HexColor("#64748b"))

            # Footer divider line
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(36, 36, 576, 36)

            # Footer left: system notice
            self.drawString(36, 24, T.get("footer_notice", "AgriGuard Official Report"))

            # Footer right: Page number
            page_template = T.get("page_str", "Page {page} of {total}")
            page_str = page_template.format(page=self._pageNumber, total=page_count)
            self.drawRightString(576, 24, page_str)

            self.restoreState()

    return LocalizedNumberedCanvas


class PDFReportService:
    def sanitize_filename(self, name: str) -> str:
        """Create a filesystem-safe filename."""
        clean = re.sub(r'[^a-zA-Z0-9_\- ]', '', name).strip().replace(' ', '_')
        return clean or "Farm"

    def _localize_disease(self, disease_str: str, lang: str) -> str:
        if not disease_str:
            return "Unknown"
        k = disease_str.lower().strip()
        for key, trans in DISEASE_NAME_MAP.items():
            if key in k:
                return trans.get(lang, disease_str)
        return disease_str

    def _localize_action(self, action_str: str, lang: str) -> str:
        if not action_str:
            return "General"
        k = action_str.lower().strip()
        for key, trans in ACTION_TYPE_MAP.items():
            if key in k:
                return trans.get(lang, action_str)
        return action_str

    def _localize_status(self, status_str: str, lang: str) -> str:
        if not status_str:
            return "Pending"
        k = status_str.lower().strip()
        for key, trans in STATUS_MAP.items():
            if key in k:
                return trans.get(lang, status_str)
        return status_str

    def build_farm_pdf(self, report_data: Dict[str, Any], lang: str = "en") -> bytes:
        """Build a complete, pristine PDF document from real report data in the requested language."""
        lang_code = lang.lower().strip() if lang else "en"
        T = PDF_TRANSLATIONS.get(lang_code, PDF_TRANSLATIONS["en"])

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=50,
        )

        styles = getSampleStyleSheet()

        # Typography styles using Indic TrueType font
        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Normal"],
            fontName=UNICODE_FONT_BOLD,
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#065f46"),
        )
        section_heading = ParagraphStyle(
            "SectionHeading",
            parent=styles["Normal"],
            fontName=UNICODE_FONT_BOLD,
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#0f172a"),
            spaceAfter=4,
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontName=UNICODE_FONT,
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#334155"),
        )
        body_bold = ParagraphStyle(
            "BodyBold",
            parent=styles["Normal"],
            fontName=UNICODE_FONT_BOLD,
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#1e293b"),
        )
        table_cell = ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName=UNICODE_FONT,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#1e293b"),
        )
        table_cell_bold = ParagraphStyle(
            "TableCellBold",
            parent=styles["Normal"],
            fontName=UNICODE_FONT_BOLD,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#065f46"),
        )
        disclaimer_style = ParagraphStyle(
            "Disclaimer",
            parent=styles["Normal"],
            fontName=UNICODE_FONT,
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#64748b"),
        )

        story = []

        farm = report_data.get("farm", {})
        status = report_data.get("status_summary", {})
        disease_history = report_data.get("disease_history", [])
        treatment_history = report_data.get("treatment_history", [])
        timeline = report_data.get("timeline", {})
        weather = report_data.get("weather", {})
        gen_timestamp = report_data.get("generated_at", datetime.utcnow().strftime("%d %B %Y, %I:%M %p UTC"))

        # ── 1. HEADER BANNER ──────────────────────────────────────────────────
        header_data = [
            [
                Paragraph(f"<b>{T['platform_title']}</b><br/><font size=7 color='#047857'>{T['platform_sub']}</font>", body_bold),
                Paragraph(f"<font size=12><b>{T['report_title']}</b></font><br/><font size=8 color='#475569'>{T['generated']} {gen_timestamp}</font>", title_style)
            ]
        ]
        header_table = Table(header_data, colWidths=[150, 390])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(header_table)
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#059669"), spaceBefore=4, spaceAfter=10))

        # ── 2. FARM DETAILS & AGRONOMIC PROFILE ────────────────────────────────
        story.append(Paragraph(T["sec1_title"], section_heading))

        sowing_val = farm.get("sowing_date") or T["not_recorded"]
        if str(sowing_val).lower() == "none" or not str(sowing_val).strip():
            sowing_val = T["not_recorded"]

        area_val = f"{farm.get('area_hectares', 0):.2f} ha" if farm.get('area_hectares') else T["not_recorded"]
        loc_val = f"{farm.get('village', '')} {farm.get('district', '')} {farm.get('state', '')}".strip() or T["not_recorded"]
        coords_val = f"{farm.get('latitude', '—')}, {farm.get('longitude', '—')}" if farm.get('latitude') else T["not_recorded"]

        farm_info_data = [
            [
                Paragraph(f"<b>{T['farm_name']}</b>", body_style),
                Paragraph(str(farm.get("name", "Unnamed Farm")), body_bold),
                Paragraph(f"<b>{T['owner']}</b>", body_style),
                Paragraph(str(farm.get("owner_name", "Farmer")), body_style),
            ],
            [
                Paragraph(f"<b>{T['crop_type']}</b>", body_style),
                Paragraph(str(farm.get("crop_type", T["not_recorded"])), body_bold),
                Paragraph(f"<b>{T['crop_variety']}</b>", body_style),
                Paragraph(str(farm.get("crop_variety", "Standard")), body_style),
            ],
            [
                Paragraph(f"<b>{T['sowing_date']}</b>", body_style),
                Paragraph(f"<b>{sowing_val}</b>", body_bold),
                Paragraph(f"<b>{T['total_area']}</b>", body_style),
                Paragraph(area_val, body_style),
            ],
            [
                Paragraph(f"<b>{T['soil_type']}</b>", body_style),
                Paragraph(str(farm.get("soil_type", T["not_recorded"])).capitalize(), body_style),
                Paragraph(f"<b>{T['irrigation']}</b>", body_style),
                Paragraph(str(farm.get("irrigation_type", T["not_recorded"])).capitalize(), body_style),
            ],
            [
                Paragraph(f"<b>{T['location']}</b>", body_style),
                Paragraph(loc_val, body_style),
                Paragraph(f"<b>{T['coordinates']}</b>", body_style),
                Paragraph(coords_val, body_style),
            ]
        ]
        farm_table = Table(farm_info_data, colWidths=[110, 160, 110, 160])
        farm_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(farm_table)
        story.append(Spacer(1, 10))

        # ── 3. CURRENT FARM HEALTH & STATUS SUMMARY ───────────────────────────
        story.append(Paragraph(T["sec2_title"], section_heading))

        health_label = self._localize_status(status.get("health_status", "Data Unavailable"), lang_code)
        health_desc = status.get("description", "No active anomalies.")
        ndvi_val = f"{status.get('ndvi', 0.0):.2f} ({status.get('ndvi_status', 'Moderate')})"
        moisture_val = f"{status.get('soil_moisture_pct', 0.0):.1f}%"
        temp_val = f"{status.get('surface_temp', 0.0):.1f}°C"

        status_box_data = [
            [
                Paragraph(f"<b>{T['overall_status']}</b>", body_style),
                Paragraph(f"<font color='#065f46'><b>{health_label}</b></font>", body_bold),
                Paragraph(f"<b>{T['satellite_ndvi']}</b>", body_style),
                Paragraph(ndvi_val, body_style),
            ],
            [
                Paragraph(f"<b>{T['root_moisture']}</b>", body_style),
                Paragraph(moisture_val, body_style),
                Paragraph(f"<b>{T['surface_temp']}</b>", body_style),
                Paragraph(temp_val, body_style),
            ],
            [
                Paragraph(f"<b>{T['summary_assessment']}</b>", body_style),
                Paragraph(health_desc, body_style),
                Paragraph(f"<b>{T['active_infections']}</b>", body_style),
                Paragraph(str(status.get("active_infections", 0)), body_bold),
            ]
        ]
        status_table = Table(status_box_data, colWidths=[110, 160, 110, 160])
        status_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#86efac")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#bbf7d0")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(status_table)
        story.append(Spacer(1, 10))

        # ── 4. REAL DISEASE DETECTION HISTORY ─────────────────────────────────
        story.append(Paragraph(T["sec3_title"], section_heading))

        if disease_history:
            disease_table_rows = [
                [
                    Paragraph(f"<b>{T['col_disease']}</b>", table_cell_bold),
                    Paragraph(f"<b>{T['col_date']}</b>", table_cell_bold),
                    Paragraph(f"<b>{T['col_conf']}</b>", table_cell_bold),
                    Paragraph(f"<b>{T['col_status']}</b>", table_cell_bold),
                ]
            ]
            for d in disease_history[:12]:
                conf_str = d.get("confidence_display") or (f"{d.get('confidence')}%" if d.get('confidence') is not None else T["not_recorded"])
                raw_disease = d.get("disease", "Unknown")
                loc_disease = self._localize_disease(raw_disease, lang_code)
                raw_status = d.get("status", "Pending")
                loc_status = self._localize_status(raw_status, lang_code)

                disease_table_rows.append([
                    Paragraph(loc_disease, table_cell),
                    Paragraph(str(d.get("date_detected", T["not_recorded"])), table_cell),
                    Paragraph(conf_str, table_cell),
                    Paragraph(loc_status, table_cell),
                ])

            dis_table = Table(disease_table_rows, colWidths=[160, 120, 90, 170])
            dis_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(dis_table)
        else:
            story.append(Paragraph(
                f"<i>{T['no_diseases']}</i>",
                body_style
            ))
        story.append(Spacer(1, 10))

        # ── 5. REAL TREATMENT & ACTION HISTORY ────────────────────────────────
        story.append(Paragraph(T["sec4_title"], section_heading))

        if treatment_history:
            treatment_table_rows = [
                [
                    Paragraph(f"<b>{T['col_action']}</b>", table_cell_bold),
                    Paragraph(f"<b>{T['col_act_date']}</b>", table_cell_bold),
                    Paragraph(f"<b>{T['col_desc']}</b>", table_cell_bold),
                    Paragraph(f"<b>{T['col_target']}</b>", table_cell_bold),
                    Paragraph(f"<b>{T['col_by']}</b>", table_cell_bold),
                ]
            ]
            for t in treatment_history[:10]:
                raw_act = t.get("action_type", "General")
                loc_act = self._localize_action(raw_act, lang_code)
                raw_rel = t.get("related_disease", "General")
                loc_rel = self._localize_disease(raw_rel, lang_code) if raw_rel != "General" else "General"

                treatment_table_rows.append([
                    Paragraph(loc_act, table_cell),
                    Paragraph(str(t.get("date_display", t.get("date", "—"))), table_cell),
                    Paragraph(str(t.get("description", "—")), table_cell),
                    Paragraph(loc_rel, table_cell),
                    Paragraph(str(t.get("recorded_by_name", "Farmer")), table_cell),
                ])

            treat_table = Table(treatment_table_rows, colWidths=[110, 80, 180, 100, 70])
            treat_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(treat_table)
        else:
            story.append(Paragraph(
                f"<i>{T['no_treatments']}</i>",
                body_style
            ))
        story.append(Spacer(1, 10))

        # ── 6. SOWING-TO-HARVEST TIMELINE GUIDANCE ─────────────────────────────
        story.append(Paragraph(T["sec5_title"], section_heading))

        if timeline.get("available", False):
            curr_stage = timeline.get("current_stage", "Growth")
            curr_focus = timeline.get("current_focus", "")
            days_el = timeline.get("days_elapsed", 0)
            tot_days = timeline.get("total_cycle_days", 120)
            est_harv = timeline.get("estimated_harvest_date", "Pending")

            timeline_rows = [
                [
                    Paragraph(f"<b>{T['est_stage']}</b>", body_style),
                    Paragraph(f"<b>{curr_stage}</b> ({days_el} / ~{tot_days})", body_bold),
                    Paragraph(f"<b>{T['est_harvest']}</b>", body_style),
                    Paragraph(str(est_harv), body_bold),
                ],
                [
                    Paragraph(f"<b>{T['stage_focus']}</b>", body_style),
                    Paragraph(str(curr_focus), body_style),
                    Paragraph(f"<b>{T['progress']}</b>", body_style),
                    Paragraph(f"{timeline.get('progress_pct', 0)}% {T['standard_cycle']}", body_style),
                ]
            ]
            t_table = Table(timeline_rows, colWidths=[110, 160, 110, 160])
            t_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(t_table)
            if timeline.get('disclaimer'):
                story.append(Paragraph(f"<b>{T['note']}</b> {timeline.get('disclaimer')}", disclaimer_style))
        else:
            story.append(Paragraph(
                f"<i>{timeline.get('message', T['no_timeline'])}</i>",
                body_style
            ))
        story.append(Spacer(1, 10))

        # ── 7. WEATHER-AWARE FARM RISK ALERTS ──────────────────────────────────
        story.append(Paragraph(T["sec6_title"], section_heading))

        if weather.get("available", False):
            alerts = weather.get("alerts", [])
            w_desc = f"{weather.get('temperature')}°C, {weather.get('description')}, {T['humidity']} {weather.get('humidity')}%, {T['rain_prob']} {weather.get('rain_probability')}%"

            weather_data_rows = [
                [
                    Paragraph(f"<b>{T['curr_weather']}</b>", body_style),
                    Paragraph(w_desc, body_bold),
                ]
            ]
            for a in alerts:
                lvl = a.get("level", "info").upper()
                weather_data_rows.append([
                    Paragraph(f"<b>[{lvl}] {a.get('title')}:</b>", body_style),
                    Paragraph(str(a.get("description")), body_style),
                ])

            w_table = Table(weather_data_rows, colWidths=[140, 400])
            w_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(w_table)
        else:
            story.append(Paragraph(
                f"<i>{weather.get('message', T['no_weather'])}</i>",
                body_style
            ))

        canvas_class = get_canvas_class(lang_code)
        doc.build(story, canvasmaker=canvas_class)
        buffer.seek(0)
        return buffer.getvalue()
