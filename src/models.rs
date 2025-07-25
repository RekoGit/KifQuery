pub struct KifHeader {
    pub kif_filename: String,
    pub sente_player: String,
    pub gote_player: String,
    pub is_sente_win: bool,
    pub started_at: Option<String>, // 追加（Optionalにしておくと柔軟）
    pub ended_at: Option<String>,   // 追加
    pub created_at: String,
    pub created_by: String,
}

pub struct KifBody {
    pub kif_id: i32,               // 外部キー
    pub te: i32,                   // 手数（何手目）
    pub fugo: String,              // 例: "7六歩"
    pub board: [Option<char>; 81], // 盤面（9x9 = 81マス）
}
