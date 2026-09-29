# Light Intelligence — Personal AI

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Motion](https://img.shields.io/badge/Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)


> [!CAUTION]
> `© 2026 Lightframe. All Rights Reserved.` <br>
> **이 Repository의 모든 파일은 소중한 개인 저작권의 보호를 받습니다. 무단 복제 및 도용을 금지합니다.** <br>
> **This repository is NOT open source.**

### 개발자 테스트중

`Light Intelligence`는 율의 이름의 뜻이자, 의미있는 별명인 **빛**에서 가져온 이름입니다. 율이 직접 확인한
기억, 취향, 가치관, 목표, 말투와 판단 방식을 연결해 다양한 상황에서 율의 방식으로
함께 생각하는 Personal AI를 실험합니다.
이 프로젝트는 실제 율 본인이 아니며, 율을 완벽하게 대체한다고 주장하지 않습니다.
새로운 Foundation Model을 학습한 제품도 아닙니다. 현재 버전은 Google Gemini의
무료 Tier와 서버 측 System Prompt를 사용하고, 연결할 수 없을 때는 브라우저의
Local Persona Engine으로 안전하게 전환합니다.

## 주요 기능

- Gemini 3.6 Flash 기반 Streaming AI 대화와 Local Persona 자동 Fallback
- 자기 이해, 일상, 취향과 선택, 진로와 성장, 창업, 프로젝트, 관계와 감정,
  개발과 디자인 등 여러 맥락에 대한 율 기반 응답
- 답변에 사용한 Self Model 영역, 판단 기준과 근거 수준 표시
- `율 같음` 답변과 율이 직접 작성한 교정 답변을 검토된 Persona 예시로 저장
- 검토된 예시를 다음 Gemini 대화에 반영하는 율 같음 개선 Loop
- 솔직함, 말 많음, 감정 공감과 디자인 우선 성격 강도 조절
- 대화, 설정과 테마의 브라우저 내 저장
- 검토된 Persona 피드백의 비공개 Vercel Blob 동기화와 안전한 브라우저 임시 보관
- 율과 서비스 정보를 관리하는 Local 위키
- 위키 검색, 분류, 공개 범위와 확인 상태 관리
- 위키 문서 추가, 수정과 삭제
- Dark/Light Mode와 Mobile, Tablet, Desktop 반응형 UI
- Keyboard Focus와 `prefers-reduced-motion` 접근성 대응
- 실제 권율 사칭, 확인되지 않은 기억 생성과 개인정보 추측 방지

## 기술 스택

- **Frontend:** Next.js 16, React 19, TypeScript 5
- **AI:** Vercel AI SDK, Google Gemini 3.6 Flash, Server-side System Prompt
- **UI & Motion:** CSS, Motion, Lucide React
- **Build & Runtime:** Vinext, Vite 8, Cloudflare Workers 호환 Runtime
- **Quality:** ESLint, Node.js Test Runner, TypeScript Type Check
- **Storage:** Vercel Blob (검토된 Persona 피드백), Browser `localStorage` (대화·설정·테마·위키 임시 보관)

## 개인정보 보호 및 보안

- 대화 기록, 설정, 테마와 Local 위키 문서는 사용 중인 브라우저의
  `localStorage`에 저장됩니다.
- Gemini가 설정된 경우 AI 답변을 만들기 위해 현재 대화의 최근 메시지와 표현 강도
  설정을 Google Gemini API로 전송합니다.
- Local 위키는 Gemini에 자동으로 전송하지 않습니다.
- `율 같음` 또는 교정 저장으로 율이 직접 승인한 Persona 예시는 Vercel Blob의
  비공개 저장소에 동기화됩니다. 다음 답변을 만들 때 최근 8개까지 Gemini에 전송되며,
  저장 전 화면에서 질문과 답변을 확인할 수 있습니다.
- Vercel Blob 환경 변수가 연결되지 않은 개발 환경에서는 피드백을 브라우저에 임시 보관하고,
  화면에 서버 동기화가 연결되지 않았음을 표시합니다.
- 위키 문서마다 `나만 보기`와 `친한 사람` 공개 범위를 기록할 수 있습니다.
- Gemini API Key는 Server 환경 변수에서만 읽으며 Client Bundle에 포함하지 않습니다.
- Chat API는 동일 출처 요청만 허용하고, 입력 길이와 최근 대화 수를 제한하며,
  과도한 호출에는 기본 Rate Limit을 적용합니다.
- Google의 무료 Tier 정책상 전송한 콘텐츠가 Google 제품 개선에 사용될 수 있으므로,
  민감한 개인정보나 Secret은 대화에 입력하지 않는 것을 원칙으로 합니다.
- 실제 권율 본인으로 가장하지 않고, 율을 기반으로 만든 AI Persona임을 명확히 밝힙니다.
- 확인되지 않은 기억, 감정, 취향과 개인정보를 사실처럼 생성하지 않습니다.
- 민감한 개인정보 요청에는 답변하지 않으며, 공개된 저장소에 Secret이나 개인 인증
  정보를 Commit하지 않습니다.
- 브라우저에 저장된 데이터는 해당 Site의 저장 공간을 삭제하면 함께 제거됩니다.

  자세한 내용은 [개인정보 보호 및 보안](./SECURITY.md)을 참고하세요.

## 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`의 `GOOGLE_GENERATIVE_AI_API_KEY`에 Google AI Studio에서 발급한 Key를
입력합니다. Key가 없거나 무료 사용량을 초과해도 Local Persona Engine으로 동작합니다.

기기 밖에도 검토된 Persona 피드백을 남기려면 Vercel의 **Storage → Blob**에서 비공개
Store를 연결한 뒤, 생성된 `BLOB_READ_WRITE_TOKEN`을 Vercel 환경 변수와 `.env.local`에
등록합니다. Token은 절대 `NEXT_PUBLIC_` 환경 변수나 Git에 넣지 않습니다.

브라우저에서 출력된 Local URL을 엽니다.

## 검증

```bash
npm run lint
npx tsc --noEmit
npm test
```

## 현재 한계

- Gemini API Key가 없으면 답변은 Local Persona Engine의 규칙 기반 범위로 제한됩니다.
- 무료 Tier의 Rate Limit과 이용 정책은 Google 계정과 지역에 따라 달라질 수 있습니다.
- 위키의 공개 범위는 현재 분류용이며 사용자 인증이나 실제 접근 제어는 아닙니다.
- Local 위키는 현재 브라우저에만 저장되어 다른 기기와 동기화되지 않습니다.
- 검토된 Persona 피드백은 로그인 기능이 없는 현재 단계에서 브라우저가 가진 동기화 식별자로
  분리됩니다. 다른 기기에서 같은 피드백을 안전하게 이어 쓰려면 다음 단계의 계정 연결이 필요합니다.
- Persona 예시는 Foundation Model의 가중치를 학습시키는 방식이 아니라, 다음 요청의
  System Prompt에 검토된 예시로 포함하는 방식입니다.
- 율이 확인하지 않은 모습은 의도적으로 빈칸으로 남깁니다.

다음 버전에서는 교정 데이터를 검토 가능한 Persona 예시로 변환한 뒤, 서버 측
Provider를 통해 원하는 LLM을 선택적으로 연결할 수 있습니다.

## README 유지 원칙

기능, 의존성, 저장 방식 또는 외부 연동이 바뀌면 이 README의 **주요 기능**,
**기술 스택**, **개인정보 보호 및 보안** 항목도 실제 구현과 함께 갱신합니다.
