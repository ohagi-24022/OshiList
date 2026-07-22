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
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")]

YAHOO_ENDPOINT = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch"
RAKUTEN_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706"

app = FastAPI(title="OshiList Product Lookup", version="0.3.0")

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


class AnalyzeLineupRequest(BaseModel):
    productName: str = Field(..., min_length=1)


class AnalyzeLineupResponse(BaseModel):
    lineup: list[LineupItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ProductCandidate(BaseModel):
    boxName: str
    imageUrl: str | None = None
    sourceLabel: str


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


async def search_yahoo_item(jan: str) -> ProductCandidate:
    if not YAHOO_APP_ID:
        raise HTTPException(status_code=503, detail="YAHOO_APP_IDが未設定です。")

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(
                YAHOO_ENDPOINT,
                params={"appid": YAHOO_APP_ID, "jan_code": jan, "image_size": 600, "results": 1},
            )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Yahoo!ショッピングAPIへ接続できませんでした。")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Yahoo!ショッピングAPIへのリクエストに失敗しました。")

    hits = response.json().get("hits") or []
    if not hits:
        raise HTTPException(status_code=404, detail="Yahoo!ショッピングで商品が見つかりませんでした。")

    item = hits[0]
    product_name = item.get("name")
    if not product_name:
        raise HTTPException(status_code=404, detail="Yahoo!ショッピングで商品名を取得できませんでした。")

    image = item.get("exImage") or item.get("image") or {}
    image_url = image.get("url") or image.get("medium") or image.get("small")
    return ProductCandidate(boxName=product_name, imageUrl=image_url, sourceLabel="Yahoo!ショッピング")


async def search_rakuten_item(jan: str) -> ProductCandidate:
    if not RAKUTEN_APP_ID:
        raise HTTPException(status_code=503, detail="RAKUTEN_APP_IDが未設定です。")

    params = {"applicationId": RAKUTEN_APP_ID, "keyword": jan, "hits": 1, "format": "json"}
    if RAKUTEN_ACCESS_KEY:
        params["accessKey"] = RAKUTEN_ACCESS_KEY

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(RAKUTEN_ENDPOINT, params=params)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="楽天商品検索APIへ接続できませんでした。")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="楽天商品検索APIへのリクエストに失敗しました。")

    items = response.json().get("Items") or []
    if not items:
        raise HTTPException(status_code=404, detail="楽天市場で商品が見つかりませんでした。")

    item = items[0].get("Item", {})
    product_name = item.get("itemName")
    if not product_name:
        raise HTTPException(status_code=404, detail="楽天市場で商品名を取得できませんでした。")

    return ProductCandidate(boxName=product_name, imageUrl=first_rakuten_image_url(item), sourceLabel="楽天商品検索")


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


async def analyze_lineup_with_gemini(product_name: str) -> AnalyzeLineupResponse:
    if not GEMINI_API_KEY:
        return AnalyzeLineupResponse(warnings=["GEMINI_API_KEYが未設定のため、ラインナップ解析はスキップしました。"])

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
    prompt = (
        "商品名からトレーディンググッズの中身候補を推定してください。"
        "実在確認できない候補を水増しせず、不明なら空配列を返してください。"
        "キャラクター名と仕様名だけを抽出してください。"
    )
    schema = {
        "type": "ARRAY",
        "items": {
            "type": "OBJECT",
            "properties": {
                "characterName": {"type": "STRING"},
                "variantName": {"type": "STRING"},
            },
            "required": ["characterName", "variantName"],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                endpoint,
                params={"key": GEMINI_API_KEY},
                json={
                    "contents": [{"role": "user", "parts": [{"text": f"{prompt}\n\n商品名: {product_name}"}]}],
                    "generationConfig": {
                        "temperature": 0.1,
                        "responseMimeType": "application/json",
                        "responseSchema": schema,
                    },
                },
            )
    except httpx.RequestError:
        return AnalyzeLineupResponse(warnings=["Gemini APIへ接続できなかったため、ラインナップ解析はスキップしました。"])

    if response.status_code != 200:
        return AnalyzeLineupResponse(warnings=["Gemini APIでラインナップ解析に失敗しました。"])

    lineup = parse_gemini_lineup(response.json())
    warnings = [] if lineup else ["Geminiから有効なラインナップ候補を取得できませんでした。"]
    return AnalyzeLineupResponse(lineup=lineup, warnings=warnings)


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
    product, search_warnings = await search_product(normalized_jan, provider)
    ai_result = await analyze_lineup_with_gemini(product.boxName) if analyze else AnalyzeLineupResponse()

    return LookupResponse(
        janCode=normalized_jan,
        boxName=product.boxName,
        imageUrl=product.imageUrl,
        sourceLabel=product.sourceLabel,
        lineup=ai_result.lineup,
        warnings=[*search_warnings, *ai_result.warnings],
    )


@app.post("/analyze-lineup", response_model=AnalyzeLineupResponse)
async def analyze_lineup(request: AnalyzeLineupRequest) -> AnalyzeLineupResponse:
    return await analyze_lineup_with_gemini(request.productName)
