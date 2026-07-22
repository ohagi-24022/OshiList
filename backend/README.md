# OshiList Backend

JANコードから商品名・画像URLを取得し、任意でAIによるラインナップ候補を返すFastAPIサーバーです。
商品検索はYahoo!ショッピングを優先し、見つからない場合に楽天商品検索へフォールバックします。

## セットアップ

```powershell
cd backend
python -m pip install -r requirements.txt
```

プロジェクトルートに `.env` を作成します。

```env
EXPO_PUBLIC_OSHILIST_LOOKUP_API_URL=http://localhost:8000/lookup
YAHOO_APP_ID=your_yahoo_client_id
RAKUTEN_APP_ID=your_rakuten_application_id
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=your_openai_model
ALLOWED_ORIGINS=*
```

`YAHOO_APP_ID` と `RAKUTEN_APP_ID` は少なくともどちらか一方を設定してください。
`OPENAI_API_KEY` と `OPENAI_MODEL` は任意です。未設定の場合、商品名と画像だけを返し、ラインナップ解析はスキップします。

## 起動

```powershell
cd backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## デプロイ先

OshiListではRenderへのデプロイを推奨します。
RenderはFree Web ServiceでPython/FastAPIを動かせ、環境変数もダッシュボードから設定できます。

Renderで新規Web Serviceを作成するときは、以下を指定してください。

```text
Name:
oshilist-api

Root Directory:
backend

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
GEMINI_MODEL=gemini-2.5-flash
ALLOWED_ORIGINS=*
```

デプロイ後のURLが `https://oshilist-api.onrender.com` になった場合、楽天Web Serviceのフォームには以下のように入力します。

```text
アプリケーションURL:
https://oshilist-api.onrender.com/

許可されたWebサイト:
oshilist-api.onrender.com
```

別のURLが発行された場合は、そのドメイン部分を `許可されたWebサイト` に入力してください。

Vercel向けの `backend/vercel.json` も残していますが、環境変数設定が使いづらい場合はRenderを使ってください。

## API

### `GET /health`

設定状況を確認します。

### `GET /lookup?jan=4900000000000`

Yahoo!ショッピングAPI、楽天商品検索APIの順に商品名と画像URLを取得し、AI設定があればラインナップ候補も返します。

検索元を固定したい場合は `provider` を指定できます。

```text
GET /lookup?jan=4900000000000&provider=yahoo
GET /lookup?jan=4900000000000&provider=rakuten
GET /lookup?jan=4900000000000&provider=auto
```

### `POST /analyze-lineup`

商品名だけを渡してラインナップ候補を解析します。

```json
{
  "productName": "スーパーかぐや姫！ トレーディング缶バッジ"
}
```
