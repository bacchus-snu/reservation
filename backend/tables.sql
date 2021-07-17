create table rooms (
    id bigserial primary key,
    name text not null unique check (name <> ''),
    seats integer not null,
    category text not null check (category <> ''),
    description text not null
);

create table schedule_groups (
    id bigserial primary key,
    room_id bigint references rooms(id) on delete cascade,
    reservee text not null check (reservee <> ''),
    email text not null check (email <> ''),
    phone_number text not null check (phone_number <> ''),
    reason text not null check (reason <> '')
);

create extension btree_gist;
create table schedules (
    id bigserial primary key,
    schedule_group_id bigint references schedule_groups(id) on delete cascade,
    during tstzrange not null,

    exclude using gist (schedule_group_id with =, during with &&)
);
create index during_idx on schedules using gist (during);
