use dotenvy::dotenv;
use mysql::prelude::*;
use mysql::*;
use mysql::{Opts, Pool};
use std::env;
pub fn get_conn() -> Result<PooledConn, Box<dyn std::error::Error>> {
    dotenv().ok();

    let url = env::var("DATABASE_URL")?;
    let opts = Opts::from_url(&url)?;
    let pool = Pool::new(opts)?;
    let conn = pool.get_conn()?;

    Ok(conn)
}

use crate::models::KifHeader;
pub fn insert_kif_header(
    conn: &mut PooledConn,
    header: &KifHeader,
) -> Result<u64, Box<dyn std::error::Error>> {
    conn.exec_drop(
        "DELETE FROM kif_headers WHERE kif_filename = ?",
        (&header.kif_filename,),
    )?;

    // INSERT
    conn.exec_drop(
        r"INSERT INTO kif_headers (
            kif_filename, sente_player, gote_player, is_sente_win,
            started_at, ended_at, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            &header.kif_filename,
            &header.sente_player,
            &header.gote_player,
            header.is_sente_win,
            &header.started_at,
            &header.ended_at,
            &header.created_at,
            &header.created_by,
        ),
    )?;

    Ok(conn.last_insert_id())
}

use crate::models::KifBody;
pub fn insert_kif_bodies(
    conn: &mut PooledConn,
    bodies: &[KifBody],
) -> Result<(), Box<dyn std::error::Error>> {
    // 削除（kif_id で）
    // conn.exec_drop("DELETE FROM kif_bodies WHERE kif_id = ?", (kif_id,))?;

    let stmt = r"INSERT INTO kif_bodies (
        kif_id, te, fugo,
        c1, c2, c3, c4, c5, c6, c7, c8, c9,
        c10, c11, c12, c13, c14, c15, c16, c17, c18,
        c19, c20, c21, c22, c23, c24, c25, c26, c27,
        c28, c29, c30, c31, c32, c33, c34, c35, c36,
        c37, c38, c39, c40, c41, c42, c43, c44, c45,
        c46, c47, c48, c49, c50, c51, c52, c53, c54,
        c55, c56, c57, c58, c59, c60, c61, c62, c63,
        c64, c65, c66, c67, c68, c69, c70, c71, c72,
        c73, c74, c75, c76, c77, c78, c79, c80, c81
    ) VALUES (
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ? 
    )";

    let params_vec: Vec<_> = bodies
        .iter()
        .map(|b| {
            let flat: Vec<_> = b
                .board
                .iter()
                .map(|c| c.map(|x| x.to_string()).unwrap_or_default())
                .collect();
            let flat_str: Vec<&str> = flat.iter().map(|s| s.as_str()).collect();

            let mut v: Vec<Value> = vec![b.kif_id.into(), b.te.into(), b.fugo.clone().into()];
            v.extend(flat_str.iter().map(|s| s.to_string().into()));
            v
        })
        .collect();

    conn.exec_batch(stmt, params_vec)?;

    Ok(())
}
