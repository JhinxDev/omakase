"""OpenAI-compatible LLM client.

Works with any service exposing /v1/chat/completions in OpenAI's shape:
OpenAI, DeepSeek, OpenRouter, Groq, Together, LM Studio, vLLM, etc.

API key is read from the `api_key` argument, otherwise from one of these env
vars (first match wins):
    OMAKASE_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY,
    OPENROUTER_API_KEY, GROQ_API_KEY, TOGETHER_API_KEY
"""

from __future__ import annotations

import os
import re

import httpx

from omakase.llm.base import BaseLLM

_API_KEY_ENV_VARS = (
    "OMAKASE_API_KEY",
    "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY",
    "OPENROUTER_API_KEY",
    "GROQ_API_KEY",
    "TOGETHER_API_KEY",
)

_DEFAULT_MAX_TOKENS = 8192
_DEEPSEEK_REASONING_MAX_TOKENS = 8192
_OPENAI_REASONING_PREFIX_RE = re.compile(r"^(?:gpt-[56]|o\d)")


def _discover_api_key() -> str:
    for var in _API_KEY_ENV_VARS:
        v = os.environ.get(var)
        if v:
            return v
    return ""


def _extract_message_content(data: dict) -> str:
    choices = data.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and isinstance(block.get("text"), str)
        )
    return ""


class OpenAILLM(BaseLLM):
    """Generic OpenAI-compatible API client."""

    def __init__(self, url: str, model: str, api_key: str | None = None):
        super().__init__(url, model, api_key or _discover_api_key())

    def _max_tokens(self) -> int:
        url = self.url.rstrip("/").lower()
        model = self.model.lower()
        if url == "https://api.deepseek.com" and model in {
            "deepseek-reasoner",
            "deepseek-v4-pro",
        }:
            return _DEEPSEEK_REASONING_MAX_TOKENS
        return _DEFAULT_MAX_TOKENS

    def _chat_completions_url(self) -> str:
        return f"{self.url.rstrip('/')}/v1/chat/completions"

    def _uses_max_completion_tokens(self) -> bool:
        url = self.url.rstrip("/").lower()
        model = self.model.lower()
        if url != "https://api.openai.com":
            return False
        return bool(_OPENAI_REASONING_PREFIX_RE.match(model))

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if "openrouter.ai" in self.url.lower():
            headers["HTTP-Referer"] = "https://omakase.jhinx.dev"
            headers["X-Title"] = "Omakase"
        return headers

    def _build_payload(
        self,
        prompt: str,
        *,
        temperature: float,
        supports_json: bool,
        use_max_completion_tokens: bool,
        include_temperature: bool,
    ) -> dict:
        payload: dict = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if use_max_completion_tokens:
            payload["max_completion_tokens"] = self._max_tokens()
        else:
            if include_temperature:
                payload["temperature"] = temperature
            payload["max_tokens"] = self._max_tokens()
        if supports_json:
            payload["response_format"] = {"type": "json_object"}
        return payload

    def generate(
        self,
        prompt: str,
        temperature: float = 0.4,
        num_ctx: int = 16384,
        supports_json: bool = True,
    ) -> str:
        use_max_completion = self._uses_max_completion_tokens()
        include_temperature = not use_max_completion
        payload = self._build_payload(
            prompt,
            temperature=temperature,
            supports_json=supports_json,
            use_max_completion_tokens=use_max_completion,
            include_temperature=include_temperature,
        )
        headers = self._headers()
        endpoint = self._chat_completions_url()

        with httpx.Client(timeout=300, follow_redirects=False) as client:
            resp = client.post(endpoint, json=payload, headers=headers)
            if resp.status_code == 400:
                detail = (resp.text or "").lower()
                retry_json = supports_json and (
                    "response_format" in detail or "json_object" in detail
                )
                retry_max_completion = not use_max_completion and "max_completion_tokens" in detail
                retry_temp = include_temperature and "temperature" in detail
                if retry_json or retry_max_completion or retry_temp:
                    fallback_payload = self._build_payload(
                        prompt,
                        temperature=temperature,
                        supports_json=False if retry_json else supports_json,
                        use_max_completion_tokens=use_max_completion or retry_max_completion,
                        include_temperature=False
                        if (retry_temp or retry_max_completion)
                        else include_temperature,
                    )
                    resp = client.post(endpoint, json=fallback_payload, headers=headers)
            resp.raise_for_status()
            return _extract_message_content(resp.json())


class OpenWebUILLM(OpenAILLM):
    """OpenWebUI's bearer-authenticated OpenAI-compatible chat endpoint."""

    def _chat_completions_url(self) -> str:
        return f"{self.url.rstrip('/')}/api/chat/completions"
