# OshiList Backend

JANコードから商品名・画像URLを取得し、任意でGeminiによるラインナップ候補を返すFastAPIサーバーです。
商品検索はYahoo!ショッピングを優先し、見つからない場合に楽天商品検索へフォールバックします。

## セットアップ

```powershell
cd backend
python -m pip install -r requirements.txt
```

## Web Search Fallback

When Yahoo/Rakuten product APIs do not return a usable JAN result, `/lookup` uses Google Custom Search API first, then asks Gemini to format those search results with normal text generation. It does not use Gemini `google_search` grounding, so it avoids the separate Search Grounding quota.

Required environment variables:

```text
GOOGLE_SEARCH_API_KEY=your_google_custom_search_api_key
GOOGLE_SEARCH_ENGINE_ID=your_programmable_search_engine_id
BRAVE_SEARCH_API_KEY=your_brave_search_api_key
```

If these values are missing, the fallback returns `503` and the app can continue to manual registration.

If Google returns `This project does not have the access to Custom Search JSON API`, the current Google Cloud project cannot use the JSON API. In that case, the app falls back to manual registration instead of showing the raw Google error.

## Candidate Cache

`/lookup` stores all product candidates by JAN code and returns them sorted by feedback score. User selections increase `selectedCount`; "not this" feedback increases `rejectedCount` and lowers the candidate score.

Production should use Supabase:

```text
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_LOOKUP_TABLE=product_lookup_candidates
```

Create the cache table in Supabase:

```sql
create table if not exists product_lookup_candidates (
  id uuid primary key default gen_random_uuid(),
  jan_code text not null,
  box_name text not null,
  image_url text,
  source_label text not null,
  source_url text,
  confidence numeric,
  selected_count integer not null default 0,
  rejected_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_selected_at timestamptz
);

create index if not exists product_lookup_candidates_jan_idx
on product_lookup_candidates (jan_code);

create unique index if not exists product_lookup_candidates_unique_idx
on product_lookup_candidates (
  jan_code,
  lower(box_name),
  lower(source_label),
  coalesce(source_url, '')
);
```

The backend uses the service role key server-side only. Do not expose it to the Expo app.

For local development without Supabase, the JSON fallback can be used:

```text
LOOKUP_CACHE_PATH=data/lookup_candidates.json
```

On Render, the local JSON cache can be reset on redeploy. Use Supabase before production launch.

プロジェクトルートに `.env` を作成します。

```env
EXPO_PUBLIC_OSHILIST_LOOKUP_API_URL=http://localhost:8000/lookup
YAHOO_APP_ID=your_yahoo_client_id
RAKUTEN_APP_ID=your_rakuten_application_id
RAKUTEN_ACCESS_KEY=your_rakuten_access_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
GOOGLE_SEARCH_API_KEY=your_google_custom_search_api_key
GOOGLE_SEARCH_ENGINE_ID=your_programmable_search_engine_id
BRAVE_SEARCH_API_KEY=your_brave_search_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_LOOKUP_TABLE=product_lookup_candidates
LOOKUP_CACHE_PATH=data/lookup_candidates.json
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
GOOGLE_SEARCH_API_KEY=your_google_custom_search_api_key
GOOGLE_SEARCH_ENGINE_ID=your_programmable_search_engine_id
BRAVE_SEARCH_API_KEY=your_brave_search_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_LOOKUP_TABLE=product_lookup_candidates
LOOKUP_CACHE_PATH=data/lookup_candidates.json
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

When product APIs cannot identify a JAN code, `/lookup` now calls Google Custom Search first and then asks Gemini to format those search results. Configure `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID`, and `GEMINI_API_KEY` on Render to enable this fallback. This path does not use Gemini Google Search grounding.

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
