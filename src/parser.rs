use crate::models::KifHeader;
use encoding_rs::EUC_JP;
use encoding_rs::SHIFT_JIS;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;

pub struct Move {
    pub te: usize,    // 何手目
    pub fugo: String, // ７六歩(77) など
}

pub fn parse_header_and_result(kif_text: &str, filename: &str) -> KifHeader {
    use chrono::Local;

    let mut sente_player = String::new();
    let mut gote_player = String::new();
    let mut started_at: Option<String> = None;
    let mut ended_at: Option<String> = None;

    for line in kif_text.lines() {
        if line.starts_with("先手：") {
            sente_player = line.replace("先手：", "").trim().to_string();
        } else if line.starts_with("後手：") {
            gote_player = line.replace("後手：", "").trim().to_string();
        } else if line.starts_with("開始日時：") {
            if let Some(dt) = line.strip_prefix("開始日時：") {
                started_at = Some(dt.trim().replace('/', "-")); // "2025-07-10 11:28:32"
            }
        } else if line.starts_with("終了日時：") {
            if let Some(dt) = line.strip_prefix("終了日時：") {
                ended_at = Some(dt.trim().replace('/', "-"));
            }
        }
    }

    // 終局情報の検出
    let last_move_num: Option<u32> = None;
    let mut is_sente_win = true;

    for line in kif_text.lines().rev() {
        if line.starts_with('*') {
            if line.contains("反則手") || line.contains("時間切れ") {
                if let Some(num) = last_move_num {
                    // 偶数手で反則等があれば、先手の勝ち
                    is_sente_win = num % 2 == 0;
                }
            }
        } else if let Some((num_str, rest)) = line.trim().split_once(char::is_whitespace) {
            if let Ok(num) = num_str.parse::<u32>() {
                if rest.contains("投了") {
                    // 偶数手で投了なら、先手の勝ち
                    is_sente_win = num % 2 == 0;
                }
                break;
            }
        }
    }

    KifHeader {
        kif_filename: filename.to_string(),
        sente_player,
        gote_player,
        is_sente_win,
        started_at,
        ended_at,
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        created_by: "system".to_string(),
    }
}

pub fn read_kif_file(path: &str) -> Result<(String, String), Box<dyn std::error::Error>> {
    let file = File::open(path)?;
    let filename = Path::new(path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut reader = BufReader::new(file);
    let mut buffer = Vec::new();
    reader.read_to_end(&mut buffer)?;

    if let Ok(s) = String::from_utf8(buffer.clone()) {
        return Ok((s, filename));
    }

    let (s, _, had_errors) = SHIFT_JIS.decode(&buffer);
    if !had_errors {
        return Ok((s.into_owned(), filename));
    }

    let (s, _, had_errors) = EUC_JP.decode(&buffer);
    if !had_errors {
        return Ok((s.into_owned(), filename));
    }

    Err("文字コードの自動判別に失敗しました".into())
}

pub fn parse_kif_moves(lines: &[String]) -> Vec<Move> {
    let mut moves = vec![];

    for line in lines {
        let line = line.trim();

        // 手数から始まる行だけを対象に
        if let Some(first_char) = line.chars().next() {
            if first_char.is_digit(10) {
                // 手数と符号部分を抽出
                if let Some(index) = line.find(' ') {
                    let (te_str, rest) = line.split_at(index);
                    if let Ok(te) = te_str.trim().parse::<usize>() {
                        let fugo = if rest.contains("打") {
                            // 打ち駒は () を含まない → "７四歩打" の部分を取り出す
                            rest.split_whitespace().next().unwrap_or("").to_string()
                        } else if let Some(start_of_time) = rest.find(')') {
                            rest[..start_of_time + 1].trim().to_string()
                        } else {
                            rest.trim().to_string()
                        };

                        moves.push(Move { te, fugo });
                    }
                }
            }
        }
    }

    moves
}
