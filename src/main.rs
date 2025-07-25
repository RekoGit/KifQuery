mod board;
mod config;
mod db;
mod import;
mod models;
mod parser;
mod routes;

use axum::{Router, routing::post};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/api/admin/import", post(import_all_handler))
        .route("/api/search", post(routes::search_games))
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

// ハンドラ関数
async fn import_all_handler() -> &'static str {
    let my_name = "Ringosky";

    match import::import_all_kif_files(my_name) {
        Ok(_) => "全ての棋譜ファイルをインポートしました",
        Err(e) => {
            eprintln!("エラー: {}", e);
            "エラーが発生しました"
        }
    }
}
