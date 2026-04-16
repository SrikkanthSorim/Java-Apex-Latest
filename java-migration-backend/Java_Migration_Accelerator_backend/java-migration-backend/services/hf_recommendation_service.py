import json
import logging
import os
from typing import Any, Dict, List

import httpx


logger = logging.getLogger(__name__)


class HFRecommendationService:
    def __init__(self) -> None:
        self.hf_token = os.getenv("HF_TOKEN", "").strip()
        self.endpoint = "https://router.huggingface.co/v1/chat/completions"
        self.model = os.getenv("HF_MODEL", "openai/gpt-oss-120b:fastest")

    async def recommend_target_version(self, analysis_payload: Dict[str, Any]) -> Dict[str, Any]:
        if not self.hf_token:
            raise ValueError("HF_TOKEN is not configured.")

        response_data = await self._call_hugging_face(analysis_payload)
        recommendation = self._parse_recommendation(response_data)

        recommended = str(recommendation.get("recommended_target_version", "")).strip()
        if recommended not in {"11", "17", "21"}:
            raise ValueError(f"Unexpected Hugging Face recommendation '{recommended}'.")

        rationale = self._normalize_rationale(recommendation)
        alternatives = recommendation.get("alternatives")

        if not rationale:
            raise ValueError("Hugging Face response did not include rationale.")

        return {
            "recommended_target_version": recommended,
            "confidence": str(recommendation.get("confidence", "medium")).lower(),
            "rationale": rationale,
            "alternatives": self._normalize_alternatives(alternatives),
        }

    async def _call_hugging_face(self, analysis_payload: Dict[str, Any]) -> Dict[str, Any]:
        prompt_payload = self._build_prompt_payload(analysis_payload)

        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                self.endpoint,
                headers={
                    "Authorization": f"Bearer {self.hf_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a Java migration architect. "
                                "Recommend a target Java version from this set only: 11, 17, 21. "
                                "Prefer LTS versions, minimize migration risk, and return valid JSON only."
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                "Analyze this repository summary and recommend the safest target Java version.\n"
                                "Return JSON with keys: recommended_target_version, confidence, rationale, alternatives.\n"
                                f"Repository summary:\n{json.dumps(prompt_payload, indent=2)}"
                            ),
                        },
                    ],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            return response.json()

    def _parse_recommendation(self, response_data: Dict[str, Any]) -> Dict[str, Any]:
        choices = response_data.get("choices") or []
        if not choices:
            raise ValueError("No choices returned from Hugging Face")

        message = choices[0].get("message") or {}
        content = message.get("content")

        if isinstance(content, list):
            text_chunks = [item.get("text", "") for item in content if isinstance(item, dict)]
            content = "".join(text_chunks)

        if not isinstance(content, str) or not content.strip():
            raise ValueError("Empty content returned from Hugging Face")

        return json.loads(content)

    def _normalize_rationale(self, recommendation: Dict[str, Any]) -> List[str]:
        candidates = [
            recommendation.get("rationale"),
            recommendation.get("reasons"),
            recommendation.get("explanation"),
            recommendation.get("reasoning"),
        ]

        normalized: List[str] = []

        for candidate in candidates:
            if isinstance(candidate, list):
                for item in candidate:
                    if isinstance(item, str) and item.strip():
                        normalized.append(item.strip())
                    elif isinstance(item, dict):
                        text = item.get("reason") or item.get("text") or item.get("description")
                        if isinstance(text, str) and text.strip():
                            normalized.append(text.strip())
            elif isinstance(candidate, str) and candidate.strip():
                split_lines = [line.strip("- ").strip() for line in candidate.splitlines() if line.strip()]
                normalized.extend([line for line in split_lines if line])
            elif isinstance(candidate, dict):
                text = candidate.get("reason") or candidate.get("text") or candidate.get("description")
                if isinstance(text, str) and text.strip():
                    normalized.append(text.strip())

        deduped: List[str] = []
        for item in normalized:
            if item not in deduped:
                deduped.append(item)

        return deduped

    def _normalize_alternatives(self, alternatives: Any) -> List[str]:
        if not isinstance(alternatives, list):
            return []

        normalized: List[str] = []
        for item in alternatives:
            value = None

            if isinstance(item, str):
                value = item.strip()
            elif isinstance(item, (int, float)):
                value = str(int(item))
            elif isinstance(item, dict):
                raw_value = item.get("version") or item.get("target_version") or item.get("value")
                if raw_value is not None:
                    value = str(raw_value).strip()

            if value in {"11", "17", "21"} and value not in normalized:
                normalized.append(value)

        return normalized

    def _build_prompt_payload(self, analysis_payload: Dict[str, Any]) -> Dict[str, Any]:
        dependencies = analysis_payload.get("dependencies") or []

        return {
            "source_java_version": str(analysis_payload.get("source_java_version", "")),
            "detected_java_version": analysis_payload.get("detected_java_version"),
            "build_tool": analysis_payload.get("build_tool"),
            "has_tests": bool(analysis_payload.get("has_tests")),
            "api_endpoint_count": int(analysis_payload.get("api_endpoint_count", 0)),
            "risk_level": analysis_payload.get("risk_level", "unknown"),
            "dependency_count": len(dependencies),
            "dependencies": [
                {
                    "group_id": dep.get("group_id"),
                    "artifact_id": dep.get("artifact_id"),
                    "current_version": dep.get("current_version"),
                    "status": dep.get("status"),
                }
                for dep in dependencies[:20]
                if isinstance(dep, dict)
            ],
        }
