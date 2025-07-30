<div id="top"></div>

# KifQuery

## 目次

1. [プロジェクトについて](#プロジェクトについて)  
2. [環境](#環境)  
3. [セットアップ手順](#セットアップ手順)  
4. [動作確認](#動作確認)  
5. [環境変数の一覧](#環境変数の一覧)  

---

## プロジェクトについて

**KifQuery** は、「こんな感じの局面が登場した棋譜」を検索するためのツールです。

ブラウザ上に駒を配置して「こんな感じの局面」を指定することで、その局面が登場した棋譜を検索してリストします。


## 環境

| 項目 | バージョン |
|------|------------|
| Rust | 1.87.0     |
| MySQL | 8.4.4     |

---

## セットアップ手順

### 1. 必要なツールのインストール

#### 🔧 Rust

Rust公式サイトよりインストールしてください：

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

インストール後、バージョン確認：

```
rustc --version
```

#### 🐬 MySQL

MySQL 8.4以降をインストールし、起動しておきます。

- macOS: `brew install mysql@8.4`
- Ubuntu: `sudo apt install mysql-server`

確認コマンド：

```
mysql --version
```

### 2. `.env` ファイルの作成

プロジェクトルートに `.env` を作成し、以下を記述：

```
KIF_PATH=/Users/yourname/shogi/KifQuery/kif
IMPORTED_DIR=imported
COLLECTED_DIR=collected
DATABASE_URL=mysql://your_user:your_pass@localhost:3306/shogi
MY_USERNAMES=WARSACCOUNT,81ACCOUNT
```

使用する環境変数の詳細は、[環境変数の一覧](#環境変数の一覧)  を参照してください。

### 3. ビルドと実行

```
cargo build   # 一度だけ、またはコード変更後に実行
cargo run     # サーバー起動。ブラウザで使えるようになります
```

#### 💡 `cargo build` とは？

Rust のソースコードをコンパイルしてバイナリを作るコマンドです。  
コードを変更したときや、初回セットアップ時に実行してください。

#### 💡 `cargo run` とは？

`build` + 実行のセット。開発中はこれだけでもOKです。

---

## 動作確認

サーバー起動後、以下にアクセス：

```
http://127.0.0.1:3000
```

トップ画面が表示されれば成功です 🎉

---

## サービスの停止

`Ctrl + C` で停止します。

---

## 環境変数の一覧

| 変数名         | 役割                                           | 設定例                                                                 |
|----------------|------------------------------------------------|------------------------------------------------------------------------|
| `KIF_PATH`     | 検索対象の棋譜を配置するディレクトリ           | `/Users/yourname/shogi/KifQuery/kif` (Mac)  <br> `C:\Users\name\KifQuery\kif` (Windows) |
| `IMPORTED_DIR` | 取り込み済みの棋譜を格納するサブディレクトリ   | `imported`                                                             |
| `COLLECTED_DIR`| 検索ヒットした棋譜をコピーするサブディレクトリ | `collected`                                                            |
| `DATABASE_URL` | MySQL の接続情報                                | `mysql://your_user:your_pass@localhost:3306/shogi`                     |
| `MY_USERNAMES` | 自分の将棋アプリのユーザー名（複数可）         | `WARSACCOUNT,81ACCOUNT`                                                |

---

<p align="right">(<a href="#top">トップへ</a>)</p>