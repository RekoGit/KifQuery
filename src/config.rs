use dotenvy::dotenv;
use lazy_static::lazy_static;
use once_cell::sync::Lazy;
use std::env;
use std::path::PathBuf;

// .env を一度だけ読み込むための Lazy
static _INIT: Lazy<()> = Lazy::new(|| {
    dotenv().ok(); // .env を読み込む
});

// 既存の KIF_DIR
pub static KIF_DIR: Lazy<PathBuf> = Lazy::new(|| {
    once_cell::sync::Lazy::force(&_INIT);
    PathBuf::from(env::var("KIF_DIR").unwrap_or_else(|_| "../kif".to_string()))
});

pub static IMPORTED_DIR: Lazy<PathBuf> = Lazy::new(|| {
    once_cell::sync::Lazy::force(&_INIT);
    PathBuf::from(env::var("IMPORTED_DIR").unwrap_or_else(|_| "../kif/imported".to_string()))
});

pub static COLLECTED_DIR: Lazy<PathBuf> = Lazy::new(|| {
    let val = dotenvy::var("COLLECTED_DIR").expect("COLLECTED_DIR must be set");
    PathBuf::from(val)
});

// pub static MY_USERNAME_WARS: Lazy<String> = Lazy::new(|| {
//     once_cell::sync::Lazy::force(&_INIT);
//     env::var("MY_USERNAME_WARS").unwrap_or_else(|_| "UnknownUser".to_string())
// });
lazy_static! {
    pub static ref MY_USERNAMES: Vec<String> = std::env::var("MY_USERNAMES")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();
}
