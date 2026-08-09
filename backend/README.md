# OshiList Backend

JANコードから商品名・画像URLを取得し、任意でGeminiによるラインナップ候補を返すFastAPIサーバーです。
商品検索はYahoo!ショッピングを優先し、見つからない場合に楽天商品検索へフォールバックします。

## セットアップ

```powershell
cd backend
python -m pip install -r requirements.txt
```

## Web Search Fallback

When Yahoo/Rakuten product APIs do not return a usable JAN result, `/lookup` uses Brave Search API first, then asks Gemini to format those search results with normal text generation. It does not use Gemini `google_search` grounding, so it avoids the separate Search Grounding quota.

Required environment variables:

```text
BRAVE_SEARCH_API_KEY=your_brave_search_api_key
```

If these values are missing, the fallback returns `503` and the app can continue to manual registration.

プロジェクトルートに `.env` を作成します。

```env
EXPO_PUBLIC_OSHILIST_LOOKUP_API_URL=http://localhost:8000/lookup
YAHOO_APP_ID=your_yahoo_client_id
RAKUTEN_APP_ID=your_rakuten_application_id
RAKUTEN_ACCESS_KEY=your_rakuten_access_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
BRAVE_SEARCH_API_KEY=your_brave_search_api_key
ALLOWED_ORIGINS=*
```

`YAHOO_APP_ID` と `RAKUTEN_APP_ID` は少なくともどちらか一方を設定してください。
`GEMINI_API_KEY` は任意です。未設定の場合、商品名と画像だけを返し、ラインナップ解析はスキップします。

## 起動

```powershell
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Renderデプロイ

Renderでは `Web Service` を選びます。

```text
Name:
oshilist-api

Root Directory:
backend

Python Version:
3.12.8

Build Command:
pip install -r requirements.txt

Start Command:
python -m uvicorn main:app --host 0.0.0.0 --port $PORT

Health Check Path:
/health
```

環境変数はRenderの `Environment` から設定します。

```text
YAHOO_APP_ID=your_yahoo_client_id
RAKUTEN_APP_ID=your_rakuten_application_id
RAKUTEN_ACCESS_KEY=your_rakuten_access_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
BRAVE_SEARCH_API_KEY=your_brave_search_api_key
ALLOWED_ORIGINS=*
PYTHON_VERSION=3.12.8
```

デプロイ後のURLが `https://oshilist-api.onrender.com` になった場合、楽天Web Serviceのフォームには以下のように入力します。

```text
アプリケーションURL:
https://oshilist-api.onrender.com/

許可されたWebサイト:
oshilist-api.onrender.com
```

## API

### `GET /`

楽天/Yahoo申請に使えるOshiList紹介ページを返します。

### `GET /privacy`

申請に使える簡易プライバシーポリシーを返します。

### `GET /health`

設定状況を確認します。

### `GET /lookup?jan=4900000000000`

Yahoo!ショッピングAPI、楽天商品検索APIの順に商品名と画像URLを取得し、Gemini設定があればラインナップ候補も返します。

When product APIs cannot identify a JAN code, `/lookup` now calls Brave Search first and then asks Gemini to format those search results. Configure `BRAVE_SEARCH_API_KEY` and `GEMINI_API_KEY` on Render to enable this fallback. This path does not use Gemini Google Search grounding.

検索元を固定したい場合は `provider` を指定できます。

```text
GET /lookup?jan=4900000000000&provider=yahoo
GET /lookup?jan=4900000000000&provider=rakuten
GET /lookup?jan=4900000000000&provider=auto
```

AI解析をスキップしたい場合は `analyze=false` を指定します。

```text
GET /lookup?jan=4900000000000&analyze=false
```

### `POST /analyze-lineup`

商品名だけを渡してラインナップ候補を解析します。

```json
{
  "productName": "スーパーかぐや姫！ トレーディング缶バッジ"
}
```
