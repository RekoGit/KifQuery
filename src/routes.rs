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
    pub te: i32,
    pub is_win: bool, // 自分が勝ったかどうか
    pub started_at: Option<String>,
    pub is_sente: bool,
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

    // 検索条件の数が0の場合は、全対局を取得する
    println!("検索条件: {}件", conditions.len());

    // 先手の場合の処理
    // 与えられた条件を一旦、where_clausesに格納
    for cond in &conditions {
        let col_name = format!("b.c{}", cond.c); // テーブルエイリアスbを付ける
        where_clauses.push(format!("{} = ? COLLATE utf8mb4_bin", col_name));
        params.push(cond.sfen.clone().into());
    }

    // ユーザー名の条件も一旦、where_clausesに格納
    where_clauses.push(format!(
        "h.sente_player IN ({})",
        MY_USERNAMES
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ")
    ));
    params.extend(MY_USERNAMES.iter().cloned().map(Value::from));

    let sql = format!(
        r#"
SELECT h.kif_filename, MIN(b.te) as min_te, h.is_sente_win as is_win, DATE_FORMAT(h.started_at, '%Y-%m-%d %H:%i:%s') AS started_at, 1 as sengo 
FROM kif_bodies b
LEFT JOIN kif_headers h ON b.kif_id = h.id
WHERE {}
GROUP BY b.kif_id
    "#,
        where_clauses.join(" AND ")
    );

    println!("SQL: {}", sql);
    println!("PARAMS: {:?}", params);

    let rows: Vec<(String, i32, bool, Option<String>, bool)> = conn
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

    gote_where_clauses.push(format!(
        "h.gote_player IN ({})",
        MY_USERNAMES
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ")
    ));
    gote_params.extend(MY_USERNAMES.iter().cloned().map(Value::from));

    // let gote_where_sql = if gote_where_clauses.is_empty() {
    //     "1".to_string()
    // } else {
    //     gote_where_clauses.join(" AND ")
    // };

    let gote_sql = format!(
        r#"
SELECT h.kif_filename, MIN(b.te) as min_te, NOT h.is_sente_win as is_win, DATE_FORMAT(h.started_at, '%Y-%m-%d %H:%i:%s') AS started_at, 0 as sengo 
FROM kif_bodies b
LEFT JOIN kif_headers h ON b.kif_id = h.id
WHERE {}
GROUP BY b.kif_id
"#,
        gote_where_clauses.join(" AND ")
    );
    println!("SQL: {}", gote_sql);
    println!("PARAMS: {:?}", gote_params);

    let gote_rows: Vec<(String, i32, bool, Option<String>, bool)> = conn
        .exec(gote_sql, gote_params)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 検索件数をprint
    println!(
        "先手検索結果: {}件, 後手検索結果: {}件",
        rows.len(),
        gote_rows.len()
    );

    // 先手 + 後手の一致ファイルをコピー
    for (filename, te, is_win, started_at, is_sente) in rows.into_iter().chain(gote_rows) {
        let src = IMPORTED_DIR.join(&filename);
        let dst = COLLECTED_DIR.join(&filename);

        links.push(KifLink {
            link: format!("{}/{}", IMPORTED_DIR.display(), filename),
            te,
            is_win: is_win,
            started_at,
            is_sente,
        });

        // ファイルが存在しない場合はスキップ
        if !src.exists() {
            println!("ファイルが存在しません: {}", src.display());
            continue;
        }

        fs::copy(&src, &dst).map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("コピー失敗: {} → {}: {}", src.display(), dst.display(), e),
            )
        })?;
    }

    // started_at の降順でソート
    links.sort_by(|a, b| b.started_at.cmp(&a.started_at));

    Ok(Json(links))
}
