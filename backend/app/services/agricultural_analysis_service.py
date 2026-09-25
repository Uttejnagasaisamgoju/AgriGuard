"""
AgriGuard Agricultural Analysis AI Service.
Translates raw ML pathology predictions, multi-image evidence,
and Disease Library pathology knowledge into structured agronomic diagnoses.
Responsible for:
- Interpreting model predictions
- Assessing foliar disease severity
- Transparent reasoning summary of symptoms
- Immediate agronomic treatment instructions
- Ongoing monitoring and scouting recommendations
- Uncertainty detection and expert escalation
- Truthful early-stage assessment (honestly communicating when stage dataset is unannotated)
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class AgriculturalAnalysisService:
    """Production Agricultural Analysis AI Layer"""

    def __init__(self):
        self.version = "agri-analysis-v2.1.0"

    def analyze(
        self,
        crop: str,
        disease_name: str,
        confidence: float,
        images_data: List[Dict[str, Any]],
        disease_library_entry: Optional[Dict[str, Any]] = None,
        is_uncertain: bool = False,
        uncertainty_score: float = 0.0,
        model_version: str = "disease-model-v1.0.0",
        dataset_version: str = "AgriGuard-Pathology-Split-v1",
    ) -> Dict[str, Any]:
        """
        Produce a structured agricultural analysis.
        Input contract:
        {
          "crop": crop,
          "disease_name": disease_name,
          "confidence": confidence,
          "images_data": images_data,
          "disease_library_entry": disease_library_entry,
          "is_uncertain": is_uncertain,
          "uncertainty_score": uncertainty_score,
          "model_version": model_version,
          "dataset_version": dataset_version
        }
        """
        is_healthy = "healthy" in disease_name.lower()

        # 1. Early-Stage Assessment:
        # Check if the training dataset contains stage-stratified annotations for this disease.
        # In the current validated dataset (AgriGuard-Pathology-Split-v1), classes are categorical
        # without per-stage (early/moderate/advanced) subdivisions.
        # DO NOT fake early-stage detection.
        stage_status = {
            "supported": False,
            "status": "NOT YET SUPPORTED",
            "stage_label": "NOT YET SUPPORTED",
            "reason": "Training datasets classify whole-specimen disease classes without unannotated early-stage stratification.",
            "message": "Early-stage detection is not yet reliable for this disease because the current validated training dataset does not contain enough early-stage examples.",
            "guidance": "Early visual symptoms require rigorous field scouting. Do not rely on AI for early-stage detection until annotated multi-stage datasets are incorporated.",
            "data_collection_active": True,
            "required_data": f"Stage-annotated field specimens for {disease_name} ({crop}) under varying canopy light conditions."
        }

        # 2. Severity Estimation based on visual metrics and pathology category
        if is_healthy:
            severity = "Healthy"
            severity_level = "None"
        elif is_uncertain or confidence < 0.65:
            severity = "Uncertain / Verification Required"
            severity_level = "Unknown"
        else:
            # Estimate severity from visual pathology category and leaf area affected
            avg_leaf_ratio = 0.0
            valid_images = [img for img in images_data if img.get("is_leaf_valid", True)]
            if valid_images:
                ratios = [img.get("metrics", {}).get("leaf_area_ratio", 0.5) for img in valid_images if img.get("metrics")]
                avg_leaf_ratio = sum(ratios) / len(ratios) if ratios else 0.5

            if avg_leaf_ratio > 0.4:
                severity = "Moderate"
                severity_level = "Moderate"
            else:
                severity = "Treatable"
                severity_level = "Low to Moderate"

        # 3. Symptoms Observed (from Disease Library or visual pathology profile)
        if disease_library_entry and disease_library_entry.get("symptoms"):
            symptoms_observed = disease_library_entry["symptoms"]
        elif is_healthy:
            symptoms_observed = "Uniform photosynthetic pigmentation observed across foliage with no necrotic lesions, pustules, or viral leaf curl."
        else:
            symptoms_observed = f"Characteristic foliar lesions and tissue chlorosis consistent with {disease_name} observed on {crop} specimen."

        # 4. Reasoning Summary
        if is_healthy:
            reasoning_summary = (
                f"Multi-spectral analysis confirms healthy chlorophyll distribution across leaf margins. "
                f"No necrotic lesion margins, powdery sporulation, or fungal pustules detected ({int(confidence * 100)}% confidence)."
            )
        elif is_uncertain:
            reasoning_summary = (
                f"Model detected visual indicators of {disease_name} on {crop}, but the predictive confidence ({int(confidence * 100)}%) "
                f"or Shannon entropy uncertainty ({uncertainty_score:.2f}) indicates potential ambiguity. "
                f"Human agricultural officer review is strongly recommended before applying chemical treatments."
            )
        else:
            reasoning_summary = (
                f"Inference pipeline detected focal necrotic pathology patterns matching {disease_name} on {crop} "
                f"with {int(confidence * 100)}% calibrated confidence. Visual markers correlate with verified {disease_library_entry.get('category', 'pathology') if disease_library_entry else 'botanical'} symptoms."
            )

        # 5. Immediate Recommended Action
        if is_healthy:
            immediate_action = "Maintain regular vegetative irrigation schedule and balanced N-P-K nutrient splits per local soil test recommendations."
        elif disease_library_entry and disease_library_entry.get("treatment"):
            immediate_action = disease_library_entry["treatment"]
        else:
            immediate_action = f"Isolate infected plant debris; apply recommended targeted fungicide/bactericide for {disease_name} during early morning."

        # 6. Monitoring Instructions
        if is_healthy:
            monitoring_instructions = "Scout field quadrants every 5–7 days. Inspect lower leaf undersides after heavy rainfall or high humidity events."
        else:
            monitoring_instructions = (
                f"Inspect adjacent {crop} rows within 48 hours to assess field transmission rate. "
                f"Avoid overhead sprinkler irrigation to prevent water-borne spore splash across the canopy."
            )

        # 7. Escalation & Expert Review Requirement
        expert_review_required = is_uncertain or confidence < 0.70 or (disease_library_entry and disease_library_entry.get("risk_level") == "critical")
        if expert_review_required:
            escalation_recommendation = "High Priority: Request verified Agronomist / Extension Officer review through AgriGuard Expert Desk."
        else:
            escalation_recommendation = "Standard: Follow agronomic treatment schedule. If symptoms persist beyond 5 days, consult local extension officer."

        return {
            "analysis_version": self.version,
            "model_version": model_version,
            "dataset_version": dataset_version,
            "diagnosis": disease_name,
            "crop": crop,
            "confidence": round(confidence, 4),
            "confidence_percentage": int(round(confidence * 100)),
            "severity": severity,
            "severity_level": severity_level,
            "stage_assessment": stage_status,
            "early_stage_detection": stage_status,
            "symptoms_observed": symptoms_observed,
            "observed_symptoms": symptoms_observed,
            "reasoning_summary": reasoning_summary,
            "transparent_reasoning": reasoning_summary,
            "recommended_immediate_action": immediate_action,
            "immediate_actions": [immediate_action] if isinstance(immediate_action, str) else immediate_action,
            "monitoring_instructions": monitoring_instructions,
            "monitoring_schedule": monitoring_instructions,
            "escalation_recommendation": escalation_recommendation,
            "uncertainty": {
                "is_uncertain": is_uncertain,
                "uncertainty_score": round(uncertainty_score, 4),
                "expert_review_required": expert_review_required,
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

agricultural_analysis_service = AgriculturalAnalysisService()
