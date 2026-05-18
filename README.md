# Poker GTO Trainer

NLH キャッシュ 6max 100bb のプリフロップレンジを学習するためのブラウザアプリ。完全静的・localStorage完結・GitHub Pages公開対応。

## 機能（MVP）

- ドリル: ランダムなハンドとスポットを出題、即フィードバック
- レンジ参照: スポット別の13×13レンジ可視化
- ミックス戦略採点: 頻度 ≥ 5% のアクションは正解扱い
- 進捗の永続化: localStorage（SRSは後続）

## 開発環境（Docker）

ポートは社内ルールにより **53004**（Vite dev）/ **53005**（preview）。

```sh
docker compose up
# → http://localhost:53004
```

初回起動時にコンテナ内で `npm install` が走る。

## 直接実行

```sh
npm install
npm run dev   # http://localhost:5173
npm run build
npm run preview
```

## ディレクトリ

```
src/
├── domain/        ドメイン型（Hand/Position/Spot/Range）
├── data/          レンジJSONローダ
├── components/    HandMatrix 等
├── pages/         DrillPage / ReferencePage
└── App.tsx
public/ranges/6max-100bb/*.json  レンジデータ
```

## レンジJSONフォーマット

```json
{
  "spotId": "RFI-BTN",
  "source": "出典",
  "strategy": {
    "open": ["AA", "KK", "KTo@0.6", ...]
  }
}
```

- `hand` だけなら頻度1
- `hand@0.6` で部分頻度
- 各アクションに書かれた合計が1未満のハンドは、残りが自動で `fold` に割り当てられる

## デプロイ

`main` への push で GitHub Actions が `gh-pages` 経由でデプロイ。リポジトリ設定で Pages を「GitHub Actions」ソースに設定する。

## 注意・既知の制限

- MVPは RFI 5種 + vsRFI 3種。他スポットは順次追加予定
- 真のソルバ計算はブラウザでは行わない（事前計算データのみ）

## レンジデータの素性と免責

このリポジトリに同梱しているレンジJSON（`public/ranges/`配下）は、**一般に流通している6max NLH 100bbのGTO戦略に関する知識をもとに、本プロジェクトが手動で構築した近似値**です。

- 商用ソルバ製品（GTO Wizard, PioSolver, Simple Postflop 等）の出力データを転載・複製したものではありません
- ナッシュ均衡解そのものは数学的事実であり、特定の数値表現を除いて著作権の対象になりません
- 数値はあくまで学習の補助を目的とした参考値であり、特定の局面における最適解を保証するものではありません
- 商用ソルバ製品の利用規約に従い、各種ツールの出力を本プロジェクトに取り込む場合は、利用許諾の確認とライセンス表記を行ってください

### 免責事項

本ソフトウェアは学習・教育目的で提供されます。本ソフトウェアの利用により生じたいかなる結果（賭博の結果を含む）についても、開発者は一切の責任を負いません。リアルマネーのギャンブルは各地域の法規制に従ってください。

## 商標について

本プロジェクトは特定のソルバ製品・トレーニングサイト・ブランドと提携しておらず、それらの名称・ロゴ・データを使用していません。"GTO Wizard"、"PioSolver"、"Upswing Poker" 等は各権利者の商標です。

## ライセンス

[MIT License](./LICENSE) — ソースコードおよび本リポジトリ同梱のレンジJSON（自作データ）に適用されます。
