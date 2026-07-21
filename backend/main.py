import os
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

RAKUTEN_APP_ID = os.getenv("RAKUTEN_APP_ID")
RAKUTEN_ENDPOINT = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706"

app = FastAPI(title="OshiList Product Lookup")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/lookup")
async def lookup(jan: str = Query(..., min_length=8, max_length=14)) -> dict[str, Any]:
    if not jan.isdigit():
        raise HTTPException(status_code=400, detail="JAN must be numeric.")

    if not RAKUTEN_APP_ID:
      raise HTTPException(status_code=503, detail="RAKUTEN_APP_ID is not configured.")

    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.get(
            RAKUTEN_ENDPOINT,
            params={
                "applicationId": RAKUTEN_APP_ID,
                "keyword": jan,
                "hits": 1,
                "format": "json",
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Product API request failed.")

    payload = response.json()
    items = payload.get("Items") or []
    if not items:
        raise HTTPException(status_code=404, detail="Product was not found.")

    item = items[0].get("Item", {})
    image_urls = item.get("mediumImageUrls") or item.get("smallImageUrls") or []
    image_url = image_urls[0].get("imageUrl") if image_urls else None

    return {
        "janCode": jan,
        "boxName": item.get("itemName") or f"JAN {jan}",
        "imageUrl": image_url,
        "sourceLabel": "楽天商品検索",
        "lineup": [],
    }
