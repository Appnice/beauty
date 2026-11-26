-- 005: the language of a salon's SMS messages (to clients and to staff). Set at sign-up from the language of
-- the page the owner used; the screens follow the visitor's own choice (cookie), not this column.
alter table salon add column lang text not null default 'pl' check (lang in ('pl', 'en'));
