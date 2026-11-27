"""Google Gemini client — uses generativelanguage.googleapis.com.

Endpoint: POST {url}/v1beta/models/{model}:generateContent
Passes the API key in the `x-goog-api-key` header (never in URL query params).
"""

from __future__ import annotations

import os

import httpx

from omakase.llm.base import BaseLLM


class GeminiLLM(BaseLLM):
    """Google Gemini via the v1beta generateContent endpoint."""

    def __init__(self, url: str, model: str, api_key: str | None = None):
        key = (
            api_key
            or os.environ.get("OMAKASE_API_KEY")
            or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GOOGLE_API_KEY", "")
        )
        super().__init__(url, model, key)

    def generate(
        self,
        prompt: str,
        temperature: float = 0.4,
        num_ctx: int = 16384,
        supports_json: bool = True,
    ) -> str:
        payload: dict = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 8192,
            },
        }
        if supports_json:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-goog-api-key"] = self.api_key

        model_id = self.model.strip().removeprefix("models/")
        endpoint = f"{self.url.rstrip('/')}/v1beta/models/{model_id}:generateContent"

        with httpx.Client(timeout=300, follow_redirects=False) as client:
            resp = client.post(endpoint, json=payload, headers=headers)
            if resp.status_code == 400 and supports_json:
                detail = (resp.text or "").lower()
                if "responsemimetype" in detail or "json" in detail:
                    payload["generationConfig"].pop("responseMimeType", None)
                    resp = client.post(endpoint, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return ""
            parts = candidates[0].get("content", {}).get("parts", [])
            return "".join(p.get("text", "") for p in parts)
