"""AI-powered contribution analysis via OpenRouter (DeepSeek)."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from openai import OpenAI

from .config import (
    HTTP_REFERER,
    X_TITLE,
    get_openrouter_api_key,
    light_model,
    openrouter_url,
)

VALID_TIMELINE_ASSESSMENTS = {"regular", "front_loaded", "back_loaded", "sporadic"}
VALID_CONFIDENCE_TAGS = {"well_supported", "partially_supported", "insufficient_evidence"}


@dataclass
class AnalysisResult:
    effort_summary: str
    anomalies: list[str] = field(default_factory=list)
    timeline_assessment: str = "regular"
    recommendations: list[str] = field(default_factory=list)
    confidence_tag: str = "insufficient_evidence"
    reasoning: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "effort_summary": self.effort_summary,
            "anomalies": self.anomalies,
            "timeline_assessment": self.timeline_assessment,
            "recommendations": self.recommendations,
            "confidence_tag": self.confidence_tag,
            "reasoning": self.reasoning,
        }


def _fallback_result() -> AnalysisResult:
    return AnalysisResult(
        effort_summary="Không thể phân tích tại thời điểm này.",
        anomalies=[],
        timeline_assessment="regular",
        recommendations=[],
        confidence_tag="insufficient_evidence",
        reasoning="Fallback: LLM call failed or returned invalid JSON.",
    )


def _build_prompt(data: dict[str, Any]) -> str:
    student_name = data.get("student_name", "N/A")
    group_name = data.get("group_name", "N/A")
    deterministic_score = data.get("deterministic_score", 0)
    tasks = data.get("tasks", [])
    work_logs = data.get("work_logs", [])
    leader_reviews = data.get("leader_reviews", [])
    peer_review_average = data.get("peer_review_average")

    tasks_text = ""
    for i, t in enumerate(tasks, 1):
        tasks_text += (
            f"  {i}. \"{t.get('name', 'N/A')}\" — status: {t.get('status', 'N/A')}, "
            f"deadline: {t.get('deadline', 'N/A')}, description: {t.get('description', '')}, "
            f"evidence_count: {t.get('evidence_count', 0)}, approved: {t.get('approved', False)}\n"
        )
    if not tasks_text:
        tasks_text = "  (Không có task nào)\n"

    logs_text = ""
    for i, log in enumerate(work_logs, 1):
        logs_text += (
            f"  {i}. Ngày: {log.get('date', 'N/A')}, "
            f"Số giờ: {log.get('hours', 0)}, "
            f"Mô tả: {log.get('description', '')}\n"
        )
    if not logs_text:
        logs_text = "  (Không có work log)\n"

    reviews_text = ""
    for i, r in enumerate(leader_reviews, 1):
        reviews_text += (
            f"  {i}. Rating: {r.get('rating', 'N/A')}/5, "
            f"Comment: {r.get('comment', '')}\n"
        )
    if not reviews_text:
        reviews_text = "  (Không có đánh giá từ trưởng nhóm/giảng viên)\n"

    peer_text = (
        f"{peer_review_average:.1f}/5" if peer_review_average is not None else "Chưa có dữ liệu"
    )

    return f"""Bạn là trợ lý phân tích contribution (đóng góp) cho dự án đồ án/luận văn nhóm sinh viên Việt Nam trên nền tảng Teamfair.

Dưới đây là dữ liệu đóng góp của sinh viên "{student_name}" trong nhóm "{group_name}":

**Điểm tham khảo (deterministic):** {deterministic_score}/100

**Danh sách task được giao:**
{tasks_text}
**Work logs (nhật ký làm việc):**
{logs_text}
**Đánh giá từ trưởng nhóm / giảng viên:**
{reviews_text}
**Điểm đánh giá chéo trung bình:** {peer_text}

---

Hãy phân tích dữ liệu trên và trả về **duy nhất** một JSON object (không markdown, không giải thích bên ngoài) với cấu trúc sau:

{{
  "effort_summary": "<Tóm tắt ngắn gọn bằng tiếng Việt về nỗ lực và chất lượng đóng góp của sinh viên, 2-4 câu>",
  "anomalies": ["<Liệt kê các bất thường nếu có, ví dụ: work log không khớp task, deadline trễ nhiều, evidence thiếu. Mỗi anomaly là 1 câu tiếng Việt ngắn. Nếu không có bất thường, trả về mảng rỗng>"],
  "timeline_assessment": "<Một trong: regular, front_loaded, back_loaded, sporadic — đánh giá nhịp độ làm việc theo thời gian>",
  "recommendations": ["<Đề xuất cải thiện bằng tiếng Việt, mỗi mục 1 câu ngắn. Tối đa 3 mục. Mảng rỗng nếu không cần>"],
  "confidence_tag": "<Một trong: well_supported, partially_supported, insufficient_evidence — mức độ tin cậy của phân tích dựa trên lượng dữ liệu có sẵn>",
  "reasoning": "<Giải thích ngắn gọn bằng tiếng Việt lý do bạn đưa ra các đánh giá trên>"
}}

Quy tắc:
- Chỉ trả về JSON, không có text nào khác.
- effort_summary phải bằng tiếng Việt.
- anomalies, recommendations phải bằng tiếng Việt.
- Nếu dữ liệu quá ít (ví dụ: 0 task, 0 work log), confidence_tag phải là "insufficient_evidence".
- Không bịa thêm dữ liệu, chỉ phân tích dữ liệu đã cho."""


def _parse_analysis(raw: str) -> AnalysisResult:
    """Parse LLM JSON output into AnalysisResult. Raises ValueError on bad data."""
    # Strip markdown code fences if present
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last lines with ```
        start = 1 if lines[0].startswith("```") else 0
        end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        text = "\n".join(lines[start:end]).strip()

    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object")

    effort_summary = data.get("effort_summary", "")
    if not isinstance(effort_summary, str) or not effort_summary.strip():
        raise ValueError("Missing or empty effort_summary")

    anomalies = data.get("anomalies", [])
    if not isinstance(anomalies, list):
        anomalies = []
    anomalies = [str(a) for a in anomalies if a]

    timeline = data.get("timeline_assessment", "regular")
    if timeline not in VALID_TIMELINE_ASSESSMENTS:
        timeline = "regular"

    recommendations = data.get("recommendations", [])
    if not isinstance(recommendations, list):
        recommendations = []
    recommendations = [str(r) for r in recommendations if r]

    confidence = data.get("confidence_tag", "insufficient_evidence")
    if confidence not in VALID_CONFIDENCE_TAGS:
        confidence = "insufficient_evidence"

    reasoning = data.get("reasoning", "")
    if not isinstance(reasoning, str):
        reasoning = ""

    return AnalysisResult(
        effort_summary=effort_summary.strip(),
        anomalies=anomalies,
        timeline_assessment=timeline,
        recommendations=recommendations,
        confidence_tag=confidence,
        reasoning=reasoning.strip(),
    )


def analyze_contribution(data: dict[str, Any]) -> AnalysisResult:
    """
    Analyze a student's contribution quality using DeepSeek via OpenRouter.

    Args:
        data: dict with keys: student_name, group_name, deterministic_score,
              tasks (list[dict]), work_logs (list[dict]),
              leader_reviews (list[dict]), peer_review_average (float|None)

    Returns:
        AnalysisResult dataclass with effort_summary, anomalies, timeline_assessment,
        recommendations, confidence_tag, reasoning.
    """
    try:
        client = OpenAI(
            api_key=get_openrouter_api_key(),
            base_url=openrouter_url,
            default_headers={
                "HTTP-Referer": HTTP_REFERER,
                "X-Title": X_TITLE,
            },
        )

        prompt = _build_prompt(data)

        completion = client.chat.completions.create(
            model=light_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a contribution analysis assistant for Teamfair, "
                        "a Vietnamese student thesis management platform. "
                        "Respond ONLY with valid JSON, no markdown or extra text."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1500,
        )

        raw_content = (completion.choices[0].message.content or "").strip()
        if not raw_content:
            return _fallback_result()

        return _parse_analysis(raw_content)

    except (json.JSONDecodeError, ValueError):
        return _fallback_result()
    except Exception:
        return _fallback_result()


def _build_verification_prompt(data: dict[str, Any]) -> str:
    task_name = data.get("task_name", "N/A")
    task_description = data.get("task_description", "Không có mô tả.")
    student_name = data.get("student_name", "N/A")
    work_logs = data.get("work_logs", [])
    evidence_files = data.get("evidence_files", [])

    work_logs_text = ""
    for i, log in enumerate(work_logs, 1):
        work_logs_text += (
            f"  {i}. Ngày: {log.get('date', 'N/A')}, "
            f"Số giờ: {log.get('hours', 0)}, "
            f"Mô tả: {log.get('description', '')}\n"
        )
    if not work_logs_text:
        work_logs_text = "  (Không có nhật ký làm việc nào được ghi cho task này)\n"

    evidence_text = ""
    for i, f in enumerate(evidence_files, 1):
        evidence_text += (
            f"--- Tệp {i}: {f.get('file_name', 'N/A')} ---\n"
            f"{f.get('content', '')}\n\n"
        )
    if not evidence_text:
        evidence_text = "  (Không có tài liệu/bằng chứng nào được nộp)\n"

    return f"""Bạn là một chuyên gia đánh giá và xác minh đóng góp của sinh viên Việt Nam trên nền tảng Teamfair.
Nhiệm vụ của bạn là đánh giá xem nhiệm vụ (task) được nộp bởi sinh viên đã hoàn thành thực sự và đảm bảo chất lượng hay chưa.

Dưới đây là thông tin nhiệm vụ và các bằng chứng liên quan:

**Tên nhiệm vụ:** {task_name}
**Mô tả nhiệm vụ:** {task_description}
**Sinh viên thực hiện:** {student_name}

**Nhật ký làm việc liên quan (Work Logs):**
{work_logs_text}

**Tệp bằng chứng được nộp (Evidence Files & Content):**
{evidence_text}

---

Hãy phân tích toàn bộ dữ liệu trên (mô tả task, nhật ký làm việc, nội dung chi tiết trong các file đính kèm) và trả về duy nhất một JSON object (không markdown, không giải thích bên ngoài) với cấu trúc sau:

{{
  "status": "<Một trong: verified, needs_revision>",
  "confidence_score": <Điểm số tin cậy từ 0 đến 100 về độ xác thực của kết quả, kiểu int>,
  "reasoning": "<Phân tích chi tiết bằng tiếng Việt về lý do đưa ra đánh giá, chỉ ra các điểm khớp hoặc không khớp giữa bằng chứng và task, chất lượng công việc, các bất thường nếu có>",
  "suggested_feedback": "<Gợi ý phản hồi bằng tiếng Việt ngắn gọn để trưởng nhóm gửi cho sinh viên (khen ngợi hoặc các điểm cần sửa đổi cụ thể nếu có)>"
}}

Quy tắc:
- Chỉ trả về JSON, không có text nào khác.
- status chỉ được là "verified" hoặc "needs_revision".
- reasoning và suggested_feedback phải bằng tiếng Việt."""


def verify_task_submission(data: dict[str, Any]) -> dict[str, Any]:
    """
    Verify a student's task submission by analyzing details, work logs and extracted document text.
    """
    try:
        client = OpenAI(
            api_key=get_openrouter_api_key(),
            base_url=openrouter_url,
            default_headers={
                "HTTP-Referer": HTTP_REFERER,
                "X-Title": X_TITLE,
            },
        )

        prompt = _build_verification_prompt(data)

        completion = client.chat.completions.create(
            model=light_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a task verification assistant for Teamfair. "
                        "Respond ONLY with valid JSON, no markdown or extra text."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=2000,
        )

        raw_content = (completion.choices[0].message.content or "").strip()
        if not raw_content:
            raise ValueError("Empty response from AI")

        # Parse JSON
        text = raw_content.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            start = 1 if lines[0].startswith("```") else 0
            end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
            text = "\n".join(lines[start:end]).strip()

        res = json.loads(text)
        if not isinstance(res, dict):
            raise ValueError("Response is not a dictionary")

        status = res.get("status", "needs_revision")
        if status not in ("verified", "needs_revision"):
            status = "needs_revision"

        return {
            "status": status,
            "confidence_score": int(res.get("confidence_score", 50)),
            "reasoning": str(res.get("reasoning", "Không có giải thích chi tiết.")),
            "suggested_feedback": str(res.get("suggested_feedback", "Không có gợi ý phản hồi."))
        }

    except Exception as e:
        return {
            "status": "needs_revision",
            "confidence_score": 0,
            "reasoning": f"Lỗi trong quá trình xác minh bằng AI: {e}",
            "suggested_feedback": "Vui lòng kiểm tra lại thủ công."
        }
