import html
import json
import os
import re
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
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")]

YAHOO_ENDPOINT = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch"
RAKUTEN_ENDPOINT = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701"


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


class AnalyzeLineupRequest(BaseModel):
    productName: str = Field(..., min_length=1)


class AnalyzeLineupResponse(BaseModel):
    lineup: list[LineupItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ProductCandidate(BaseModel):
    boxName: str
    imageUrl: str | None = None
    sourceLabel: str


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


def extract_grounding_source_urls(payload: dict[str, Any]) -> list[str]:
    metadata = payload.get("candidates", [{}])[0].get("groundingMetadata", {})
    chunks = metadata.get("groundingChunks") or []
    urls: list[str] = []
    seen: set[str] = set()

    for chunk in chunks:
        if not isinstance(chunk, dict):
            continue
        web_chunk = chunk.get("web")
        if not isinstance(web_chunk, dict):
            continue
        uri = web_chunk.get("uri")
        if isinstance(uri, str) and uri and uri not in seen:
            seen.add(uri)
            urls.append(uri)

    return urls


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
        return [], [gemini_error_message(response)]

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
        return PhotoInferResponse(warnings=[gemini_error_message(response)])

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


def gemini_error_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return f"Gemini APIでラインナップ解析に失敗しました。status={response.status_code}"
    message = payload.get("error", {}).get("message")
    if isinstance(message, str) and message:
        return f"Gemini APIでラインナップ解析に失敗しました。status={response.status_code}: {message}"
    return f"Gemini APIでラインナップ解析に失敗しました。status={response.status_code}"


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
        return AnalyzeLineupResponse(warnings=[gemini_error_message(response)])

    lineup = parse_gemini_lineup(response.json())
    warnings = [] if lineup else ["Geminiから有効なラインナップ候補を取得できませんでした。"]
    return AnalyzeLineupResponse(lineup=lineup, warnings=warnings)


async def lookup_product_with_gemini_search(jan: str) -> LookupResponse:
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured.")

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    prompt = (
        "あなたは日本の推しグッズ管理アプリの商品検索補助です。"
        "次のJANコードをWeb検索し、公式ストア、メーカーの商品ページ、通販ページ、商品紹介ページなどの情報から、"
        "最も可能性が高い商品を1件だけJSONで返してください。"
        "JANコードがページ内に明記されている情報を最優先し、商品名だけが似ている候補はconfidenceを低くしてください。"
        "ランダム/トレーディング/ブラインド商品らしい場合は、確認できる範囲でラインナップも抽出してください。"
        "画像URLは商品画像として使えそうなURLが見つかった場合だけ入れてください。"
        "不明な項目は空文字または空配列にしてください。推測で埋めないでください。"
        "返答は説明文なしのJSONオブジェクトのみです。"
        "\n\nJSON schema:"
        "{"
        '"boxName":"商品名",'
        '"seriesName":"作品名またはシリーズ名",'
        '"goodsType":"缶バッジ/アクリルスタンド等",'
        '"imageUrl":"商品画像URLまたは空文字",'
        '"confidence":0.0,'
        '"sourceUrls":["根拠URL"],'
        '"lineup":[{"characterName":"キャラクター名","variantName":"仕様名"}],'
        '"warnings":["注意点"]'
        "}"
        f"\n\nJANコード: {jan}"
    )

    try:
        async with httpx.AsyncClient(timeout=35) as client:
            request_body = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "tools": [{"google_search": {}}],
                "generationConfig": {"temperature": 0.2},
            }
            response = await client.post(
                endpoint,
                headers={"x-goog-api-key": GEMINI_API_KEY},
                json=request_body,
            )
            if response.status_code == 400:
                request_body["tools"] = [{"googleSearch": {}}]
                response = await client.post(
                    endpoint,
                    headers={"x-goog-api-key": GEMINI_API_KEY},
                    json=request_body,
                )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Gemini Web検索へ接続できませんでした。")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=gemini_error_message(response))

    payload = response.json()
    parsed = parse_json_from_gemini(payload)
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=404, detail="AI Web検索で商品候補を構造化できませんでした。")

    box_name = str(parsed.get("boxName") or parsed.get("box_name") or "").strip()
    image_url = str(parsed.get("imageUrl") or parsed.get("image_url") or "").strip() or None
    try:
        confidence = float(parsed.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))

    parsed_urls = parsed.get("sourceUrls") or parsed.get("source_urls") or []
    source_urls = [str(url).strip() for url in parsed_urls if isinstance(url, str) and str(url).strip()] if isinstance(parsed_urls, list) else []
    for url in extract_grounding_source_urls(payload):
        if url not in source_urls:
            source_urls.append(url)

    parsed_warnings = parsed.get("warnings")
    warnings = [str(warning).strip() for warning in parsed_warnings if isinstance(warning, str) and warning.strip()] if isinstance(parsed_warnings, list) else []
    if confidence < 0.6:
        warnings.append("AI Web検索の信頼度が低いため、登録前に商品名と画像を確認してください。")
    if source_urls:
        warnings.append(f"AI Web検索の参照元: {source_urls[0]}")

    if not box_name:
        raise HTTPException(status_code=404, detail="AI Web検索でも商品名を特定できませんでした。")

    return LookupResponse(
        janCode=jan,
        boxName=box_name,
        imageUrl=image_url,
        sourceLabel="AI Web検索候補",
        lineup=parse_lineup_items(parsed.get("lineup")),
        warnings=warnings,
        confidence=confidence,
        sourceUrls=source_urls[:5],
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
    }


@app.get("/lookup", response_model=LookupResponse)
async def lookup(
    jan: str = Query(..., min_length=8, max_length=14),
    analyze: bool = Query(default=True),
    provider: str = Query(default="auto", pattern="^(auto|yahoo|rakuten)$"),
) -> LookupResponse:
    normalized_jan = validate_jan(jan)
    try:
        product, search_warnings = await search_product(normalized_jan, provider)
    except HTTPException as search_error:
        try:
            fallback_result = await lookup_product_with_gemini_search(normalized_jan)
        except HTTPException:
            raise search_error
        fallback_result.warnings = [f"商品APIでは見つかりませんでした: {search_error.detail}", *fallback_result.warnings]
        return fallback_result

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
    )


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
