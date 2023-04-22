import Head from 'next/head';

import RoomList from 'components/RoomList';
import { getPayloadFromToken, useTokenStore } from 'components/Token';

export default function Home() {
  const [tokenState] = useTokenStore();

  const payload = tokenState.token == null ? null : getPayloadFromToken(tokenState.token);
  let loginState: React.ReactNode = null;
  if (tokenState.loading) {
    loginState = '...';
  } else if (tokenState.error) {
    loginState = '에러가 발생했습니다.';
  } else if (payload == null) {
    loginState = (
      <a href="https://id.snucse.org" target="_blank" rel="noopener noreferrer" className="text-blue-500">
        통합계정으로 로그인하세요
      </a>
    );
  } else {
    loginState = `${payload.username}님, 환영합니다.`;
  }

  return (
    <div className="container mx-auto">
      <Head>
        <title>강의실 예약 시스템</title>
        <meta name="description" content="Room reservation system" />
      </Head>

      <main className="px-8 py-16 space-y-4">
        <div>{loginState}</div>
        <div className="flex flex-col-reverse lg:flex-row">
          <section className="flex-none lg:flex-1">
            <h1 className="text-xl font-bold">강의실 예약 시스템</h1>
            <p>
              여기에 설명 입력
            </p>
          </section>
          <RoomList className="mb-4 lg:mb-0 lg:ml-8 lg:w-1/4 flex-none" />
        </div>
      </main>
    </div>
  );
}
