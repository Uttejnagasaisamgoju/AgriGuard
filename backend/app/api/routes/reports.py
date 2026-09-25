"""
AgriGuard Reports API
=====================
Authoritative timestamp for each reportable event type:
  - Disease Detection  → DiseasePrediction.created_at
    (created_at is set at the moment the ML inference request is submitted,
     making it the actual detection timestamp. No separate detected_at field exists.)
  - Officer Case       → OfficerCase.created_at  (creation), OfficerCase.resolved_at (resolution)
  - Farm Registration  → Farm.created_at

Timezone strategy:
  - All timestamps stored in the database as UTC (naive datetime, datetime.utcnow()).
  - All backend date filtering is performed in UTC.
  - The frontend displays dates in the user's browser/local timezone via JavaScript's
    toLocaleString() — conversion happens at the display boundary only.
  - No mixed-timezone arithmetic is performed inside backend calculations.

Date boundary convention:
  - Half-open interval [start_utc, end_utc) is used throughout.
    i.e.  created_at >= start_utc  AND  created_at < end_utc
  - This avoids the 23:59:59 bug that missed records with microseconds past that second.
"""

from fastapi import APIRouter, Depends, Query, Response, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta, date
import calendar

from app.database.session import get_db
from app.models.user import User, UserRole
from app.models.farm import Farm
from app.models.disease import DiseasePrediction
from app.models.officer import OfficerCase, CaseStatus
from app.models.report_history import FarmReport
from app.auth.dependencies import get_current_user
from app.services.farm_report_service import FarmReportService
from app.services.pdf_report_service import PDFReportService

router = APIRouter(prefix="/api/reports", tags=["Reports"])
farm_report_service = FarmReportService()
pdf_report_service = PDFReportService()


def _get_utc_range(period: str) -> tuple[datetime, datetime]:
    """
    Return (start_utc, end_utc) for the requested period.

    Rolling windows (suffix 'd'):
        7d, 30d, 90d, 365d → [now - N days, now)

    Calendar-anchored (all boundaries computed in UTC):
        today       → [start of today UTC, start of tomorrow UTC)
        yesterday   → [start of yesterday UTC, start of today UTC)
        this_week   → [start of Monday this ISO week UTC, now)
        last_week   → [start of Monday last ISO week, start of Monday this week)
        this_month  → [1st of current month UTC 00:00, now)
        last_month  → [1st of previous month UTC 00:00, 1st of current month UTC 00:00)
    """
    now_utc = datetime.utcnow()
    today_utc = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_utc = today_utc + timedelta(days=1)

    if period == "today":
        return today_utc, tomorrow_utc

    if period == "yesterday":
        yesterday_utc = today_utc - timedelta(days=1)
        return yesterday_utc, today_utc

    if period == "this_week":
        # ISO week: Monday = 0
        days_since_monday = today_utc.weekday()  # Monday=0, Sunday=6
        week_start = today_utc - timedelta(days=days_since_monday)
        return week_start, now_utc

    if period == "last_week":
        days_since_monday = today_utc.weekday()
        this_week_start = today_utc - timedelta(days=days_since_monday)
        last_week_start = this_week_start - timedelta(weeks=1)
        return last_week_start, this_week_start

    if period == "this_month":
        month_start = today_utc.replace(day=1)
        return month_start, now_utc

    if period == "last_month":
        first_of_this_month = today_utc.replace(day=1)
        # Last day of previous month = day before first of this month
        last_month_end = first_of_this_month
        # First day of previous month
        if first_of_this_month.month == 1:
            last_month_start = first_of_this_month.replace(year=first_of_this_month.year - 1, month=12, day=1)
        else:
            last_month_start = first_of_this_month.replace(month=first_of_this_month.month - 1, day=1)
        return last_month_start, last_month_end

    # Rolling windows: Nd
    rolling_map = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "365d": 365,
        "1y": 365,  # alias kept for backward compat
    }
    days = rolling_map.get(period, 30)
    start_utc = now_utc - timedelta(days=days)
    return start_utc, now_utc


@router.get("")
async def get_reports(
    period: str = Query(
        "30d",
        description=(
            "Time period. Rolling: 7d, 30d, 90d, 365d. "
            "Calendar: today, yesterday, this_week, last_week, this_month, last_month."
        ),
    ),
    farm_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return aggregated report data for the authenticated user.

    All counts and date filtering use DiseasePrediction.created_at as the
    authoritative detection timestamp (see module docstring above).

    Half-open interval [start_utc, end_utc) is used so that no records are
    lost or double-counted across adjacent periods.
    """
    start_utc, end_utc = _get_utc_range(period)

    # ── Farm Scope ────────────────────────────────────────────────────────────
    if current_user.role == UserRole.FARMER:
        farm_query = db.query(Farm).filter(Farm.user_id == current_user.id)
    else:
        farm_query = db.query(Farm)

    if farm_id:
        farm_query = farm_query.filter(Farm.id == farm_id)

    farms = farm_query.all()

    # ── Predictions in Period ─────────────────────────────────────────────────
    # Authoritative timestamp: DiseasePrediction.created_at (= detection timestamp)
    # Half-open interval: created_at >= start_utc AND created_at < end_utc
    pred_query = db.query(DiseasePrediction).filter(
        DiseasePrediction.created_at >= start_utc,
        DiseasePrediction.created_at < end_utc,
    )
    if current_user.role == UserRole.FARMER:
        pred_query = pred_query.filter(DiseasePrediction.user_id == current_user.id)
    if farm_id:
        pred_query = pred_query.filter(DiseasePrediction.farm_id == farm_id)

    predictions = pred_query.all()

    # ── Aggregation ───────────────────────────────────────────────────────────
    disease_counts: dict[str, int] = {}
    crop_counts: dict[str, int] = {}
    confidence_data: list[float] = []

    for p in predictions:
        d = p.primary_disease or "Unknown"
        disease_counts[d] = disease_counts.get(d, 0) + 1
        c = p.primary_crop or "Unknown"
        crop_counts[c] = crop_counts.get(c, 0) + 1
        if p.overall_confidence is not None:
            confidence_data.append(p.overall_confidence)

    healthy_count = disease_counts.get("Healthy", 0)
    total_detections = len(predictions)
    disease_detections = total_detections - healthy_count

    # ── Officer Cases in Period ───────────────────────────────────────────────
    # Authoritative timestamp: OfficerCase.created_at (= case creation event)
    cases_query = db.query(OfficerCase).filter(
        OfficerCase.created_at >= start_utc,
        OfficerCase.created_at < end_utc,
    )
    if current_user.role == UserRole.FARMER:
        cases_query = cases_query.filter(OfficerCase.farmer_id == current_user.id)
    if farm_id:
        cases_query = cases_query.filter(OfficerCase.farm_id == farm_id)

    total_cases = cases_query.count()
    resolved_cases = cases_query.filter(OfficerCase.status == CaseStatus.RESOLVED).count()

    # ── Daily Disease Trend ───────────────────────────────────────────────────
    # Generate one bucket per calendar day in the selected range.
    # Uses half-open [day_start, day_end) per bucket so records with
    # microseconds after 23:59:59 are correctly counted.
    delta_days = (end_utc.date() - start_utc.date()).days
    # Cap trend to 30 buckets max (rolling display limit)
    trend_days = min(delta_days + 1, 30)

    # For periods longer than 30 days, start the trend from the most recent 30 days
    trend_start_date = end_utc.date() - timedelta(days=trend_days - 1)

    disease_trend: list[dict] = []
    for i in range(trend_days):
        day_date = trend_start_date + timedelta(days=i)
        day_start = datetime(day_date.year, day_date.month, day_date.day, 0, 0, 0, 0)
        day_end = day_start + timedelta(days=1)  # exclusive upper bound

        # Filter against the in-memory predictions list for efficiency
        day_preds = [
            p for p in predictions
            if p.created_at is not None and day_start <= p.created_at < day_end
        ]
        disease_trend.append({
            "date": day_date.strftime("%Y-%m-%d"),
            "detections": len(day_preds),
            "healthy": sum(1 for p in day_preds if (p.primary_disease or "").lower() == "healthy"),
        })

    avg_confidence = (
        round(sum(confidence_data) / len(confidence_data), 3)
        if confidence_data else None
    )

    return {
        "period": period,
        "period_start_utc": start_utc.isoformat(),
        "period_end_utc": end_utc.isoformat(),
        "summary": {
            "total_farms": len(farms),
            "total_detections": total_detections,
            "disease_detections": disease_detections,
            "healthy_detections": healthy_count,
            "total_cases": total_cases,
            "resolved_cases": resolved_cases,
            "avg_confidence": avg_confidence,
        },
        "disease_distribution": [
            {"disease": k, "count": v}
            for k, v in sorted(disease_counts.items(), key=lambda x: -x[1])
        ],
        "crop_distribution": [
            {"crop": k, "count": v}
            for k, v in sorted(crop_counts.items(), key=lambda x: -x[1])
        ],
        "disease_trend": disease_trend,
        "has_data": total_detections > 0,
        "message": (
            None if total_detections > 0
            else "Not enough data yet. Use the disease detection feature to generate analytics."
        ),
    }


@router.get("/farm/{farm_id}")
async def get_single_farm_report(
    farm_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full per-farm report data via /api/reports/farm/{farm_id}"""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if str(farm.user_id) != str(current_user.id) and user_role_str not in ["OFFICER", "ADMIN", "EXPERT"]:
        raise HTTPException(status_code=403, detail="Access denied: You are not authorized to view this farm's report")

    return await farm_report_service.get_farm_full_report(farm, db)


@router.get("/farm/{farm_id}/pdf")
async def download_single_farm_report_pdf(
    farm_id: str,
    lang: str = Query("en"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and download fresh farm report PDF via /api/reports/farm/{farm_id}/pdf in selected language"""
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    user_role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if str(farm.user_id) != str(current_user.id) and user_role_str not in ["OFFICER", "ADMIN", "EXPERT"]:
        raise HTTPException(status_code=403, detail="Access denied: You are not authorized to download this report")

    report_data = await farm_report_service.get_farm_full_report(farm, db)
    pdf_bytes = pdf_report_service.build_farm_pdf(report_data, lang=lang)

    safe_name = pdf_report_service.sanitize_filename(farm.name)
    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    filename = f"AgriGuard_{safe_name}_Report_{date_str}.pdf"

    # Persist in farm_reports table for history
    try:
        report_record = FarmReport(
            farm_id=farm.id,
            user_id=current_user.id,
            report_type="health_summary",
            period="current",
            file_name=filename,
            summary_data={
                "health_status": report_data["status_summary"]["health_status"],
                "active_infections": report_data["status_summary"]["active_infections"],
                "total_detections": report_data["status_summary"]["total_detections"],
                "ndvi": report_data["status_summary"]["ndvi"],
            },
            status="completed",
            generated_at=datetime.utcnow(),
        )
        db.add(report_record)
        db.commit()
    except Exception:
        db.rollback()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Type": "application/pdf",
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
