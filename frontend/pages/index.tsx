import Head from 'next/head';

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

      <main className="py-20 space-y-2">
        <div className="flex flex-row justify-between items-baseline">
          <div className="flex flex-row space-x-2">
          </div>
          <div>{loginState}</div>
        </div>
      </main>
    </div>
  );
}
