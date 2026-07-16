# SwitchBot

Raycastから公式の `@switchbot/openapi-cli` を操作する薄いUIラッパーです。

## 対応機能

- 最近使った順のSwitchBotデバイス一覧
- IRエアコンのON/OFF、温度・モード・風量設定
- IRテレビのON/OFF、音量・チャンネル操作
- IRライトのON/OFF、相対的な明るさ操作
- Hub 2の温度・湿度・照度表示
- その他の物理デバイスのライブ状態と詳細表示
- 選択したデバイスのメニューバー表示

## メニューバー

Raycastで `SwitchBot Menu Bar` を一度実行すると、選択したデバイスの情報がmacOSのメニューバーに表示されます。

- `表示デバイス` から表示対象を切り替え
- Hub 2は温度・湿度、IRデバイスは最終送信内容を表示
- 5分ごとにバックグラウンド更新
- `再取得` で手動更新
- `メニューバーをOFF` で非表示
- 再表示するときはRaycastから `SwitchBot Menu Bar` を実行

メニューバーをクリックしたときは保存済みの表示値をすぐに読み込みます。CLIからの再取得はバックグラウンド更新、手動更新、表示デバイスの切り替え時に行います。

## 前提

- `switchbot auth login` でCLI側の認証を完了していること
- Raycast Extension Preferencesで `switchbot` 実行ファイルを指定すること
- Raycast側ではSwitchBotのTokenやSecretを保存しません

IRエアコンの表示は監査ログから復元した最終送信値です。実機の状態を確認した値ではありません。
テレビやIRライトも、実機状態ではなく監査ログから復元した最終送信操作を表示します。

## 開発

```bash
npm ci
npm test
npm run lint
npm run build
npm run dev
```
