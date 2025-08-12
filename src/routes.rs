use crate::config::{COLLECTED_DIR, IMPORTED_DIR, MY_USERNAMES};
use crate::db;
use axum::http::StatusCode;
use mysql::prelude::Queryable;
use serde::Deserialize;
use serde::Serialize;
use std::fs;

// use axum::{extract::Json, response::IntoResponse};
use axum::Json;
use mysql::*;

#[derive(Deserialize)]
pub struct SearchCondition {
    pub c: String,
    pub sfen: String,
}

#[derive(Serialize)]
pub struct KifLink {
    pub link: String,
    pub te: i32,            // ← 何手目（ヒットした局面の手数）
    pub is_win: bool,       // 自分が勝ったかどうか
    pub started_at: String, // 対局開始日時（例: "2025-07-10 14:00:00"）
    pub is_sente: bool,     // 先手か後手か（true: 先手, false: 後手）
}

pub async fn search_games(
    Json(conditions): Json<Vec<SearchCondition>>,
) -> Result<Json<Vec<KifLink>>, (StatusCode, String)> {
    // ヒットした棋譜をコピーするディレクトリを整備
    if COLLECTED_DIR.exists() {
        fs::remove_dir_all(&*COLLECTED_DIR).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("COLLECTED_DIR削除失敗: {}", e),
            )
        })?;
    }
    fs::create_dir_all(&*COLLECTED_DIR).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("COLLECTED_DIR作成失敗: {}", e),
        )
    })?;

    let mut conn =
        db::get_conn().map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut links: Vec<KifLink> = Vec::new(); // 先手＋後手それぞれの検索結果を格納
    let mut where_clauses = Vec::new();
    let mut params: Vec<Value> = Vec::new();

    // 先手の場合の処理
    for cond in &conditions {
        let col_name = format!("b.c{}", cond.c); // テーブルエイリアスbを付ける
        // where_clauses.push(format!("{} = ?", col_name));
        where_clauses.push(format!("{} = ? COLLATE utf8mb4_bin", col_name));
        params.push(cond.sfen.clone().into());
    }
    // where_clauses.push("h.sente_player = ?".to_string());
    // params.push(MY_USERNAME_WARS.to_string().into());
    where_clauses.push(format!(
        "h.sente_player IN ({})",
        MY_USERNAMES
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ")
    ));
    params.extend(MY_USERNAMES.iter().cloned().map(Value::from));

    let where_sql = if where_clauses.is_empty() {
        "1".to_string()
    } else {
        where_clauses.join(" AND ")
    };

    let sql = format!(
        r#"
SELECT h.kif_filename, MIN(b.te) as min_te, h.is_sente_win as is_win, DATE_FORMAT(h.started_at, '%Y-%m-%d %H:%i:%s') AS started_at, 1 as sengo 
FROM kif_bodies b
LEFT JOIN kif_headers h ON b.kif_id = h.id
WHERE {}
GROUP BY b.kif_id
    "#,
        where_sql
    );

    let rows: Vec<(String, i32, bool, String, bool)> = conn
        // let rows: Vec<(String, i32)> = conn
        .exec(sql, params)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 後手の場合の処理
    let mut gote_where_clauses = Vec::new();
    let mut gote_params: Vec<Value> = Vec::new();

    for cond in &conditions {
        // cの反転: 82 - c（数値に変換）
        let c_val: i32 = cond.c.parse().unwrap_or(0);
        let reversed_c = 82 - c_val;

        // sfenの大文字小文字反転
        let reversed_sfen = cond
            .sfen
            .chars()
            .map(|ch| {
                if ch.is_ascii_lowercase() {
                    ch.to_ascii_uppercase()
                } else {
                    ch.to_ascii_lowercase()
                }
            })
            .collect::<String>();

        let col_name = format!("b.c{}", reversed_c);
        // gote_where_clauses.push(format!("{} = ?", col_name));
        gote_where_clauses.push(format!("{} = ? COLLATE utf8mb4_bin", col_name));
        gote_params.push(reversed_sfen.into());
    }

    // gote_where_clauses.push("h.gote_player = ?".to_string());
    // gote_params.push(MY_USERNAME_WARS.to_string().into());
    gote_where_clauses.push(format!(
        "h.gote_player IN ({})",
        MY_USERNAMES
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ")
    ));
    gote_params.extend(MY_USERNAMES.iter().cloned().map(Value::from));

    let gote_where_sql = if gote_where_clauses.is_empty() {
        "1".to_string()
    } else {
        gote_where_clauses.join(" AND ")
    };

    let gote_sql = format!(
        r#"
SELECT h.kif_filename, MIN(b.te) as min_te, NOT h.is_sente_win as is_win, DATE_FORMAT(h.started_at, '%Y-%m-%d %H:%i:%s') AS started_at, 0 as sengo 
FROM kif_bodies b
LEFT JOIN kif_headers h ON b.kif_id = h.id
WHERE {}
GROUP BY b.kif_id
"#,
        gote_where_sql
    );
    println!("SQL: {}", gote_sql);

    let gote_rows: Vec<(String, i32, bool, String, bool)> = conn
        .exec(gote_sql, gote_params)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 先手 + 後手の一致ファイルをコピー
    for (filename, te, is_win, started_at, is_sente) in rows.into_iter().chain(gote_rows) {
        let src = IMPORTED_DIR.join(&filename);
        let dst = COLLECTED_DIR.join(&filename);

        fs::copy(&src, &dst).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("コピー失敗: {} → {}: {}", src.display(), dst.display(), e),
            )
        })?;

        links.push(KifLink {
            link: format!("{}/{}", IMPORTED_DIR.display(), filename),
            te,
            is_win: is_win,
            started_at,
            is_sente,
        });
    }

    // started_at の降順でソート
    links.sort_by(|a, b| b.started_at.cmp(&a.started_at));

    Ok(Json(links))
}
