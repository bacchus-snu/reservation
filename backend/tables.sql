create table if not exists categories (
    id bigserial primary key,
    name text not null unique check (name <> ''),
    description text not null
);

create table if not exists rooms (
    id bigserial primary key,
    name text not null unique check (name <> ''),
    seats integer not null,
    category_id bigint references categories(id) on delete set null
);

create table if not exists schedule_groups (
    id bigserial primary key,
    room_id bigint not null references rooms(id) on delete cascade,
    user_idx bigint not null,
    reservee text not null check (reservee <> ''),
    email text not null check (email <> ''),
    phone_number text not null check (phone_number <> ''),
    reason text not null check (reason <> '')
);

create extension if not exists btree_gist;
create table if not exists schedules (
    id bigserial primary key,
    room_id bigint not null references rooms(id) on delete cascade,
    schedule_group_id bigint not null references schedule_groups(id) on delete cascade,
    during tstzrange not null,

    exclude using gist (room_id with =, during with &&)
);
create index if not exists during_idx on schedules using gist (during);
