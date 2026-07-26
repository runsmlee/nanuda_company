-- 자가출판 프로젝트/주문 스키마.
--
-- 핵심 설계: 조판 PDF를 저장하지 않고 **원고 + 옵션만 저장**한다.
-- 조판은 결정적이므로(같은 입력 → 같은 출력) 주문 시점에 다시 만들면 된다.
-- 수백 KB짜리 PDF를 쌓지 않아도 되고, 미리보기와 인쇄본이 어긋날 일이 없다.

create extension if not exists "pgcrypto";

-- ── 프로젝트: 저자가 만든 책 한 권 ────────────────────────────────────────
create table if not exists publishing_projects (
  id              uuid primary key default gen_random_uuid(),
  -- 저자 계정이 아직 없다. 이메일 + 조회 토큰으로 접근을 제한한다.
  author_email    text not null,
  access_token    text not null unique,

  title           text not null,
  author_name     text not null,

  -- 원고 원본. Supabase Storage의 비공개 버킷 경로.
  manuscript_path text not null,
  manuscript_name text not null,

  -- 조판 옵션. 이 값들로 PDF를 재생성한다.
  book_spec_uid   text not null,
  text_size       text not null check (text_size in ('small','normal','large')),
  chapter_new_page boolean not null default true,

  -- 표지 옵션
  cover_theme     text not null default 'ivory' check (cover_theme in ('ivory','charcoal','photo')),
  cover_image_path text,
  back_text       text,

  -- 조판 결과 스냅샷. 가격·주문 검증에 쓴다.
  page_count      integer,
  char_count      integer,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists publishing_projects_email_idx on publishing_projects (author_email);

-- ── 주문 ─────────────────────────────────────────────────────────────────
create table if not exists publishing_orders (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references publishing_projects (id) on delete restrict,

  kind                text not null check (kind in ('digital','physical')),
  quantity            integer not null default 1 check (quantity between 1 and 100),

  -- 저자에게 청구한 금액(원). 원가는 저장하지 않는다.
  price_krw           integer not null check (price_krw > 0),

  status              text not null default 'pending'
                      check (status in ('pending','paid','submitted','failed','refunded','cancelled')),

  -- 결제사 식별자. 같은 결제로 두 번 인쇄되는 것을 DB 차원에서 막는다.
  payment_provider    text,
  payment_order_id    text,

  -- 제작사 주문. 실물 주문일 때만 채워진다.
  print_order_uid     text,
  print_status        text,

  -- 배송지 (실물 주문)
  recipient_name      text,
  recipient_phone     text,
  postal_code         text,
  address1            text,
  address2            text,
  shipping_memo       text,

  failure_reason      text,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz,
  submitted_at        timestamptz,
  updated_at          timestamptz not null default now()
);

-- 결제 하나당 주문 하나. 웹훅이 중복 도착해도 두 번 처리되지 않는다.
create unique index if not exists publishing_orders_payment_uniq
  on publishing_orders (payment_provider, payment_order_id)
  where payment_order_id is not null;

-- 제작사 주문도 한 번만. 재시도가 이중 인쇄로 이어지지 않게 한다.
create unique index if not exists publishing_orders_print_uniq
  on publishing_orders (print_order_uid)
  where print_order_uid is not null;

create index if not exists publishing_orders_project_idx on publishing_orders (project_id);
create index if not exists publishing_orders_status_idx on publishing_orders (status);

-- ── 웹훅 수신 기록 ────────────────────────────────────────────────────────
-- 재전송(최대 3회)이 와도 한 번만 처리하기 위한 멱등 장부.
create table if not exists publishing_webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  event_id      text not null,
  event_name    text not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text,
  unique (provider, event_id)
);

-- ── updated_at 자동 갱신 ─────────────────────────────────────────────────
-- search_path를 비워 고정한다. 고정하지 않으면 호출자가 스키마를 가로채
-- 함수 동작을 바꿀 수 있다 (Supabase security advisor 경고 대상).
create or replace function publishing_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists publishing_projects_touch on publishing_projects;
create trigger publishing_projects_touch before update on publishing_projects
  for each row execute function publishing_touch_updated_at();

drop trigger if exists publishing_orders_touch on publishing_orders;
create trigger publishing_orders_touch before update on publishing_orders
  for each row execute function publishing_touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- 모든 접근은 서버(service role)를 거친다. 익명 클라이언트는 아무것도 못 본다.
-- 원고는 미공개 저작물이고 주문에는 배송지가 들어 있다.
--
-- 정책을 하나도 만들지 않는 것이 의도다. RLS가 켜져 있고 정책이 없으면 anon·
-- authenticated 역할은 전부 거부되고 service role만 통과한다. Supabase advisor가
-- 이를 INFO로 알리지만 여기서는 설계대로다.
alter table publishing_projects enable row level security;
alter table publishing_orders enable row level security;
alter table publishing_webhook_events enable row level security;

-- ── 스토리지 ─────────────────────────────────────────────────────────────
-- 원고·표지 이미지를 담을 비공개 버킷. 공개로 두면 미발표 원고가 노출된다.
insert into storage.buckets (id, name, public, file_size_limit)
values ('publishing-manuscripts', 'publishing-manuscripts', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;
