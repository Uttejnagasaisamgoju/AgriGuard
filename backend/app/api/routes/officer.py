from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from app.database.session import get_db
from app.models.officer import OfficerCase, CaseStatus, FieldVisit, FieldReport
from app.models.user import User, UserRole
from app.models.farm import Farm
from app.models.disease import DiseasePrediction, ExpertFeedback
from app.models.notification import Notification, NotificationType
from app.auth.dependencies import get_current_user, require_role
from pydantic import BaseModel

router = APIRouter(prefix="/api/officer", tags=["Officer"])


class CaseUpdateRequest(BaseModel):
    status: Optional[str] = None
    officer_notes: Optional[str] = None
    priority: Optional[str] = None
    resolution_notes: Optional[str] = None


class FieldVisitRequest(BaseModel):
    case_id: str
    scheduled_date: datetime
    notes: Optional[str] = None


class FieldReportRequest(BaseModel):
    case_id: str
    title: str
    content: str
    recommendations: Optional[str] = None


@router.get("/dashboard")
async def officer_dashboard(
    current_user: User = Depends(require_role(UserRole.OFFICER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    # Farmers in system
    total_farmers = db.query(User).filter(User.role == UserRole.FARMER).count()

    # Cases
    my_cases = db.query(OfficerCase).filter(OfficerCase.officer_id == current_user.id)
    total_cases = my_cases.count()
    new_cases = my_cases.filter(OfficerCase.status == CaseStatus.NEW).count()
    resolved_today = my_cases.filter(
        OfficerCase.status == CaseStatus.RESOLVED,
        OfficerCase.resolved_at >= datetime.utcnow().replace(hour=0, minute=0, second=0),
    ).count()
    pending_cases = my_cases.filter(
        OfficerCase.status.in_([CaseStatus.NEW, CaseStatus.UNDER_REVIEW, CaseStatus.FIELD_VISIT_REQUIRED])
    ).count()

    # Recent cases
    recent_cases = db.query(OfficerCase).filter(
        OfficerCase.officer_id == current_user.id
    ).order_by(OfficerCase.created_at.desc()).limit(10).all()

    return {
        "stats": {
            "farmers_monitored": total_farmers,
            "total_cases": total_cases,
            "new_cases": new_cases,
            "resolved_today": resolved_today,
            "pending_cases": pending_cases,
        },
        "recent_cases": [_case_to_dict(c) for c in recent_cases],
    }


@router.get("/cases")
async def list_cases(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_role(UserRole.OFFICER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    query = db.query(OfficerCase)
    if current_user.role == UserRole.OFFICER:
        query = query.filter(OfficerCase.officer_id == current_user.id)
    if status:
        if status.upper() == "RESOLVED":
            query = query.filter(OfficerCase.status == CaseStatus.RESOLVED)
        elif status.lower() == "active":
            query = query.filter(OfficerCase.status != CaseStatus.RESOLVED)
        else:
            try:
                query = query.filter(OfficerCase.status == CaseStatus(status))
            except ValueError:
                pass
    if priority:
        query = query.filter(OfficerCase.priority == priority)

    total = query.count()
    cases = query.order_by(OfficerCase.created_at.desc()).offset(skip).limit(limit).all()
    return {"cases": [_case_to_dict(c) for c in cases], "total": total}


@router.get("/cases/{case_id}")
async def get_case(
    case_id: str,
    current_user: User = Depends(require_role(UserRole.OFFICER, UserRole.EXPERT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    case = db.query(OfficerCase).filter(OfficerCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return _case_to_dict(case, detailed=True)


@router.get("/cases/{case_id}/history")
async def get_case_history(
    case_id: str,
    current_user: User = Depends(require_role(UserRole.OFFICER, UserRole.EXPERT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    case = db.query(OfficerCase).filter(OfficerCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    timeline = []

    # 1. Detection Event
    det_time = case.created_at
    timeline.append({
        "id": f"det_{case.id}",
        "timestamp": det_time.isoformat() if det_time else None,
        "type": "DETECTION",
        "title": "Pathology Issue Detected & Logged",
        "description": case.description or f"Field issue flagged: {case.title}",
        "author": case.farmer.name if case.farmer else "Farmer",
        "badge": "Detection",
        "metadata": {
            "priority": case.priority,
            "farm_name": case.farm.name if case.farm else None,
            "crop": case.farm.crop_type if case.farm else None,
        }
    })

    # 2. AI Prediction details (if prediction_id exists)
    if case.prediction_id:
        pred = db.query(DiseasePrediction).filter(DiseasePrediction.id == case.prediction_id).first()
        if pred:
            conf_pct = round((pred.overall_confidence or 0.0) * 100, 1)
            timeline.append({
                "id": f"ai_{pred.id}",
                "timestamp": (pred.created_at or det_time).isoformat(),
                "type": "AI_DIAGNOSIS",
                "title": f"AI Diagnostic Analysis: {pred.primary_disease or 'Identified'}",
                "description": f"Crop: {pred.primary_crop or 'Foliage'} | Model Confidence: {conf_pct}%",
                "author": f"AgriGuard ML Pipeline (v{pred.model_version or '1.0'})",
                "badge": "AI Diagnostic",
                "metadata": {
                    "confidence": pred.overall_confidence,
                    "crop": pred.primary_crop,
                    "disease": pred.primary_disease,
                    "image_results": pred.image_results,
                }
            })

            # Expert Reviews / Feedback on this prediction
            feedbacks = db.query(ExpertFeedback).filter(ExpertFeedback.prediction_id == pred.id).all()
            for fb in feedbacks:
                timeline.append({
                    "id": f"fb_{fb.id}",
                    "timestamp": fb.created_at.isoformat() if fb.created_at else None,
                    "type": "EXPERT_FEEDBACK",
                    "title": f"Specialist Audit: {fb.reviewer_decision or 'Validated'}",
                    "description": fb.expert_notes or f"Review decision: {fb.reviewer_decision}. Disease confirmation: {fb.corrected_disease or 'Verified'}",
                    "author": fb.expert.name if (hasattr(fb, "expert") and fb.expert) else (fb.reviewer_role or "Plant Pathologist"),
                    "badge": "Expert Input",
                    "metadata": {
                        "decision": fb.reviewer_decision,
                        "corrected_disease": fb.corrected_disease,
                        "quality_score": fb.quality_score,
                    }
                })

    # 3. Field Visits
    for visit in case.field_visits:
        timeline.append({
            "id": f"visit_{visit.id}",
            "timestamp": visit.created_at.isoformat() if visit.created_at else visit.scheduled_date.isoformat(),
            "type": "FIELD_VISIT",
            "title": f"Field Visit Scheduled ({visit.status})",
            "description": f"Scheduled date: {visit.scheduled_date.strftime('%B %d, %Y')}. Notes: {visit.notes or 'In-person agronomic site inspection'}",
            "author": visit.officer.name if visit.officer else "Extension Officer",
            "badge": "Field Visit",
            "metadata": {
                "scheduled_date": visit.scheduled_date.isoformat(),
                "status": visit.status,
            }
        })

    # 4. Field Reports
    for rpt in case.field_reports:
        timeline.append({
            "id": f"rpt_{rpt.id}",
            "timestamp": rpt.created_at.isoformat() if rpt.created_at else None,
            "type": "FIELD_REPORT",
            "title": f"Field Observation Report: {rpt.title}",
            "description": f"{rpt.content}\nRecommendations: {rpt.recommendations or 'Follow prescribed protocol.'}",
            "author": rpt.officer.name if rpt.officer else "Extension Officer",
            "badge": "Field Report",
            "metadata": {
                "title": rpt.title,
                "recommendations": rpt.recommendations,
            }
        })

    # 5. Resolution Event
    if case.status == CaseStatus.RESOLVED and case.resolved_at:
        resolved_by_name = case.resolved_by.name if (hasattr(case, "resolved_by") and case.resolved_by) else "Agricultural Officer"
        timeline.append({
            "id": f"res_{case.id}",
            "timestamp": case.resolved_at.isoformat(),
            "type": "RESOLUTION",
            "title": "Case Resolved & Treatment Closed",
            "description": case.resolution_notes or case.officer_notes or "Treatment plan executed. Field inspection confirmed pathogen eradicated.",
            "author": resolved_by_name,
            "badge": "Resolved",
            "metadata": {
                "resolved_by_id": str(case.resolved_by_id) if case.resolved_by_id else None,
                "resolved_by_name": resolved_by_name,
                "resolution_notes": case.resolution_notes,
            }
        })

    # Sort timeline events chronologically
    timeline.sort(key=lambda x: x["timestamp"] or "")

    return {
        "case": _case_to_dict(case, detailed=True),
        "timeline": timeline
    }


@router.put("/cases/{case_id}")
async def update_case(
    case_id: str,
    req: CaseUpdateRequest,
    current_user: User = Depends(require_role(UserRole.OFFICER, UserRole.EXPERT, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    case = db.query(OfficerCase).filter(OfficerCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if req.status:
        try:
            new_status = CaseStatus(req.status)
            case.status = new_status
            if new_status == CaseStatus.RESOLVED:
                case.resolved_at = datetime.utcnow()
                case.resolved_by_id = current_user.id
                if req.resolution_notes:
                    case.resolution_notes = req.resolution_notes
                elif req.officer_notes and not case.resolution_notes:
                    case.resolution_notes = req.officer_notes

            # Notify farmer
            status_text = new_status.value.replace('_', ' ').title()
            push_title = f"Case Update: {case.title}"
            push_msg = f"Officer {current_user.name} updated your case status to '{status_text}'. Tap to view."
            notif = Notification(
                user_id=case.farmer_id,
                type=NotificationType.CASE_UPDATE,
                title=push_title,
                message=push_msg,
                related_entity_id=str(case.id),
                related_entity_type="case",
            )
            db.add(notif)

            # Dispatch Real Device Push
            from app.services.push_notification_service import push_service
            push_service.send_push_to_user(
                db=db,
                user_id=case.farmer_id,
                title=push_title,
                message=push_msg,
                notification_type="officer_message",
                screen="home",
                record_id=str(case.id),
                create_in_app=False,
            )
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {req.status}")

    if req.officer_notes:
        case.officer_notes = req.officer_notes
    if req.resolution_notes:
        case.resolution_notes = req.resolution_notes
    if req.priority:
        case.priority = req.priority

    case.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(case)
    return {"message": "Case updated", "case": _case_to_dict(case)}


@router.post("/field-visits")
async def schedule_field_visit(
    req: FieldVisitRequest,
    current_user: User = Depends(require_role(UserRole.OFFICER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    case = db.query(OfficerCase).filter(OfficerCase.id == req.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    visit = FieldVisit(
        case_id=req.case_id,
        farm_id=case.farm_id,
        officer_id=current_user.id,
        scheduled_date=req.scheduled_date,
        notes=req.notes,
    )
    db.add(visit)
    case.status = CaseStatus.FIELD_VISIT_REQUIRED
    db.commit()

    # Notify farmer
    visit_date_str = req.scheduled_date.strftime('%B %d, %Y')
    push_title = "Field Visit Scheduled"
    push_msg = f"Officer {current_user.name} scheduled an on-site field inspection on {visit_date_str}. Tap to view details."
    notif = Notification(
        user_id=case.farmer_id,
        type=NotificationType.FIELD_VISIT,
        title=push_title,
        message=push_msg,
        related_entity_id=str(case.id),
        related_entity_type="case",
    )
    db.add(notif)

    # Dispatch Real Device Push
    from app.services.push_notification_service import push_service
    push_service.send_push_to_user(
        db=db,
        user_id=case.farmer_id,
        title=push_title,
        message=push_msg,
        notification_type="officer_message",
        screen="home",
        record_id=str(case.id),
        create_in_app=False,
    )

    db.commit()
    db.refresh(visit)
    return {"message": "Field visit scheduled", "visit_id": str(visit.id)}


@router.post("/field-reports")
async def add_field_report(
    req: FieldReportRequest,
    current_user: User = Depends(require_role(UserRole.OFFICER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    case = db.query(OfficerCase).filter(OfficerCase.id == req.case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    report = FieldReport(
        case_id=req.case_id,
        officer_id=current_user.id,
        title=req.title,
        content=req.content,
        recommendations=req.recommendations,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"message": "Field report added", "report_id": str(report.id)}


def _case_to_dict(case: OfficerCase, detailed: bool = False) -> dict:
    result = {
        "id": str(case.id),
        "status": case.status.value if case.status else None,
        "title": case.title,
        "description": case.description,
        "officer_notes": case.officer_notes,
        "priority": case.priority,
        "farmer_id": str(case.farmer_id),
        "farmer_name": case.farmer.name if case.farmer else None,
        "farm_id": str(case.farm_id) if case.farm_id else None,
        "farm_name": case.farm.name if case.farm else None,
        "prediction_id": str(case.prediction_id) if case.prediction_id else None,
        "created_at": case.created_at.isoformat() if case.created_at else None,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
        "resolved_at": case.resolved_at.isoformat() if case.resolved_at else None,
        "resolved_by_id": str(case.resolved_by_id) if case.resolved_by_id else None,
        "resolved_by_name": case.resolved_by.name if (hasattr(case, "resolved_by") and case.resolved_by) else None,
        "resolution_notes": case.resolution_notes,
    }
    if detailed:
        result["field_visits"] = [
            {
                "id": str(v.id),
                "scheduled_date": v.scheduled_date.isoformat(),
                "status": v.status,
                "notes": v.notes,
            }
            for v in case.field_visits
        ]
        result["field_reports"] = [
            {
                "id": str(r.id),
                "title": r.title,
                "content": r.content,
                "recommendations": r.recommendations,
                "created_at": r.created_at.isoformat(),
            }
            for r in case.field_reports
        ]
    return result
