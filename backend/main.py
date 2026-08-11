import html
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

load_dotenv()

YAHOO_APP_ID = os.getenv("YAHOO_APP_ID")
RAKUTEN_APP_ID = os.getenv("RAKUTEN_APP_ID")
RAKUTEN_ACCESS_KEY = os.getenv("RAKUTEN_ACCESS_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_SEARCH_API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY")
GOOGLE_SEARCH_ENGINE_ID = os.getenv("GOOGLE_SEARCH_ENGINE_ID") or os.getenv("GOOGLE_CSE_ID")
BRAVE_SEARCH_API_KEY = os.getenv("BRAVE_SEARCH_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
SUPABASE_LOOKUP_TABLE = os.getenv("SUPABASE_LOOKUP_TABLE", "product_lookup_candidates")
WEB_SEARCH_PROVIDER = os.getenv("WEB_SEARCH_PROVIDER", "brave").strip().lower()
LOOKUP_CACHE_PATH = Path(os.getenv("LOOKUP_CACHE_PATH", "data/lookup_candidates.json"))
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")]

YAHOO_ENDPOINT = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch"
RAKUTEN_ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"
GOOGLE_CUSTOM_SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1"
BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"


def normalize_gemini_model(value: str | None) -> str:
    model = (value or "gemini-3.6-flash").strip()
    aliases = {
        "gemini2.5flash": "gemini-3.6-flash",
        "gemini-2.5flash": "gemini-3.6-flash",
        "gemini2.5-flash": "gemini-3.6-flash",
        "gemini flash 2.5": "gemini-3.6-flash",
        "gemini 2.5 flash": "gemini-3.6-flash",
        "gemini-2.5-flash": "gemini-3.6-flash",
        "2.5flash": "gemini-3.6-flash",
        "2.5-flash": "gemini-3.6-flash",
        "gemini3.6flash": "gemini-3.6-flash",
        "gemini-3.6flash": "gemini-3.6-flash",
        "gemini3.6-flash": "gemini-3.6-flash",
        "gemini flash 3.6": "gemini-3.6-flash",
        "gemini 3.6 flash": "gemini-3.6-flash",
        "3.6flash": "gemini-3.6-flash",
        "3.6-flash": "gemini-3.6-flash",
    }
    return aliases.get(model.lower(), model)


GEMINI_MODEL = normalize_gemini_model(os.getenv("GEMINI_MODEL"))

app = FastAPI(title="OshiList Product Lookup", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class LineupItem(BaseModel):
    characterName: str = Field(..., min_length=1)
    variantName: str = Field(default="通常版", min_length=1)


class LookupResponse(BaseModel):
    janCode: str
    boxName: str
    imageUrl: str | None = None
    sourceLabel: str
    lineup: list[LineupItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    sourceUrls: list[str] = Field(default_factory=list)
    selectedCandidateId: str | None = None
    candidates: list["LookupCandidate"] = Field(default_factory=list)


class AnalyzeLineupRequest(BaseModel):
    productName: str = Field(..., min_length=1)


class AnalyzeLineupResponse(BaseModel):
    lineup: list[LineupItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ProductCandidate(BaseModel):
    boxName: str
    imageUrl: str | None = None
    sourceLabel: str


class LookupCandidate(ProductCandidate):
    id: str
    sourceUrl: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    selectedCount: int = 0
    rejectedCount: int = 0
    score: float = 0.0


class CandidateFeedbackRequest(BaseModel):
    candidateId: str = Field(..., min_length=1)
    action: str = Field(..., pattern="^(selected|rejected)$")


class ReceiptParseRequest(BaseModel):
    imageBase64: str = Field(..., min_length=1)
    mimeType: str = Field(default="image/jpeg")


class ReceiptExtractedItem(BaseModel):
    rawText: str
    normalizedQuery: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class ReceiptItemCandidate(ReceiptExtractedItem):
    candidates: list[ProductCandidate] = Field(default_factory=list)


class ReceiptParseResponse(BaseModel):
    items: list[ReceiptItemCandidate] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class PhotoInferResponse(BaseModel):
    boxName: str = ""
    seriesName: str = ""
    characterName: str = ""
    goodsType: str = ""
    variantName: str = ""
    isRandom: bool = False
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def landing_page() -> str:
    return """
    <!doctype html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>OshiList</title>
        <style>
          body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #171622; background: #fbfaff; }
          main { max-width: 720px; margin: 0 auto; padding: 56px 20px; }
          h1 { font-size: 36px; margin: 0 0 12px; }
          p { line-height: 1.8; }
          a { color: #7b61ff; font-weight: 700; }
          .panel { background: #ffffff; border: 1px solid #ddd7ff; border-radius: 8px; padding: 20px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <main>
          <h1>OshiList</h1>
          <p>OshiListは、推しグッズの所持状況を管理するアプリです。JANコードから商品名と画像を取得し、コレクション登録と重複購入防止を補助します。</p>
          <div class="panel">
            <p>このサイトはOshiListアプリのバックエンドAPIおよびアプリケーション紹介ページです。</p>
            <p><a href="/privacy">プライバシーポリシー</a> / <a href="/health">APIヘルスチェック</a></p>
          </div>
        </main>
      </body>
    </html>
    """


@app.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
async def privacy_page() -> str:
    app_name = html.escape("OshiList")
    return f"""
    <!doctype html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{app_name} Privacy Policy</title>
        <style>
          body {{ font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #171622; background: #ffffff; }}
          main {{ max-width: 760px; margin: 0 auto; padding: 48px 20px; }}
          h1 {{ font-size: 30px; margin: 0 0 18px; }}
          h2 {{ font-size: 18px; margin-top: 28px; }}
          p, li {{ line-height: 1.8; }}
        </style>
      </head>
      <body>
        <main>
          <h1>プライバシーポリシー</h1>
          <p>{app_name}は、推しグッズ管理を補助するためにJANコード、商品名、商品画像URL、登録内容を利用します。</p>
          <h2>取得する情報</h2>
          <ul>
            <li>ユーザーが入力またはスキャンしたJANコード</li>
            <li>商品検索APIから取得した商品名、商品画像URL</li>
            <li>ユーザーがアプリ内で登録したグッズ情報</li>
          </ul>
          <h2>利用目的</h2>
          <p>商品登録の補助、コレクション管理、重複購入防止のために利用します。</p>
          <h2>外部API</h2>
          <p>商品情報取得のため、楽天市場API、Yahoo!ショッピングAPI、Gemini APIを利用する場合があります。</p>
          <h2>保存</h2>
          <p>コレクション情報は主に端末内に保存されます。バックエンドは商品検索とラインナップ解析の中継に利用します。</p>
        </main>
      </body>
    </html>
    """


def validate_jan(jan: str) -> str:
    normalized = jan.strip()
    if not re.fullmatch(r"\d{8,14}", normalized):
        raise HTTPException(status_code=400, detail="JANコードは8〜14桁の数字で指定してください。")
    return normalized


def first_rakuten_image_url(item: dict[str, Any]) -> str | None:
    image_sets = item.get("mediumImageUrls") or item.get("smallImageUrls") or []
    if not image_sets:
        return None
    image_url = image_sets[0].get("imageUrl")
    return image_url.replace("?_ex=128x128", "") if isinstance(image_url, str) else None


def rakuten_error_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return f"Rakuten Item Search API request failed. Status={response.status_code}"
    description = payload.get("error_description") or payload.get("error")
    if isinstance(description, str) and description:
        return f"Rakuten Item Search API request failed. Status={response.status_code}: {description}"
    return f"Rakuten Item Search API request failed. Status={response.status_code}"


def is_valid_rakuten_keyword(query: str) -> bool:
    words = [word for word in re.split(r"\s+", query.strip()) if word]
    if not words:
        return False

    for word in words:
        if re.search(r"[\u3040-\u30ffー]", word) and len(word) < 2:
            return False
        if word.isascii() and len(word) < 2:
            return False
    return True


def rakuten_item_from_wrapper(wrapper: dict[str, Any]) -> dict[str, Any]:
    item = wrapper.get("Item")
    if isinstance(item, dict):
        return item
    return wrapper


USED_PRODUCT_KEYWORDS = [
    "中古",
    "買取",
    "開封済",
    "開封品",
    "訳あり",
    "わけあり",
    "ジャンク",
    "アウトレット",
    "リユース",
    "リサイクル",
    "used",
    "pre-owned",
]

NEW_PRODUCT_HINT_KEYWORDS = [
    "新品",
    "予約",
    "公式",
    "正規品",
]


def product_quality_score(product_name: str, image_url: str | None = None) -> int:
    normalized_name = product_name.lower()
    score = 0
    if image_url:
        score += 2
    if any(keyword.lower() in normalized_name for keyword in NEW_PRODUCT_HINT_KEYWORDS):
        score += 2
    if any(keyword.lower() in normalized_name for keyword in USED_PRODUCT_KEYWORDS):
        score -= 8
    return score


def best_product_candidate(candidates: list[ProductCandidate]) -> ProductCandidate | None:
    if not candidates:
        return None
    ranked = sorted(candidates, key=lambda candidate: product_quality_score(candidate.boxName, candidate.imageUrl), reverse=True)
    best = ranked[0]
    if product_quality_score(best.boxName, best.imageUrl) < 0:
        return None
    return best


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def candidate_id_for(jan: str, box_name: str, source_label: str, source_url: str | None = None) -> str:
    raw = "|".join([jan.strip(), box_name.strip().lower(), source_label.strip().lower(), (source_url or "").strip().lower()])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def load_lookup_cache() -> dict[str, Any]:
    if not LOOKUP_CACHE_PATH.exists():
        return {"jans": {}}
    try:
        with LOOKUP_CACHE_PATH.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {"jans": {}}
    return payload if isinstance(payload, dict) else {"jans": {}}


def save_lookup_cache(payload: dict[str, Any]) -> None:
    LOOKUP_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOOKUP_CACHE_PATH.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def candidate_score(candidate: dict[str, Any]) -> float:
    selected = int(candidate.get("selectedCount") or 0)
    rejected = int(candidate.get("rejectedCount") or 0)
    base = float(candidate.get("confidence") or 0.0) * 3
    quality = product_quality_score(str(candidate.get("boxName") or ""), candidate.get("imageUrl"))
    return selected * 8 - rejected * 5 + base + quality


def sort_cached_candidates(raw_candidates: list[dict[str, Any]]) -> list[LookupCandidate]:
    sorted_candidates = sorted(raw_candidates, key=candidate_score, reverse=True)
    response_candidates: list[LookupCandidate] = []
    for candidate in sorted_candidates:
        try:
            response_candidates.append(
                LookupCandidate(
                    id=str(candidate.get("id") or ""),
                    boxName=str(candidate.get("boxName") or ""),
                    imageUrl=candidate.get("imageUrl") if isinstance(candidate.get("imageUrl"), str) else None,
                    sourceLabel=str(candidate.get("sourceLabel") or ""),
                    sourceUrl=candidate.get("sourceUrl") if isinstance(candidate.get("sourceUrl"), str) else None,
                    confidence=float(candidate.get("confidence")) if candidate.get("confidence") is not None else None,
                    selectedCount=max(0, int(candidate.get("selectedCount") or 0)),
                    rejectedCount=max(0, int(candidate.get("rejectedCount") or 0)),
                    score=candidate_score(candidate),
                ),
            )
        except (TypeError, ValueError):
            continue
    return [candidate for candidate in response_candidates if candidate.id and candidate.boxName]


def json_cached_candidates_for_jan(jan: str) -> list[LookupCandidate]:
    payload = load_lookup_cache()
    jan_entry = (payload.get("jans") or {}).get(jan)
    if not isinstance(jan_entry, dict):
        return []
    raw_candidates = jan_entry.get("candidates")
    if not isinstance(raw_candidates, list):
        return []
    return sort_cached_candidates(raw_candidates)


def json_store_lookup_candidates(jan: str, candidates: list[ProductCandidate], confidence: float | None = None, source_urls: list[str] | None = None) -> list[LookupCandidate]:
    payload = load_lookup_cache()
    jans = payload.setdefault("jans", {})
    jan_entry = jans.setdefault(jan, {"candidates": []})
    raw_candidates = jan_entry.setdefault("candidates", [])
    if not isinstance(raw_candidates, list):
        raw_candidates = []
        jan_entry["candidates"] = raw_candidates

    by_id = {str(candidate.get("id")): candidate for candidate in raw_candidates if isinstance(candidate, dict) and candidate.get("id")}
    by_key = {
        (str(candidate.get("boxName") or "").strip().lower(), str(candidate.get("sourceLabel") or "").strip().lower()): candidate
        for candidate in raw_candidates
        if isinstance(candidate, dict)
    }
    current_time = now_iso()

    for index, candidate in enumerate(candidates):
        source_url = source_urls[index] if source_urls and index < len(source_urls) else None
        candidate_id = candidate_id_for(jan, candidate.boxName, candidate.sourceLabel, source_url)
        existing = by_id.get(candidate_id) or by_key.get((candidate.boxName.strip().lower(), candidate.sourceLabel.strip().lower()))
        if existing is None:
            existing = {
                "id": candidate_id,
                "janCode": jan,
                "boxName": candidate.boxName,
                "imageUrl": candidate.imageUrl,
                "sourceLabel": candidate.sourceLabel,
                "sourceUrl": source_url,
                "confidence": confidence,
                "selectedCount": 0,
                "rejectedCount": 0,
                "createdAt": current_time,
            }
            raw_candidates.append(existing)
        else:
            existing["boxName"] = candidate.boxName or existing.get("boxName")
            existing["imageUrl"] = candidate.imageUrl or existing.get("imageUrl")
            existing["sourceLabel"] = candidate.sourceLabel or existing.get("sourceLabel")
            existing["sourceUrl"] = source_url or existing.get("sourceUrl")
            if confidence is not None:
                existing["confidence"] = max(float(existing.get("confidence") or 0), confidence)
        existing["updatedAt"] = current_time

    jan_entry["updatedAt"] = current_time
    save_lookup_cache(payload)
    return sort_cached_candidates(raw_candidates)


def json_apply_candidate_feedback(jan: str, candidate_id: str, action: str) -> list[LookupCandidate]:
    payload = load_lookup_cache()
    jan_entry = (payload.get("jans") or {}).get(jan)
    if not isinstance(jan_entry, dict):
        raise HTTPException(status_code=404, detail="候補キャッシュが見つかりませんでした。")
    raw_candidates = jan_entry.get("candidates")
    if not isinstance(raw_candidates, list):
        raise HTTPException(status_code=404, detail="候補キャッシュが見つかりませんでした。")

    for candidate in raw_candidates:
        if not isinstance(candidate, dict) or candidate.get("id") != candidate_id:
            continue
        key = "selectedCount" if action == "selected" else "rejectedCount"
        candidate[key] = max(0, int(candidate.get(key) or 0) + 1)
        candidate["updatedAt"] = now_iso()
        if action == "selected":
            candidate["lastSelectedAt"] = candidate["updatedAt"]
        jan_entry["updatedAt"] = candidate["updatedAt"]
        save_lookup_cache(payload)
        return sort_cached_candidates(raw_candidates)

    raise HTTPException(status_code=404, detail="指定された候補が見つかりませんでした。")


def supabase_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def supabase_rest_url() -> str:
    return f"{str(SUPABASE_URL).rstrip('/')}/rest/v1/{SUPABASE_LOOKUP_TABLE}"


def supabase_headers(prefer: str | None = None) -> dict[str, str]:
    headers = {
        "apikey": str(SUPABASE_SERVICE_ROLE_KEY),
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def supabase_row_to_candidate_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row.get("id") or ""),
        "janCode": str(row.get("jan_code") or ""),
        "boxName": str(row.get("box_name") or ""),
        "imageUrl": row.get("image_url") if isinstance(row.get("image_url"), str) else None,
        "sourceLabel": str(row.get("source_label") or ""),
        "sourceUrl": row.get("source_url") if isinstance(row.get("source_url"), str) else None,
        "confidence": row.get("confidence"),
        "selectedCount": int(row.get("selected_count") or 0),
        "rejectedCount": int(row.get("rejected_count") or 0),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
        "lastSelectedAt": row.get("last_selected_at"),
    }


def supabase_candidate_key(candidate: dict[str, Any]) -> tuple[str, str, str]:
    return (
        str(candidate.get("boxName") or "").strip().lower(),
        str(candidate.get("sourceLabel") or "").strip().lower(),
        str(candidate.get("sourceUrl") or "").strip().lower(),
    )


async def supabase_fetch_candidate_rows(jan: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.get(
            supabase_rest_url(),
            params={"jan_code": f"eq.{jan}", "select": "*"},
            headers=supabase_headers(),
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Supabase candidate cache request failed. status={response.status_code}: {response.text[:200]}")
    payload = response.json()
    return payload if isinstance(payload, list) else []


async def supabase_cached_candidates_for_jan(jan: str) -> list[LookupCandidate]:
    rows = await supabase_fetch_candidate_rows(jan)
    return sort_cached_candidates([supabase_row_to_candidate_dict(row) for row in rows if isinstance(row, dict)])


async def supabase_store_lookup_candidates(jan: str, candidates: list[ProductCandidate], confidence: float | None = None, source_urls: list[str] | None = None) -> list[LookupCandidate]:
    rows = await supabase_fetch_candidate_rows(jan)
    existing_candidates = [supabase_row_to_candidate_dict(row) for row in rows if isinstance(row, dict)]
    by_key = {supabase_candidate_key(candidate): candidate for candidate in existing_candidates}

    async with httpx.AsyncClient(timeout=12) as client:
        for index, candidate in enumerate(candidates):
            source_url = source_urls[index] if source_urls and index < len(source_urls) else None
            key = (candidate.boxName.strip().lower(), candidate.sourceLabel.strip().lower(), (source_url or "").strip().lower())
            existing = by_key.get(key)
            if existing:
                patch_payload: dict[str, Any] = {
                    "box_name": candidate.boxName,
                    "image_url": candidate.imageUrl or existing.get("imageUrl"),
                    "source_label": candidate.sourceLabel,
                    "source_url": source_url or existing.get("sourceUrl"),
                    "updated_at": now_iso(),
                }
                if confidence is not None:
                    patch_payload["confidence"] = max(float(existing.get("confidence") or 0), confidence)
                response = await client.patch(
                    supabase_rest_url(),
                    params={"id": f"eq.{existing['id']}"},
                    headers=supabase_headers(),
                    json=patch_payload,
                )
            else:
                response = await client.post(
                    supabase_rest_url(),
                    headers=supabase_headers(),
                    json={
                        "jan_code": jan,
                        "box_name": candidate.boxName,
                        "image_url": candidate.imageUrl,
                        "source_label": candidate.sourceLabel,
                        "source_url": source_url,
                        "confidence": confidence,
                    },
                )
            if response.status_code >= 400:
                raise HTTPException(status_code=502, detail=f"Supabase candidate cache save failed. status={response.status_code}: {response.text[:200]}")

    return await supabase_cached_candidates_for_jan(jan)


async def supabase_apply_candidate_feedback(jan: str, candidate_id: str, action: str) -> list[LookupCandidate]:
    rows = await supabase_fetch_candidate_rows(jan)
    matched = next((row for row in rows if isinstance(row, dict) and str(row.get("id")) == candidate_id), None)
    if not matched:
        raise HTTPException(status_code=404, detail="指定された候補が見つかりませんでした。")

    key = "selected_count" if action == "selected" else "rejected_count"
    patch_payload: dict[str, Any] = {
        key: max(0, int(matched.get(key) or 0) + 1),
        "updated_at": now_iso(),
    }
    if action == "selected":
        patch_payload["last_selected_at"] = patch_payload["updated_at"]

    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.patch(
            supabase_rest_url(),
            params={"id": f"eq.{candidate_id}"},
            headers=supabase_headers(),
            json=patch_payload,
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Supabase candidate feedback failed. status={response.status_code}: {response.text[:200]}")
    return await supabase_cached_candidates_for_jan(jan)


async def cached_candidates_for_jan(jan: str) -> list[LookupCandidate]:
    if supabase_configured():
        return await supabase_cached_candidates_for_jan(jan)
    return json_cached_candidates_for_jan(jan)


async def store_lookup_candidates(jan: str, candidates: list[ProductCandidate], confidence: float | None = None, source_urls: list[str] | None = None) -> list[LookupCandidate]:
    if supabase_configured():
        return await supabase_store_lookup_candidates(jan, candidates, confidence=confidence, source_urls=source_urls)
    return json_store_lookup_candidates(jan, candidates, confidence=confidence, source_urls=source_urls)


async def apply_candidate_feedback(jan: str, candidate_id: str, action: str) -> list[LookupCandidate]:
    if supabase_configured():
        return await supabase_apply_candidate_feedback(jan, candidate_id, action)
    return json_apply_candidate_feedback(jan, candidate_id, action)


async def search_yahoo_item(jan: str) -> ProductCandidate:
    if not YAHOO_APP_ID:
        raise HTTPException(status_code=503, detail="YAHOO_APP_IDが未設定です。")

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(
                YAHOO_ENDPOINT,
                params={"appid": YAHOO_APP_ID, "jan_code": jan, "image_size": 600, "results": 10},
            )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Yahoo!ショッピングAPIへ接続できませんでした。")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Yahoo!ショッピングAPIへのリクエストに失敗しました。status={response.status_code}")

    hits = response.json().get("hits") or []
    if not hits:
        raise HTTPException(status_code=404, detail="Yahoo!ショッピングで商品が見つかりませんでした。")

    candidates: list[ProductCandidate] = []
    for item in hits:
        product_name = item.get("name")
        if not product_name:
            continue
        image = item.get("exImage") or item.get("image") or {}
        image_url = image.get("url") or image.get("medium") or image.get("small")
        candidates.append(ProductCandidate(boxName=product_name, imageUrl=image_url, sourceLabel="Yahoo!ショッピング"))

    selected = best_product_candidate(candidates)
    if not selected:
        raise HTTPException(status_code=404, detail="Yahoo!ショッピングの候補が中古・買取系に偏っていたため、商品API候補としては採用しませんでした。")
    return selected


async def search_rakuten_item(jan: str) -> ProductCandidate:
    if not RAKUTEN_APP_ID:
        raise HTTPException(status_code=503, detail="RAKUTEN_APP_IDが未設定です。")
    if not RAKUTEN_ACCESS_KEY:
        raise HTTPException(status_code=503, detail="RAKUTEN_ACCESS_KEY is not configured.")

    params = {
        "applicationId": RAKUTEN_APP_ID,
        "accessKey": RAKUTEN_ACCESS_KEY,
        "keyword": jan,
        "hits": 10,
        "format": "json",
        "formatVersion": 2,
    }

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(RAKUTEN_ENDPOINT, params=params)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="楽天商品検索APIへ接続できませんでした。")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=rakuten_error_message(response))

    items = response.json().get("Items") or response.json().get("items") or []
    if not items:
        raise HTTPException(status_code=404, detail="楽天市場で商品が見つかりませんでした。")

    candidates: list[ProductCandidate] = []
    for wrapper in items:
        item = rakuten_item_from_wrapper(wrapper)
        product_name = item.get("itemName")
        if not product_name:
            continue
        candidates.append(ProductCandidate(boxName=product_name, imageUrl=first_rakuten_image_url(item), sourceLabel="楽天商品検索"))

    selected = best_product_candidate(candidates)
    if not selected:
        raise HTTPException(status_code=404, detail="楽天市場の候補が中古・買取系に偏っていたため、商品API候補としては採用しませんでした。")
    return selected


async def search_yahoo_jan_candidates(jan: str, limit: int = 8) -> list[ProductCandidate]:
    if not YAHOO_APP_ID:
        raise HTTPException(status_code=503, detail="YAHOO_APP_ID is not configured.")

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(
                YAHOO_ENDPOINT,
                params={"appid": YAHOO_APP_ID, "jan_code": jan, "image_size": 600, "results": limit},
            )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not connect to Yahoo! Shopping API.")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Yahoo! Shopping API request failed. Status={response.status_code}")

    candidates: list[ProductCandidate] = []
    for item in response.json().get("hits") or []:
        product_name = item.get("name")
        if not product_name:
            continue
        image = item.get("exImage") or item.get("image") or {}
        image_url = image.get("url") or image.get("medium") or image.get("small")
        candidates.append(ProductCandidate(boxName=product_name, imageUrl=image_url, sourceLabel="Yahoo!ショッピング"))

    if not candidates:
        raise HTTPException(status_code=404, detail="Yahoo! Shopping did not return JAN candidates.")
    return sorted(candidates, key=lambda candidate: product_quality_score(candidate.boxName, candidate.imageUrl), reverse=True)


async def search_product_candidates_for_jan(jan: str, provider: str = "auto", limit: int = 8) -> tuple[list[ProductCandidate], list[str]]:
    provider_order = ["yahoo", "rakuten"] if provider == "auto" else [provider]
    warnings: list[str] = []
    candidates: list[ProductCandidate] = []
    seen: set[str] = set()

    for current_provider in provider_order:
        try:
            if current_provider == "yahoo":
                provider_candidates = await search_yahoo_jan_candidates(jan, limit)
            elif current_provider == "rakuten":
                provider_candidates = await search_rakuten_candidates(jan, limit)
            else:
                warnings.append(f"Unsupported provider: {current_provider}")
                continue
        except HTTPException as exc:
            warnings.append(f"{current_provider}: {exc.detail}")
            continue

        for candidate in provider_candidates:
            if product_quality_score(candidate.boxName, candidate.imageUrl) < 0:
                warnings.append(f"{current_provider}: 中古・買取系の候補を除外しました: {candidate.boxName}")
                continue
            key = candidate.boxName.strip()
            if key and key not in seen:
                seen.add(key)
                candidates.append(candidate)
            if len(candidates) >= limit:
                return candidates, warnings

    return candidates, warnings


async def search_yahoo_candidates(query: str, limit: int = 3) -> list[ProductCandidate]:
    if not YAHOO_APP_ID:
        raise HTTPException(status_code=503, detail="YAHOO_APP_ID is not configured.")

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(
                YAHOO_ENDPOINT,
                params={"appid": YAHOO_APP_ID, "query": query, "image_size": 600, "results": limit},
            )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not connect to Yahoo! Shopping API.")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Yahoo! Shopping API request failed. Status={response.status_code}")

    candidates: list[ProductCandidate] = []
    for item in response.json().get("hits") or []:
        product_name = item.get("name")
        if not product_name:
            continue
        image = item.get("exImage") or item.get("image") or {}
        image_url = image.get("url") or image.get("medium") or image.get("small")
        candidates.append(ProductCandidate(boxName=product_name, imageUrl=image_url, sourceLabel="Yahoo!ショッピング"))
    return sorted(candidates, key=lambda candidate: product_quality_score(candidate.boxName, candidate.imageUrl), reverse=True)


async def search_rakuten_candidates(query: str, limit: int = 3) -> list[ProductCandidate]:
    if not RAKUTEN_APP_ID:
        raise HTTPException(status_code=503, detail="RAKUTEN_APP_ID is not configured.")
    if not RAKUTEN_ACCESS_KEY:
        raise HTTPException(status_code=503, detail="RAKUTEN_ACCESS_KEY is not configured.")
    if not is_valid_rakuten_keyword(query):
        raise HTTPException(status_code=400, detail="Rakuten keyword is too short.")

    params = {
        "applicationId": RAKUTEN_APP_ID,
        "accessKey": RAKUTEN_ACCESS_KEY,
        "keyword": query,
        "hits": limit,
        "format": "json",
        "formatVersion": 2,
    }

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(RAKUTEN_ENDPOINT, params=params)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not connect to Rakuten Item Search API.")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=rakuten_error_message(response))

    candidates: list[ProductCandidate] = []
    for wrapper in response.json().get("Items") or response.json().get("items") or []:
        item = rakuten_item_from_wrapper(wrapper)
        product_name = item.get("itemName")
        if not product_name:
            continue
        candidates.append(ProductCandidate(boxName=product_name, imageUrl=first_rakuten_image_url(item), sourceLabel="楽天市場"))
    return sorted(candidates, key=lambda candidate: product_quality_score(candidate.boxName, candidate.imageUrl), reverse=True)


async def search_product_candidates(query: str, provider: str = "auto", limit: int = 3) -> tuple[list[ProductCandidate], list[str]]:
    provider_order = ["yahoo", "rakuten"] if provider == "auto" else [provider]
    warnings: list[str] = []
    candidates: list[ProductCandidate] = []
    seen: set[str] = set()

    for current_provider in provider_order:
        try:
            if current_provider == "yahoo":
                provider_candidates = await search_yahoo_candidates(query, limit)
            elif current_provider == "rakuten":
                provider_candidates = await search_rakuten_candidates(query, limit)
            else:
                warnings.append(f"Unsupported provider: {current_provider}")
                continue
        except HTTPException as exc:
            if current_provider == "rakuten" and exc.status_code == 400 and "too short" in str(exc.detail):
                continue
            warnings.append(f"{current_provider}: {exc.detail}")
            continue

        for candidate in provider_candidates:
            if product_quality_score(candidate.boxName, candidate.imageUrl) < 0:
                warnings.append(f"{current_provider}: 中古・買取系の候補を除外しました: {candidate.boxName}")
                continue
            key = candidate.boxName.strip()
            if key and key not in seen:
                seen.add(key)
                candidates.append(candidate)
            if len(candidates) >= limit:
                return candidates, warnings

    return candidates, warnings


async def search_product(jan: str, provider: str) -> tuple[ProductCandidate, list[str]]:
    provider_order = ["yahoo", "rakuten"] if provider == "auto" else [provider]
    warnings: list[str] = []

    for current_provider in provider_order:
        try:
            if current_provider == "yahoo":
                return await search_yahoo_item(jan), warnings
            if current_provider == "rakuten":
                return await search_rakuten_item(jan), warnings
            warnings.append(f"未対応の検索プロバイダです: {current_provider}")
        except HTTPException as exc:
            warnings.append(f"{current_provider}: {exc.detail}")

    if warnings and all("未設定" in warning for warning in warnings):
        raise HTTPException(status_code=503, detail="YAHOO_APP_IDまたはRAKUTEN_APP_IDを設定してください。")

    raise HTTPException(
        status_code=404,
        detail="設定済みの商品検索APIでは商品が見つかりませんでした。手動登録に切り替えてください。",
    )


def parse_lineup_items(raw_items: Any) -> list[LineupItem]:
    if not isinstance(raw_items, list):
        return []

    lineup: list[LineupItem] = []
    seen: set[tuple[str, str]] = set()
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        character_name = str(item.get("characterName") or item.get("character_name") or "").strip()
        variant_name = str(item.get("variantName") or item.get("variant_name") or "通常版").strip() or "通常版"
        key = (character_name, variant_name)
        if character_name and key not in seen:
            seen.add(key)
            lineup.append(LineupItem(characterName=character_name, variantName=variant_name))
    return lineup


def parse_gemini_lineup(payload: dict[str, Any]) -> list[LineupItem]:
    parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    if not text:
        return []
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("[")
        end = text.rfind("]")
        if start < 0 or end < start:
            return []
        try:
            parsed = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return []
    return parse_lineup_items(parsed)


def image_url_from_custom_search_item(item: dict[str, Any]) -> str | None:
    pagemap = item.get("pagemap")
    if not isinstance(pagemap, dict):
        return None

    cse_images = pagemap.get("cse_image")
    if isinstance(cse_images, list):
        for image in cse_images:
            if isinstance(image, dict) and isinstance(image.get("src"), str):
                return image["src"]

    metatags = pagemap.get("metatags")
    if isinstance(metatags, list):
        for tag in metatags:
            if not isinstance(tag, dict):
                continue
            for key in ("og:image", "twitter:image", "image"):
                image_url = tag.get(key)
                if isinstance(image_url, str) and image_url:
                    return image_url

    return None


def image_url_from_brave_search_item(item: dict[str, Any]) -> str | None:
    thumbnail = item.get("thumbnail")
    if isinstance(thumbnail, dict):
        for key in ("src", "original"):
            image_url = thumbnail.get(key)
            if isinstance(image_url, str) and image_url:
                return image_url

    profile = item.get("profile")
    if isinstance(profile, dict):
        image_url = profile.get("img")
        if isinstance(image_url, str) and image_url:
            return image_url

    return None


async def search_google_results_for_jan(jan: str) -> list[dict[str, str | None]]:
    if not GOOGLE_SEARCH_API_KEY or not GOOGLE_SEARCH_ENGINE_ID:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID are required for web search fallback.",
        )

    params = {
        "key": GOOGLE_SEARCH_API_KEY,
        "cx": GOOGLE_SEARCH_ENGINE_ID,
        "q": f'"{jan}" JAN グッズ 商品',
        "num": 5,
        "lr": "lang_ja",
        "safe": "active",
    }

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(GOOGLE_CUSTOM_SEARCH_ENDPOINT, params=params)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not connect to Google Custom Search API.")

    if response.status_code != 200:
        try:
            payload = response.json()
            message = payload.get("error", {}).get("message")
        except ValueError:
            message = None

        if (
            response.status_code == 403
            and isinstance(message, str)
            and "does not have the access to Custom Search JSON API" in message
        ):
            raise HTTPException(
                status_code=503,
                detail="Google Custom Search JSON APIをこのプロジェクトで利用できません。手動登録に切り替えてください。",
            )

        detail = f"Google Custom Search API request failed. status={response.status_code}"
        if isinstance(message, str) and message:
            detail = f"{detail}: {message}"
        raise HTTPException(status_code=502, detail=detail)

    results: list[dict[str, str | None]] = []
    for item in response.json().get("items") or []:
        if not isinstance(item, dict):
            continue
        link = item.get("link")
        title = item.get("title")
        snippet = item.get("snippet")
        if not isinstance(link, str) or not isinstance(title, str):
            continue
        results.append(
            {
                "title": title,
                "snippet": snippet if isinstance(snippet, str) else "",
                "link": link,
                "imageUrl": image_url_from_custom_search_item(item),
            },
        )

    if not results:
        raise HTTPException(status_code=404, detail="Google Custom Search did not return product candidates.")
    return results


async def search_brave_results_for_jan(jan: str) -> list[dict[str, str | None]]:
    if not BRAVE_SEARCH_API_KEY:
        raise HTTPException(status_code=503, detail="BRAVE_SEARCH_API_KEY is required for Brave Search fallback.")

    params = {
        "q": f'"{jan}" JAN グッズ 商品',
        "count": 8,
        "country": "JP",
        "search_lang": "ja",
        "ui_lang": "ja-JP",
        "safesearch": "moderate",
        "spellcheck": 1,
    }
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_SEARCH_API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(BRAVE_SEARCH_ENDPOINT, params=params, headers=headers)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not connect to Brave Search API.")

    if response.status_code != 200:
        try:
            payload = response.json()
            message = payload.get("error", {}).get("detail") or payload.get("message")
        except ValueError:
            message = None
        detail = f"Brave Search API request failed. status={response.status_code}"
        if isinstance(message, str) and message:
            detail = f"{detail}: {message}"
        raise HTTPException(status_code=502, detail=detail)

    results: list[dict[str, str | None]] = []
    for item in response.json().get("web", {}).get("results") or []:
        if not isinstance(item, dict):
            continue
        link = item.get("url")
        title = item.get("title")
        snippet = item.get("description")
        if not isinstance(link, str) or not isinstance(title, str):
            continue
        results.append(
            {
                "title": title,
                "snippet": snippet if isinstance(snippet, str) else "",
                "link": link,
                "imageUrl": image_url_from_brave_search_item(item),
            },
        )

    if not results:
        raise HTTPException(status_code=404, detail="Brave Search did not return product candidates.")
    return results


async def search_web_results_for_jan(jan: str) -> tuple[list[dict[str, str | None]], str]:
    errors: list[str] = []

    provider = WEB_SEARCH_PROVIDER if WEB_SEARCH_PROVIDER in {"brave", "google", "auto"} else "brave"

    if provider in {"brave", "auto"} and BRAVE_SEARCH_API_KEY:
        try:
            return await search_brave_results_for_jan(jan), "Brave Search"
        except HTTPException as exc:
            errors.append(f"Brave: {exc.detail}")

    if provider in {"google", "auto"} and GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID:
        try:
            return await search_google_results_for_jan(jan), "Google Custom Search"
        except HTTPException as exc:
            errors.append(f"Google: {exc.detail}")

    detail = " / ".join(errors) if errors else "No web search provider is configured."
    raise HTTPException(status_code=503, detail=detail)


def parse_json_from_gemini(payload: dict[str, Any]) -> Any:
    parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = min([position for position in [text.find("{"), text.find("[")] if position >= 0], default=-1)
        end = max(text.rfind("}"), text.rfind("]"))
        if start < 0 or end < start:
            return None
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None


def parse_receipt_items(raw_items: Any) -> list[ReceiptExtractedItem]:
    if not isinstance(raw_items, list):
        return []

    items: list[ReceiptExtractedItem] = []
    seen: set[str] = set()
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        raw_text = str(item.get("rawText") or item.get("raw_text") or "").strip()
        normalized_query = str(item.get("normalizedQuery") or item.get("normalized_query") or raw_text).strip()
        if not normalized_query or normalized_query in seen:
            continue
        seen.add(normalized_query)
        try:
            confidence = float(item.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
        items.append(
            ReceiptExtractedItem(
                rawText=raw_text or normalized_query,
                normalizedQuery=normalized_query,
                confidence=max(0.0, min(1.0, confidence)),
            ),
        )
    return items[:8]


async def extract_receipt_items_with_gemini(image_base64: str, mime_type: str) -> tuple[list[ReceiptExtractedItem], list[str]]:
    if not GEMINI_API_KEY:
        return [], ["GEMINI_API_KEYが未設定のため、領収書解析を実行できません。"]

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    prompt = (
        "この画像はグッズ購入時の領収書またはレシートです。"
        "店舗名、日時、合計、税、支払い方法、単価だけの行は除外し、商品名らしい行だけを抽出してください。"
        "略称やカタカナ表記ゆれがある場合は、商品検索に使いやすい日本語の検索語へ正規化してください。"
        "推測しすぎず、不確かな候補はconfidenceを低めにしてください。"
        "返答はJSONのみです。"
    )
    schema = {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "rawText": {"type": "string"},
                        "normalizedQuery": {"type": "string"},
                        "confidence": {"type": "number"},
                    },
                    "required": ["rawText", "normalizedQuery", "confidence"],
                },
            },
        },
        "required": ["items"],
    }

    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(
                endpoint,
                headers={"x-goog-api-key": GEMINI_API_KEY},
                json={
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {"text": prompt},
                                {"inline_data": {"mime_type": mime_type, "data": image_base64}},
                            ],
                        },
                    ],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "responseSchema": schema,
                    },
                },
            )
    except httpx.RequestError:
        return [], ["Gemini APIへ接続できなかったため、領収書解析に失敗しました。"]

    if response.status_code != 200:
        return [], [gemini_error_message(response, "receipt parsing")]

    parsed = parse_json_from_gemini(response.json())
    items = parse_receipt_items(parsed.get("items") if isinstance(parsed, dict) else parsed)
    warnings = [] if items else ["領収書から商品名候補を抽出できませんでした。"]
    return items, warnings


async def infer_goods_from_photo_with_gemini(image_base64: str, mime_type: str) -> PhotoInferResponse:
    if not GEMINI_API_KEY:
        return PhotoInferResponse(warnings=["GEMINI_API_KEYが未設定のため、写真から推定できません。"])

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    prompt = (
        "この画像は推しグッズの商品写真、パッケージ写真、またはグッズ本体の写真です。"
        "商品を完全特定しようとせず、手動登録を補助するための情報だけを控えめに推定してください。"
        "読める文字や確実な視覚情報を優先し、分からない項目は空文字にしてください。"
        "boxNameは商品名が明確に読める場合だけ入れてください。分からない場合は空文字にしてください。"
        "seriesNameは作品名やシリーズ名が分かる場合だけ入れてください。"
        "characterNameはキャラクター名が分かる場合だけ入れてください。"
        "goodsTypeは缶バッジ、アクリルスタンド、キーホルダー、カード、ぬいぐるみ等の種別を入れてください。"
        "variantNameはホログラム、通常版、ミニキャラ等が分かる場合だけ入れてください。"
        "isRandomはトレーディング、ランダム、全種、ブラインド等のランダム商品らしさが分かる場合だけtrueにしてください。"
        "confidenceは全体の推定信頼度です。曖昧なら0.4以下にしてください。"
        "返答はJSONのみです。"
    )
    schema = {
        "type": "object",
        "properties": {
            "boxName": {"type": "string"},
            "seriesName": {"type": "string"},
            "characterName": {"type": "string"},
            "goodsType": {"type": "string"},
            "variantName": {"type": "string"},
            "isRandom": {"type": "boolean"},
            "confidence": {"type": "number"},
        },
        "required": ["boxName", "seriesName", "characterName", "goodsType", "variantName", "isRandom", "confidence"],
    }

    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(
                endpoint,
                headers={"x-goog-api-key": GEMINI_API_KEY},
                json={
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {"text": prompt},
                                {"inline_data": {"mime_type": mime_type, "data": image_base64}},
                            ],
                        },
                    ],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "responseSchema": schema,
                    },
                },
            )
    except httpx.RequestError:
        return PhotoInferResponse(warnings=["Gemini APIへ接続できなかったため、写真から推定できませんでした。"])

    if response.status_code != 200:
        return PhotoInferResponse(warnings=[gemini_error_message(response, "photo inference")])

    parsed = parse_json_from_gemini(response.json())
    if not isinstance(parsed, dict):
        return PhotoInferResponse(warnings=["写真から登録情報を推定できませんでした。"])

    try:
        confidence = float(parsed.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0

    result = PhotoInferResponse(
        boxName=str(parsed.get("boxName") or parsed.get("box_name") or "").strip(),
        seriesName=str(parsed.get("seriesName") or parsed.get("series_name") or "").strip(),
        characterName=str(parsed.get("characterName") or parsed.get("character_name") or "").strip(),
        goodsType=str(parsed.get("goodsType") or parsed.get("goods_type") or "").strip(),
        variantName=str(parsed.get("variantName") or parsed.get("variant_name") or "").strip(),
        isRandom=bool(parsed.get("isRandom") if "isRandom" in parsed else parsed.get("is_random", False)),
        confidence=max(0.0, min(1.0, confidence)),
    )
    if result.confidence < 0.45:
        result.warnings.append("写真だけでは特定が難しいため、未整理として登録して後から確認してください。")
    if not any([result.boxName, result.seriesName, result.characterName, result.goodsType]):
        result.warnings.append("登録に使える情報をほとんど推定できませんでした。")
    return result


def gemini_error_message(response: httpx.Response, task_label: str = "Gemini API") -> str:
    try:
        payload = response.json()
    except ValueError:
        return f"{task_label} failed. status={response.status_code}"
    message = payload.get("error", {}).get("message")
    if response.status_code == 429:
        return f"{task_label} failed because Gemini API quota was exceeded. Check Google AI Studio usage, rate limits, and billing settings."
    if isinstance(message, str) and message:
        return f"{task_label} failed. status={response.status_code}: {message}"
    return f"{task_label} failed. status={response.status_code}"


async def analyze_lineup_with_gemini(product_name: str) -> AnalyzeLineupResponse:
    if not GEMINI_API_KEY:
        return AnalyzeLineupResponse(warnings=["GEMINI_API_KEYが未設定のため、ラインナップ解析はスキップしました。"])

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    prompt = (
        "商品名からトレーディンググッズの中身候補を推定してください。"
        "実在確認できない候補を水増しせず、不明なら空配列を返してください。"
        "キャラクター名と仕様名だけを抽出してください。"
        "返答はJSON配列のみです。"
    )
    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "characterName": {"type": "string"},
                "variantName": {"type": "string"},
            },
            "required": ["characterName", "variantName"],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                endpoint,
                headers={"x-goog-api-key": GEMINI_API_KEY},
                json={
                    "contents": [{"role": "user", "parts": [{"text": f"{prompt}\n\n商品名: {product_name}"}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "responseSchema": schema,
                    },
                },
            )
    except httpx.RequestError:
        return AnalyzeLineupResponse(warnings=["Gemini APIへ接続できなかったため、ラインナップ解析はスキップしました。"])

    if response.status_code != 200:
        return AnalyzeLineupResponse(warnings=[gemini_error_message(response, "lineup analysis")])

    lineup = parse_gemini_lineup(response.json())
    warnings = [] if lineup else ["Geminiから有効なラインナップ候補を取得できませんでした。"]
    return AnalyzeLineupResponse(lineup=lineup, warnings=warnings)


async def lookup_product_with_web_search(jan: str) -> LookupResponse:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured.")

    search_results, search_provider_label = await search_web_results_for_jan(jan)
    search_context = json.dumps(search_results, ensure_ascii=False)
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    prompt = (
        "You help identify Japanese character goods for a collection app. "
        f"You are given {search_provider_label} results for a JAN code. "
        "Return exactly one most likely product as JSON using only the provided search results. "
        "Prioritize official stores, manufacturer pages, product pages, and results that explicitly mention the JAN code. "
        "If only similar product names are found, lower confidence. "
        "Treat used, buyback, opened, junk, outlet, and damaged-item listings as weak evidence. "
        "If the product appears to be random, trading, blind-box, or blind-pack goods, extract the confirmed lineup when possible. "
        "Only include imageUrl when a usable product image URL is found. "
        "Leave unknown fields empty and do not invent facts. "
        "Return only a JSON object with no explanation."
        "\n\nJSON schema:"
        "{"
        '"boxName":"product name",'
        '"seriesName":"series or franchise name",'
        '"goodsType":"badge/acrylic stand/keychain/etc",'
        '"imageUrl":"product image URL or empty string",'
        '"confidence":0.0,'
        '"sourceUrls":["source URL"],'
        '"lineup":[{"characterName":"character name","variantName":"variant name"}],'
        '"warnings":["notes"]'
        "}"
        f"\n\nJAN code: {jan}"
        f"\n\n{search_provider_label} results JSON:\n{search_context}"
    )

    request_body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "object",
                "properties": {
                    "boxName": {"type": "string"},
                    "seriesName": {"type": "string"},
                    "goodsType": {"type": "string"},
                    "imageUrl": {"type": "string"},
                    "confidence": {"type": "number"},
                    "sourceUrls": {"type": "array", "items": {"type": "string"}},
                    "lineup": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "characterName": {"type": "string"},
                                "variantName": {"type": "string"},
                            },
                            "required": ["characterName", "variantName"],
                        },
                    },
                    "warnings": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["boxName", "confidence", "sourceUrls", "lineup", "warnings"],
            },
        },
    }

    try:
        async with httpx.AsyncClient(timeout=55) as client:
            response = await client.post(endpoint, headers={"x-goog-api-key": GEMINI_API_KEY}, json=request_body)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not connect to Gemini product candidate formatter.")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=gemini_error_message(response, "web search result formatting"))

    payload = response.json()
    parsed = parse_json_from_gemini(payload)
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=404, detail="AI Web search could not structure a product candidate.")

    box_name = str(parsed.get("boxName") or parsed.get("box_name") or "").strip()
    image_url = str(parsed.get("imageUrl") or parsed.get("image_url") or "").strip() or None
    if not image_url:
        image_url = next((result["imageUrl"] for result in search_results if result.get("imageUrl")), None)
    try:
        confidence = float(parsed.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    parsed_urls = parsed.get("sourceUrls") or parsed.get("source_urls") or []
    source_urls = [str(url).strip() for url in parsed_urls if isinstance(url, str) and str(url).strip()] if isinstance(parsed_urls, list) else []
    for result in search_results:
        link = result.get("link")
        if isinstance(link, str) and link not in source_urls:
            source_urls.append(link)

    parsed_warnings = parsed.get("warnings")
    warnings = [str(warning).strip() for warning in parsed_warnings if isinstance(warning, str) and warning.strip()] if isinstance(parsed_warnings, list) else []
    if confidence < 0.6:
        warnings.append("Web search fallback confidence is low. Please confirm the product name and image before registering.")
    if source_urls:
        warnings.append(f"Web search source: {source_urls[0]}")

    if not box_name:
        raise HTTPException(status_code=404, detail="Web search fallback could not identify a product name.")

    cached_candidates = await store_lookup_candidates(
        jan,
        [ProductCandidate(boxName=box_name, imageUrl=image_url, sourceLabel=f"{search_provider_label} + Gemini")],
        confidence=confidence,
        source_urls=source_urls[:1],
    )

    return LookupResponse(
        janCode=jan,
        boxName=box_name,
        imageUrl=image_url,
        sourceLabel=f"{search_provider_label} + Gemini",
        lineup=parse_lineup_items(parsed.get("lineup")),
        warnings=warnings,
        confidence=confidence,
        sourceUrls=source_urls[:5],
        selectedCandidateId=cached_candidates[0].id if cached_candidates else None,
        candidates=cached_candidates,
    )

@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "yahooConfigured": bool(YAHOO_APP_ID),
        "rakutenConfigured": bool(RAKUTEN_APP_ID),
        "rakutenAccessKeyConfigured": bool(RAKUTEN_ACCESS_KEY),
        "geminiConfigured": bool(GEMINI_API_KEY),
        "geminiModel": GEMINI_MODEL,
        "webSearchProvider": WEB_SEARCH_PROVIDER if WEB_SEARCH_PROVIDER in {"brave", "google", "auto"} else "brave",
        "googleSearchConfigured": bool(GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID),
        "braveSearchConfigured": bool(BRAVE_SEARCH_API_KEY),
        "supabaseCandidateCacheConfigured": supabase_configured(),
        "candidateCacheTable": SUPABASE_LOOKUP_TABLE if supabase_configured() else str(LOOKUP_CACHE_PATH),
    }


@app.get("/lookup", response_model=LookupResponse)
async def lookup(
    jan: str = Query(..., min_length=8, max_length=14),
    analyze: bool = Query(default=True),
    provider: str = Query(default="auto", pattern="^(auto|yahoo|rakuten)$"),
) -> LookupResponse:
    normalized_jan = validate_jan(jan)

    cached_candidates = await cached_candidates_for_jan(normalized_jan)
    if cached_candidates:
        selected = cached_candidates[0]
        ai_result = await analyze_lineup_with_gemini(selected.boxName) if analyze else AnalyzeLineupResponse()
        return LookupResponse(
            janCode=normalized_jan,
            boxName=selected.boxName,
            imageUrl=selected.imageUrl,
            sourceLabel=f"{selected.sourceLabel} / キャッシュ",
            lineup=ai_result.lineup,
            warnings=["過去の候補キャッシュから表示しています。", *ai_result.warnings],
            confidence=selected.confidence,
            sourceUrls=[selected.sourceUrl] if selected.sourceUrl else [],
            selectedCandidateId=selected.id,
            candidates=cached_candidates,
        )

    try:
        candidates, search_warnings = await search_product_candidates_for_jan(normalized_jan, provider=provider, limit=8)
        if not candidates:
            raise HTTPException(status_code=404, detail="商品APIで候補が見つかりませんでした。")
    except HTTPException as search_error:
        try:
            fallback_result = await lookup_product_with_web_search(normalized_jan)
        except HTTPException as fallback_error:
            fallback_detail = str(fallback_error.detail)
            if "手動登録に切り替えてください" in fallback_detail:
                raise HTTPException(status_code=fallback_error.status_code, detail=fallback_detail)
            raise HTTPException(
                status_code=fallback_error.status_code,
                detail=f"商品APIとWeb検索のどちらでも商品情報を取得できませんでした。手動登録に切り替えてください。詳細: {fallback_error.detail}",
            )
        fallback_result.warnings = [f"Product APIs did not return a usable result: {search_error.detail}", *fallback_result.warnings]
        return fallback_result

    cached_candidates = await store_lookup_candidates(normalized_jan, candidates)
    product = cached_candidates[0] if cached_candidates else candidates[0]
    ai_result = await analyze_lineup_with_gemini(product.boxName) if analyze else AnalyzeLineupResponse()

    return LookupResponse(
        janCode=normalized_jan,
        boxName=product.boxName,
        imageUrl=product.imageUrl,
        sourceLabel=product.sourceLabel,
        lineup=ai_result.lineup,
        warnings=[*search_warnings, *ai_result.warnings],
        confidence=None,
        sourceUrls=[],
        selectedCandidateId=product.id if isinstance(product, LookupCandidate) else None,
        candidates=cached_candidates,
    )


@app.post("/lookup/{jan}/feedback", response_model=list[LookupCandidate])
async def lookup_candidate_feedback(jan: str, request: CandidateFeedbackRequest) -> list[LookupCandidate]:
    normalized_jan = validate_jan(jan)
    return await apply_candidate_feedback(normalized_jan, request.candidateId, request.action)


@app.get("/search", response_model=list[ProductCandidate])
async def search(
    q: str = Query(..., min_length=1, max_length=120),
    provider: str = Query(default="auto", pattern="^(auto|yahoo|rakuten)$"),
    limit: int = Query(default=5, ge=1, le=10),
) -> list[ProductCandidate]:
    candidates, warnings = await search_product_candidates(q.strip(), provider=provider, limit=limit)
    if not candidates:
        detail = "商品名検索で候補が見つかりませんでした。"
        if warnings:
            detail = f"{detail} {' / '.join(warnings)}"
        raise HTTPException(status_code=404, detail=detail)
    return candidates


@app.post("/receipt/parse", response_model=ReceiptParseResponse)
async def parse_receipt(request: ReceiptParseRequest) -> ReceiptParseResponse:
    extracted_items, warnings = await extract_receipt_items_with_gemini(request.imageBase64, request.mimeType)
    response_items: list[ReceiptItemCandidate] = []

    for item in extracted_items:
        candidates, search_warnings = await search_product_candidates(item.normalizedQuery, provider="auto", limit=3)
        warnings.extend(search_warnings)
        response_items.append(
            ReceiptItemCandidate(
                rawText=item.rawText,
                normalizedQuery=item.normalizedQuery,
                confidence=item.confidence,
                candidates=candidates,
            ),
        )

    return ReceiptParseResponse(items=response_items, warnings=warnings)


@app.post("/photo/infer", response_model=PhotoInferResponse)
async def infer_photo(request: ReceiptParseRequest) -> PhotoInferResponse:
    return await infer_goods_from_photo_with_gemini(request.imageBase64, request.mimeType)


@app.post("/analyze-lineup", response_model=AnalyzeLineupResponse)
async def analyze_lineup(request: AnalyzeLineupRequest) -> AnalyzeLineupResponse:
    return await analyze_lineup_with_gemini(request.productName)
