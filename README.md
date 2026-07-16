# SwitchBot

Raycastから公式の `@switchbot/openapi-cli` を操作する薄いUIラッパーです。

## 前提

- `switchbot auth login` でCLI側の認証を完了していること
- Raycast Extension Preferencesで `switchbot` 実行ファイルを指定すること
- Raycast側ではSwitchBotのTokenやSecretを保存しません

IRエアコンの表示は監査ログから復元した最終送信値です。実機の状態を確認した値ではありません。
