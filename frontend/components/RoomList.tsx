import Link from 'next/link';
import * as React from 'react';
import { createContext, useContext } from 'react';
import useSWR from 'swr';

type Response = {
  rooms: ResponseRoom[];
  categories: ResponseCategory[];
};

type ResponseRoom = {
  id: number;
  name: string;
  seats: number;
  categoryId: number;  // -1: no category
};

type ResponseCategory = {
  id: number;
  name: string;
  description: string;
};

export type Category = {
  id: number;
  name: string;
  description: string;
  rooms: Room[];
};

export type Room = {
  id: number;
  name: string;
  seats: number;
};

export type RoomsAndCategories = {
  categories: Category[];
  roomsWithoutCategory: Room[];
};

async function fetcher(key: string): Promise<RoomsAndCategories> {
  const resp = await fetch(key);
  if (resp.status !== 200) {
    throw new Error(`${key} returned status ${resp.status} ${resp.statusText}`);
  }

  const data: Response = await resp.json();
  const categoryMap = new Map<number, Category>(
    data.categories.map(item => [item.id, { ...item, rooms: [] }])
  );
  const roomsWithoutCategory: Room[] = [];

  for (const { id, name, seats, categoryId } of data.rooms) {
    const room = { id, name, seats };
    const category = categoryMap.get(categoryId);
    if (category != null) {
      category.rooms.push(room);
    } else {
      roomsWithoutCategory.push(room);
    }
  }

  return {
    categories: [...categoryMap.values()],
    roomsWithoutCategory,
  };
}

const RoomsContext = createContext<RoomsAndCategories | null>(null);

export function RoomListProvider(props: { children?: React.ReactNode }) {
  const { data = null } = useSWR('/api/rooms/get', fetcher);

  return (
    <RoomsContext.Provider value={data}>
      {props.children}
    </RoomsContext.Provider>
  );
}

export function useRoomList() {
  return useContext(RoomsContext);
}

type Props = {
  className?: string;
  selected?: { type: 'category' | 'room', id: number };
};

export default function RoomList(props: Props) {
  const { className, selected } = props;

  const rooms = useRoomList();
  if (rooms == null) {
    return null;
  }

  const listItems = [];
  for (const category of rooms.categories) {
    const showRoomList = selected != null && (
      (selected.type === 'room' && category.rooms.some(room => room.id === selected.id)) ||
      (selected.type === 'category' && category.id === selected.id)
    );

    if (showRoomList) {
      const rooms = [];
      for (const room of category.rooms) {
        rooms.push(
          <li key={`room-${room.id}`}>
            <Link href={`/room/${room.id}`}>
              <a className="text-blue-500">{room.name}</a>
            </Link>
          </li>
        );
      }
      listItems.push(
        <li key={`cat-${category.id}`}>
          <Link href={`/category/${category.id}`}>
            <a className="text-blue-500">{category.name}</a>
          </Link>
          <ul className="pl-4 list-[circle] list-inside">
            {rooms}
          </ul>
        </li>
      );
    } else {
      listItems.push(
        <li key={`cat-${category.id}`}>
          <Link href={`/category/${category.id}`}>
            <a className="text-blue-500">{category.name}</a>
          </Link>
        </li>
      );
    }
  }
  for (const room of rooms.roomsWithoutCategory) {
    listItems.push(
      <li key={`room-${room.id}`}>
        <Link href={`/room/${room.id}`}>
          <a className="text-blue-500">{room.name}</a>
        </Link>
      </li>
    );
  }

  return (
    <ul className={`list-disc list-inside ${className}`}>{listItems}</ul>
  );
}
