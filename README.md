# SwitchBot

Raycastから公式の `@switchbot/openapi-cli` を操作する薄いUIラッパーです。

## 対応機能

- 最近使った順のSwitchBotデバイス一覧
- IRエアコンのON/OFF、温度・モード・風量設定
- IRテレビのON/OFF、音量・チャンネル操作
- IRライトのON/OFF、相対的な明るさ操作
- Hub 2の温度・湿度・照度表示
- その他の物理デバイスのライブ状態と詳細表示

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
