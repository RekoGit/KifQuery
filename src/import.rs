use crate::board::Board;
use crate::config::IMPORTED_DIR;
use crate::models::KifBody;
use crate::{db, parser};
use mysql::PooledConn;

use crate::config::KIF_DIR;
use std::fs;

pub fn import_kif_file(
    conn: &mut PooledConn,
    filepath: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let (contents, filename) = parser::read_kif_file(filepath)?;
    let header = parser::parse_header_and_result(&contents, &filename);

    let lines: Vec<String> = contents.lines().map(|line| line.to_string()).collect();
    let moves = parser::parse_kif_moves(&lines);
    let mut board = Board::new();
    let kif_id = db::insert_kif_header(conn, &header)?;

    for m in &moves {
        // 投了などの終局を検出してループ終了
        if m.fugo.contains("投了") {
            break;
        }
        board.apply_move(&m.fugo, m.te % 2 == 1)?;
        let body = KifBody {
            kif_id: kif_id as i32,
            te: m.te as i32,
            fugo: m.fugo.clone(),
            board: board.to_verbose_sfen(),
        };
        db::insert_kif_bodies(conn, &[body])?;
    }

    // 読み込んだファイルを移動
    let destination = IMPORTED_DIR.join(filename);

    if !IMPORTED_DIR.exists() {
        fs::create_dir_all(IMPORTED_DIR.as_path())?;
    }

    fs::rename(filepath, &destination)?;
    println!("✅ ファイル移動: {} → {}", filepath, destination.display());

    Ok(())
}

pub fn import_all_kif_files() -> Result<(), Box<dyn std::error::Error>> {
    let paths = fs::read_dir(KIF_DIR.as_path())?;
    let mut conn = db::get_conn()?;

    for entry in paths {
        let entry = entry?;
        let path = entry.path();

        if path.extension().map(|ext| ext != "kif").unwrap_or(true) {
            continue;
        }

        println!("\n=== 処理中: {} ===", path.to_string_lossy());

        if let Err(e) = import_kif_file(&mut conn, path.to_str().unwrap()) {
            eprintln!("棋譜取り込み失敗: {}", e);
        }
    }

    Ok(())
}
