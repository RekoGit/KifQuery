#[derive(Debug, Clone)]
pub struct Board {
    pub squares: [[Option<char>; 9]; 9], // 9x9のマス（None = 空白, Some(c) = 駒）
}

impl Board {
    /// 初期配置で盤面を初期化
    pub fn new() -> Self {
        let mut squares = [[None; 9]; 9];

        // 後手の駒（下段）
        squares[0] = [
            Some('l'),
            Some('n'),
            Some('s'),
            Some('g'),
            Some('k'),
            Some('g'),
            Some('s'),
            Some('n'),
            Some('l'),
        ];
        squares[1] = [
            None,
            Some('r'),
            None,
            None,
            None,
            None,
            None,
            Some('b'),
            None,
        ];
        squares[2] = [Some('p'); 9];
        // 中段は空
        for rank in 3..6 {
            squares[rank] = [None; 9];
        }
        // 先手の駒（上段）
        squares[6] = [Some('P'); 9];
        squares[7] = [
            None,
            Some('B'),
            None,
            None,
            None,
            None,
            None,
            Some('R'),
            None,
        ];
        squares[8] = [
            Some('L'),
            Some('N'),
            Some('S'),
            Some('G'),
            Some('K'),
            Some('G'),
            Some('S'),
            Some('N'),
            Some('L'),
        ];

        Board { squares }
    }

    /// SFEN風の固定長文字列に変換（空白圧縮なし）
    pub fn to_verbose_sfen(&self) -> [Option<char>; 81] {
        // self.squares
        //     .iter()
        //     .map(|rank| {
        //         rank.iter()
        //             .map(|cell| match cell {
        //                 Some(c) => c.to_string(),
        //                 None => "1".to_string(),
        //             })
        //             .collect::<String>()
        //     })
        //     .collect::<Vec<_>>()
        //     .join("/")
        let mut flat = [None; 81];
        for y in 0..9 {
            for x in 0..9 {
                flat[y * 9 + x] = self.squares[y][x];
            }
        }
        flat
    }

    /// 指し手（符号）を受け取って盤面に適用する（例: "５六歩(57)"）
    pub fn apply_move(&mut self, fugo: &str, is_sente_turn: bool) -> Result<(), String> {
        use regex::Regex;

        let cleaned_fugo = fugo.replace("成", "");

        let re = Regex::new(r"(?P<to_file>[１２３４５６７８９])(?P<to_rank>[一二三四五六七八九])(?P<piece>..)（?(?P<from>[1-9]{2})?）?").unwrap();

        if let Some(caps) = re.captures(&cleaned_fugo) {
            // 符号をsfen文字に変換
            let piece_kanji = caps.name("piece").unwrap().as_str().chars().next().unwrap();
            let piece = convert_kanji_to_piece(piece_kanji, is_sente_turn);

            let to_file_kanji = caps.name("to_file").unwrap().as_str();
            let to_rank_kanji = caps.name("to_rank").unwrap().as_str();
            let from = caps.name("from").map(|m| m.as_str());

            let file = convert_kanji_to_digit(to_file_kanji)
                .ok_or_else(|| format!("ファイルの全角数字が不正です: {}", to_file_kanji))?;
            let rank = convert_kanji_to_rank(to_rank_kanji)
                .ok_or_else(|| format!("ランクの漢数字が不正です: {}", to_rank_kanji))?;

            let to_x = 9 - file;
            let to_y = rank - 1;

            if fugo.ends_with("打") {
                // 「打ち駒」はどこに打つかだけ分かればいいので、盤上にその駒を直接置く
                self.squares[to_y][to_x] = Some(piece);
                return Ok(());
            } else {
                if let Some(from_str) = from {
                    let from_file = from_str.chars().nth(0).unwrap().to_digit(10).unwrap();
                    let from_rank = from_str.chars().nth(1).unwrap().to_digit(10).unwrap();

                    let from_x = 9 - from_file;
                    let from_y = from_rank - 1;

                    let piece = self.squares[from_y as usize][from_x as usize]
                        .ok_or("No piece at source")?;

                    // 移動
                    self.squares[from_y as usize][from_x as usize] = None;
                    self.squares[to_y][to_x] = Some(piece);

                    Ok(())
                } else {
                    Err("未対応の指し手です".to_string())
                }
            }
        } else {
            println!("不正な符号形式: {}", fugo);
            Err("不正な符号形式です".to_string())
        }
    }
}

pub fn convert_kanji_to_digit(c: &str) -> Option<usize> {
    let kanji_digits = ["１", "２", "３", "４", "５", "６", "７", "８", "９"];
    kanji_digits.iter().position(|&x| x == c).map(|i| i + 1)
}

pub fn convert_kanji_to_rank(c: &str) -> Option<usize> {
    let kanji_ranks = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
    kanji_ranks.iter().position(|&x| x == c).map(|i| i + 1)
}

/// 漢字の駒を SFEN 用の文字（大文字または小文字）に変換する（将来的には成駒かどうかを区別するようにしたいけど、今はcharでいい）
pub fn convert_kanji_to_piece(piece_kanji: char, is_sente_turn: bool) -> char {
    // まず漢字を小文字アルファベットに置き換え
    let lower = match piece_kanji {
        '歩' => 'p',
        '香' => 'l',
        '桂' => 'n',
        '銀' => 's',
        '金' => 'g',
        '角' => 'b',
        '飛' => 'r',
        '玉' | '王' => 'k',
        _ => '?',
    };

    // 先手なら大文字、後手なら小文字を返す
    if is_sente_turn {
        lower.to_ascii_uppercase()
    } else {
        lower
    }
}
