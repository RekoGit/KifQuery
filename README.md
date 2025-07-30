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

以下のバージョンで動作確認済み。

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
cargo build   # 初回セットアップ時は実行してください
cargo run     # サーバー起動
```

---

## 動作確認

サーバー起動後、環境変数 *KIF_PATH* に設定したディレクトリに棋譜を配置してください。
(棋神アナリティクスと81道場でダウンロードした棋譜のみ、動作確認済みです。)

以下のコマンドを実行してデーターベースに読み込みます。
```
curl -X POST http://localhost:3000/api/admin/import
```

以下のファイルにブラウザでアクセス：

```
(cloneしたディレクトリ)/KifQuery/web/index.html
```

駒を配置する盤面が表示されます。
両サイドの駒を配置して「この内容で検索する」を押下し、検索結果が表示されれば成功です。

ヒットした棋譜は環境変数  *COLLECTED_DIR* に指定したディレクトリに格納されています。
検索結果下部のChooseFileで  *COLLECTED_DIR* から棋譜を選択するとブラウザ上に表示することができます。

---

## サーバーの停止

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