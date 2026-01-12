from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


@dataclass(frozen=True)
class ReportPaths:
    reports_dir: Path
    frames_dir: Path


def _safe_text(value: Optional[object]) -> str:
    if value is None:
        return "—"
    text = str(value).strip()
    return text if text else "—"


def _parse_iso_datetime(value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


def _register_fonts_if_available() -> None:
    """Register optional fonts if present.

    Keeps the report looking consistent without requiring system fonts.
    """

    fonts_dir = Path(__file__).resolve().parent.parent / "assets" / "fonts"
    if not fonts_dir.exists():
        return

    inter_regular = fonts_dir / "Inter-Regular.ttf"
    inter_semibold = fonts_dir / "Inter-SemiBold.ttf"

    try:
        if inter_regular.exists():
            pdfmetrics.registerFont(TTFont("Inter", str(inter_regular)))
        if inter_semibold.exists():
            pdfmetrics.registerFont(TTFont("Inter-SemiBold", str(inter_semibold)))
    except Exception:
        # Font registration is best-effort; fall back to built-ins.
        return


def generate_incident_report_pdf(
    *,
    incident_id: str,
    media_id: str,
    fault_type: str,
    severity: str,
    status: str,
    tampering_score: float,
    timestamp: str,
    lat: float,
    lng: float,
    reporter_name: Optional[str],
    reporter_phone: Optional[str],
    evidence_frames: Optional[list[str]],
    paths: ReportPaths,
    overwrite: bool = False,
) -> Path:
    """Generate a simple, professional incident PDF report.

    Returns the path to the generated PDF in reports/.
    """

    paths.reports_dir.mkdir(exist_ok=True)

    out_path = paths.reports_dir / f"{incident_id}.pdf"
    if out_path.exists() and not overwrite:
        return out_path

    _register_fonts_if_available()

    page_width, page_height = A4
    c = canvas.Canvas(str(out_path), pagesize=A4)

    # Palette (kept subtle / govt-portal style)
    ink = (17 / 255, 24 / 255, 39 / 255)  # slate-900
    muted = (75 / 255, 85 / 255, 99 / 255)  # slate-600
    border = (226 / 255, 232 / 255, 240 / 255)  # slate-200
    brand = (31 / 255, 41 / 255, 55 / 255)  # slate-800

    margin_x = 18 * mm
    cursor_y = page_height - 18 * mm

    def set_font(name: str, size: int) -> None:
        try:
            c.setFont(name, size)
        except Exception:
            c.setFont("Helvetica", size)

    # Header band
    band_h = 18 * mm
    c.setFillColorRGB(*brand)
    c.rect(0, page_height - band_h, page_width, band_h, fill=1, stroke=0)

    c.setFillColorRGB(1, 1, 1)
    set_font("Inter-SemiBold", 11)
    c.drawString(margin_x, page_height - 12 * mm, "Government of NCT of Delhi")
    set_font("Inter", 9)
    c.drawRightString(page_width - margin_x, page_height - 12 * mm, "Rail Infrastructure Safety Portal")

    cursor_y -= band_h + 10 * mm

    # Title
    c.setFillColorRGB(*ink)
    set_font("Inter-SemiBold", 16)
    c.drawString(margin_x, cursor_y, "Incident Report")
    set_font("Inter", 10)
    c.setFillColorRGB(*muted)
    c.drawString(margin_x, cursor_y - 6 * mm, "Automated anomaly assessment summary")

    cursor_y -= 16 * mm

    # Summary card
    card_x = margin_x
    card_w = page_width - 2 * margin_x
    card_h = 54 * mm
    c.setFillColorRGB(1, 1, 1)
    c.setStrokeColorRGB(*border)
    c.roundRect(card_x, cursor_y - card_h, card_w, card_h, 6, fill=1, stroke=1)

    left_x = card_x + 10 * mm
    top_y = cursor_y - 10 * mm

    set_font("Inter-SemiBold", 10)
    c.setFillColorRGB(*muted)
    c.drawString(left_x, top_y, "Incident ID")
    c.drawString(left_x + 70 * mm, top_y, "Severity")

    set_font("Inter-SemiBold", 12)
    c.setFillColorRGB(*ink)
    c.drawString(left_x, top_y - 6 * mm, _safe_text(incident_id))
    c.drawString(left_x + 70 * mm, top_y - 6 * mm, _safe_text(severity).upper())

    set_font("Inter", 10)
    c.setFillColorRGB(*muted)
    c.drawString(left_x, top_y - 16 * mm, "Fault Type")
    c.drawString(left_x + 70 * mm, top_y - 16 * mm, "Status")

    set_font("Inter-SemiBold", 11)
    c.setFillColorRGB(*ink)
    c.drawString(left_x, top_y - 22 * mm, _safe_text(fault_type).replace("_", " "))
    c.drawString(left_x + 70 * mm, top_y - 22 * mm, _safe_text(status))

    # Score + time
    set_font("Inter", 10)
    c.setFillColorRGB(*muted)
    c.drawString(left_x, top_y - 32 * mm, "Confidence / Score")
    c.drawString(left_x + 70 * mm, top_y - 32 * mm, "Reported At")

    set_font("Inter-SemiBold", 11)
    c.setFillColorRGB(*ink)
    c.drawString(left_x, top_y - 38 * mm, f"{max(0.0, float(tampering_score)) * 100:.0f}%")

    parsed_dt = _parse_iso_datetime(timestamp)
    time_text = parsed_dt.strftime("%d %b %Y, %H:%M") if parsed_dt else _safe_text(timestamp)
    c.drawString(left_x + 70 * mm, top_y - 38 * mm, time_text)

    cursor_y -= card_h + 12 * mm

    # Details
    set_font("Inter-SemiBold", 12)
    c.setFillColorRGB(*ink)
    c.drawString(margin_x, cursor_y, "Details")
    cursor_y -= 8 * mm

    details = [
        ("Media ID", media_id),
        ("Location", f"{lat:.6f}, {lng:.6f}"),
        ("Reporter", f"{_safe_text(reporter_name)}  {_safe_text(reporter_phone)}".strip()),
    ]

    set_font("Inter", 10)
    for label, value in details:
        c.setFillColorRGB(*muted)
        c.drawString(margin_x, cursor_y, label)
        c.setFillColorRGB(*ink)
        c.drawString(margin_x + 38 * mm, cursor_y, _safe_text(value))
        cursor_y -= 6 * mm

    cursor_y -= 6 * mm

    # Evidence
    set_font("Inter-SemiBold", 12)
    c.setFillColorRGB(*ink)
    c.drawString(margin_x, cursor_y, "Evidence")
    cursor_y -= 8 * mm

    evidence = evidence_frames or []
    primary = evidence[0] if evidence else None

    set_font("Inter", 10)
    c.setFillColorRGB(*muted)
    c.drawString(margin_x, cursor_y, "Files")
    c.setFillColorRGB(*ink)
    c.drawString(margin_x + 38 * mm, cursor_y, ", ".join(evidence) if evidence else "—")
    cursor_y -= 10 * mm

    # Embed the first image if available
    if primary and primary.lower().endswith((".jpg", ".jpeg", ".png")):
        img_path = paths.frames_dir / media_id / primary
        if img_path.exists():
            img_w = 170 * mm
            img_h = 80 * mm
            x = margin_x
            y = max(18 * mm, cursor_y - img_h)
            try:
                c.setStrokeColorRGB(*border)
                c.roundRect(x, y, img_w, img_h, 6, fill=0, stroke=1)
                c.drawImage(str(img_path), x + 2 * mm, y + 2 * mm, img_w - 4 * mm, img_h - 4 * mm, preserveAspectRatio=True, anchor="c")
            except Exception:
                pass

    # Footer
    c.setFillColorRGB(*muted)
    set_font("Inter", 8)
    c.drawString(margin_x, 12 * mm, "Generated locally by Rail Infrastructure Safety Portal")
    c.drawRightString(page_width - margin_x, 12 * mm, datetime.now().strftime("%d %b %Y %H:%M"))

    c.showPage()
    c.save()

    return out_path
