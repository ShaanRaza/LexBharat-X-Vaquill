CREATE INDEX act_sections_tsv_gin ON act_sections USING GIN (tsv);
CREATE INDEX act_sections_number ON act_sections (act_id, number);
CREATE INDEX acts_title_tsv_gin ON acts USING GIN (title_tsv);
CREATE INDEX acts_title_lower ON acts (lower(title) text_pattern_ops);
ANALYZE acts;
ANALYZE act_sections;
