use dotenvy::dotenv;
use lazy_static::lazy_static;
use once_cell::sync::Lazy;
use std::env;
use std::path::PathBuf;

// .env を一度だけ読み込む
static _INIT: Lazy<()> = Lazy::new(|| {
    dotenv().ok(); // .env を読み込む
});

pub static KIF_PATH: Lazy<PathBuf> = Lazy::new(|| {
    once_cell::sync::Lazy::force(&_INIT);
    PathBuf::from(env::var("KIF_PATH").expect("KIF_PATH must be set"))
});

pub static IMPORTED_DIR: Lazy<PathBuf> = Lazy::new(|| {
    let subdir = env::var("IMPORTED_DIR").unwrap_or_else(|_| "imported".to_string());
    KIF_PATH.join(subdir)
});

pub static COLLECTED_DIR: Lazy<PathBuf> = Lazy::new(|| {
    let subdir = env::var("COLLECTED_DIR").unwrap_or_else(|_| "collected".to_string());
    KIF_PATH.join(subdir)
});

lazy_static! {
    pub static ref MY_USERNAMES: Vec<String> = std::env::var("MY_USERNAMES")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();
}
