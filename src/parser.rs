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
    let mut is_sente_win = true;
    let mut is_resutl_found = false;
    let mut prev_line: Option<String> = None;

    // 棋譜が変化を含む場合があるため、先頭から走査して最初に「投了」や「反則手」が出てくる行を探す
    for line in kif_text.lines() {
        // 81道場で反則手等で終局している場合、手数が記載されていないためprev_lineから手数を取得する
        if line.contains("*反則手") || line.contains("*時間切れ") {
            println!(
                "反則手や時間切れの直前の行: {}",
                prev_line.as_deref().unwrap_or("なし")
            );
            if let Some(last) = prev_line.as_ref() {
                if let Some((num_str, _)) = last.trim().split_once(char::is_whitespace) {
                    if let Ok(num) = num_str.parse::<u32>() {
                        print!("終局: {} {}手目", line, num);
                        // 時間切れの場合、直前の行を指した方が勝ち
                        if line.contains("*時間切れ") {
                            is_sente_win = num % 2 == 1;
                        } else {
                            is_sente_win = num % 2 == 0;
                        }
                        is_resutl_found = true;
                        break;
                    }
                }
            }
        }

        if line.contains("投了") {
            if let Some((num_str, rest)) = line.trim().split_once(char::is_whitespace) {
                if let Ok(num) = num_str.parse::<u32>() {
                    // 偶数手で投了なら、先手の勝ち
                    print!("投了手: {} ", rest);
                    is_sente_win = num % 2 == 0;
                    is_resutl_found = true;
                    break;
                }
            }
        }

        // 直前のlineを保管
        prev_line = Some(line.to_string());
    }

    // この時点で勝敗が不明である場合は、最後の手を指した方を勝ちとする
    if is_resutl_found == false {
        if let Some(last) = prev_line.as_ref() {
            if let Some((num_str, _)) = last.trim().split_once(char::is_whitespace) {
                if let Ok(num) = num_str.parse::<u32>() {
                    print!(
                        "投了/反則等の終局情報が見つからないため、最後の手を指した方を勝ちとします： 最終手: {} ",
                        last,
                    );
                    is_sente_win = num % 2 == 1;
                }
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

pub fn normalize_fugo(fugo: &str, prev_fugo: Option<&str>) -> String {
    use regex::Regex;
    let fugo = fugo.replace(['\u{3000}', ' '], ""); // スペース削除

    if fugo.starts_with("同") {
        if let Some(prev) = prev_fugo {
            let re =
                Regex::new(r"(?P<to_file>[１２３４５６７８９])(?P<to_rank>[一二三四五六七八九])")
                    .unwrap();
            if let Some(caps) = re.captures(prev) {
                let file = caps.name("to_file").unwrap().as_str();
                let rank = caps.name("to_rank").unwrap().as_str();
                // 置換: "同　銀(48)" → "３七銀(48)" など
                return fugo.replacen("同", &format!("{}{}", file, rank), 1);
            }
        }
    }
    fugo.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_fugo_with_doh_doublebyte() {
        let prev = "３七歩成(36)";
        let current = "同　銀(48)";
        let expected = "３七銀(48)";
        assert_eq!(normalize_fugo(current, Some(prev)), expected);
    }

    #[test]
    fn test_normalize_fugo_with_doh_singlebyte() {
        let prev = "３七歩成(36)";
        let current = "同 銀(48)";
        let expected = "３七銀(48)";
        assert_eq!(normalize_fugo(current, Some(prev)), expected);
    }

    #[test]
    fn test_normalize_fugo_without_doh() {
        let prev = "３七歩(36)";
        let current = "４八銀(39)";
        assert_eq!(normalize_fugo(current, Some(prev)), "４八銀(39)");
    }

    #[test]
    fn test_normalize_fugo_without_prev_fugo() {
        let current = "同　銀(48)";
        assert_eq!(normalize_fugo(current, None), "同銀(48)");
    }
}
