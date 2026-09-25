"""
Database seed — only runs in development/demo mode.
Seeds disease library and demo users. Never fakes predictions or live data.
"""
import logging
from sqlalchemy.orm import Session
from app.models.disease import Disease, DiseaseCategory, RiskLevel, DiseasePrediction
from app.models.user import User, UserRole
from app.models.chat import ExpertProfile, Conversation, Message, MessageType
from app.models.farm import Farm, SoilType, IrrigationType
from app.models.officer import OfficerCase, CaseStatus
from app.auth.security import hash_password
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def seed_database(db: Session):
    """Seed initial development data"""
    _seed_diseases(db)
    _seed_demo_users(db)
    _seed_farms_and_cases(db)
    logger.info("Seed data applied")


def _seed_diseases(db: Session):
    """Seed comprehensive disease library with authentic botanical reference images"""
    if db.query(Disease).count() > 0:
        return

    diseases = [
        Disease(
            name="Brown Spot",
            scientific_name="Bipolaris oryzae",
            crop_type="Rice",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.HIGH,
            ml_class_name="Rice___Brown_Spot",
            symptoms="Small, oval to circular brown spots with yellow halo on leaves. Spots enlarge to become brown with gray centers.",
            causes="Caused by the fungus Bipolaris oryzae. Favored by high humidity, warm temperatures, and nutrient-deficient soils.",
            affected_parts=["leaves", "glumes", "grains"],
            prevention="Use resistant varieties. Maintain proper soil nutrition especially potassium. Avoid water stress.",
            management="Apply fungicides containing tricyclazole or propiconazole. Improve soil nutrition. Remove infected debris.",
            treatment="Fungicide application: Mancozeb 75% WP at 2g/L water. Repeat after 10-15 days if needed.",
            favorable_conditions="Temperature 25-35°C, relative humidity above 80%, nitrogen-deficient soils",
            reference_images=["/diseases/rice_brown_spot.jpg"],
        ),
        Disease(
            name="Leaf Blast",
            scientific_name="Pyricularia oryzae",
            crop_type="Rice",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.CRITICAL,
            ml_class_name="Rice___Leaf_Blast",
            symptoms="Diamond-shaped lesions with gray centers and dark brown borders. Lesions may coalesce causing leaf death.",
            causes="Caused by Magnaporthe oryzae. Spreads through spores. Favored by cool nights, heavy dew, and excessive nitrogen.",
            affected_parts=["leaves", "nodes", "panicle", "neck"],
            prevention="Use blast-resistant varieties. Balanced fertilization. Avoid excessive nitrogen.",
            management="Apply systemic fungicides (tricyclazole, isoprothiolane). Silicon fertilization increases resistance.",
            treatment="Tricyclazole 75% WP at 0.6g/L water at early symptom stage. Carbendazim 50% WP as alternative.",
            favorable_conditions="Temperature 20-28°C, humidity >90%, long leaf wetness periods",
            reference_images=["/diseases/rice_blast.jpg"],
        ),
        Disease(
            name="Bacterial Blight",
            scientific_name="Xanthomonas oryzae pv. oryzae",
            crop_type="Rice",
            category=DiseaseCategory.BACTERIAL,
            risk_level=RiskLevel.HIGH,
            ml_class_name="Rice___Bacterial_Blight",
            symptoms="Water-soaked leaf margins that turn yellow then white. Leaves dry and turn grayish-white.",
            causes="Caused by Xanthomonas oryzae. Spreads through water, wind, and mechanical damage.",
            affected_parts=["leaves", "vascular system"],
            prevention="Use resistant varieties. Avoid excessive nitrogen. Proper water management.",
            management="No effective chemical control. Remove infected plants. Use copper-based bactericides preventively.",
            treatment="Copper oxychloride 50% WP at 3g/L water for preventive protection. Remove and destroy infected material.",
            favorable_conditions="Temperature 25-34°C, high humidity, flooding conditions",
            reference_images=["/diseases/rice_bacterial_blight.jpg"],
        ),
        Disease(
            name="Early Blight",
            scientific_name="Alternaria solani",
            crop_type="Tomato",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.MEDIUM,
            ml_class_name="Tomato___Early_blight",
            symptoms="Dark brown spots with concentric rings forming a target pattern. Yellow halo surrounds spots. Lower leaves affected first.",
            causes="Alternaria solani fungus. Thrives in warm, humid conditions. Spreads via water splash and wind.",
            affected_parts=["leaves", "stems", "fruit"],
            prevention="Crop rotation. Resistant varieties. Stake plants for air circulation. Mulching.",
            management="Remove infected leaves. Apply fungicides (chlorothalonil, mancozeb). Ensure proper plant spacing.",
            treatment="Chlorothalonil 75% WP at 2g/L water. Apply every 7-10 days. Alternate with mancozeb to prevent resistance.",
            favorable_conditions="Temperature 24-29°C, high humidity, alternating wet/dry conditions",
            reference_images=["/diseases/tomato_early_blight.jpg"],
        ),
        Disease(
            name="Late Blight",
            scientific_name="Phytophthora infestans",
            crop_type="Tomato",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.CRITICAL,
            ml_class_name="Tomato___Late_blight",
            symptoms="Water-soaked greenish-gray spots on leaves. White fuzzy growth on undersides. Rapid browning and death.",
            causes="Oomycete Phytophthora infestans. Spreads rapidly in cool, wet conditions. Waterborne pathogen.",
            affected_parts=["leaves", "stems", "fruit"],
            prevention="Plant certified disease-free seeds. Avoid overhead irrigation. Resistant varieties.",
            management="Apply protectant fungicides before disease onset. Systemic fungicides (metalaxyl) when infected.",
            treatment="Metalaxyl + mancozeb at 2.5g/L water. Ridomil Gold MZ or similar. Act immediately upon detection.",
            favorable_conditions="Temperature 10-25°C, relative humidity >90%, rain or heavy dew",
            reference_images=["/diseases/tomato_late_blight.jpg"],
        ),
        Disease(
            name="Mosaic Virus",
            scientific_name="Tomato mosaic virus (ToMV)",
            crop_type="Tomato",
            category=DiseaseCategory.VIRAL,
            risk_level=RiskLevel.HIGH,
            ml_class_name="Tomato___Tomato_mosaic_virus",
            symptoms="Mottled light and dark green pattern on leaves. Leaf distortion, curling. Stunted growth. Reduced fruit quality.",
            causes="Tomato mosaic virus transmitted by aphids, mechanical contact, and infected seeds.",
            affected_parts=["leaves", "stems", "fruit"],
            prevention="Use virus-free seeds. Control aphid vectors. Disinfect tools. Remove infected plants.",
            management="No chemical treatment. Remove infected plants. Control vectors. Plant resistant varieties.",
            treatment="No direct treatment available. Focus on vector control (aphids) using appropriate insecticides.",
            favorable_conditions="Warm temperatures. High aphid populations. Mechanical damage to plants.",
            reference_images=["/diseases/tomato_mosaic_virus.jpg"],
        ),
        Disease(
            name="Early Blight",
            scientific_name="Alternaria solani",
            crop_type="Potato",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.MEDIUM,
            ml_class_name="Potato___Early_blight",
            symptoms="Small, dark brown spots with concentric rings on lower/older leaves. Yellow halo. Defoliation in severe cases.",
            causes="Alternaria solani fungus. Warm days with cool nights favor infection.",
            affected_parts=["leaves", "stems", "tubers"],
            prevention="Certified seed tubers. Crop rotation. Resistant varieties. Adequate plant nutrition.",
            management="Fungicide applications. Remove infected plant debris. Maintain plant vigor.",
            treatment="Mancozeb 75% WP at 2g/L or chlorothalonil at 2g/L. Begin at first sign of disease.",
            favorable_conditions="Temperature 24-29°C, high humidity, alternating wet and dry periods",
            reference_images=["/diseases/potato_early_blight.jpg"],
        ),
        Disease(
            name="Late Blight",
            scientific_name="Phytophthora infestans",
            crop_type="Potato",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.CRITICAL,
            ml_class_name="Potato___Late_blight",
            symptoms="Water-soaked lesions on leaves turning brown. White mold on underside in humid conditions. Tuber rot.",
            causes="Phytophthora infestans. Spreads rapidly via spores in wet conditions.",
            affected_parts=["leaves", "stems", "tubers"],
            prevention="Certified seed tubers. Resistant varieties. Hilling. Remove volunteers.",
            management="Immediate fungicide application. Destroy infected foliage before harvest.",
            treatment="Metalaxyl 8% + mancozeb 64% WP at 2.5g/L. Chlorothalonil 75% WP as alternative.",
            favorable_conditions="Cool temperatures 10-20°C, >90% relative humidity, rain",
            reference_images=["/diseases/potato_late_blight.jpg"],
        ),
        Disease(
            name="Common Rust",
            scientific_name="Puccinia sorghi",
            crop_type="Maize",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.MEDIUM,
            ml_class_name="Corn_(maize)___Common_rust_",
            symptoms="Small, powdery, brick-red to brown pustules on both leaf surfaces. Pustules rupture releasing rust-colored spores.",
            causes="Puccinia sorghi fungus. Wind-dispersed spores. Favored by moderate temperatures and high humidity.",
            affected_parts=["leaves", "husks", "stalks"],
            prevention="Resistant hybrid varieties. Early planting. Adequate plant spacing.",
            management="Fungicide application if economically justified. Monitor early season.",
            treatment="Propiconazole 25% EC at 1mL/L water. Apply at early rust development stage.",
            favorable_conditions="Temperature 16-23°C, high humidity, cloudy days",
            reference_images=["/diseases/maize_common_rust.jpg"],
        ),
        Disease(
            name="Gray Leaf Spot",
            scientific_name="Cercospora zeae-maydis",
            crop_type="Maize",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.HIGH,
            ml_class_name="Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
            symptoms="Rectangular lesions parallel to leaf veins. Initially tan, then gray. Lesions coalesce causing blight.",
            causes="Cercospora zeae-maydis fungus. Favored by warm temperatures and extended leaf wetness.",
            affected_parts=["leaves"],
            prevention="Resistant hybrids. Crop rotation. Tillage to reduce residue.",
            management="Foliar fungicides if disease develops early and conditions favor spread.",
            treatment="Strobilurin fungicides (azoxystrobin) or triazoles (propiconazole). Apply at early tassel stage.",
            favorable_conditions="Temperature 22-30°C, extended periods of high humidity and leaf wetness",
            reference_images=["/diseases/maize_gray_leaf_spot.jpg"],
        ),
        Disease(
            name="Yellow Leaf Curl Virus",
            scientific_name="Tomato yellow leaf curl virus (TYLCV)",
            crop_type="Tomato",
            category=DiseaseCategory.VIRAL,
            risk_level=RiskLevel.HIGH,
            ml_class_name="Tomato___Tomato_Yellow_Leaf_Curl_Virus",
            symptoms="Upward curling of leaves. Yellow margins. Small, crumpled leaves. Severe stunting. Reduced fruit set.",
            causes="TYLCV transmitted by whiteflies (Bemisia tabaci). No direct plant-to-plant transmission.",
            affected_parts=["leaves", "shoots", "flowers"],
            prevention="Whitefly-resistant varieties. Physical barriers. Reflective mulches.",
            management="Control whitefly populations. Remove infected plants immediately. Screen nurseries.",
            treatment="Control whitefly vectors with imidacloprid or acetamiprid. No cure for infected plants.",
            favorable_conditions="High whitefly populations. Warm dry conditions.",
            reference_images=["/diseases/tomato_yellow_leaf_curl.jpg"],
        ),
        Disease(
            name="Bacterial Spot",
            scientific_name="Xanthomonas campestris pv. vesicatoria",
            crop_type="Tomato",
            category=DiseaseCategory.BACTERIAL,
            risk_level=RiskLevel.MEDIUM,
            ml_class_name="Tomato___Bacterial_spot",
            symptoms="Small, dark, water-soaked spots on leaves, stems, and fruit. Spots turn brown with yellow halo.",
            causes="Xanthomonas bacteria. Spreads via rain splash, wind, infected seed, and tools.",
            affected_parts=["leaves", "stems", "fruit"],
            prevention="Certified disease-free seed. Avoid overhead irrigation. Tool sanitation.",
            management="Copper-based bactericides. Remove infected plant material. Crop rotation.",
            treatment="Copper hydroxide at 3g/L water. Apply preventively or at first symptoms. Repeat weekly.",
            favorable_conditions="Warm temperatures 24-30°C, wet conditions, mechanical damage",
            reference_images=["/diseases/tomato_bacterial_spot.jpg"],
        ),
        Disease(
            name="Aphids",
            scientific_name="Various Aphis spp.",
            crop_type="Multiple Crops",
            category=DiseaseCategory.PEST,
            risk_level=RiskLevel.MEDIUM,
            ml_class_name=None,
            symptoms="Sticky honeydew on leaves. Sooty mold. Curled, distorted leaves. Yellowing. Stunted growth. Visible colonies under leaves.",
            causes="Aphid insects feeding on plant sap. Colonies multiply rapidly. Transmitted viruses.",
            affected_parts=["leaves", "shoots", "stems"],
            prevention="Beneficial insects (ladybugs, parasitic wasps). Reflective mulches. Companion planting.",
            management="Water sprays to dislodge. Insecticidal soap. Neem oil. Chemical insecticides as last resort.",
            treatment="Imidacloprid 17.8% SL at 0.5mL/L or dimethoate 30% EC at 2mL/L. Neem oil for organic option.",
            favorable_conditions="Warm, dry conditions. Lush, nitrogen-rich plant growth.",
            reference_images=["/diseases/aphids_multiple_crops.jpg"],
        ),
        Disease(
            name="Powdery Mildew",
            scientific_name="Various Erysiphales",
            crop_type="Multiple Crops",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.MEDIUM,
            ml_class_name="Squash___Powdery_mildew",
            symptoms="White powdery fungal growth on leaf surfaces. Leaves turn yellow and dry. Stems and fruit may be affected.",
            causes="Erysiphales fungi. Unlike most fungi, favored by dry conditions with moderate humidity.",
            affected_parts=["leaves", "stems", "fruit"],
            prevention="Resistant varieties. Proper spacing. Avoid excessive nitrogen.",
            management="Sulfur-based fungicides. Potassium bicarbonate. Remove infected tissue.",
            treatment="Sulfur 80% WP at 3g/L water. Propiconazole 25% EC at 1mL/L. Bitertanol as alternative.",
            favorable_conditions="Temperature 15-28°C, moderate humidity 50-70%, poor air circulation",
            reference_images=["/diseases/powdery_mildew.jpg"],
        ),
        Disease(
            name="Downy Mildew",
            scientific_name="Pseudoperonospora cubensis",
            crop_type="Cucumber",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.HIGH,
            ml_class_name="Cucumber___Downy_mildew",
            symptoms="Angular chlorotic yellow patches sharply bounded by leaf veins on the upper surface. Purplish-gray downy mold on leaf underside.",
            causes="Pseudoperonospora cubensis oomycete. Favored by high relative humidity and mild temperatures.",
            affected_parts=["leaves"],
            prevention="Wide plant spacing for aeration. Drip irrigation only. Resistant hybrid cultivars.",
            management="Copper fungicides preventively. Systemic fungicides (mancozeb + cymoxanil) at early infection.",
            treatment="Spray Cymoxanil 8% + Mancozeb 64% WP at 2g/L water at early symptom onset.",
            favorable_conditions="Temperature 15-22°C, relative humidity >90%",
            reference_images=["/diseases/cucumber_downy_mildew.jpg"],
        ),
        Disease(
            name="Whitefly",
            scientific_name="Bemisia tabaci",
            crop_type="Tomato",
            category=DiseaseCategory.PEST,
            risk_level=RiskLevel.HIGH,
            ml_class_name="Tomato___Whitefly",
            symptoms="Tiny powdery white winged insects on leaf underside. Mottling, yellowing, leaf curl, sticky honeydew, and sooty mold.",
            causes="Bemisia tabaci sap-sucking insect vectors transmitting TYLCV virus.",
            affected_parts=["leaves", "shoots"],
            prevention="Yellow sticky traps. Insect exclusion netting (50-mesh). Reflective silver mulches.",
            management="Introduce Encarsia formosa parasitoids. Spray neem extract (5ml/L). Systemic insecticide rotation.",
            treatment="Apply Acetamiprid 20% SP at 0.5g/L water or Imidacloprid 17.8% SL at 0.3ml/L.",
            favorable_conditions="Warm dry weather, poor weed management",
            reference_images=["/diseases/tomato_whitefly.jpg"],
        ),
        Disease(
            name="Rust",
            scientific_name="Puccinia striiformis",
            crop_type="Wheat",
            category=DiseaseCategory.FUNGAL,
            risk_level=RiskLevel.CRITICAL,
            ml_class_name="Wheat___Rust",
            symptoms="Linear parallel stripes of bright orange-yellow powdery rust pustules erupting along leaf veins.",
            causes="Puccinia striiformis f. sp. tritici fungus. Air-borne urediniospores carried over long distances.",
            affected_parts=["leaves", "glumes"],
            prevention="Plant rust-resistant certified wheat cultivars. Early sowing to escape peak infection period.",
            management="Foliar fungicide application at first stripe appearance. Avoid excessive nitrogen application.",
            treatment="Apply Propiconazole 25% EC at 1ml/L water immediately upon pustule emergence. Repeat in 15 days if conditions persist.",
            favorable_conditions="Cool moist weather, temperature 10-18°C",
            reference_images=["/diseases/wheat_rust.jpg"],
        ),
    ]

    db.add_all(diseases)
    db.commit()
    logger.info(f"Seeded {len(diseases)} diseases into library")


def _seed_demo_users(db: Session):
    """Create demo users for development/testing"""
    from app.core.config import settings
    if settings.APP_ENV == "production":
        return

    demo_users = [
        {
            "name": "Demo Farmer",
            "email": "farmer@demo.agriguard.app",
            "password": "Demo@1234",
            "role": UserRole.FARMER,
        },
        {
            "name": "Agricultural Officer Singh",
            "email": "officer@demo.agriguard.app",
            "password": "Demo@1234",
            "role": UserRole.OFFICER,
        },
        {
            "name": "Dr. Ramesh Kumar",
            "email": "expert@demo.agriguard.app",
            "password": "Demo@1234",
            "role": UserRole.EXPERT,
        },
        {
            "name": "Admin",
            "email": "admin@demo.agriguard.app",
            "password": "Admin@1234",
            "role": UserRole.ADMIN,
        },
    ]

    for ud in demo_users:
        existing = db.query(User).filter(User.email == ud["email"]).first()
        if existing:
            continue
        user = User(
            name=ud["name"],
            email=ud["email"],
            password_hash=hash_password(ud["password"]),
            role=ud["role"],
            is_verified=True,
            is_active=True,
        )
        db.add(user)
        db.flush()

        if ud["role"] == UserRole.EXPERT:
            profile = ExpertProfile(
                user_id=user.id,
                specialization="Crop Disease & Plant Pathology",
                qualifications="PhD in Plant Pathology, MSc Agriculture",
                years_experience="12",
                crops_expertise=["Rice", "Tomato", "Potato", "Maize", "Cotton"],
                is_online=True,
                is_verified=True,
                rating="4.8",
                total_consultations="247",
                bio="Senior plant pathologist specializing in crop disease diagnosis and integrated pest management.",
            )
            db.add(profile)

    db.commit()
    logger.info("Demo users seeded")


def _seed_farms_and_cases(db: Session):
    """Seed real baseline farms, chat conversation, and officer cases"""
    farmer = db.query(User).filter(User.email == "farmer@demo.agriguard.app").first()
    officer = db.query(User).filter(User.email == "officer@demo.agriguard.app").first()
    expert = db.query(User).filter(User.email == "expert@demo.agriguard.app").first()

    if not farmer:
        return

    # 1. Seed Real Baseline Farms if farmer has none
    if db.query(Farm).filter(Farm.user_id == farmer.id).count() == 0:
        f1 = Farm(
            user_id=farmer.id,
            name="Farm 1",
            description="Main paddy cultivation plots in fertile river plain",
            latitude=17.7265,
            longitude=78.2916,
            area_hectares=2.4,
            crop_type="Rice",
            crop_variety="Basmati Super",
            soil_type=SoilType.CLAY,
            irrigation_type=IrrigationType.FLOOD,
            village="Mupkal",
            district="Nizamabad",
            state="Telangana",
            country="India",
            boundary_geojson={
                "type": "Polygon",
                "coordinates": [[
                    [78.2895, 17.7285],
                    [78.2938, 17.7290],
                    [78.2942, 17.7245],
                    [78.2900, 17.7240],
                    [78.2895, 17.7285]
                ]]
            }
        )
        f2 = Farm(
            user_id=farmer.id,
            name="Farm 2",
            description="Vegetable and tomato drip irrigation zone",
            latitude=17.7310,
            longitude=78.2980,
            area_hectares=1.8,
            crop_type="Tomato",
            crop_variety="Arka Rakshak",
            soil_type=SoilType.LOAMY,
            irrigation_type=IrrigationType.DRIP,
            village="Mupkal",
            district="Nizamabad",
            state="Telangana",
            country="India",
        )
        f3 = Farm(
            user_id=farmer.id,
            name="Farm 3",
            description="Rainfed grain corn and maize field",
            latitude=17.7205,
            longitude=78.2850,
            area_hectares=3.2,
            crop_type="Maize",
            crop_variety="DeKalb 9108",
            soil_type=SoilType.LOAMY,
            irrigation_type=IrrigationType.SPRINKLER,
            village="Mupkal",
            district="Nizamabad",
            state="Telangana",
            country="India",
        )
        db.add_all([f1, f2, f3])
        db.flush()
        logger.info("Baseline farms seeded for demo farmer")

    farm_1 = db.query(Farm).filter(Farm.user_id == farmer.id).first()

    # 2. Seed Real Chat Conversation & Real Messages between Farmer and Expert
    if expert and db.query(Conversation).filter(Conversation.farmer_id == farmer.id, Conversation.expert_id == expert.id).count() == 0:
        conv = Conversation(
            farmer_id=farmer.id,
            expert_id=expert.id,
            last_message_at=datetime.utcnow() - timedelta(minutes=2),
        )
        db.add(conv)
        db.flush()

        messages = [
            Message(
                conversation_id=conv.id,
                sender_id=farmer.id,
                receiver_id=expert.id,
                content="What can I do to control brown spot in rice?",
                created_at=datetime.utcnow() - timedelta(minutes=15),
            ),
            Message(
                conversation_id=conv.id,
                sender_id=expert.id,
                receiver_id=farmer.id,
                content="You can use a recommended fungicide like Carbendazim or Tricyclazole. Maintain proper water level and avoid excessive nitrogen fertilizer.",
                created_at=datetime.utcnow() - timedelta(minutes=12),
            ),
            Message(
                conversation_id=conv.id,
                sender_id=farmer.id,
                receiver_id=expert.id,
                content="Thank you! Can you suggest the dosage?",
                created_at=datetime.utcnow() - timedelta(minutes=8),
            ),
            Message(
                conversation_id=conv.id,
                sender_id=expert.id,
                receiver_id=farmer.id,
                content="For Carbendazim 50% WP, use 1g per liter of water. Spray in the early morning or evening hours.",
                created_at=datetime.utcnow() - timedelta(minutes=5),
            ),
            Message(
                conversation_id=conv.id,
                sender_id=farmer.id,
                receiver_id=expert.id,
                content="Got it. Thank you!",
                created_at=datetime.utcnow() - timedelta(minutes=2),
            ),
        ]
        db.add_all(messages)
        logger.info("Seeded initial real conversation messages")

    # 3. Seed Real Officer Cases if none
    if officer and db.query(OfficerCase).filter(OfficerCase.officer_id == officer.id).count() == 0:
        case_1 = OfficerCase(
            officer_id=officer.id,
            farmer_id=farmer.id,
            farm_id=farm_1.id if farm_1 else None,
            title="Disease detected: Brown Spot",
            description="AI detected potential Brown Spot with 92.0% confidence in Farm 1 rice leaves.",
            priority="high",
            status=CaseStatus.NEW,
            created_at=datetime.utcnow() - timedelta(minutes=2),
        )
        case_2 = OfficerCase(
            officer_id=officer.id,
            farmer_id=farmer.id,
            farm_id=farm_1.id if farm_1 else None,
            title="Routine Check: Crop Healthy",
            description="Regular farm monitoring confirmed healthy foliage.",
            priority="low",
            status=CaseStatus.RESOLVED,
            resolved_at=datetime.utcnow() - timedelta(hours=1),
            created_at=datetime.utcnow() - timedelta(hours=3),
        )
        db.add_all([case_1, case_2])
        logger.info("Seeded real officer cases")

    db.commit()

