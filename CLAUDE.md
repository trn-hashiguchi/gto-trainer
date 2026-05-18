# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

NLH キャッシュ 6max 100bb のプリフロップ GTO レンジを学習するブラウザアプリ。React + Vite + TypeScript の完全静的サイトで、進捗は localStorage に永続化。GitHub Pages で公開（https://trn-hashiguchi.github.io/gto-trainer/）。

## 開発コマンド

開発は Docker 経由が基本。**ポートは社内ルールにより 53004（dev）/ 53005（preview）に固定**。他社員と衝突するため変更時は `ss -tln` で空きを確認すること（既使用: 50530/53000-53002/54125/55000/55173）。

```sh
docker compose up -d            # 開発サーバ起動 → http://localhost:53004
docker compose exec app npm run build    # 本番ビルド（型チェック含む）
docker compose exec app npx tsc -b       # 型チェックのみ
docker compose exec app npm run test     # Vitest
docker compose logs -f app               # ログ確認
docker compose down                      # 停止
```

Docker を使わない場合は `npm run dev` / `npm run build` / `npm run preview`。

## アーキテクチャ

### レンジデータの流れ
`public/ranges/6max-100bb/<spotId>.json` → `src/data/rangeLoader.ts:loadRange()` で fetch → `expandRange()` で全 169 ハンドの `Range` 型に展開（メモリキャッシュ付き）。

**JSON は簡潔フォーマット**: アクション名をキーに、採用ハンドを `"AKs"` / `"KTo@0.6"`（頻度付き）形式の配列で列挙。`fold` は書かずに、各ハンドで合計が 1 未満なら残余が自動的に `fold` に割り当てられる。`source` フィールドには必ず「自作データ」である旨を明記（商用ソルバ製品からの転載防止のため）。

レンジ JSON の参照パスは `import.meta.env.BASE_URL` を経由する。GitHub Pages のサブパス（`/gto-trainer/`）でも動くよう、絶対パスで書かないこと。`vite-env.d.ts` の `vite/client` 参照が `import.meta.env` の型解決に必要。

### ドメインモデル（`src/domain/poker.ts`）
- `ALL_HANDS`: 13×13 マトリクスを `handAt(row, col)` で展開した 169 ハンドのコード配列
- `Spot`: scenario (`RFI`/`vsRFI`/`vs3bet`) × hero × villain × 選択肢アクション
- `CORRECT_FREQUENCY_THRESHOLD = 0.05`: **採点は argmax ではない**。頻度 ≥ 5% のアクションは全て正解（ミックス戦略許容）。仕様変更時はこの定数を動かす

### SRS（`src/store/progress.ts`）
Leitner 5 箱方式、間隔は即/1日/3日/7日/14日。zustand + persist で `localStorage["poker-gto-v1"]` に保存。`priorityScore()` で出題重みを計算（未学習: 1,000,000、期限超過分/分 + (6-box)\*1000）。

ストアのキー（`cards`/`recent`/`totals`/`byPosition`/`bySpot`）を変更したら永続化スキーマが壊れるため、`persist` の `name` をバージョンアップ（`poker-gto-v2` 等）するか migration を書くこと。

### 出題ロジック（`DrillPage.tsx:pickQuestion`）
全 (spot × hand) を candidate にして `priorityScore` で重み付けランダム抽選。AVAILABLE_SPOT_IDS 配列に並ぶスポットのみが出題対象 — 新しいレンジ JSON を追加したらここに登録する。

### 視覚化の規約
- **ポジションテーブル（`PositionTable.tsx`）はアクションが時計回りに進む**。BB(12時)→UTG(2時)→HJ(4時)→CO(6時)→BTN(8時)→SB(10時)。配置を変更する際は必ずこの順を維持
- `HandMatrix`: 13×13、行列インデックスの慣例は `row<col=suited, row>col=offsuit`。複数アクションは横方向グラデーションで頻度を可視化
- `CardPair`: ハンドコードを実カード表記に変換。`T` は `10` 表示、suited=♠♠、offsuit/pair=♠♥ で固定

## 重要な制約・方針

- **レンジデータは自作のみ**: 商用ソルバ（GTO Wizard, PioSolver 等）の出力を転載しない。商標名を UI に出さない。詳細は README の「レンジデータの素性と免責」セクション
- **ブラウザでソルバ計算を行わない**: 事前計算 JSON のみ。重い計算は将来 WebWorker や WASM ソルバを検討
- **真の DB は持たない**: localStorage 完結。エクスポート機能は未実装だが将来検討
- **採点はミックス戦略前提**: argmax 採点に変えない（学習効果が落ちる）

## デプロイ

`main` への push で `.github/workflows/deploy.yml` が走り、`VITE_BASE=/gto-trainer/` でビルドして GitHub Pages にデプロイ。リポジトリ名を変更した場合は workflow 内の base パスも変わる（自動で `${{ github.event.repository.name }}` を読む）。

## 既知の落とし穴

- TypeScript の strict 設定で `noUnusedLocals` が有効。CI でビルドが落ちるため、未使用 import は残さない
- `tsconfig.tsbuildinfo` は `.gitignore` 済み
- Docker ボリュームに node_modules を分離している（`poker_node_modules`）。`package.json` 更新後は `docker compose down && docker compose up` で再 install させる
- Vite dev server は社内ホスト名（"ws" 等）からのアクセスがあるため `server.allowedHosts: true` を設定済み
