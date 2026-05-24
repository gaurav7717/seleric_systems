-- ClickHouse analytics schema (local dev reference)

CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.campaign_daily (
    date Date,
    campaign_id String,
    spend Float64,
    revenue Float64,
    orders UInt32,
    roas Float64
) ENGINE = MergeTree()
ORDER BY (date, campaign_id);
