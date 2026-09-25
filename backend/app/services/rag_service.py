"""
AgriGuard RAG (Retrieval-Augmented Generation) Service.
Manages agricultural knowledge base documents, TF-IDF vector indexing,
semantic similarity retrieval, and factual citation extraction.
"""
import logging
from typing import List, Dict, Any, Optional
import numpy as np
from sqlalchemy.orm import Session
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from datetime import datetime
from app.models.disease import KnowledgeDocument, Disease

logger = logging.getLogger(__name__)

# Curated agricultural extension documents grounded in verified institutional guidelines
# (ICAR, TNAU, IARI, FAO, USDA Agricultural Extension)
INITIAL_AGRI_KNOWLEDGE_DOCS = [
    {
        "document_id": "AGRI-DOC-RICE-BLAST",
        "title": "Rice Blast Disease (Magnaporthe oryzae) Management & Field Protocol",
        "source": "ICAR - National Rice Research Institute (NRRI) Extension Bulletin 2024",
        "crop": "Rice",
        "disease": "Rice Blast",
        "category": "Plant Pathology",
        "last_verified": "2024-09-01",
        "content": """
Rice blast is caused by the fungus Magnaporthe oryzae (anamorph Pyricularia oryzae).
It is one of the most destructive diseases of rice worldwide, affecting leaf, collar, node, and panicle neck.
Symptoms: Spindle-shaped or elliptical lesions with grayish-white centers and reddish-brown borders on leaves.
Neck blast causes rotting of the neck region leading to lodging and chaffy, empty grains.
Triggers: High relative humidity (>90%), moderate temperatures (20-28°C), prolonged leaf wetness, and excessive nitrogenous fertilizer application.
Immediate Treatment:
- Spray Tricyclazole 75% WP @ 0.6 g/L or Isoprothiolane 40% EC @ 1.5 mL/L or Kasugamycin 3% SL @ 2.5 mL/L at early symptom onset.
- For biological control, apply Pseudomonas fluorescens (Pf-1) powder formulation @ 2.5 kg/ha mixed with well-decomposed FYM, or liquid formulation @ 5 mL/L foliage spray.
Cultural Prevention:
- Avoid excessive urea; split nitrogen into 3-4 applications (basal, tillering, panicle initiation).
- Treat seeds with Tricyclazole @ 2 g/kg or Carbendazim @ 2 g/kg prior to sowing.
- Ensure proper field sanitation by burning/composting infected stubbles.
Safety: Wear personal protective equipment (mask, nitrile gloves) when spraying fungicides. Observe a 14-day pre-harvest interval (PHI).
"""
    },
    {
        "document_id": "AGRI-DOC-RICE-BROWN-SPOT",
        "title": "Rice Brown Spot (Bipolaris oryzae / Cochliobolus miyabeanus) Comprehensive Protocol",
        "source": "TNAU Agronomy & Pathology Repository 2024",
        "crop": "Rice",
        "disease": "Brown Spot",
        "category": "Plant Pathology",
        "last_verified": "2024-08-15",
        "content": """
Rice Brown Spot, caused by Bipolaris oryzae, predominantly affects crops grown in nutritionally poor, water-stressed, or zinc-deficient soils.
Symptoms: Circular to oval dark brown spots on the leaf blade, coleoptile, and glumes. Fully developed spots have a light gray to whitish center with a prominent dark brown margin, often resembling sesame seeds.
Nutritional Connection: Highly associated with potassium (K) deficiency, silicon deficiency, and drought conditions.
Immediate Treatment:
- Foliar spray of Mancozeb 75% WP @ 2 g/L or Propiconazole 25% EC @ 1 mL/L or Edifenphos 50% EC @ 1 mL/L.
- Apply zinc sulphate (ZnSO4) @ 25 kg/ha basal or 0.5% foliar spray if micronutrient deficiency is diagnosed.
Cultural Prevention:
- Seed treatment with Agrosan or Thiram @ 2 g/kg seed.
- Balanced application of NPK fertilizers with adequate potassium top-dressing.
- Maintain consistent shallow water stagnation (2-3 cm) during vegetative stage rather than alternate drying.
Safety: Spray early morning or late evening; avoid spraying during active wind drift or high heat.
"""
    },
    {
        "document_id": "AGRI-DOC-TOMATO-EARLY-BLIGHT",
        "title": "Tomato Early Blight (Alternaria solani) Diagnosis, Fungicide Schedule, and Cultural Controls",
        "source": "Indian Institute of Horticultural Research (IIHR) Extension Leaflet #42",
        "crop": "Tomato",
        "disease": "Early Blight",
        "category": "Plant Pathology",
        "last_verified": "2024-07-20",
        "content": """
Early blight of tomato is caused by Alternaria solani. It attacks foliage, stems, and fruits throughout the growing season.
Symptoms: Distinctive concentric dark rings producing a 'target board' pattern on older leaves first. Lesions enlarge up to 1 cm, surrounded by a chlorotic yellow halo. Causes premature defoliation, sunscald of exposed fruit, and stem collar rot.
Triggers: Alternating periods of wet and dry weather, temperatures between 24-30°C, and heavy morning dew.
Immediate Treatment:
- Spray Chlorothalonil 75% WP @ 2 g/L or Mancozeb 75% WP @ 2.5 g/L as preventive protector.
- At active onset, apply Azoxystrobin 23% SC @ 1 mL/L or Difenoconazole 25% EC @ 0.5 mL/L.
Organic / Biological:
- Spray Bacillus subtilis or Trichoderma viride @ 5 g/L weekly.
- Apply 5% neem seed kernel extract (NSKE) as an anti-sporulant.
Cultural Prevention:
- Prune lower leaves (bottom 30 cm) to eliminate splash dispersal of soil-borne spores.
- Use drip irrigation to keep foliage completely dry; avoid overhead sprinklers.
- Implement 3-year crop rotation with non-solanaceous crops (beans, corn, cereals).
- Apply straw or plastic mulch around plant bases to prevent soil splash.
Safety: Follow 7-day harvest waiting period after Azoxystrobin application.
"""
    },
    {
        "document_id": "AGRI-DOC-TOMATO-LATE-BLIGHT",
        "title": "Tomato and Potato Late Blight (Phytophthora infestans) Emergency Management",
        "source": "FAO Plant Protection & Production Series - Global Blight Network",
        "crop": "Tomato",
        "disease": "Late Blight",
        "category": "Plant Pathology",
        "last_verified": "2024-08-30",
        "content": """
Late blight caused by the oomycete Phytophthora infestans is an aggressive disease capable of destroying entire tomato and potato fields within 7-10 days.
Symptoms: Large, irregular water-soaked pale green to dark brown lesions on leaves and stems. Under humid conditions, a fine white downy fungal growth (sporangiophores) appears on the underside of leaves. Fruits develop greasy, firm, dark brown rot.
Triggers: Cool temperatures (15-22°C) combined with sustained relative humidity (>90%) and rain/fog for consecutive days.
Immediate Emergency Protocol:
- Apply systemic penetrant fungicides: Cymoxanil 8% + Mancozeb 64% WP @ 2.5 g/L, or Metalaxyl-M 4% + Mancozeb 64% WP @ 2.5 g/L.
- Dimethomorph 50% WP @ 1 g/L or Fluopicolide + Propamocarb @ 2 mL/L provides curative knock-down.
Cultural Prevention:
- Destroy all cull piles, volunteer potato tubers, and infected solanaceous weed hosts (black nightshade).
- Ensure wider plant spacing (60 x 60 cm) for canopy aeration.
- Never irrigate late in the afternoon or evening.
- Consult agricultural extension officers immediately if symptoms spread across multiple rows.
"""
    },
    {
        "document_id": "AGRI-DOC-MAIZE-FALL-ARMYWORM",
        "title": "Fall Armyworm (Spodoptera frugiperda) Integrated Pest Management (IPM) in Maize",
        "source": "ICAR - Directorate of Maize Research (IIMR) Technical Advisory",
        "crop": "Maize",
        "disease": "Fall Armyworm",
        "category": "Pest Management",
        "last_verified": "2024-09-05",
        "content": """
Fall Armyworm (FAW) is an invasive noctuid moth capable of devastating maize crops from seedling to whorl stage.
Symptoms: Elongated 'window-pane' papery feeding patches on young leaves, followed by ragged, irregular holes with abundant moist sawdust-like fecal frass in the central leaf whorl. In severe attacks, central shoots are killed ('dead heart').
Monitoring: Install pheromone traps @ 5 traps/acre to detect adult moth flight spikes.
Integrated Control Strategy:
1. Early Whorl Stage (First 15-25 days):
   - Whorl application of neem formulation (Azadirachtin 1500 ppm @ 5 mL/L).
   - Release egg parasitoid Trichogramma pretiosum @ 50,000/acre at weekly intervals.
2. Mid Whorl Stage (25-45 days) when >10% plants show fresh damage:
   - Apply Bacillus thuringiensis (Bt) kurstaki formulation @ 2 g/L, or Metarhizium rileyi @ 3 g/L into whorls.
3. Severe Outbreak / Rescue Chemical:
   - Chlorantraniliprole 18.5% SC @ 0.4 mL/L directed squarely into the central whorls using a knapsack sprayer with nozzle cap removed.
   - Alternatively, Emamectin benzoate 5% SG @ 0.4 g/L or Spinetoram 11.7% SC @ 0.5 mL/L.
Cultural Prevention:
- Timely and synchronous sowing in the farming cluster; avoid staggered planting.
- Intercropping with pulses like cowpea or pigeonpea reduces oviposition.
- Handpick and crush egg masses (covered with cream/gray scales) during daily field walks.
"""
    },
    {
        "document_id": "AGRI-DOC-FERTILIZER-NPK",
        "title": "Comprehensive N-P-K & Secondary Micronutrient Management for Field Crops",
        "source": "IARI Division of Soil Science and Agricultural Chemistry",
        "crop": "General",
        "disease": None,
        "category": "Fertilizer Management",
        "last_verified": "2024-06-10",
        "content": """
Proper plant nutrition balances primary macronutrients (Nitrogen, Phosphorus, Potassium), secondary nutrients (Calcium, Magnesium, Sulphur), and micronutrients (Zinc, Boron, Iron).
Deficiency Diagnostics:
- Nitrogen (N): Uniform pale yellowing (chlorosis) beginning on older, lower leaves; stunted growth and thin stems.
- Phosphorus (P): Purplish or dark bronze discoloration along lower leaf veins; delayed root development and poor tillering.
- Potassium (K): Marginal scorching, necrosis and browning along leaf margins ('tip burn'); weak stalks susceptible to lodging and fungal infection.
- Zinc (Zn): Bleached white bands on either side of the midrib in maize/rice ('Khaira' disease).
- Boron (B): Brittle petioles, hollow stems, blossom drop, and internal brown rot in crucifers and fruit crops.
Application Principles:
- Basal: 100% of Phosphorus (DAP or SSP) and 33-50% of Potassium (MOP) should be placed 5 cm below seed level.
- Split Nitrogen: Never apply total urea at once. Split into 3-4 doses: basal, active tillering, and panicle/flower initiation to minimize leaching and ammonia volatilization.
- Organic Carbon: Incorporate 5-10 tonnes/ha Farm Yard Manure (FYM) or vermicompost 3 weeks before sowing to improve cation-exchange capacity (CEC).
Soil Testing: Get soil tested every 2 years for electrical conductivity (EC), pH, and organic carbon (OC) prior to fertilizer purchase.
"""
    },
    {
        "document_id": "AGRI-DOC-IRRIGATION-WATER",
        "title": "Smart Irrigation Scheduling, Drip Systems, and Water Conservation Guide",
        "source": "Ministry of Agriculture & Water Resources Extension Bulletin",
        "crop": "General",
        "disease": None,
        "category": "Irrigation & Water",
        "last_verified": "2024-05-15",
        "content": """
Efficient water management maximizes crop water productivity (kg grain produced per m3 water) while suppressing soil-borne fungal pathogens.
Critical Irrigation Stages by Crop:
- Rice: Panicle initiation, flowering, and milk grain stages are critical; keep 2-3 cm shallow water. Alternate Wetting and Drying (AWD) saves 25-30% water without yield reduction.
- Wheat: Crown root initiation (CRI at 21 days), tillering, late jointing, flowering, and dough stage. CRI stage stress causes up to 35% irreversible yield loss.
- Maize: Tasseling and silking stages are hyper-sensitive to moisture stress.
- Solanaceous (Tomato/Chili): Flowering and fruit sizing stages require uniform moisture to prevent blossom end rot (calcium transport failure).
Irrigation Best Practices:
- Drip Irrigation: Delivers water directly to root zone with 90-95% efficiency, cutting water use by 40-60% compared to flood irrigation.
- Fertigation: Dissolve soluble fertilizers (19:19:19, Potassium Nitrate 13:0:45) in drip system for 30% higher nutrient uptake.
- Tensiometer Guidelines: Irrigate when soil water tension reaches 30-40 kPa for sandy loam and 50-60 kPa for clay soils.
- Avoid Overhead Sprinklers on sensitive crops (tomato, potato, cucurbits) during cool weather to avoid leaf wetness that sparks fungal blights.
"""
    },
    {
        "document_id": "AGRI-DOC-SOIL-PH-AMENDMENTS",
        "title": "Soil pH Correction: Reclaiming Acidic, Saline, and Alkaline Soils",
        "source": "Central Soil Salinity Research Institute (CSSRI) Field Guide",
        "crop": "General",
        "disease": None,
        "category": "Soil Management",
        "last_verified": "2024-07-05",
        "content": """
Soil pH directly determines nutrient availability and microbial biodiversity. Most agronomic crops thrive between pH 6.0 and 7.5.
1. Acid Soils (pH < 5.5):
   - Causes: High rainfall leaching basic cations, continuous use of ammonium sulfate or urea.
   - Problems: Aluminum (Al) and Manganese (Mn) toxicity; fixation of Phosphorus; Calcium and Magnesium deficiency.
   - Amendment: Apply Agricultural Lime (CaCO3) or Dolomite (CaMg(CO3)2) @ 2-4 tonnes/ha based on buffer pH test. Apply 4 weeks prior to sowing and incorporate thoroughly into top 15 cm.
2. Saline Soils (EC > 4 dS/m, pH < 8.5):
   - Problems: High soluble salts induce osmotic drought; plants wilt despite wet soil.
   - Amendment: Provide good subsurface drainage and leach salts with good quality water. Avoid saline groundwater irrigation.
3. Alkaline / Sodic Soils (pH > 8.5, ESP > 15%):
   - Problems: High sodium disperses clay particles, destroying soil structure; causes hard pan and zero aeration.
   - Amendment: Apply agricultural Gypsum (CaSO4·2H2O) based on gypsum requirement (GR). Incorporate, pond water for 10-15 days, and flush drainage. Green manuring with Dhaincha (Sesbania aculeata) effectively lowers pH.
"""
    },
    {
        "document_id": "AGRI-DOC-ORGANIC-BIO-PESTICIDES",
        "title": "Bio-Pesticides, Botanical Extracts, and Organic Pest Control Recipes",
        "source": "National Centre for Organic and Natural Farming (NCONF) Manual",
        "crop": "General",
        "disease": None,
        "category": "Organic Farming",
        "last_verified": "2024-08-01",
        "content": """
Organic pest management relies on preventative biological equilibrium, botanical extracts, and microbial entomopathogens.
1. Neem Seed Kernel Extract (NSKE 5%):
   - Preparation: Crush 50 g dried neem seed kernels per liter of water. Soak overnight, filter through muslin cloth, and add 1 mL mild liquid soap per liter as spreader.
   - Action: Azadirachtin functions as an antifeedant, repellent, and insect growth regulator (IGR). Controls aphids, whiteflies, thrips, and early instar caterpillars.
2. Jeevamrutha Microbial Culture:
   - Preparation: Mix 10 kg fresh cow dung + 10 L cow urine + 2 kg jaggery + 2 kg pulse flour + handful of fertile virgin soil in 200 L water. Ferment for 48-72 hours under shade, stirring clockwise twice daily.
   - Application: Apply 200 L/acre via irrigation or 10% foliar spray every 15 days to stimulate soil flora and induce systemic plant resistance.
3. Entomopathogenic Microbials:
   - Beauveria bassiana @ 5 g/L: Targets caterpillars, whiteflies, and grasshoppers.
   - Verticillium lecanii @ 5 g/L: Highly effective against sucking pests (mealybugs, aphids).
   - Metarhizium anisopliae @ 5 g/L: Targets soil grubs, termites, and beetle larvae.
Application Rule: Apply bio-pesticides during late afternoon (after 4 PM) as UV sunlight rapidly degrades microbial spores.
"""
    },
    {
        "document_id": "AGRI-DOC-WEATHER-EXTREME-PROTECTION",
        "title": "Protecting Crops from Extreme Weather: Heatwaves, Frost, Hail, and Heavy Rain",
        "source": "Agromet Advisory Services - India Meteorological Department (IMD)",
        "crop": "General",
        "disease": None,
        "category": "Weather & Climate",
        "last_verified": "2024-09-12",
        "content": """
Extreme weather events require proactive tactical interventions to prevent catastrophic yield loss.
1. Heatwave & High Temperature Stress:
   - Symptoms: Pollen sterility, flower abortion, leaf tip scorch, rapid soil moisture depletion.
   - Actions: Provide light and frequent irrigation during evening hours. Spray 1% Potassium Nitrate (KNO3) or Salicylic acid @ 100 ppm to induce physiological thermotolerance. Apply straw mulch to keep root zone soil cool.
2. Frost / Cold Wave:
   - Symptoms: Ice crystal formation inside plant cells, dark water-soaked wilted leaves, blackened stems.
   - Actions: Provide light surface irrigation before sunset (water releases latent heat upon cooling). Burn crop residues around field boundaries to create smoke canopy (smudge pots).
3. Heavy Rainfall & Waterlogging:
   - Symptoms: Root hypoxia, root rot (Pythium, Phytophthora), yellowing due to denitrification.
   - Actions: Dig open drainage trenches immediately to drain stagnant water within 24 hours. After water recedes, spray 1% Urea + 1% Zinc sulphate foliar solution to revitalize starved root systems. Apply Trichoderma harzianum soil drench.
"""
    }
]


class RAGKnowledgeService:
    """
    RAG service managing agricultural documents, TF-IDF vector retrieval,
    and factual grounding for AgriGuard AI assistant.
    """

    def __init__(self):
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.doc_cache: List[Dict[str, Any]] = []
        self.tfidf_matrix = None

    def seed_initial_knowledge(self, db: Session) -> int:
        """Seed initial knowledge documents into database if table is empty"""
        existing_count = db.query(KnowledgeDocument).count()
        if existing_count > 0:
            logger.info(f"Knowledge documents already present: {existing_count} records")
            return existing_count

        added = 0
        for doc_data in INITIAL_AGRI_KNOWLEDGE_DOCS:
            doc = KnowledgeDocument(
                document_id=doc_data["document_id"],
                title=doc_data["title"],
                source=doc_data["source"],
                crop=doc_data.get("crop"),
                disease=doc_data.get("disease"),
                category=doc_data.get("category"),
                content=doc_data["content"].strip(),
                last_verified=doc_data.get("last_verified"),
            )
            db.add(doc)
            added += 1

        db.commit()
        logger.info(f"Seeded {added} agricultural knowledge documents")
        self.refresh_index(db)
        return added

    def refresh_index(self, db: Session):
        """Build or refresh TF-IDF search index from database knowledge documents AND live Disease Library"""
        docs = db.query(KnowledgeDocument).all()
        if not docs:
            # If empty in db, seed first
            self.seed_initial_knowledge(db)
            docs = db.query(KnowledgeDocument).all()

        self.doc_cache = [
            {
                "id": str(d.id),
                "document_id": d.document_id,
                "title": d.title,
                "source": d.source,
                "crop": d.crop,
                "disease": d.disease,
                "category": d.category,
                "content": d.content,
                "last_verified": d.last_verified,
            }
            for d in docs
        ]

        # Live Disease Library integration: Always index current verified database diseases
        try:
            diseases = db.query(Disease).all()
            for dis in diseases:
                cat_str = dis.category.value if hasattr(dis.category, 'value') else str(dis.category or 'Pathology')
                self.doc_cache.append({
                    "id": str(dis.id),
                    "document_id": f"DISEASE-LIB-{dis.id}",
                    "title": f"{dis.name} ({dis.crop_type}) Botanical Standard",
                    "source": "AgriGuard Botanical Disease Library (Live Source of Truth)",
                    "crop": dis.crop_type,
                    "disease": dis.name,
                    "category": cat_str,
                    "content": (
                        f"Pathology: {dis.name}. Crop Affected: {dis.crop_type}. Scientific Name: {dis.scientific_name or 'N/A'}. "
                        f"Category: {cat_str}. Symptoms: {dis.symptoms or 'Foliar lesions'}. Causes: {dis.causes or 'Pathogen infection'}. "
                        f"Treatment: {dis.treatment or 'Apply recommended fungicide/bactericide'}. "
                        f"Agronomic Management: {dis.management or 'Maintain balanced nutrition and soil drainage'}. "
                        f"Prevention: {dis.prevention or 'Use certified disease-free seeds and field rotation'}."
                    ),
                    "last_verified": dis.updated_at.strftime("%Y-%m-%d") if dis.updated_at else datetime.utcnow().strftime("%Y-%m-%d"),
                })
        except Exception as e:
            logger.warning(f"Could not index live Disease library: {e}")

        if not self.doc_cache:
            return

        corpus = [
            f"{d['title']} {d.get('crop') or ''} {d.get('disease') or ''} {d.get('category') or ''} {d['content']}"
            for d in self.doc_cache
        ]

        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=5000)
        self.tfidf_matrix = self.vectorizer.fit_transform(corpus)
        logger.info(f"RAG TF-IDF index built across {len(self.doc_cache)} documents (including live Disease Library)")

    def sync_with_disease_library(self, db: Session):
        """Invalidate cache and rebuild RAG index when Disease Library is modified"""
        self.refresh_index(db)

    def search(
        self,
        query: str,
        db: Session,
        crop: Optional[str] = None,
        top_k: int = 3,
        threshold: float = 0.05,
    ) -> List[Dict[str, Any]]:
        """
        Search knowledge base for top-k matching documents using TF-IDF cosine similarity.
        Boosts documents matching the active crop.
        """
        if not self.doc_cache or self.vectorizer is None or self.tfidf_matrix is None:
            self.refresh_index(db)

        if not self.doc_cache or self.vectorizer is None:
            return []

        # Determine target crop from query or active farm
        q_lower = query.lower()
        mentioned_crop = None
        for c in ["rice", "paddy", "wheat", "maize", "corn", "cucumber", "cotton", "potato", "chilli", "chili", "soybean", "tomato"]:
            if c in q_lower:
                mentioned_crop = "Rice" if c in ["rice", "paddy"] else c.title()
                break

        # Check if query is about general agronomy/practices
        is_general_topic = any(w in q_lower for w in ["fertilizer", "npk", "urea", "soil", "ph", "irrigation", "water", "organic", "neem", "compost", "pesticide", "disposal"])

        target_crop = mentioned_crop or (None if is_general_topic else crop)

        search_text = query
        if target_crop and target_crop.lower() not in q_lower:
            search_text = f"{target_crop} {query}"

        try:
            query_vec = self.vectorizer.transform([search_text])
            similarities = cosine_similarity(query_vec, self.tfidf_matrix)[0]
        except Exception as e:
            logger.warning(f"Error computing TF-IDF similarity: {e}")
            return []

        scored_docs = []
        for idx, score in enumerate(similarities):
            doc = self.doc_cache[idx]
            final_score = float(score)

            doc_crop = (doc.get("crop") or "").lower()
            if target_crop and doc_crop:
                if target_crop.lower() in doc_crop:
                    final_score += 0.20
                elif mentioned_crop and mentioned_crop.lower() not in doc_crop:
                    final_score -= 0.15

            if final_score >= threshold:
                scored_docs.append((final_score, doc))

        scored_docs.sort(key=lambda x: x[0], reverse=True)
        top_results = scored_docs[:top_k]

        results = []
        for score, doc in top_results:
            snippet = doc["content"][:280].replace("\n", " ").strip() + "..."
            results.append({
                "document_id": doc["document_id"],
                "title": doc["title"],
                "source": doc["source"],
                "crop": doc["crop"],
                "disease": doc["disease"],
                "category": doc["category"],
                "relevance_score": round(score, 4),
                "snippet": snippet,
                "full_content": doc["content"],
                "last_verified": doc["last_verified"],
            })

        return results

    def get_all_documents(self, db: Session) -> List[Dict[str, Any]]:
        """Return all knowledge base documents for developer/admin view"""
        docs = db.query(KnowledgeDocument).all()
        return [
            {
                "id": str(d.id),
                "document_id": d.document_id,
                "title": d.title,
                "source": d.source,
                "crop": d.crop,
                "disease": d.disease,
                "category": d.category,
                "last_verified": d.last_verified,
                "snippet": d.content[:200] + "...",
            }
            for d in docs
        ]


# Singleton instance
rag_service = RAGKnowledgeService()
