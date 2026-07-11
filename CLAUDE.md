# 프로젝트 개요
Gemini 기반의 Claude Code 클론 CLI 도구로, 터미널에서 파일 읽기/편집, 명령 실행, 코드 검색, 웹 검색 기능을 제공합니다. Groq 폴백을 지원합니다.

# 주요 기술 스택
-   **언어**: TypeScript
-   **런타임**: Node.js
-   **터미널 UI**: Ink, React
-   **LLM 연동**: Vercel AI SDK (Gemini, Groq)
-   **환경 변수 관리**: dotenv
-   **유틸리티**: zod, fast-glob

# 폴더/파일 구조 요약
-   `dist/`: TypeScript 컴파일 결과물 (JavaScript 파일)
-   `src/`: 프로젝트 소스 코드
    -   `src/cli.tsx`: CLI 애플리케이션의 메인 엔트리 포인트.
    -   `src/commands/`: CLI 명령 관련 로직.
    -   `src/config/`: 환경 설정 및 전역 상태 관리.
    -   `src/context/`: 애플리케이션 컨텍스트 및 상태 관리.
    -   `src/llm/`: LLM (Large Language Model) 클라이언트 및 사용량 추적 로직.
    -   `src/permissions/`: 파일 시스템 접근 권한 및 프롬프트 로직.
    -   `src/session/`: 사용자 세션 관리.
    -   `src/tools/`: 에이전트가 사용하는 파일 시스템, 셸 명령, 웹 검색 등의 도구 구현.
    -   `src/ui/`: 터미널 UI 컴포넌트 및 테마 관련 로직.
-   `demo/`: 데모 및 gif 파일 포함.
-   `package.json`: 프로젝트 메타데이터 및 의존성 관리.
-   `tsconfig.json`: TypeScript 컴파일러 설정.
-   `README.md`: 프로젝트 개요 및 사용법 문서.
-   `pnpm-lock.yaml`, `pnpm-workspace.yaml`: pnpm 패키지 관리 관련 파일.

# 개발 명령
-   `npm run build`: TypeScript 코드를 JavaScript로 컴파일합니다 (`tsc`).
-   `npm run dev`: 개발 모드로 CLI를 실행합니다 (`tsx src/cli.tsx`).
-   `npm run start`: 컴파일된 CLI를 실행합니다 (`node dist/cli.js`).
-   `npm run snake`: `src/snake/cli.tsx` 파일을 실행합니다.
-   `npm run clean`: `dist` 디렉토리를 삭제합니다.

# 코딩 컨벤션 및 주의사항
-   **TypeScript**: `tsconfig.json`에 따라 `ES2022`를 타겟으로 하며, `ESNext` 모듈 시스템과 `react-jsx`를 사용합니다. 엄격한 타입 검사 (`strict: true`)를 따릅니다.
-   **API 키 설정**: `GEMINI_API_KEY`, `GROQ_API_KEY`, `TAVILY_API_KEY`는 `~/.claude/.env` 파일에 설정해야 합니다.
-   **CLI 실행 파일**: `dist/cli.js`가 메인 바이너리 파일입니다.
-   **패키지 관리**: `pnpm`을 사용하여 의존성을 관리하는 것으로 보입니다. (`pnpm install` 권장)
